# BandFlow BLE Bridge API v3

v3 keeps everything in [v2](ble-bridge-v2.md) and adds what the AI layer needs: every work has a stored
matrix category, steps can be locked behind a prerequisite, and voice errors carry a code. Both sides accept
`X-BandFlow-Bridge-Version: v1`, `v2` or `v3`; Node and the bridge send `v3`. Deploy the Node server and the
bridge together: a v2 bridge answers `426` to a v3 dispatch.

Nothing was removed, so a watch with v2 firmware keeps working (it shows a locked step like a pending one).

## Quadrants: one category for the app and the watch

Every work now has a stored `eisenhower_category` and an `eisenhower_source`:

| Source | Set when | Later changes |
| --- | --- | --- |
| `ai` | The AI's answer for the work held up (see "Priority matrix classifier" below), when the work was created or in the daily refresh. | A deadline that comes within two days (or passes) raises urgency at once: `schedule` becomes `do_first`, `eliminate` becomes `delegate`. The AI is asked again the next day. |
| `rules` | No AI is configured, it could not be reached, or its answer for this work was refused. | Recomputed from priority and due date whenever the work is read, so it follows the calendar. |
| `manual` | The caller sent `eisenhowerCategory` to `POST /work`. | Never. |

The rules are unchanged from v2: urgent means due within two days or overdue; important means priority above
Low. `matrix` and `works` (watch) and `GET /work` (app, fields `eisenhower_category` and `eisenhower_source`)
all read the category through the same function, so a work is always in the same quadrant on both screens.
A work that is `Done` keeps the category it finished with.

`GET /work` and the answer to `POST /work` also carry the sentence that explains the quadrant:

| Field | Meaning |
| --- | --- |
| `eisenhower_reason` | One short sentence, or `null` for a `manual` category. |
| `eisenhower_reason_by` | Who wrote that sentence: `ai` or `rules`. It is `rules` even for an `ai` category on any day the AI has not been asked yet, so a client never credits the AI with a sentence it did not write. |

These are additions to the app's API only. Nothing the bridge or the watch sends or receives has changed.

### Priority matrix classifier

One request classifies any number of works. The system prompt is in `server/ai.mjs`; the user message and the
expected answer are:

```json
{ "today": "2026-10-10", "items": [ { "id": "w1", "title": "Fix the gas leak", "priority": "High", "due_date": "2026-10-11" } ] }
```

```json
{ "items": [ { "id": "w1", "urgent": true, "important": true, "quadrant": "do_first", "reason": "Due tomorrow and high priority." } ] }
```

`priority` is `Low`, `Medium`, `High`, `Critical` or `null`; `due_date` is `null` for work with no due date.
The definitions are exact (urgent = due within 2 days or overdue; important = priority above Low), so the server
checks each answered item against them and refuses, item by item:

- an item that is missing, repeated, or whose `urgent` / `important` are not booleans;
- a `quadrant` that is not one of the four or does not follow from its own `urgent` and `important`;
- `urgent` that contradicts the due date, or `important` that contradicts a given priority (only a `null`
  priority leaves importance to the AI, which then judges from the title);
- a `reason` that is missing, empty, or longer than 120 characters.

A refused item is placed by the rules; the other items of the same request are kept. Items the AI adds on its
own are ignored.

The matrix depends on the date, so the server asks again once a day: every open work that has not been checked
today goes to the AI in requests of up to 20 (at start-up and then every `MATRIX_REFRESH_MS`, 10 minutes by
default). Reading work never waits for this. A work whose answer was refused is not asked about again that day;
a work the AI could not be reached for is tried on the next round.

## Locked steps

A step may depend on at most one **earlier** step of the same work. Until that step is done:

- the step is never sent to the watch;
- `subtasks`, `remove` and `add` replies report it with `s: "l"` (new) instead of `"p"`;
- `GET /work` reports it with `locked: true` in `subtask_details`;
- `PATCH /work/:workId/subtasks/:subtaskId {"done": true}` answers `409` with the name of the step to finish first.

`s` is now one of `d`one / `a`ctive / `p`ending / `l`ocked.

## Voice input

Unchanged packets. The transcript line gains `code` when `ok` is `false`, and `text` is always plain ASCII
(curly quotes, dashes and accents are replaced) and at most 120 characters:

```json
{"t": "transcript", "sid": 7, "ok": false, "code": "silence", "error": "I did not hear any words. Try again, closer to the mic."}
```

| `code` | Meaning |
| --- | --- |
| `too_short`, `too_long` | The recording is under 0.4 s or over 15 s, or the text is over 120 characters. |
| `bad_format`, `audio_lost` | The audio could not be decoded, or packets were missing. |
| `silence` | The speech service returned no words. (The watch itself also refuses a recording with no sound in it before sending.) |
| `unclear` | The speech service returned a stock phrase, an echo of its prompt, or text the watch cannot show. |
| `stt_not_configured` | No `OPENAI_API_KEY` and no local `WHISPER_URL`. |
| `stt_unreachable` | The speech service could not be reached. |
| `stt_error` | The speech service answered with an error; its message is included. |

