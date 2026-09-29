# BandFlow BLE Bridge API v1

This contract is the compatibility boundary between the Node API repository and
the `naprock` BLE repository. The app repository owns users, tasks, subtasks,
progress, and synchronization records. The BLE repository owns the BLE
connection and transport queue.

## Dispatch: Node → Flask

```http
POST /v1/dispatch
Content-Type: application/json
X-BandFlow-Token: <shared-secret>
X-BandFlow-Bridge-Version: v1
```

```json
{
  "event_id": "stable-or-unique-dispatch-id",
  "task_id": "task-id",
  "subtask_id": "subtask-id",
  "text": "Inspect the installation area"
}
```

Flask stores the current assignment, sends `text` to the wristband, and returns
`200` only when the write succeeds:

```json
{
  "status": "sent",
  "task_id": "task-id",
  "subtask_id": "subtask-id",
  "bridge_api_version": "v1"
}
```

`503` means the assignment was not sent because BLE is unavailable. Node keeps
the assignment in its database and may retry it.

## Completion event: Flask → Node

```http
POST /internal/ble/events
Content-Type: application/json
X-BandFlow-Token: <shared-secret>
X-BandFlow-Bridge-Version: v1
```

```json
{
  "event_id": "unique-device-event-id",
  "task_id": "task-id",
  "subtask_id": "subtask-id",
  "event_type": "subtask_completed",
  "created_at": "2026-09-29T12:00:00+00:00",
  "payload": {
    "source": "wristband"
  }
}
```

Node acknowledges duplicate `event_id` values without applying the completion
twice. For a newly completed subtask, Node updates progress, finds the next
dependency-ready subtask, and dispatches it through `/v1/dispatch`.

## Health

Flask exposes `GET /v1/health` and returns the bridge version and connection
state. The legacy `POST /task` endpoint remains available for manual testing,
but production traffic must use the v1 contract.

## Compatibility rule

Changes to request fields, response fields, event types, or endpoint behavior
require a new contract version. The root repository pins a tested `naprock`
commit; update that pin only after the compatibility checks pass.
