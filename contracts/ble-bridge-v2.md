# BandFlow BLE Bridge API v2

v2 keeps everything in [v1](ble-bridge-v1.md) and adds the wristband session: the watch is linked to a
worker's account, and it loads the priority matrix, works and tasks through the bridge. Both sides
accept `X-BandFlow-Bridge-Version: v1` or `v2`; Node sends `v2`.

## Changes to v1 endpoints

`POST /v1/dispatch` gains an optional field:

```json
{ "band_id": "aa:bb:cc:dd:ee:01" }
```

Node sends the band linked to the worker the step is assigned to. The bridge answers `409` when that is
not the band it is connected to, and `503` when it is not connected to any band. Node no longer
dispatches at all to a worker who has no linked band.

`GET /v1/health` also returns `band_id` (the connected band's BLE address, lower case, or `null`).

## Linking a watch to an account

1. The watch asks for a code (`pair`). Node creates a 6-digit code valid for 5 minutes and ties it to the
   band's id.
2. The worker enters the code in the app (`Settings > Wristband`): `POST /band/link {"code": "123456"}`
   with their session token. Node stores `band_id -> user`. One worker has one band and a band has one
   worker; linking again replaces the old link.
3. The watch polls `link_status` every two seconds and moves on when it reports `linked`.

Only workers can link. A user may make 5 wrong attempts per 10 minutes, because whoever enters a valid
code takes over that watch. `DELETE /band/link` (app) or `unlink` (watch) removes the link.

App endpoints (session token required): `GET /band/link`, `POST /band/link`, `DELETE /band/link`,
`DELETE /work/:workId/subtasks/:subtaskId`.

## Session channel (BLE)

Same service as v1, two more characteristics:

| Characteristic | UUID | Direction | Properties |
| --- | --- | --- | --- |
| `RPC_RX` | `12345678-1234-1234-1234-1234567890ae` | bridge → watch | write |
| `RPC_TX` | `12345678-1234-1234-1234-1234567890af` | watch → bridge | notify |

Each message is one line of UTF-8 JSON ending in `\n`, split into chunks that fit the negotiated MTU
(at least 20 bytes). The receiver joins chunks until the newline. The bridge subscribes to `RPC_TX` and then
writes `{"t":"hello"}` so the watch knows it can start asking.

### Watch → bridge → Node

The bridge removes `id`, posts `{"band_id": "<ble address>", "request": {...}}` to
`POST /internal/band/rpc` (shared-secret headers as in v1), and writes Node's reply back with the same `id`.
Replies are `{"ok": true, ...}` or `{"ok": false, "error": "..."}`. `error: "not_linked"` means the band
has no account and the watch returns to its pairing screen.

| `t` | Extra fields | Reply |
| --- | --- | --- |
| `status`, `link_status` | | `linked`, `name` |
| `pair` | | `linked: false`, `code`, `ttl` (seconds) |
| `unlink` | | `linked: false` |
| `matrix` | | `counts: {do_first, schedule, delegate, eliminate}` |
| `works` | `cat` | `cat`, `more`, `works: [{id, title, p, pr, due}]` (at most 12) |
| `subtasks` | `work` | `work: {id, title, progress}`, `subtasks: [{id, d, s}]` with `s` = `d`one / `a`ctive / `p`ending |
| `remove` | `work`, `sub` | as `subtasks`, plus `clear_step` |

Only active works (not `Done`) assigned to the linked worker are returned. Text is cut to fit and uses
`...` because the watch font is ASCII only.

### Quadrants

Works use their stored `eisenhower_category` (set by the optional AI classifier). Without one, rules
decide: urgent means due within two days or overdue; important means priority above Low.

| | Urgent | Not urgent |
| --- | --- | --- |
| Important | `do_first` | `schedule` |
| Not important | `delegate` | `eliminate` |

### Removing a task

`remove` deletes one subtask. A work must keep at least one. If the removed task was the active one, the
next ready task becomes active and is dispatched to the band; if none is ready, `clear_step` is `true`.

## Compatibility rule

Unchanged from v1: changes to request fields, response fields, event types, or endpoint behavior require a
new contract version.
