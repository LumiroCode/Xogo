import { IsoRenderer } from './engine/IsoRenderer.js';
import { Input } from './engine/Input.js';
import { GameViewAdapter } from './adapters/GameViewAdapter.js';
import { PresentationBinder } from './adapters/PresentationBinder.js';
import { GameFramePresenter } from './adapters/GameFramePresenter.js';
import { GameSimulation } from './prototype/GameSimulation.js';

const canvas=document.querySelector('#game'),loading=document.querySelector('#loading'),status=document.querySelector('#status');
const nameEl=document.querySelector('#unit-name'),statsEl=document.querySelector('#unit-stats'),modeEl=document.querySelector('#mode-status');

const [map,unitDefs,terrainDefs,demo,presentationBindings,gameplayRules]=await Promise.all([
  fetch('./data/map.json').then(r=>r.json()),
  fetch('./data/unit_definitions.json').then(r=>r.json()),
  fetch('./data/terrain_presets.json').then(r=>r.json()),
  fetch('./data/demo_units.json').then(r=>r.json()),
  fetch('./data/presentation_bindings.json').then(r=>r.json()),
  fetch('./data/gameplay_rules.json').then(r=>r.json())
]);

const renderer=new IsoRenderer(canvas);
await renderer.assets.loadManifest('./data/assets.json');
const missing=renderer.assets.validateModularCatalog(unitDefs);
if(missing.length)throw new Error(`Missing proxy modules: ${missing.join(', ')}`);
const binder=new PresentationBinder(presentationBindings);
const view=new GameViewAdapter(renderer,binder);
const framePresenter=new GameFramePresenter();
view.setMap(map);
const sim=new GameSimulation(map,unitDefs,terrainDefs,demo,gameplayRules,view);
renderer.camera.y=390;renderer.camera.zoom=.72;

function ammoPips(u){
  if(!u?.supplyCapacity)return '□□□□';
  const ratio=Math.max(0,Math.min(1,u.supplyState/u.supplyCapacity));
  const n=Math.ceil(ratio*4-.00001);
  return '■'.repeat(n)+'□'.repeat(4-n);
}

function showSelection(){
  const units=sim.getSelectedUnits();
  if(!units.length){
    nameEl.textContent='Brak zaznaczenia';
    statsEl.textContent='LPM: wybór · Shift+LPM: dodaj/usuń · PPM: ruch/atak\nAlt+LPM lub środkowy: kamera · G: attack ground';
    return;
  }
  if(units.length>1){
    const hp=units.reduce((s,u)=>s+u.hp,0),maxHp=units.reduce((s,u)=>s+u.maxHp,0);
    const ammo=units.reduce((s,u)=>s+u.supplyState,0),maxAmmo=units.reduce((s,u)=>s+u.supplyCapacity,0);
    nameEl.textContent=`Grupa: ${units.length} jednostek`;
    statsEl.textContent=`HP ${Math.round(hp)} / ${Math.round(maxHp)}\nAmunicja ${Math.round(ammo)} / ${Math.round(maxAmmo)}\nFormacja: ${sim.formation}\nPostawa rozkazowa: ${sim.stance}`;
    return;
  }
  const u=units[0],ammoPct=u.supplyCapacity>0?Math.round((u.supplyState/u.supplyCapacity)*100):0;
  statsEl.textContent=`${u.assembly.platform}\n+ ${u.assembly.weapon}\n+ ${u.assembly.specialization}\n\nHP ${Math.round(u.hp)} / ${Math.round(u.maxHp)}\nSupresja ${Math.round(u.suppression)} / ${u.maxSuppression}\nAmunicja ${ammoPips(u)}  ${Math.round(u.supplyState)} / ${Math.round(u.supplyCapacity)} (${ammoPct}%)\nRuch ${u.speed.toFixed(2)} pola/s\nEyes ${sim.getVisualRange(u).toFixed(1)} · sensor ${u.sensorRange.toFixed(1)}\nPostawa: ${u.stance}${u.configuration==='tracked_supply_carrier'?`\nAuto supply: ${u.autoSupply?'ON':'OFF'}`:''}\nRola: ${u.role}`;
  nameEl.textContent=u.label;
}

function updateMode(){
  const ui=sim.getUiState();
  modeEl.textContent=`${ui.attackGroundMode?'ATTACK GROUND · ':''}${ui.formation} · ${ui.stance} · visibility ${ui.visibility.toFixed(2)}`;
  modeEl.classList.toggle('warning',ui.attackGroundMode);
}

function commandFeedback(result){
  if(result?.kind==='insufficient_intel')status.textContent=`${result.level.toUpperCase()}: brak stabilnego tracku — użyj G + PPM albo popraw rozpoznanie`;
  else if(result?.kind==='attack_ground')status.textContent=`attack ground · ${result.count} jednostek`;
  else if(result?.kind==='attack')status.textContent=`atak: ${result.target.label}`;
}

const input=new Input(canvas,renderer.camera,{
  pointerDown:e=>{
    if(e.button===0){sim.selectAt(e.clientX,e.clientY,e.shiftKey);showSelection();}
    if(e.button===2){commandFeedback(sim.commandContext(e.clientX,e.clientY));showSelection();updateMode();}
  },
  keyDown:e=>{
    if(e.repeat)return;
    const presentationFlags={KeyV:'sensors',KeyB:'grid',KeyH:'heights',KeyF:'fog'};
    if(presentationFlags[e.code]){view.toggleFlag(presentationFlags[e.code]);return;}
    if(e.code==='KeyG'){sim.toggleAttackGround();updateMode();return;}
    if(e.code==='KeyZ'){sim.cycleFormation();showSelection();updateMode();return;}
    if(e.code==='Digit1'){sim.setStance('aggressive');showSelection();updateMode();return;}
    if(e.code==='Digit2'){sim.setStance('defensive');showSelection();updateMode();return;}
    if(e.code==='Digit3'){sim.setStance('passive');showSelection();updateMode();return;}
    if(e.code==='Digit4'){sim.setStance('concealed');showSelection();updateMode();return;}
    if(e.code==='KeyE'){sim.toggleEmission();showSelection();return;}
    if(e.code==='KeyL'){sim.toggleAutoSupply();showSelection();return;}
    if(e.code==='KeyX'){sim.stopSelected();return;}
    if(e.code==='KeyN'){sim.toggleNight();updateMode();return;}
  }
});

loading.classList.add('hidden');
showSelection();updateMode();
let prev=performance.now(),hudClock=0;
function loop(now){
  const dt=Math.min(.05,(now-prev)/1000);prev=now;input.update(dt);sim.update(dt);
  view.render(framePresenter.present(sim.getFrame()));
  hudClock+=dt;if(hudClock>.18){hudClock=0;showSelection();updateMode();}
  if(!status.textContent.includes('brak stabilnego')&&!status.textContent.startsWith('attack ground')&&!status.textContent.startsWith('atak:')){
    status.textContent=`game logic 0.3 · ${renderer.assets.composer.cache.size} loadouts cached · Canvas 2D`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
