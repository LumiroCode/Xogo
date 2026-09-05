# Mouse interaction rules 0.4

## Design goal

Mouse interaction must be deterministic, readable and consistent with modern RTS muscle memory.
The renderer owns hit-testing of what is actually visible; the simulation owns the semantic result of the interaction.

## Core precedence rule

1. If an explicit modal command is active (currently `attack ground`), interpret the click according to that mode.
2. Otherwise, test presentation entities under the pointer first.
3. Only when no interactive entity is hit, interpret the pointer as a point on the map.

This prevents a click on a visible unit sprite from accidentally becoming a move command to the tile behind it.

## Primary mouse button — selection

### Single LMB

- Clicking a friendly unit selects it.
- Hit testing uses non-transparent pixels of the unit's rendered composite sprite, not its logical world point and not a generic bounding rectangle.
- Clicking empty map clears the current selection unless Shift is held.
- Shift + LMB toggles a single friendly unit in/out of the current selection.

### LMB drag

- Dragging beyond a small threshold creates a visible rectangular selection box.
- On release, every friendly unit whose non-transparent rendered sprite pixels intersect the rectangle is included.
- Shift + box-select adds units to the current selection.
- Logical unit coordinates are deliberately irrelevant to box inclusion.

### Double LMB / Ctrl + LMB

- Select every visible-on-screen friendly unit with the same modular configuration/loadout as the clicked unit.
- Shift keeps the previous selection and adds the matching units.

## Secondary mouse button — contextual order

With friendly units selected:

- RMB on a sufficiently tracked enemy presentation: attack that entity.
- RMB on a low-quality contact: do not silently convert the click into movement; report insufficient intel.
- RMB on a friendly entity: the entity consumes the interaction. There is currently no default friendly contextual action; this is the insertion point for future follow/repair/resupply behavior.
- RMB on empty map: move selected units to that exact map point using the current formation.

Thus entity interaction always has precedence over map interaction in normal contextual mode.

## Explicit attack-ground mode

- `G` enters attack-ground mode.
- The next RMB is explicitly interpreted as a map point even if a unit sprite is under the cursor.
- This is the deliberate exception to entity precedence because the command already specifies the target category: terrain/space, not entity.

## Camera

- Middle-mouse drag: pan camera.
- Alt + LMB drag: pan camera.
- Mouse wheel: zoom around pointer.
- Camera drag never starts a selection box.

## Hover feedback

- Friendly selectable sprite: pointer cursor.
- Current enemy presentation while units are selected: targeting/crosshair cursor.
- Empty map while units are selected: move cursor.
- Active box selection: crosshair cursor.

## Presentation-level hit testing

Normal visible/fire-control units use pixel-perfect alpha tests against the composed sprite.
Current low-intel representations (`contact`, `track`) use their actually rendered glyph geometry because the real sprite is intentionally not shown.
`last-known` markers are memories, not current units, and are non-interactive.

## Rationale distilled from established RTS conventions

The chosen baseline follows the modern two-button convention shared by Age of Empires, StarCraft, Tzar and later Command & Conquer titles: primary button for selection, secondary button for contextual orders, box selection and Shift-based selection extension. Older C&C and World War III: Black Gold used different legacy mouse schemes; their useful command concepts remain relevant, but their button mappings are not adopted because they conflict with contemporary RTS expectations.
