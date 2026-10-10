# BandFlow Node server

This server is the primary application backend and database owner for the Expo app. Run it with Node.js 22.13 or newer.

```bash
node server/index.mjs
```

Environment variables:

```bash
PORT=8787
DATABASE_PATH=/var/lib/bandflow/bandflow.sqlite
BLE_BRIDGE_URL=http://127.0.0.1:5000/v1/dispatch
BLE_INTERNAL_TOKEN=replace-with-a-shared-secret
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=
WORKLOAD_BUSY_AT=5
WORKLOAD_OVERLOADED_AT=7
MATRIX_REFRESH_MS=600000
```

The server reads these from its environment. To keep them in a file, start it with
`node --env-file=.env server/index.mjs`; in PowerShell a single value can be set with
`$env:AI_API_KEY = "..."` before `npm run server`.

The server already listens on `0.0.0.0`, so the Pi can receive its address from DHCP. Give the Pi a stable hostname once, then use mDNS instead of its changing LAN address:

```bash
sudo hostnamectl set-hostname bandflow
sudo apt install avahi-daemon
sudo systemctl enable --now avahi-daemon
```

The Expo app should point to the hostname in `.env`:

```env
EXPO_PUBLIC_API_URL=http://bandflow.local:8787
```

Keep the phone and Pi on the same LAN. Do not use `127.0.0.1` on a physical phone; that points to the phone itself. If a network does not support mDNS, use the Pi's current DHCP address only for that network.

By default, the API opens the app workspace's `data/bandflow.sqlite` regardless of the directory used to start it. The Flask BLE service does not open SQLite or create task records. Set `DATABASE_PATH` when deploying elsewhere.

The Node server owns these application tables:

- `users` and `sessions`
- `tasks` and `subtasks`
- `sync_events`
- `voice_records`

The existing `work_items` table is migrated automatically on startup so current accounts and assignments are preserved. New API writes use `tasks` and `subtasks`; the legacy table is no longer used as an application source of truth.

The API provides:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/forgot` (records a worker's password-reset request for their boss)
- `GET /me`, `PATCH /me` (own profile), `POST /me/password` (change own password)
- `GET /workers` (boss only; each worker with `skills`, `open_works` and `workload`)
- `PATCH /workers/:id` (boss only; `status`: `active`, `away`, or `offline`, and/or `skills`: a list of tags)
- `POST /workers/:id/password` (boss only; sets a temporary password and signs the worker out)
- `GET /work`
- `POST /work`
- `POST /work/recommend` (boss only; ranks the workers for a described work)
- `POST /work/:id/breakdown` (assigned worker or boss; the AI rewrites the steps that are not done)
- `PATCH /work/:id` (assigned worker or boss; status: `In Progress`, `Review`, or `Done`)
- `DELETE /work/:id` (boss only)
- `POST /internal/ble/events` (Flask bridge only; idempotent completion events)
- `POST /voice/records` (authenticated voice-record metadata)

When `POST /work` succeeds, the Node API validates the structured subtask response, stores the task and subtasks in one transaction, marks the first ready subtask active, and forwards it to the Flask BLE bridge. If the bridge is offline, the work remains saved and the response includes `band.sent: false`. When Flask later sends a `subtask_completed` event, Node marks it done, calculates progress, selects the next dependency-ready subtask, and dispatches it.

## AI layer

Three of the four AI functions run here (the fourth, speech-to-text for the watch, runs in the BLE bridge).
They are prompts, not trained models, and they are sent to whichever chat service you configure. Any service
with the OpenAI-style `POST <base>/chat/completions` API works:

| Service | Settings |
| --- | --- |
| OpenAI | `AI_API_KEY=sk-...` (model defaults to `gpt-4o-mini`; `OPENAI_API_KEY` is also accepted) |
| Ollama on the same machine (free, no key) | `AI_BASE_URL=http://127.0.0.1:11434/v1` and `AI_MODEL=llama3.2` |
| Anything else (Groq, OpenRouter, LM Studio, ...) | `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` from that service |

The server prints `AI: <model> at <url>` or `AI: off (...)` when it starts, and `GET /health` returns `ai: true|false`.

