# Game Logic 0.6 integration

Bug-fix/refactor release on top of 0.5.

## Changes
- Manual `Attack Target` and autonomous aggressive/defensive attack now share one engagement state machine.
- Attack state uses hysteresis: chase to `range - 0.2`, hold/fire while target remains within `range`, re-chase only after target leaves `range`.
- Autonomous aggressive units clear their chase path when they enter the firing band, so they no longer walk onto the enemy position.
- Fire control is faction-shared: a weapon may consume a track/fire-control solution produced by another friendly observer. Direct-fire weapons still require the shooter's geometric LoS. Indirect artillery does not.
- Artillery supports normal unit-target Attack Target as well as Attack Ground.
- Unarmed units do not receive Attack Target when included in a mixed selection.
