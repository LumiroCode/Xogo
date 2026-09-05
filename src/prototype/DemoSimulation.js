const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class DemoSimulation {
  constructor(map, defs, view) {
    this.map=map;this.defs=defs;this.view=view;this.units=new Map();this.selected=[];this.commandMarker=null;
    this.fog=Array.from({length:map.height},()=>Array(map.width).fill(0));
    for(const u of defs.units) this._spawn(u);
    this._updateIntel(); this._publishViews();
  }
  _spawn(u){ const d=this.defs.types[u.type]; const z=this.heightAt(u.x,u.y)+(d.air?1.8:0); const state={...u,...d,z,target:null,visibility:u.faction==='human'?'visible':'hidden'};this.units.set(u.id,state);this.view.spawnEntity(this._toView(state)); }
  _toView(u){ return {id:u.id,visual:u.visual,x:u.x,y:u.y,z:u.z,faction:u.faction,hp:u.hp,maxHp:u.maxHp,sensorRange:u.sensorRange,visibility:u.visibility}; }
  heightAt(x,y){ return this.map.tiles[clamp(Math.floor(y),0,this.map.height-1)][clamp(Math.floor(x),0,this.map.width-1)].height; }
  selectAt(cx,cy){ const e=this.view.pick(cx,cy); if(e&&e.faction==='human'){this.selected=[e.id];this.view.setSelection(this.selected);return this.units.get(e.id);} this.selected=[];this.view.setSelection([]);return null; }
  commandMove(cx,cy){ if(!this.selected.length)return;const w=this.view.screenToWorld(cx,cy);const x=clamp(w.x,0.05,this.map.width-.05),y=clamp(w.y,0.05,this.map.height-.05);for(const id of this.selected){const u=this.units.get(id);if(u)u.target={x,y};}this.commandMarker={x,y,time:performance.now()}; }
  update(dt){
    for(const u of this.units.values()){
      if(u.target){const dx=u.target.x-u.x,dy=u.target.y-u.y,d=Math.hypot(dx,dy);if(d<.05)u.target=null;else{const step=Math.min(d,u.speed*dt);u.x+=dx/d*step;u.y+=dy/d*step;u.z=this.heightAt(u.x,u.y)+(u.air?1.8:0);}}
    }
    this._updateIntel();
    this._publishViews();
  }
  _observerRange(o){ return o.sensorRange + this.heightAt(o.x,o.y)*.55 + (o.air?1.25:0); }
  _updateIntel(){
    for(let y=0;y<this.map.height;y++)for(let x=0;x<this.map.width;x++){if(this.fog[y][x]===2)this.fog[y][x]=1;}
    const humans=[...this.units.values()].filter(u=>u.faction==='human');
    for(const o of humans){const range=this._observerRange(o);for(let y=Math.max(0,Math.floor(o.y-range));y<=Math.min(this.map.height-1,Math.ceil(o.y+range));y++)for(let x=Math.max(0,Math.floor(o.x-range));x<=Math.min(this.map.width-1,Math.ceil(o.x+range));x++){if(Math.hypot((x+.5)-o.x,(y+.5)-o.y)<=range)this.fog[y][x]=2;}}
    for(const u of this.units.values()) if(u.faction==='machine'){
      let quality=0; // 0 none, 1 contact, 2 identified/current
      for(const o of humans){const range=this._observerRange(o), d=Math.hypot(u.x-o.x,u.y-o.y);if(d>range)continue;const tile=this.map.tiles[clamp(Math.floor(u.y),0,this.map.height-1)][clamp(Math.floor(u.x),0,this.map.width-1)];const degraded=(tile.terrain==='forest' && !o.air) || d>range*.78;quality=Math.max(quality,degraded?1:2);}
      const prev=u.visibility;
      if(quality===2)u.visibility='visible';
      else if(quality===1)u.visibility='contact';
      else if(prev==='visible'||prev==='contact'||prev==='lastKnown')u.visibility='lastKnown';
      else u.visibility='hidden';
      this.view.setVisibility(u.id,u.visibility);
    }
  }
  _publishViews(){
    for(const u of this.units.values()){
      if(u.faction==='human'||u.visibility==='visible') this.view.updateEntity(u.id,{x:u.x,y:u.y,z:u.z,hp:u.hp});
      else if(u.visibility==='contact') this.view.updateEntity(u.id,{x:Math.floor(u.x)+.5,y:Math.floor(u.y)+.5,z:this.heightAt(u.x,u.y),hp:u.hp});
      // lastKnown intentionally freezes the previous rendered position.
    }
  }
  getFrame(){return {fog:this.fog,commandMarker:this.commandMarker};}
  getUnit(id){return this.units.get(id);}
}
