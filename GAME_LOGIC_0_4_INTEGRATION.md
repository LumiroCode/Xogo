# Game logic 0.4 — mouse interaction + splash integration

This revision keeps the separation:

`GameSimulation -> PresentationBinder / GameFramePresenter -> IsoRenderer`

## Changed interaction architecture

- `src/engine/Input.js`
  - distinguishes LMB click from LMB drag;
  - exposes a live screen-space selection rectangle;
  - MMB / Alt+LMB remain camera pan gestures;
  - RMB remains contextual command input.

- `src/engine/IsoRenderer.js`
  - owns pixel-perfect sprite alpha hit testing;
  - owns sprite/selection-rectangle intersection tests;
  - draws the selection rectangle as a generic presentation overlay;
  - contact/track glyphs are hit-tested by the geometry actually rendered;
  - last-known markers are non-interactive.

- `src/adapters/GameViewAdapter.js`
  - exposes generic `pickRect()` and `entityIdsOnScreen()` methods to the simulation.

- `src/prototype/GameSimulation.js`
  - owns selection semantics;
  - supports box selection and same-loadout screen selection;
  - contextual command resolution explicitly uses entity-first, map-second precedence;
  - attack-ground remains an explicit map-targeting mode.

## Mouse rules

See `MOUSE_INTERACTION_RULES_0_4.md`.

## Splash damage

Every weapon now has a `splashRadius` parameter.

- `splashRadius = 0`: point/direct damage only.
- `splashRadius > 0`: a successful impact affects units around the epicentre.
- artillery is validated to require `splashRadius > 0`.
- effect falls with distance using a bounded inverse-distance function:

  `falloff = 1 / (1 + k * distance / splashRadius)`

  for `distance <= splashRadius`, and zero outside the radius.

- `k` is `combat.splash_falloff_strength` in `data/gameplay_rules.json`.
- the primary target of a direct splash attack still uses directional armor; secondary splash targets use `armorOther`.
- suppression uses the same spatial falloff.

## Data changes

- `data/unit_definitions.json`
  - `blastRadius` renamed to `splashRadius`;
  - all weapons explicitly define it;
  - artillery currently uses `1.15`.

- `data/gameplay_rules.json`
  - schema 0.4;
  - adds `combat.splash_falloff_strength`.

## Validation

- all JS files pass `node --check`;
- all JSON files parse successfully;
- simulation smoke test runs with all 16 modular units;
- artillery instances validate `splashRadius > 0`;
- direct splash test confirms centre damage is greater than edge damage.
