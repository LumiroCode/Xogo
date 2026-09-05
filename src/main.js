import { IsoRenderer } from './engine/IsoRenderer.js';
import { Input } from './engine/Input.js';
import { GameViewAdapter } from './adapters/GameViewAdapter.js';
import { PresentationBinder } from './adapters/PresentationBinder.js';
import { DemoSimulation } from './prototype/DemoSimulation.js';

const canvas=document.querySelector('#game'),loading=document.querySelector('#loading'),status=document.querySelector('#status');
const nameEl=document.querySelector('#unit-name'),statsEl=document.querySelector('#unit-stats');
const [map,unitDefs,terrainDefs,demo,presentationBindings]=await Promise.all([
  fetch('./data/map.json').then(r=>r.json()),
  fetch('./data/unit_definitions.json').then(r=>r.json()),
  fetch('./data/terrain_presets.json').then(r=>r.json()),
  fetch('./data/demo_units.json').then(r=>r.json()),
  fetch('./data/presentation_bindings.json').then(r=>r.json())
]);
const renderer=new IsoRenderer(canvas);await renderer.assets.loadManifest('./data/assets.json');
const missing=renderer.assets.validateModularCatalog(unitDefs);if(missing.length)throw new Error(`Missing proxy modules: ${missing.join(', ')}`);
const binder=new PresentationBinder(presentationBindings);
const view=new GameViewAdapter(renderer,binder);view.setMap(map);const sim=new DemoSimulation(map,unitDefs,terrainDefs,demo,view);
renderer.camera.y=390;renderer.camera.zoom=.72;
function showUnit(u){
  if(!u){nameEl.textContent='Brak zaznaczenia';statsEl.textContent='LPM: wybór · PPM: ruch\nShift+LPM lub środkowy: przesuwanie kamery';return;}
  const ammoPct=u.supplyCapacity>0 ? Math.round((u.supplyState/u.supplyCapacity)*100) : 0;
  statsEl.textContent=`${u.assembly.platform}\n+ ${u.assembly.weapon}\n+ ${u.assembly.specialization}\n\nHP ${Math.round(u.hp)} / ${u.maxHp}\nSupresja ${Math.round(u.suppression ?? 0)} / ${u.maxSuppression ?? 100}\nAmunicja ${Math.round(u.supplyState)} / ${Math.round(u.supplyCapacity)} (${ammoPct}%)\nRuch ${u.speed.toFixed(2)} pola/s\nSensor ${u.sensorRange.toFixed(1)} pola\nRola: ${u.role}`;
  nameEl.textContent=u.label;
}
const input=new Input(canvas,renderer.camera,{
  pointerDown:e=>{if(e.button===0)showUnit(sim.selectAt(e.clientX,e.clientY));if(e.button===2)sim.commandMove(e.clientX,e.clientY);},
  keyDown:e=>{if(e.repeat)return;const flags={KeyV:'sensors',KeyG:'grid',KeyH:'heights',KeyF:'fog'};if(flags[e.code])view.toggleFlag(flags[e.code]);}
});
loading.classList.add('hidden');status.textContent=`modular renderer · ${renderer.assets.composer.cache.size} composites cached · Canvas 2D`;
let prev=performance.now();function loop(now){const dt=Math.min(.05,(now-prev)/1000);prev=now;input.update(dt);sim.update(dt);view.render(sim.getFrame());status.textContent=`modular renderer · ${renderer.assets.composer.cache.size} unique loadouts cached · Canvas 2D`;requestAnimationFrame(loop);}requestAnimationFrame(loop);
