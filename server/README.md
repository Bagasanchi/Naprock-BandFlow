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
AI_BREAKDOWN_URL=
AI_BREAKDOWN_TOKEN=
AI_CLASSIFICATION_URL=
AI_CLASSIFICATION_TOKEN=
```

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
- `GET /workers`
- `PATCH /workers/:id` (boss only; status: `active`, `away`, or `offline`)
- `GET /work`
- `POST /work`
- `PATCH /work/:id` (assigned worker or boss; status: `In Progress`, `Review`, or `Done`)
- `DELETE /work/:id` (boss only)
- `POST /internal/ble/events` (Flask bridge only; idempotent completion events)
- `POST /voice/records` (authenticated voice-record metadata)

When `POST /work` succeeds, the Node API validates the structured subtask response, stores the task and subtasks in one transaction, marks the first ready subtask active, and forwards it to the Flask BLE bridge. If the bridge is offline, the work remains saved and the response includes `band.sent: false`. When Flask later sends a `subtask_completed` event, Node marks it done, calculates progress, selects the next dependency-ready subtask, and dispatches it.

The optional AI services are provider-neutral. `AI_BREAKDOWN_URL` receives `{ title, priority, due, subtasks }` and must return `{ title, subtasks: [{ description, order_index, depends_on_order_index }] }`. `AI_CLASSIFICATION_URL` receives `{ title, priority, due }` and must return `{ category }`, where the category is one of `do_first`, `schedule`, `delegate`, or `eliminate`. Every response is validated before database writes. If no breakdown URL is configured, the server uses the subtasks supplied by the app, or creates one structured subtask from the title.

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

Back up the Node-owned database regularly:

```bash
cp data/bandflow.sqlite data/bandflow.sqlite.backup
```
