# Asset notes

Aktualny prototyp nie zawiera modeli ani sprite'ów Quaterniusa. Wszystkie grafiki jednostek w `assets/modules/` są własnymi SVG proxy wygenerowanymi na potrzeby testu modularnego renderera.

Docelowa integracja Quaterniusa powinna zastępować osobno:

- platformy,
- uzbrojenie,
- pakiety specjalizacji,

zamiast prerenderować każdą pełną konfigurację. Dzięki socketom i cache'owi liczba potrzebnych assetów rośnie liniowo wraz z katalogiem modułów.

Surowe źródłowe modele 3D należy trzymać poza buildem runtime; do gry trafiają jedynie gotowe warstwy 2D.
