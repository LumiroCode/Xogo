# Integration contract: simulation → presentation binding → renderer

## Fundamentalna granica

`IsoRenderer` nie zna znaczenia stanu gry. Nie zna HP, supresji, amunicji, morale, temperatury, paliwa itd.

Podział odpowiedzialności:

```text
Simulation
    │ arbitrary domain state
    ▼
PresentationBinder + data/presentation_bindings.json
    │ generic visual state
    ▼
GameViewAdapter / Scene
    ▼
IsoRenderer
```

Nazwy pól domenowych występują tylko w symulacji i w konfigurowalnym bindingu prezentacji.

## Źródłowy stan encji

Symulacja może publikować dowolne pola, np.:

```js
view.spawnEntity({
  id,
  visual: {
    kind: 'modular_unit',
    platform: 'light_tracked',
    weapon: 'autocannon',
    specialization: 'signature_reduction_package'
  },
  x, y, z,
  faction,
  visibility,
  sensorRange,

  // arbitrary domain state:
  hp,
  maxHp,
  suppression,
  maxSuppression,
  supplyState,
  supplyCapacity
});
```

Te pola **nie trafiają bezpośrednio do `Scene`/`IsoRenderer`**. `GameViewAdapter` utrzymuje źródłowy snapshot i przepuszcza go przez `PresentationBinder` przy spawn i po każdym patchu.

Tak samo `faction` i `sensorRange` nie muszą trafić do renderera. W aktualnym bindingu są tłumaczone odpowiednio na czysto prezentacyjne `selectable`, `spriteFilter` i `sensorOverlayRadius`.

## Binding prezentacji

`data/presentation_bindings.json` opisuje, jak dowolne ścieżki ze stanu domenowego zamienić na generyczne dane wizualne.

Sekcja `entity.fields` może mapować prostą ścieżkę lub generyczne wyrażenie `select`. Przykładowo `faction` może zostać zamienione na boolean `selectable` albo filtr sprite'a, bez ujawniania frakcji rendererowi.

Przykład:

```json
{
  "id": "resource-pips",
  "kind": "pips",
  "current": {"source": "supplyState"},
  "max": {"source": "supplyCapacity"},
  "segments": 4,
  "segmentFill": "discrete",
  "placement": "inside-top-right",
  "direction": "left-to-right",
  "foreground": {"type": "graphic", "key": "ammo_pip"},
  "background": {"type": "color", "value": "#922d2a"}
}
```

Po bindingu renderer widzi wyłącznie:

```js
{
  id: 'resource-pips',
  kind: 'pips',
  current: 52,
  max: 96,
  segments: 4,
  segmentFill: 'discrete',
  placement: 'inside-top-right',
  direction: 'left-to-right',
  foreground: { type: 'graphic', key: 'ammo_pip' },
  background: { type: 'color', value: '#922d2a' }
}
```

Nie wie, czym są `52` i `96`.

## Generyczne możliwości PresentationBinder

### Ścieżka do wartości

```json
{"source": "state.some.deep.value"}
```

### Wybór wariantu na podstawie dowolnego pola

```json
{
  "select": {
    "source": "faction",
    "values": {
      "human": {"type": "color", "value": "#75c997"},
      "machine": {"type": "color", "value": "#df726b"}
    },
    "default": {"type": "color", "value": "#d7d7d7"}
  }
}
```

`PresentationBinder` nie zna semantyki wartości selektora; wykonuje tylko generyczne mapowanie.

### Warunkowe wskaźniki

Szablon może opcjonalnie mieć:

```json
"when": {"source": "someFlag", "equals": true}
```

lub:

```json
"when": {"source": "someType", "oneOf": ["a", "b"]}
```

### Dodatkowe wskaźniki per encja

`presentationIndicators` może zawierać już gotowe generyczne definicje wizualne, które binder dopisze do skonfigurowanych wskaźników.

## Kontrakt `IsoRenderer` dla wskaźników

Renderer obsługuje tylko generyczne `indicators[]`.

Typy:

- `bar`
- `pips` / `segments`

Wartość:

- `current` + `max`, albo
- `value` w zakresie `0..1`.

Styl:

```js
{ type: 'color', value: '#f0c85b' }
{ type: 'graphic', key: 'ammo_pip' }
```

Położenie:

- `above`
- `below`
- `left`
- `right`
- `inside-top-left`
- `inside-top-right`
- `inside-bottom-left`
- `inside-bottom-right`

Kierunek:

- `left-to-right`
- `right-to-left`
- `top-to-bottom`
- `bottom-to-top`

Pola N-segmentowe mogą używać:

- `segmentFill: "partial"` — ostatnie pole może być częściowo wypełnione,
- `segmentFill: "discrete"` — każde pole jest wyłącznie pełne/puste.

## Modularny wygląd jednostki

Pozostaje bez zmian:

```text
platform + specialization + weapon → ModularSpriteComposer → cached Canvas
```

Renderer korzysta z identyfikatorów komponentów wyłącznie jako kluczy prezentacyjnych.
