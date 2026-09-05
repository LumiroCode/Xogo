# Unit Behavior Rules 0.5

## Design rule

Explicit orders override stance. Stance governs autonomous behaviour when no explicit combat target is being pursued.

## Orders

1. **Move** — reach the requested map point. Autonomous fire may occur against valid targets already in range, but the unit does not abandon the move destination to chase.
2. **Attack Target** — hard intent. The unit pursues the selected target regardless of stance, stops at `weaponRange - 0.2`, fires, and resumes pursuit only when the target leaves `weaponRange`. This creates a 0.2-tile stop/restart hysteresis band.
3. **Attack Ground** — repeatedly attacks the requested map point when the weapon can do so. It does not auto-path into range in 0.5.
4. **Stop** — cancels explicit orders. Subsequent autonomous behaviour again depends on stance.

## Information and pursuit

Attack Target never grants hidden information. If the target drops below Track, the attacker moves only toward the last known/approximate contact point. If the target is not reacquired on arrival, the attack order ends.

## Stances

- **Aggressive** — autonomously acquires fire-control targets and may chase them within the configured aggressive acquisition envelope.
- **Defensive** — autonomously engages nearby targets, may pursue only within a short leash around its defensive anchor, then returns to the anchor.
- **Passive** — no autonomous target acquisition. Explicit Attack Target still works.
- **Concealed** — no autonomous target acquisition; emission is switched off on entering the stance. Explicit Attack Target still works and firing creates the normal signature spike.

## Minimum range

Units do not automatically kite away from targets inside `minRange`. Minimum range remains a tactical vulnerability rather than an automatic micro routine.

## Debug

`F9` toggles DEBUG enemy control. In debug mode machine units are revealed for inspection and can be selected (single or box) and have their stance changed. Selection remains single-faction: a selection never mixes human and machine units. Commands issued while controlling a machine unit still use the machine faction's actual intel state.

## Pause

`Space` toggles simulation pause. Camera, selection and HUD remain interactive while paused.
