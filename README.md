# RTS AI — 2D isometric renderer prototype

Mały, niezależny renderer/shell dla przyszłej logiki RTS. Runtime używa wyłącznie Canvas 2D i danych JSON; nie ładuje modeli 3D.

## Uruchomienie

```bash
python serve.py
```

Następnie otwórz `http://127.0.0.1:8765/` (skrypt próbuje otworzyć przeglądarkę automatycznie).

## Sterowanie

- LPM — wybór jednostki ludzi.
- PPM — rozkaz ruchu.
- Shift+LPM lub środkowy przycisk — przesuwanie kamery.
- Kółko — zoom.
- WASD / strzałki — kamera.
- V — zasięgi sensorów.
- G — siatka.
- H — wysokość terenu.
- F — fog of war.

## Architektura

`src/engine/*` nie zna zasad RTS. `GameViewAdapter` jest jedyną granicą między symulacją i obrazem. `DemoSimulation` jest wymiennym klientem renderera i istnieje wyłącznie po to, aby prototyp dało się uruchomić bez właściwego MVP.

Publiczny kontrakt prezentacji: `setMap`, `spawnEntity`, `updateEntity`, `removeEntity`, `setSelection`, `setVisibility`, `pick`, `screenToWorld`, `render`.

Dane mapy i definicje demo są w `data/`. Sprite'y i UI są w `assets/`.

## Quaternius

`data/assets.json` ma stabilne klucze i mapowanie do wybranych paczek Quaterniusa. Dołączone SVG są **proxy**, nie assetami Quaterniusa. Docelowy pipeline jest opisany w `tools/quaternius_pipeline.md`: model 3D służy wyłącznie do wygenerowania izometrycznych sprite'ów 2D, które można podmienić bez zmiany logiki.

Powód pozostawienia surowych modeli poza tym repozytorium/prototypem: oddzielenie source art od gotowego produktu i uniknięcie redystrybucji paczek jako samodzielnych assetów. Przed publikacją komercyjną należy utrwalić wersję licencji właściwą dla pobranych paczek.
