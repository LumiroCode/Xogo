# RTS AI — modularny renderer 2D isometric

Warstwa prezentacji dla prototypu RTS-a. Runtime używa Canvas 2D, modularnych proxy SVG i konfiguracji JSON.

## Architektura

```text
Simulation / gameplay / ML
        │
        │ arbitrary state
        ▼
PresentationBinder
        │  data/presentation_bindings.json
        │
        │ generic visual state
        ▼
GameViewAdapter → Scene → IsoRenderer
                         │
                         ├─ ModularSpriteComposer
                         ├─ terrain/elevation
                         ├─ FOW / contacts / last-known
                         ├─ generic indicators
                         └─ picking / camera
```

### Ważna granica

`IsoRenderer` **nie zna** pól takich jak HP, supresja czy amunicja.

Ich nazwy występują w domenowym stanie gry oraz w `data/presentation_bindings.json`. `PresentationBinder` zamienia je na generyczne:

```text
current / max / bar / pips / foreground / background / placement / direction
```

Dzięki temu dodanie nowego stanu jednostki nie wymaga zmiany renderera.

W aktualnym buildzie ta sama warstwa ukrywa przed rendererem również `faction` i `sensorRange`: renderer dostaje już tylko prezentacyjne `selectable`, `spriteFilter` i `sensorOverlayRadius`.

## Modularne jednostki

Wygląd powstaje z:

```text
platform + weapon + specialization
```

`src/engine/ModularSpriteComposer.js` składa trzy warstwy przez sockety montażowe i cache'uje wynik. Obecny katalog zawiera 5 platform, 7 broni i 6 specjalizacji — 210 możliwych kompozytów przy 18 SVG proxy.

## Generyczne wskaźniki

`IsoRenderer` obsługuje:

- `bar`,
- `pips` / `segments`,
- foreground/background jako kolor lub grafikę,
- pozycje nad/pod/po bokach oraz w czterech rogach wewnątrz sprite'a,
- cztery kierunki wypełniania,
- pola częściowo wypełniane lub dyskretne pełne/puste.

Demo binding pokazuje obecnie trzy domenowe wartości jako:

- pasek nad jednostką,
- pasek pod jednostką,
- czteropolowy wskaźnik w prawym górnym rogu.

To, **co te trzy wartości oznaczają**, jest zdefiniowane poza rendererem w `data/presentation_bindings.json`.

## Uruchomienie

```bash
python serve.py
```

- prototyp: `http://127.0.0.1:8765/`
- galeria modułów: `http://127.0.0.1:8765/gallery.html`

## Sterowanie

- LPM — wybór jednostki ludzi,
- PPM — ruch,
- Shift+LPM lub środkowy — kamera,
- kółko — zoom,
- WASD / strzałki — kamera,
- V — sensory,
- G — siatka,
- H — wysokość,
- F — fog of war.

## Dane

- `data/unit_definitions.json` — schemat jednostek MVP,
- `data/terrain_presets.json` — presety terenu,
- `data/demo_units.json` — instancje testowe,
- `data/map.json` — mapa,
- `data/assets.json` — moduły graficzne, sockety, terrain styles i indicator graphics,
- `data/presentation_bindings.json` — mapowanie dowolnego stanu domenowego na generyczny stan wizualny.
