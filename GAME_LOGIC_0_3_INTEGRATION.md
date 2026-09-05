# Game logic 0.3 — integration overlay

Ten pakiet przenosi logikę taktycznego MVP 0.3 do modularnego silnika izometrycznego bez łamania granicy `Simulation -> binding/presenter -> renderer`.

## Instalacja

Najprościej: rozpakuj overlay do katalogu silnika i pozwól nadpisać istniejące pliki. Nowe pliki zostaną dodane automatycznie.

Alternatywnie użyj pełnego gotowego builda.

Uruchomienie pozostaje bez zmian:

```bash
python serve.py
```

Następnie otwórz `http://127.0.0.1:8765/`.

## Podział odpowiedzialności

- `src/prototype/GameSimulation.js` — cała logika domenowa gry.
- `data/gameplay_rules.json` — jawne stałe/tuning mechaniki.
- `data/unit_definitions.json` — modularne platformy, bronie i specjalizacje.
- `data/terrain_presets.json` — właściwości terenu.
- `src/adapters/GameFramePresenter.js` — tłumaczy domenowe eventy strzałów/artylerii na generyczne efekty renderera.
- `data/presentation_bindings.json` — tłumaczy domenowy `intelLevel`, opacity i wskaźniki na stan prezentacyjny encji.
- `src/engine/IsoRenderer.js` — nadal nie zna HP, amunicji, supresji, klas sensorów ani zasad walki. Dostał jedynie generyczne tryby widoczności/opacity i generyczne efekty `line/projectile/ring`.

## Zaimplementowana logika

- kwadratowa mapa + płynny ruch;
- A* z kosztem `surface x locomotion x elevation`;
- locomotion: infantry / tracked / walker / air;
- cover zależny od rozmiaru;
- geometryczny LoS z elevation, cover i wzajemnym przesłanianiem jednostek;
- eyes: range zależny od height + elevation + duży bonus air;
- special sensors: dłuższe sensory nieblokowane geometrycznym LoS, ale zależne od signature;
- `unknown -> contact -> track -> fire-control -> identified -> last-known`;
- dynamic signature: cover, ruch, strzał, emission, lokalne skupienie;
- concealment widoczny przez opacity własnych jednostek;
- kierunkowy pancerz front / other;
- damage, accuracy, RoF, suppression;
- jakość fire-control silnie wpływa na celność;
- attack-ground;
- artyleria indirect-fire z min range, rozrzutem i AoE;
- 4-pipowy wskaźnik amunicji przez istniejący PresentationBinder;
- fizyczny supply carrier z ostrożnym auto-support i możliwością ręcznego override;
- formacje compact / line / spread;
- postawy aggressive / defensive / passive / concealed;
- proste testowe AI korzystające z tych samych zasad informacji i walki;
- dzień/noc jako BattlefieldVisibility.

## Sterowanie

- `LPM` — zaznacz jednostkę;
- `Shift + LPM` — dodaj/usuń jednostkę z grupy;
- `PPM` — ruch albo atak wykrytego celu;
- `G`, potem `PPM` — attack ground;
- `Z` — następna formacja;
- `1` — aggressive;
- `2` — defensive;
- `3` — passive;
- `4` — concealed;
- `E` — toggle emission;
- `L` — toggle auto-supply dla zaznaczonego transportera;
- `X` — stop;
- `N` — dzień/noc;
- `V` — overlay sensorów;
- `B` — siatka;
- `H` — wysokości;
- `F` — fog;
- `Alt + LPM` albo środkowy przycisk — kamera;
- WASD / strzałki — kamera;
- kółko — zoom.

## Walidacja

- wszystkie pliki JS przechodzą `node --check`;
- wszystkie JSON-y przechodzą parse;
- wykonano 60-sekundowy smoke test symulacji w Node: 16 jednostek, AI, fog/intel, walka, zużycie amunicji i śmierć jednostek;
- wykonano wymuszony test direct-fire oraz artillery attack-ground;
- sprawdzono binding wszystkich poziomów informacji oraz brak wskaźników HP/supply przeciwnika przed prezentacją własnych danych.

Headless Chromium w środowisku wykonawczym blokował nawigację administracyjnie, więc walidacja runtime renderera została wykonana statycznie + przez testy warstw symulacji/bindingu, a nie przez automatyczny screenshot przeglądarki.
