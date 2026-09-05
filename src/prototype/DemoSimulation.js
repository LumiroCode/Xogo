import { resolveAssembly } from './UnitResolver.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pretty=s=>String(s).replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());

export class DemoSimulation {
  constructor(map,unitDefs,terrainDefs,demoData,view){
    this.map=map;this.unitDefs=unitDefs;this.terrainDefs=terrainDefs;this.demoData=demoData;this.view=view;
    this.units=new Map();this.selected=[];this.commandMarker=null;
    this.fog=Array.from({length:map.height},()=>Array.from({length:map.width},()=>0));
    for(const instance of demoData.units) this.spawnUnit(instance);
    this._updateIntel();
    this._publishViews(true);
  }

  spawnUnit(instance){
    const assembly=instance.assembly ?? this.unitDefs.test_configurations[instance.configuration];
    if(!assembly) throw new Error(`Unit ${instance.id}: missing assembly/configuration`);
    const resolved=instance.configuration && this.unitDefs.resolved_test_units?.[instance.configuration]
      ? {...this.unitDefs.resolved_test_units[instance.configuration]}
      : resolveAssembly(this.unitDefs,assembly);
    const cfg=instance.configuration ? this.unitDefs.test_configurations[instance.configuration] : null;
    const z=this.heightAt(instance.x,instance.y)+(resolved.locomotionClass==='air'?1.8:0);
    const maxHp = instance.maxHp ?? resolved.durability;
    const hp = clamp(instance.hp ?? resolved.durability, 0, maxHp);
    const maxSuppression = instance.maxSuppression ?? 100;
    const suppression = clamp(instance.suppression ?? 0, 0, maxSuppression);
    const supplyCapacity = instance.supplyCapacity ?? resolved.supplyCapacity;
    const supplyState = clamp(instance.supplyState ?? resolved.supplyState ?? supplyCapacity, 0, supplyCapacity);
    const state={
      ...instance,...resolved,assembly,z,target:null,
      label:instance.label??pretty(instance.configuration??`${assembly.platform} ${assembly.weapon}`),
      role:cfg?.test_role??'Runtime-composed loadout; no dedicated unit sprite.',
      hp,maxHp,maxSuppression,suppression,supplyCapacity,supplyState,
      visibility:instance.faction==='human'?'visible':'hidden'
    };
    this.units.set(instance.id,state);this.view.spawnEntity(this._toView(state));
  }

  _toView(u){
    return {
      id:u.id,
      visual:{kind:'modular_unit',...u.assembly},
      x:u.x,y:u.y,z:u.z,faction:u.faction,
      hp:u.hp,maxHp:u.maxHp,
      suppression:u.suppression,maxSuppression:u.maxSuppression,
      supplyState:u.supplyState,supplyCapacity:u.supplyCapacity,
      sensorRange:u.sensorRange,
      visibility:u.visibility,
      presentationIndicators:u.presentationIndicators
    };
  }
  heightAt(x,y){return this.map.tiles[clamp(Math.floor(y),0,this.map.height-1)][clamp(Math.floor(x),0,this.map.width-1)].height;}
  terrainAt(x,y){return this.map.tiles[clamp(Math.floor(y),0,this.map.height-1)][clamp(Math.floor(x),0,this.map.width-1)].terrain;}
  movementMultiplier(u){return this.terrainDefs.terrain_presets[this.terrainAt(u.x,u.y)]?.mobility?.[u.locomotionClass]??1;}
  selectAt(cx,cy){const e=this.view.pick(cx,cy);if(e&&e.selectable){this.selected=[e.id];this.view.setSelection(this.selected);return this.units.get(e.id);}this.selected=[];this.view.setSelection([]);return null;}
  commandMove(cx,cy){if(!this.selected.length)return;const w=this.view.screenToWorld(cx,cy),x=clamp(w.x,.05,this.map.width-.05),y=clamp(w.y,.05,this.map.height-.05);for(const id of this.selected){const u=this.units.get(id);if(u)u.target={x,y};}this.commandMarker={x,y,time:performance.now()};}

  update(dt){
    for(const u of this.units.values()) if(u.target){
      const dx=u.target.x-u.x,dy=u.target.y-u.y,d=Math.hypot(dx,dy);
      if(d<.05)u.target=null;else{const step=Math.min(d,u.speed*this.movementMultiplier(u)*dt);u.x+=dx/d*step;u.y+=dy/d*step;u.z=this.heightAt(u.x,u.y)+(u.locomotionClass==='air'?1.8:0);}
    }
    this._updateIntel();this._publishViews();
  }

  _observerRange(o){return o.sensorRange+this.heightAt(o.x,o.y)*.55+(o.locomotionClass==='air'?1.25:0);}
  _updateIntel(){
    for(let y=0;y<this.map.height;y++)for(let x=0;x<this.map.width;x++)if(this.fog[y][x]===2)this.fog[y][x]=1;
    const humans=[...this.units.values()].filter(u=>u.faction==='human');
    for(const o of humans){const range=this._observerRange(o);for(let y=Math.max(0,Math.floor(o.y-range));y<=Math.min(this.map.height-1,Math.ceil(o.y+range));y++)for(let x=Math.max(0,Math.floor(o.x-range));x<=Math.min(this.map.width-1,Math.ceil(o.x+range));x++)if(Math.hypot((x+.5)-o.x,(y+.5)-o.y)<=range)this.fog[y][x]=2;}
    for(const u of this.units.values())if(u.faction==='machine'){
      let quality=0;
      for(const o of humans){const range=this._observerRange(o),d=Math.hypot(u.x-o.x,u.y-o.y);if(d>range)continue;const terrain=this.terrainAt(u.x,u.y),cover=this.terrainDefs.terrain_presets[terrain]?.cover??0;const degraded=(cover>=.5&&o.locomotionClass!=='air')||d>range*.78;quality=Math.max(quality,degraded?1:2);}
      const prev=u.visibility;if(quality===2)u.visibility='visible';else if(quality===1)u.visibility='contact';else if(prev==='visible'||prev==='contact'||prev==='lastKnown')u.visibility='lastKnown';else u.visibility='hidden';this.view.setVisibility(u.id,u.visibility);
    }
  }
  _publishViews(force=false){
    for(const u of this.units.values()){
      const patch={x:u.x,y:u.y,z:u.z,hp:u.hp,maxHp:u.maxHp,suppression:u.suppression,maxSuppression:u.maxSuppression,supplyState:u.supplyState,supplyCapacity:u.supplyCapacity,presentationIndicators:u.presentationIndicators};
      if(u.faction==='human'||u.visibility==='visible'||force)this.view.updateEntity(u.id,patch);
      else if(u.visibility==='contact')this.view.updateEntity(u.id,{...patch,x:Math.floor(u.x)+.5,y:Math.floor(u.y)+.5,z:this.heightAt(u.x,u.y)});
      else if(u.visibility==='lastKnown')this.view.updateEntity(u.id,patch);
    }
  }
  getFrame(){return{fog:this.fog,commandMarker:this.commandMarker};}
  getUnit(id){return this.units.get(id);}
}
