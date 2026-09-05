# Unit attack state machine 0.6

`Attack Target` is one intent regardless of whether it came from player RMB or autonomous stance target acquisition.

1. **Acquire** — target must be at least `track`.
2. **Chase** — move toward the known target position until distance <= `weaponRange - hysteresis` **and** a direct-fire weapon has geometric LoS. Indirect fire ignores this LoS condition.
3. **Hold/Fire** — clear chase movement and attack.
4. **Maintain** — while target remains <= `weaponRange`, remain stopped and continue attacking.
5. **Re-chase** — only when target crosses beyond `weaponRange`.
6. **Lost track** — explicit Attack Target moves to the last known position; autonomous attacks stop pursuing.
7. **Minimum range** — no automatic kiting; the unit stops but cannot fire.

The same state machine is used by manual Attack Target and aggressive/defensive autonomous attack.

Artillery is an indirect-fire weapon, not an attack-ground-only weapon: it can receive a unit target from team reconnaissance and automatically engage it. Attack Ground remains available for firing on uncertain/area contacts.
