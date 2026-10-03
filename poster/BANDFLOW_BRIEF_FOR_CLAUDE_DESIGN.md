# BandFlow: current-state brief for the poster (paste this whole file into the Claude design chat)

**Instruction for the designer chat.** Keep the layout, visual style and panel structure of the attached poster
(`BandFlow_A0_poster_EN.pdf`: purple header with the wristband loop diagram, numbered cards, chips, dark
code box, screenshot strips). **Replace its content with the facts below.** Where the attached poster
disagrees with this brief, this brief wins. Do not add features that are not listed here.

## 1. One-paragraph summary
BandFlow delivers work to a wristband one step at a time. A boss creates a piece of work in the phone
app or web dashboard. It is split into ordered steps with optional dependencies. Only the current step is
sent over Bluetooth Low Energy to the wristband of the assigned worker. The worker taps DONE on the
band (or ticks the step in the app). The server saves progress, unlocks the next step and sends it.
The boss sees progress update live.

## 2. Users (only two roles exist)
- **Boss:** creates work (title, priority Low/Medium/High, due date, optional steps); picks one worker or several
  (each worker gets their own copy of the work with their own steps); sees team progress by status and worker status
  (active/away/offline); deletes work or a single step; sets a temporary password for a worker who forgot theirs.
- **Worker:** sees assigned work and each step's status; ticks steps in the app; links a wristband with a 6-digit
  code (Settings > Wristband); on the band can browse the matrix, works and steps, tap DONE, remove a step,
  unlink; edits profile and password.

## 3. Hardware (final design)
- **Wristband:** ESP32-S3 with a 320x170 touchscreen, electret microphone capsule (with preamp),
  vibration motor, rechargeable battery with charger module, Bluetooth LE.
- **Raspberry Pi 4 (4 GB):** runs the Node API, the SQLite database and the Flask BLE bridge on the local Wi-Fi network.
- **Not used (do not draw or mention):** HDMI monitor, USB speaker, USB microphone, GPIO button,
  text-to-speech, spoken announcements.

## 4. Software
- Mobile app: Expo / React Native (TypeScript), boss and worker screens, light/dark theme.
- Web dashboard: React + Vite, uses the same API as the app (no database of its own).
- Backend: Node.js API (accounts, sessions, work, steps, dependencies, progress, priority matrix, pairing, voice
  records). SQLite is the single source of truth.
- BLE bridge: Python + Flask + Bleak. Keeps the BLE connection, reconnects, keeps a durable event queue.
  Versioned contract (v1, v2) between Node and the bridge.
- Wristband firmware: Arduino C++ with LVGL (UI), NimBLE (Bluetooth), ArduinoJson.
- AI (optional): provider-neutral HTTP hooks. One returns ordered steps with dependencies, one classifies
  priority. The server validates every reply (rejects invalid steps and circular dependencies) before saving.
  If no AI service is connected, steps typed by the boss are used, or one step from the title. **Do not name a model or vendor.**
- Whisper speech-to-text API for voice entry (needs internet).

## 5. Architecture (draw this)
Phone app and web dashboard --HTTP--> Raspberry Pi hub [Node API + SQLite + Flask BLE bridge] --Bluetooth LE-->
ESP32-S3 wristband. Node calls the optional AI service and the Whisper API over the internet only when needed.
Everything else runs on the local network. Completion (DONE) events travel back: band -> bridge -> Node
(idempotent, so duplicates are ignored).

AI reply format shown in the code box:
`{ "title": "...", "subtasks": [ { "description": "...", "order_index": 1, "depends_on_order_index": null } ] }`

## 6. Core loop (6 steps)
1 Assign (boss creates work, picks worker) -> 2 Break down (ordered steps with prerequisites, validated) ->
3 Queue (first ready step becomes active, dependent steps stay locked) -> 4 Deliver (sent over Bluetooth to the
worker's linked band; it vibrates and shows the step) -> 5 Confirm (tap DONE on the band, or tick in the app) ->
6 Advance (save progress, unlock and send the next step, update dashboard). Steps 4-6 repeat until all steps are done.
Neutral example: "Install electrical equipment": Inspect the installation area, Prepare the required tools,
Run the cable, Fit the equipment, Test the circuit, Record the result.

## 7. Wristband screens (from the firmware)
Pairing (6-digit code, valid 5 minutes, enter it in the app) -> Priority matrix (counts per quadrant) ->
Works list per quadrant (max 12) -> Steps of one work (done / active / pending) -> Current step with a step timer
and a DONE button. Confirmation dialogs for removing a step and unlinking. Text is ASCII only on the band.

## 8. Priority matrix (Eisenhower)
Quadrants: DO FIRST (important, urgent), SCHEDULE (important, not urgent), DELEGATE (not important, urgent),
ELIMINATE (not important, not urgent). Set by the optional AI classifier, otherwise by rules:
urgent = due within 2 days or overdue; important = priority above Low. Shown in the app and on the band.

## 9. Dependency locking
Each step may depend on one earlier step of the same work. Only the active step is sent to the band; a step unlocks
when its prerequisite is done; circular dependencies are rejected. Work assigned to several workers is copied per worker;
there is **no** locking between different workers.

## 10. What makes it different (only these)
Wristband as the work interface (one step at a time, tap to confirm) - account-linked band (pairing code, steps go only
to that worker's band) - dependency-aware step queue - priority matrix on the wrist - voice task entry - offline-tolerant
(work is saved if the band is away; events are queued and de-duplicated) - accounts and roles - one backend shared by app and web.

## 11. Voice task entry (final hardware stage, not finished)
Speak (electret mic on the ESP32-S3 records a short clip) -> send over Bluetooth to the Raspberry Pi ->
Pi sends audio to the Whisper API and gets text -> text returns to the band screen to confirm ->
Node saves the task, steps are built, first step is dispatched.

## 12. Status (be honest on the poster)
- **Built (in the code):** accounts and roles, work/steps/dependencies, progress, step delivery and DONE over Bluetooth,
  band pairing, priority matrix, app/web/wristband screens, event queue.
- **In progress:** voice task entry, vibration alerts, battery and charging, connecting an AI service.
- **No measured results yet** (no timing, battery life or user-test numbers). Do not invent any.
- Keep a small status line such as: "Work in progress: voice entry and vibration alerts are in hardware assembly;
  no measured results yet."

## 13. Remove from the old poster (these are NOT part of the current design)
"AI breaks work into 3-8 subtasks"; "role / difficulty tags"; workload gauge and overload prevention; role-based or
AI auto-assignment (assignment is manual); progress nudge to teammates; cross-teammate dependency locking
(the Haruka/Kenji example); text-to-speech speaker; USB microphone; GPIO button; HDMI dashboard monitor;
Claude/OpenAI as named AI vendors; the "Flask server & API owns the database" box (Node owns it);
Python/Flask as the main stack; the hospital/kitchen/farm/factory/office scenario cards and the "Launch a new
seasonal menu" example; the Trello/Asana/Monday comparison table and the "Expected benefits" panel
(nothing is measured). Do not claim "no screen interaction": the band has a touchscreen.

## 14. Keep as is
Team: E. Tuvshinzaya, N. Sanchirbayar, G. Erdene; Mentor U. Anujin; New Mongol College of Technology, Mongolia;
Reg. No. 10083. Header: NAPROCK PROCON 2026, Themed Section. Real app and web screenshots (attach them again).

## 15. Known weaknesses (do not hide, do not oversell "one step at a time")
If a worker has two active works, a new work's first step can overwrite the step on the band. A fix is planned on the
server. The wristband screens on the poster are drawn from the firmware design, not photographs.
