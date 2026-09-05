# Quaternius → modular 2D sprite pipeline

Runtime jest czystym Canvas 2D. Po zmianie na modularny renderer docelowy art powinien zastępować **moduły**, a nie gotowe konfiguracje jednostek.

## Warstwy

- `platforms/*` — korpus/platforma wraz z bazowym układem ruchu,
- `weapons/*` — uzbrojenie z ustalonym punktem montażowym,
- `specializations/*` — widoczny pakiet dodatkowy,
- `data/assets.json` — sockety platform, skala warstw i mount-pointy modułów.

Dzięki temu liczba finalnych prerenderów rośnie liniowo z liczbą części, nie kombinatorycznie z liczbą loadoutów.

## Docelowy workflow

1. Import źródłowego modelu do Blendera.
2. Ujednolicenie światła, kamery ortograficznej i palety dla wszystkich modułów.
3. Platformę renderować bez uzbrojenia/specjalizacji.
4. Weapon i specialization renderować osobno na transparentnym tle z zachowanym wspólnym kierunkiem izometrycznym.
5. Ustalić mount point w pikselach oraz socket na każdej platformie.
6. Eksport PNG/WebP; podmiana ścieżki w `data/assets.json`.
7. Otworzyć `gallery.html` i sprawdzić całą macierz automatycznie.

Obecne SVG są proxy. `ModularSpriteComposer` nie zależy od formatu źródłowego — można podmienić SVG na PNG/WebP bez dotykania logiki gry.