The watch shows `error` as it is; `code` is for logs and for clients that want their own wording.

### Repairing lost audio packets

Bluetooth notifications are not acknowledged, so a few audio packets can go missing. When the end packet arrives
and some data packets are missing, the bridge keeps what it has and writes this line to `RPC_RX` instead of failing:

```json
{"t": "audio_resend", "sid": 7, "missing": [12, 40, 41]}
```

The watch sends only those data packets again, with their original sequence numbers and the same packet size, and
then sends the end packet again. This repeats for at most 4 rounds, and only while at most 40 packets are missing;
a packet that arrives twice counts once. If the repair is not possible (too many packets missing, the start packet
never arrived, or a packet never gets through), the bridge answers with the `audio_lost` transcript error and the
watch sends the whole recording again under a new session number, at most 3 times in all.

Watch firmware older than this change ignores `audio_resend` and would wait for a transcript that never comes, so
the firmware and the bridge need to be updated together.

## AI functions (Node)

All four are prompts sent to one configurable chat service (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`; see
`server/README.md`). Every answer is checked before anything is saved, and each has a rule to fall back on:

| Function | AI answer that is accepted | Fallback |
| --- | --- | --- |
| Priority matrix | For each work sent: `urgent`, `important`, the `quadrant` that follows from them, and a short `reason`, all consistent with the due date and priority (see "Priority matrix classifier"). | The rules above, work by work. |
| Task breakdown | 1 to 12 steps numbered from 1; each at most 80 plain ASCII characters; `depends_on` is `null` or an earlier step's number. | The steps the boss typed, else one step made from the title. |
| Voice task adder | See "Voice input" (speech-to-text runs in the bridge). | An error on the watch; nothing is added. |
| Worker recommendation | A list of at most 5 short skill names. | The team's skill tags whose words appear in the work text. |

## App endpoints added in v3

Session token required.

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `POST /work/recommend {"text": "..."}` | boss | Ranks every worker for the described work. |
| `POST /work/:workId/breakdown` | boss or the assigned worker | The AI rewrites the steps that are not done. `503` without AI, `502` when its answer is unusable; the work is left unchanged in both cases. |
| `PATCH /workers/:id {"skills": [...]}` | boss | Replaces a worker's skill tags (`status` can be sent alone, as before). |
| `PATCH /me {"skills": [...]}` | anyone | Replaces your own skill tags. |

`GET /workers` rows gain `skills`, `open_works` and `workload: {open, level, busy_at, overloaded_at}`.
`POST /work` replies gain `ai: {breakdown, category}` saying where the steps (`ai`, `manual`, `fallback`) and
the category (`ai`, `rules`, `manual`) came from. Skills are up to 12 tags of up to 24 characters.

### Recommendation

```json
{
  "required_skills": ["Design"],
  "source": "ai",
  "workload_limits": { "busy_at": 5, "overloaded_at": 7 },
  "recommendations": [
    {
      "worker_id": "…", "name": "Haruka", "score": 94, "skill_match": 1, "open_works": 2, "status": "active",
      "reason": "Has Design; 2 open works", "skills": ["Design"], "matched_skills": ["Design"],
      "workload": { "open": 2, "level": "light", "busy_at": 5, "overloaded_at": 7 },
      "badges": ["recommended"]
    }
  ]
}
```

`source` is `ai`, `keywords` (the fallback) or `none` (empty text: ranked by workload alone, no AI call).
The AI only names the skills; the score is arithmetic, so the same inputs always give the same ranking:

```text
score = 66 × skill_match + 34 − workload cost − status cost        (kept within 0–100, rounded)

skill_match   = needed skills the worker has ÷ needed skills (1 when the work needs no particular skill)
workload cost = 3 per open work below the Busy threshold, 10 per open work from the Busy threshold on
status cost   = 0 active, 15 away, 30 offline
```

Open works are the works assigned to the worker that are not `Done`. Levels: Light below `WORKLOAD_BUSY_AT`
(default 5), Busy from there, Overloaded from `WORKLOAD_OVERLOADED_AT` (default 7). Skills match regardless of
letter case and word form ("Design" = "designer"). Ranking is by score, then fewer open works, then name.

Badges: `recommended` (ranked first and has at least one needed skill), `skill_mismatch` (has none of them),
`high_workload` (Overloaded), `away`, `offline`. They are advice: any worker can still be assigned.

## Compatibility rule

Unchanged: changes to request fields, response fields, event types, or endpoint behavior require a new
contract version.
