# Game Logic 0.5 integration

This build keeps the presentation/simulation split intact. The renderer and pointer gesture layer remain generic; unit intent, stances, pursuit, intel and debug-control policy live in `src/prototype/GameSimulation.js`.

## Changed files

- `src/prototype/GameSimulation.js`
  - simulation pause
  - debug enemy reveal/control mode
  - single-faction debug selection
  - explicit Attack Target state machine
  - 0.2-tile stop/restart hysteresis
  - moving-target repathing
  - last-known pursuit without hidden-position cheating
  - stance/autonomous behaviour rules
  - defensive leash + return to anchor
  - contact memory stores approximate tile position
- `src/main.js`
  - Space pause
  - F9 debug enemy control
  - HUD shows faction and current order
- `data/gameplay_rules.json`
  - attack pursuit/hysteresis tuning constants
- `index.html`
  - new debug/pause hotkey legend and version
- `UNIT_BEHAVIOR_RULES_0_5.md`
  - canonical behaviour contract for this prototype

## New hotkeys

- `Space` — pause/unpause simulation. Selection, camera and HUD remain interactive.
- `F9` — DEBUG enemy control. Machine units are revealed for inspection and can be selected/commanded. This is explicitly a prototype/debug feature, not game rules.

## Attack Target contract

1. Right-clicking a tracked/identified enemy issues `attack_target`.
2. The order overrides stance.
3. Unit closes to `weaponRange - attack_stop_hysteresis`.
4. It stops and attacks while target remains within `weaponRange`.
5. If target exits `weaponRange`, pursuit resumes.
6. Target path is refreshed at a limited cadence to avoid per-frame A* churn.
7. If target drops below Track, only last-known/contact memory is pursued.
8. On reaching the last-known point without reacquisition, the order ends.
9. Units inside their own `minRange` do not auto-kite; minimum range remains a tactical weakness.

## Stance contract

Stance affects autonomous behaviour only. Explicit orders override stance.

- `aggressive`: autonomous acquisition + pursuit within aggressive envelope.
- `defensive`: short autonomous leash around `defensiveAnchor`, then return.
- `passive`: no autonomous acquisition.
- `concealed`: no autonomous acquisition and emission off; explicit Attack Target still executes.

## Tuning

`data/gameplay_rules.json -> combat`

- `attack_stop_hysteresis`: `0.2`
- `attack_repath_seconds`: `0.25`
- `attack_repath_distance`: `0.3`
- `attack_last_known_arrival`: `0.18`
