# BandFlow SQLite server

This server is the shared backend for the Expo app. Run it on the Raspberry Pi with Node.js 22.13 or newer.

```bash
node server/index.mjs
```

Optional environment variables:

```bash
PORT=8787
DATABASE_PATH=/var/lib/bandflow/bandflow.sqlite
```

The Expo app must point to the Pi's LAN address in `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:8787
```

Do not use `127.0.0.1` on a physical phone; that points to the phone itself. Use the Pi's local network address.

The API creates `data/bandflow.sqlite` automatically and provides:

- `POST /auth/signup`
- `POST /auth/login`
- `GET /workers`
- `GET /work`
- `POST /work`

New signups are workers by default. To create the first boss account, insert one directly on the Pi after creating the account:

```bash
node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync('data/bandflow.sqlite'); db.prepare(\"UPDATE users SET role = 'boss' WHERE email = ?\").run('boss@example.com');"
```

Back up the database regularly:

```bash
cp data/bandflow.sqlite data/bandflow.sqlite.backup
```
