# Quaternius → 2D sprite pipeline

Runtime gry jest celowo czystym 2D. Modele Quaterniusa są materiałem źródłowym do prerenderu, nie zależnością runtime.

## Wybrane zestawy
- Animated Mech Pack — walkery / ciężkie maszyny.
- Animated Tanks Pack — pojazdy gąsienicowe / artyleria.
- Sci‑Fi Essentials Kit — roboty, propsy, elementy sci‑fi.
- Ultimate Stylized Nature Pack — drzewa, skały i dekoracje terenu.

## Kontrakt renderu
1. Import modelu FBX/glTF do Blendera.
2. Ujednolicenie skali i punktu oparcia przy ziemi.
3. Materiały zachowują paletę źródłową; frakcyjny tint/emissive powinien być nakładany osobno.
4. Kamera ortograficzna w standardzie game-isometric 2:1; azymut 45°, około 30–35° elewacji.
5. 8 kierunków (N, NE, E, SE, S, SW, W, NW), ten sam bounding box i anchor.
6. Tło transparentne. Dla prototypu: 192×192 lub 256×256 na klatkę; WebP/PNG.
7. Cień może być osobną warstwą lub generowany w rendererze (obecnie renderer generuje prosty cień).
8. Wynik zastępuje SVG w `assets/sprites/`, a `data/assets.json` zachowuje te same klucze (`mech`, `artillery`, itd.).

To oznacza, że zmiana proxy → prawdziwy prerender Quaterniusa nie dotyka `DemoSimulation.js` ani przyszłej logiki gry.
