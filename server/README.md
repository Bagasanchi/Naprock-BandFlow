# BandFlow SQLite server

This server is the shared backend for the Expo app and the cloned BandFlow SQLite database. Run it with Node.js 22.13 or newer.

```bash
node server/index.mjs
```

Optional environment variables:

```bash
PORT=8787
DATABASE_PATH=/var/lib/bandflow/bandflow.db
BLE_BRIDGE_URL=http://127.0.0.1:5000/task
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

By default, the API opens the project-root `naprock/bandflow.db` regardless of the directory used to start it. The Python BLE service uses the same file. Set `DATABASE_PATH` or `BAND_FLOW_DB_PATH` when deploying elsewhere, and use the same path for both services.

The API provides:

- `POST /auth/signup`
- `POST /auth/login`
- `GET /workers`
- `PATCH /workers/:id` (boss only; status: `active`, `away`, or `offline`)
- `GET /work`
- `POST /work`
- `PATCH /work/:id` (assigned worker or boss; status: `In Progress`, `Review`, or `Done`)
- `DELETE /work/:id` (boss only)

When `POST /work` succeeds, the Node API forwards the first subtask to the Pi's Flask BLE bridge at `BLE_BRIDGE_URL`. If there are no subtasks, it forwards the work title. The work item is still saved when the bridge is offline; the response includes `band.sent: false` and the bridge error so the Pi operator can reconnect BLE without losing the assignment.

## Safe startup

This sequence keeps the existing SQLite data and works after moving to another Wi-Fi network:

1. On the Pi, connect it to the new Wi-Fi and confirm its hostname resolves:

	```bash
	ping -c 1 bandflow.local
	```

2. On the Pi, start the BLE bridge from the project directory:

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

6. Log in with any existing account, or use **Create account** first. Do not delete `naprock/bandflow.db` during startup.

New signups are workers by default. To create the first boss account, insert one directly on the Pi after creating the account:

```bash
node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync('data/bandflow.sqlite'); db.prepare(\"UPDATE users SET role = 'boss' WHERE email = ?\").run('boss@example.com');"
```

Back up the database regularly:

```bash
cp data/bandflow.sqlite data/bandflow.sqlite.backup
```