| Function | What the AI does | Without AI, or when its answer is invalid |
| --- | --- | --- |
| Priority matrix | Places each work in `do_first` / `schedule` / `delegate` / `eliminate` and writes one sentence saying why, for a new work and again once a day for every open work (many works per request). | Rules: urgent = due within 2 days or overdue; important = priority above Low. |
| Task breakdown | Turns a work without steps into ordered steps (short, plain ASCII for the watch); a step may depend on one earlier step and stays locked until it is done. | The steps the boss typed, else one step made from the title. **Break Down** in the app retries later. |
| Worker recommendation | Names the skills a described work needs. | Keyword match of the work text against the team's skill tags. |

Every answer is checked before anything is saved (see `server/ai.mjs`); a bad answer is logged and the
fallback is used, so creating work never fails because of the AI. The score of a recommendation is plain
arithmetic on skills and open works (`server/recommend.mjs`, formula in `contracts/ble-bridge-v3.md`).

`WORKLOAD_BUSY_AT` and `WORKLOAD_OVERLOADED_AT` set how many open works make a worker Busy and Overloaded.

`MATRIX_REFRESH_MS` is how often the server looks for open works the AI has not classified today (the matrix
depends on the date). The default is 10 minutes; each round is one request for up to 20 works, and nothing is
sent when every work is already up to date.

`AI_BREAKDOWN_URL` and `AI_CLASSIFICATION_URL` (with `..._TOKEN`) are still honoured for a service of your own that returns the finished structure: the first receives `{ title, priority, due, subtasks }` and must return `{ title, subtasks: [{ description, order_index, depends_on_order_index }] }`; the second receives `{ title, priority, due }` and must return `{ category }`. When set, they replace the prompt for that function; the same validation and fallbacks apply.

## Tests

```bash
npm test
```

runs the scoring and validation tests and an end-to-end test that starts the server on a throwaway database
with a stand-in AI service (good answers, garbage, and unreachable).

## Demo data for screenshots

```bash
npm run server:demo
```

serves a **separate** database (`data/demo.sqlite`, not in git) with three made-up workers, and prints a
one-time login for a demo boss. For the work "Design the new menu card" the Smart assignment screen shows
Haruka (Design, 2 open works, 94%, Recommended), Sara (Design, 7 open, 58%, High workload) and Kenji
(Programming, 1 open, 31%, Skill mismatch). Every start resets the demo people; the real database is never
touched, and demo workers cannot log in. Stop the normal server first: both use the same port.

## Safe startup

This sequence keeps the existing SQLite data and works after moving to another Wi-Fi network:

1. On the Pi, connect it to the new Wi-Fi and confirm its hostname resolves:

	```bash
	ping -c 1 bandflow.local
	```

2. Configure the shared `BLE_INTERNAL_TOKEN` for both services. Configure `NODE_EVENT_URL`, `BLE_EVENT_QUEUE_PATH`, and `BLE_ASSIGNMENT_STATE_PATH` for Flask, then start the BLE bridge from the project directory:

	```bash
	python3 naprock/app.py
	```

3. In a second Pi terminal, start the Node API:

	```bash
	node server/index.mjs
	```

4. From the phone or another device on the same Wi-Fi, open `http://bandflow.local:8787/health`. It must return `{"ok":true}`.

5. On the development computer, restart Expo so it reloads `.env`:

	```powershell
	npm run start:clean
	```

6. Log in with any existing account, or use **Create account** first. Do not delete `data/bandflow.sqlite` during startup.

Flask stores only its durable BLE event queue and current assignment state in the paths configured by `BLE_EVENT_QUEUE_PATH` and `BLE_ASSIGNMENT_STATE_PATH`. These are transport state, not a second task database.

New signups are workers by default. To create the first boss account, insert one directly on the Pi after creating the account:

```bash
node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync('data/bandflow.sqlite'); db.prepare(\"UPDATE users SET role = 'boss' WHERE email = ?\").run('boss@example.com');"
```

Passwords are stored only as salted scrypt hashes and cannot be read back. To reset any account's password (for example a boss who forgot theirs), run this on the computer that has the database:

```bash
npm run reset-password -- boss@example.com NewPassword123
```

It signs that account out everywhere. Workers can instead use **Forgot password?** in the app; their boss then sets a temporary password from **Manage Workers**.

Back up the Node-owned database regularly:

```bash
cp data/bandflow.sqlite data/bandflow.sqlite.backup
```
