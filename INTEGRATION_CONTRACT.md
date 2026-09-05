# Integration contract: game logic → renderer

Renderer jest klientem stanu gry. Nie wykonuje pathfindingu, combat resolution, sensor resolution, supply ani AI.

Minimalna granica to `src/adapters/GameViewAdapter.js`:

```js
view.setMap(mapPresentation);
view.spawnEntity({ id, visual, x, y, z, faction, hp, maxHp, sensorRange, visibility });
view.updateEntity(id, { x, y, z, hp });
view.setVisibility(id, 'visible' | 'contact' | 'lastKnown' | 'hidden');
view.setSelection(ids);
view.removeEntity(id);
view.render({ fog, commandMarker });
```

## Zalecany model integracji z właściwym MVP

Logika jest autorytatywna i publikuje **delta state** po ticku symulacji. Adapter tłumaczy tylko nazwy pól na view-model. Renderer może chodzić w `requestAnimationFrame`, a symulacja w stałym ticku (np. 10–20 Hz) i interpolować pozycje później.

Nie należy wpuszczać do `src/engine/` pojęć typu `damage`, `suppression`, `ammo`, `supply route`, `AI policy` ani `weapon`. Engine może znać wyłącznie ich prezentacyjne skutki: sprite, pasek, overlay, marker, visibility, transform.

## Stabilne visual keys

Logika używa `visual: "mech"`, a nie ścieżki pliku. `data/assets.json` wiąże ten klucz z konkretnym prerenderem. Dzięki temu zmiana proxy na Quaternius, a później Quaterniusa na finalny art, nie zmienia modelu symulacji.
