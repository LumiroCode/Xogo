import { IsoRenderer } from './engine/IsoRenderer.js';
import { Input } from './engine/Input.js';
import { GameViewAdapter } from './adapters/GameViewAdapter.js';
import { DemoSimulation } from './prototype/DemoSimulation.js';

const canvas=document.querySelector('#game'), loading=document.querySelector('#loading'), status=document.querySelector('#status');
const nameEl=document.querySelector('#unit-name'), statsEl=document.querySelector('#unit-stats');
const [map,defs]=await Promise.all([fetch('./data/map.json').then(r=>r.json()),fetch('./data/entities.json').then(r=>r.json())]);
const renderer=new IsoRenderer(canvas); await renderer.assets.loadManifest('./data/assets.json');
const view=new GameViewAdapter(renderer);view.setMap(map);const sim=new DemoSimulation(map,defs,view);
renderer.camera.y=390;renderer.camera.zoom=.78;
function showUnit(u){if(!u){nameEl.textContent='Brak zaznaczenia';statsEl.textContent='LPM: wybór · PPM: ruch\nShift+LPM lub środkowy: przesuwanie kamery';return;}nameEl.textContent=u.label;statsEl.textContent=`HP ${Math.round(u.hp)} / ${u.maxHp}\nRuch ${u.speed.toFixed(1)} pola/s\nSensor ${u.sensorRange.toFixed(1)} pola\nRola: ${u.role}`;}
const input=new Input(canvas,renderer.camera,{
 pointerDown:e=>{ if(e.button===0)showUnit(sim.selectAt(e.clientX,e.clientY)); if(e.button===2)sim.commandMove(e.clientX,e.clientY); },
 keyDown:e=>{if(e.repeat)return;const map={KeyV:'sensors',KeyG:'grid',KeyH:'heights',KeyF:'fog'};if(map[e.code])view.toggleFlag(map[e.code]);}
});
loading.classList.add('hidden');status.textContent='demo adapter aktywny · Canvas 2D · 2:1 iso';
let prev=performance.now();function loop(now){const dt=Math.min(.05,(now-prev)/1000);prev=now;input.update(dt);sim.update(dt);view.render(sim.getFrame());requestAnimationFrame(loop);}requestAnimationFrame(loop);
