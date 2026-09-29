# BandFlow workspaces

The repositories are now independent:

```text
D:\Baga Codes and Stuff\
├── Naprock-BandFlow\   Expo app, Node API, and canonical SQLite database
├── naprock\            Flask BLE bridge and ESP32 firmware
└── BandFlow-Web\       React + Vite website (uses this repo's Node API)
```

Open all folders together with `D:\Baga Codes and Stuff\Naprock-BandFlow.code-workspace`.

The website has no database of its own; it calls the same Node API as the phone
app. See `BandFlow-Web/README.md` for how to start it.

The app workspace does not track the bridge repository as a submodule. The
repositories communicate through the v1 contract in `contracts/ble-bridge-v1.md`.

`naprock` tracks the shared repository directly
(`origin` = <https://github.com/Tuvshu0-coder/naprock>).

To pull teammates' changes safely:

```powershell
npm run sync:naprock
```

This pulls `origin/main` into the sibling `naprock` workspace (rebasing any
unpushed local commits on top) and refuses to run while it has uncommitted
changes. Push your own `naprock` commits with `git push` from that folder.
