import { resolveAssembly } from './UnitResolver.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const pretty=s=>String(s).replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const TAU=Math.PI*2;

function angleDiff(a,b){
  let d=a-b;
  while(d>Math.PI)d-=TAU;
  while(d<-Math.PI)d+=TAU;
  return Math.abs(d);
}

export class GameSimulation {
  constructor(map,unitDefs,terrainDefs,demoData,rules,view){
    this.map=map;
    this.unitDefs=unitDefs;
    this.terrainDefs=terrainDefs;
    this.demoData=demoData;
    this.rules=rules;
    this.view=view;

    this.units=new Map();
    this.selected=[];
    this.commandMarker=null;
    this.attackGroundMode=false;
    this.paused=false;
    this.debugEnemyControl=false;
    this.formation='compact';
    this.stance='defensive';
    this.time=0;
    this.lastAiThink=0;
    this.lastSupplyThink=0;
    this.nextFxId=1;
    this.events=[];
    this.battlefieldVisibility=rules.battlefield.visibility;
    this.battlefieldMobility=rules.battlefield.mobility;

    this.fog=Array.from({length:map.height},()=>Array.from({length:map.width},()=>0));
    this.intel={human:new Map(),machine:new Map()};
    this.memory={human:new Map(),machine:new Map()};

    for(const instance of demoData.units) this.spawnUnit(instance);
    this._updateIntel();
    this._publishViews(true);
  }

  // ---------- public control surface ----------

  spawnUnit(instance){
    const assembly=instance.assembly ?? this.unitDefs.test_configurations[instance.configuration];
    if(!assembly) throw new Error(`Unit ${instance.id}: missing assembly/configuration`);
    const resolved=instance.configuration && this.unitDefs.resolved_test_units?.[instance.configuration]
      ? {...this.unitDefs.resolved_test_units[instance.configuration]}
      : resolveAssembly(this.unitDefs,assembly);
    const cfg=instance.configuration ? this.unitDefs.test_configurations[instance.configuration] : null;
    if(resolved.indirectFire && !(resolved.splashRadius>0)) throw new Error(`Unit ${instance.id}: indirect-fire weapon requires splashRadius > 0`);
    const z=this.heightAt(instance.x,instance.y)+(resolved.locomotionClass==='air'?1.8:0);
    const maxHp=instance.maxHp ?? resolved.durability;
    const maxSuppression=instance.maxSuppression ?? 100;
    const supplyCapacity=instance.supplyCapacity ?? resolved.supplyCapacity;
    const state={
      ...instance,...resolved,assembly,z,
      label:instance.label??pretty(instance.configuration??`${assembly.platform} ${assembly.weapon}`),
      role:cfg?.test_role??'Runtime-composed loadout; no dedicated unit class.',
      hp:clamp(instance.hp ?? resolved.durability,0,maxHp),
      maxHp,
      suppression:clamp(instance.suppression ?? 0,0,maxSuppression),
      maxSuppression,
      supplyCapacity,
      supplyState:clamp(instance.supplyState ?? resolved.supplyState ?? supplyCapacity,0,supplyCapacity),
      heading:instance.heading ?? (instance.faction==='human'?0:Math.PI),
      stance:instance.stance ?? (resolved.weaponRange>0?'defensive':'passive'),
      formation:instance.formation ?? 'compact',
      path:[],moveGoal:null,manualTarget:null,autoTarget:null,groundTarget:null,
      orderKind:'idle',attackLastKnown:null,attackRepathAt:0,attackPathTarget:null,
      autoChasing:false,returningToAnchor:false,
      fireCooldown:Math.random()*.35,recentFire:0,alive:true,
      defensiveAnchor:{x:instance.x,y:instance.y},
      autoSupply:instance.autoSupply ?? (instance.configuration==='tracked_supply_carrier'),
      autoSupplyTarget:null,manualMoveUntil:0,
      nextReconPatrol:Math.random()*this.rules.ai.recon_patrol_seconds,
      intelLevel:instance.faction==='human'?'identified':'unknown'
    };
    this.units.set(instance.id,state);
    this.view.spawnEntity(this._toView(state,'identified'));
    return state;
  }

  _canDebugControl(u){return !!(u?.alive&&(u.faction==='human'||(this.debugEnemyControl&&u.faction==='machine')));}
  getSelectedFaction(){return this.getSelectedUnits()[0]?.faction??null;}

  _prepareSelectionFaction(faction,additive){
    const current=this.getSelectedFaction();
    if(!additive||!current||current!==faction)this.selected=[];
  }

  selectAt(cx,cy,additive=false){
    const e=this.view.pick(cx,cy),u=e?this.units.get(e.id):null;
    if(this._canDebugControl(u)){
      this._prepareSelectionFaction(u.faction,additive);
      if(additive&&this.selected.includes(u.id))this.selected=this.selected.filter(id=>id!==u.id);
      else if(!this.selected.includes(u.id))this.selected.push(u.id);
      this.view.setSelection(this.selected);
      return u;
    }
    if(!additive){this.selected=[];this.view.setSelection([]);}
    return null;
  }

  selectRect(rect,additive=false){
    const hits=this.view.pickRect(rect,{selectableOnly:!this.debugEnemyControl});
    let units=hits.map(e=>this.units.get(e.id)).filter(u=>this._canDebugControl(u));
    const current=this.getSelectedFaction();
    let faction=(additive&&current)?current:null;
    if(!faction){
      // Normal human control keeps precedence when a debug box covers both armies.
      faction=units.some(u=>u.faction==='human')?'human':units[0]?.faction??null;
    }
    if(!faction){if(!additive){this.selected=[];this.view.setSelection([]);}return[];}
    units=units.filter(u=>u.faction===faction);
    this._prepareSelectionFaction(faction,additive);
    for(const u of units)if(!this.selected.includes(u.id))this.selected.push(u.id);
    this.view.setSelection(this.selected);
    return this.getSelectedUnits();
  }

  selectSameConfigurationAt(cx,cy,additive=false){
    const e=this.view.pick(cx,cy),clicked=e?this.units.get(e.id):null;
    if(!this._canDebugControl(clicked))return null;
    const onScreen=new Set(this.view.entityIdsOnScreen({selectableOnly:!this.debugEnemyControl}));
    const ids=[...this.units.values()].filter(u=>u.alive&&u.faction===clicked.faction&&u.configuration===clicked.configuration&&onScreen.has(u.id)).map(u=>u.id);
    this._prepareSelectionFaction(clicked.faction,additive);
    for(const id of ids)if(!this.selected.includes(id))this.selected.push(id);
    this.view.setSelection(this.selected);
    return this.getSelectedUnits();
  }

  getSelectedUnits(){return this.selected.map(id=>this.units.get(id)).filter(u=>u?.alive);}
  getUnit(id){return this.units.get(id);}
  getVisualRange(u){return this._visualRange(u);}

  commandContext(cx,cy){
    if(!this.selected.length)return {kind:'none'};
    const selected=this.getSelectedUnits(),controllerFaction=this.getSelectedFaction();
    if(!controllerFaction)return {kind:'none'};

    if(this.attackGroundMode){
      const world=this.view.screenToWorld(cx,cy);
      const x=clamp(world.x,.05,this.map.width-.05),y=clamp(world.y,.05,this.map.height-.05);
      let count=0;
      for(const u of selected)if(u.rateOfFire>0){
        u.groundTarget={x,y};u.manualTarget=null;u.autoTarget=null;u.path=[];u.moveGoal=null;u.orderKind='attack_ground';count++;
      }
      this.commandMarker={x,y,time:performance.now(),kind:'attack_ground'};
      this.attackGroundMode=false;
      return {kind:'attack_ground',count,x,y};
    }

    const picked=this.view.pick(cx,cy),target=picked?this.units.get(picked.id):null;
    if(target?.alive){
      if(target.faction!==controllerFaction){
        const intel=this._intelFor(controllerFaction,target);
        // Debug control reveals enemy sprites for inspection, but orders still obey the
        // controlling faction's actual information state.
        if(intel.level==='contact'||intel.level==='unknown')return {kind:'insufficient_intel',level:intel.level,target};
        for(const u of selected)this._issueAttackTarget(u,target);
        this.commandMarker={x:target.x,y:target.y,time:performance.now(),kind:'attack'};
        return {kind:'attack',target};
      }
      return {kind:'friendly_entity',target};
    }

    const world=this.view.screenToWorld(cx,cy);
    const x=clamp(world.x,.05,this.map.width-.05),y=clamp(world.y,.05,this.map.height-.05);
    this._issueFormationMove(selected,x,y,true);
    this.commandMarker={x,y,time:performance.now(),kind:'move'};
    return {kind:'move',x,y};
  }

  setStance(stance){
    this.stance=stance;
    for(const u of this.getSelectedUnits()){
      u.stance=stance;
      if(stance==='concealed')u.emission=false;
    }
    return stance;
  }

  cycleFormation(){
    const vals=['compact','line','spread'];
    this.formation=vals[(vals.indexOf(this.formation)+1)%vals.length];
    for(const u of this.getSelectedUnits())u.formation=this.formation;
    return this.formation;
  }

  toggleAttackGround(){this.attackGroundMode=!this.attackGroundMode;return this.attackGroundMode;}
  togglePause(){this.paused=!this.paused;return this.paused;}
  toggleDebugEnemyControl(){
    this.debugEnemyControl=!this.debugEnemyControl;
    if(!this.debugEnemyControl&&this.getSelectedFaction()==='machine'){this.selected=[];this.view.setSelection([]);}
    this._publishViews(true);
    return this.debugEnemyControl;
  }
  toggleEmission(){for(const u of this.getSelectedUnits())u.emission=!u.emission;}
  toggleAutoSupply(){
    const carriers=this.getSelectedUnits().filter(u=>u.configuration==='tracked_supply_carrier');
    if(!carriers.length)return null;
    const next=!carriers.every(u=>u.autoSupply);
    for(const u of carriers){u.autoSupply=next;u.autoSupplyTarget=null;}
    return next;
  }
  stopSelected(){for(const u of this.getSelectedUnits()){this._clearExplicitCombatOrder(u);u.path=[];u.moveGoal=null;u.autoTarget=null;u.autoChasing=false;u.returningToAnchor=false;u.orderKind='idle';}}
  toggleNight(){
    const day=this.rules.battlefield.visibility;
    const night=this.rules.battlefield.night_visibility;
    this.battlefieldVisibility=Math.abs(this.battlefieldVisibility-day)<.05?night:day;
    return this.battlefieldVisibility;
  }

  getUiState(){
    return {
      attackGroundMode:this.attackGroundMode,
      formation:this.formation,
      stance:this.stance,
      visibility:this.battlefieldVisibility,
      paused:this.paused,
      debugEnemyControl:this.debugEnemyControl,
      selectedFaction:this.getSelectedFaction(),
      selected:this.getSelectedUnits()
    };
  }

  update(dt){
    if(this.paused)return;
    this.time+=dt;
    this._updateIntel();
    this._updateAutoSupply();
    this._updateAI();
    for(const u of this.units.values())if(u.alive){
      this._updateMovement(u,dt);
      this._updateCombat(u,dt);
    }
    this._transferSupply(dt);
    this._updateEvents(dt);
    this._updateIntel();
    this._publishViews();
  }

  getFrame(){
    return {
      fog:this.fog,
      commandMarker:this.commandMarker,
      events:this.events.filter(e=>this._eventVisibleToHuman(e))
    };
  }

  // ---------- map / movement ----------

  heightAt(x,y){return this.map.tiles[clamp(Math.floor(y),0,this.map.height-1)][clamp(Math.floor(x),0,this.map.width-1)].height;}
  tileAt(x,y){return this.map.tiles[clamp(Math.floor(y),0,this.map.height-1)][clamp(Math.floor(x),0,this.map.width-1)];}
  terrainAt(x,y){return this.tileAt(x,y).terrain;}
  terrainDefAt(x,y){return this.terrainDefs.terrain_presets[this.terrainAt(x,y)];}

  _passable(u,fromTile,toTile){
    if(u.locomotionClass==='air')return true;
    const r=this.rules.movement;
    let limit=r.slope_block_delta[u.locomotionClass] ?? 3;
    if(u.size>r.large_unit_size_threshold)limit-=r.large_unit_slope_penalty_levels;
    return Math.abs(toTile.height-fromTile.height)<limit;
  }

  _moveMultiplier(u,tile,fromTile=null){
    const terrain=this.terrainDefs.terrain_presets[tile.terrain];
    let m=(terrain?.mobility?.[u.locomotionClass]??1)*this.battlefieldMobility;
    if(fromTile && u.locomotionClass!=='air'){
      const dh=Math.abs(tile.height-fromTile.height);
      m*=Math.max(.25,1-dh*this.rules.movement.elevation_move_penalty);
    }
    return m;
  }

  _tileCost(u,r,c,nr,nc){
    const a=this.map.tiles[r]?.[c],b=this.map.tiles[nr]?.[nc];
    if(!a||!b||!this._passable(u,a,b))return Infinity;
    const diag=(r!==nr&&c!==nc)?Math.SQRT2:1;
    return diag/Math.max(.12,this._moveMultiplier(u,b,a));
  }

  _findPath(u,gx,gy){
    if(u.locomotionClass==='air')return [{x:gx,y:gy}];
    const W=this.map.width,H=this.map.height;
    const sc=clamp(Math.floor(u.x),0,W-1),sr=clamp(Math.floor(u.y),0,H-1);
    const gc=clamp(Math.floor(gx),0,W-1),gr=clamp(Math.floor(gy),0,H-1);
    const key=(r,c)=>r*W+c;
    const open=[{r:sr,c:sc,f:0}],g=new Map([[key(sr,sc),0]]),came=new Map(),seen=new Set();
    while(open.length){
      open.sort((a,b)=>a.f-b.f);
      const cur=open.shift(),ck=key(cur.r,cur.c);
      if(seen.has(ck))continue;seen.add(ck);
      if(cur.r===gr&&cur.c===gc){
        const out=[];let r=gr,c=gc,k=key(r,c);
        while(!(r===sr&&c===sc)){
          out.push({x:c+.5,y:r+.5});
          const prev=came.get(k);if(!prev)break;r=prev.r;c=prev.c;k=key(r,c);
        }
        out.reverse();out.push({x:gx,y:gy});return out;
      }
      for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nr=cur.r+dr,nc=cur.c+dc;if(nr<0||nr>=H||nc<0||nc>=W)continue;
        const step=this._tileCost(u,cur.r,cur.c,nr,nc);if(!Number.isFinite(step))continue;
        const ng=(g.get(ck)??Infinity)+step,nk=key(nr,nc);
        if(ng<(g.get(nk)??Infinity)){
          g.set(nk,ng);came.set(nk,{r:cur.r,c:cur.c});
          open.push({r:nr,c:nc,f:ng+Math.hypot(gr-nr,gc-nc)});
        }
      }
    }
    return [];
  }

  _clearExplicitCombatOrder(u){
    u.manualTarget=null;u.groundTarget=null;u.attackLastKnown=null;u.attackPathTarget=null;u.attackRepathAt=0;
  }

  _issueMove(u,x,y,manual=true,preserveCombatOrder=false,orderKind=null){
    u.moveGoal={x,y};u.path=this._findPath(u,x,y);
    if(!preserveCombatOrder)this._clearExplicitCombatOrder(u);
    if(orderKind)u.orderKind=orderKind;
    else if(manual)u.orderKind='move';
    if(manual && u.configuration==='tracked_supply_carrier')u.manualMoveUntil=this.time+this.rules.supply.manual_override_seconds;
  }

  _issueAttackTarget(u,target){
    u.manualTarget=target.id;u.autoTarget=null;u.groundTarget=null;u.path=[];u.moveGoal=null;
    u.orderKind='attack_target';u.attackLastKnown={x:target.x,y:target.y,time:this.time};
    u.attackPathTarget=null;u.attackRepathAt=0;u.autoChasing=false;u.returningToAnchor=false;
  }

  _knownTargetPoint(observerFaction,target){
    const intel=this._intelFor(observerFaction,target);
    if(['track','fire_control','identified'].includes(intel.level))return {x:target.x,y:target.y,level:intel.level};
    const m=this.memory[observerFaction].get(target.id);
    return m?{x:m.x,y:m.y,level:m.level??'last_known'}:null;
  }

  _attackStopRange(u){
    return Math.max(u.minRange??0,Math.max(0,u.weaponRange-(this.rules.combat.attack_stop_hysteresis??.2)));
  }

  _navigateAttack(u,point,orderKind='attack_target'){
    const c=this.rules.combat,old=u.attackPathTarget;
    const moved=!old||Math.hypot(point.x-old.x,point.y-old.y)>c.attack_repath_distance;
    if(!u.path.length||this.time>=u.attackRepathAt||moved){
      this._issueMove(u,point.x,point.y,false,true,orderKind);
      u.attackPathTarget={x:point.x,y:point.y};u.attackRepathAt=this.time+c.attack_repath_seconds;
    }
  }


  _issueFormationMove(units,gx,gy,manual=true){
    if(!units.length)return;
    const form=this.formation;
    const fr=this.rules.formation;
    const spacing=form==='compact'?fr.compact_spacing:form==='line'?fr.line_spacing:fr.spread_spacing;
    let frontage=form==='line'?units.length:fr.default_frontage;
    if(form==='compact')frontage=Math.min(frontage,Math.ceil(Math.sqrt(units.length)));
    const avg={x:units.reduce((s,u)=>s+u.x,0)/units.length,y:units.reduce((s,u)=>s+u.y,0)/units.length};
    const dir=Math.atan2(gy-avg.y,gx-avg.x),right={x:-Math.sin(dir),y:Math.cos(dir)},back={x:-Math.cos(dir),y:-Math.sin(dir)};
    const maxFoot=Math.sqrt(Math.max(...units.map(u=>u.footprint)));
    const cell=Math.max(.4,spacing+maxFoot*.22);
    const ordered=[...units].sort((a,b)=>a.id.localeCompare(b.id));
    ordered.forEach((u,i)=>{
      const col=i%frontage,row=Math.floor(i/frontage),rowCount=Math.min(frontage,ordered.length-row*frontage);
      const centered=col-(rowCount-1)/2;
      const x=clamp(gx+right.x*centered*cell+back.x*row*cell,.2,this.map.width-.2);
      const y=clamp(gy+right.y*centered*cell+back.y*row*cell,.2,this.map.height-.2);
      u.formation=form;this._issueMove(u,x,y,manual);
    });
  }

  _updateMovement(u,dt){
    if(!u.path.length)return;
    const p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy);
    if(d<.05){
      u.path.shift();
      if(!u.path.length){
        u.moveGoal=null;
        if(u.orderKind==='move'){u.defensiveAnchor={x:u.x,y:u.y};u.orderKind='idle';}
        if(u.returningToAnchor){u.returningToAnchor=false;u.orderKind='idle';}
      }
      return;
    }
    const tile=this.tileAt(u.x,u.y),next=this.tileAt(p.x,p.y);
    const supMove=1-(u.suppression/u.maxSuppression)*this.rules.combat.suppression_move_penalty;
    const speed=u.speed*this._moveMultiplier(u,next,tile)*supMove;
    const step=Math.min(d,speed*dt),nx=dx/d,ny=dy/d;
    u.x+=nx*step;u.y+=ny*step;u.heading=Math.atan2(ny,nx);
    u.z=this.heightAt(u.x,u.y)+(u.locomotionClass==='air'?1.8:0);
  }

  // ---------- signature / cover / line of sight ----------

  _effectiveCover(target){
    const raw=this.terrainDefAt(target.x,target.y)?.cover??0;
    return clamp(raw/(1+target.size/this.rules.signature.size_cover_scale),0,.95);
  }

  _effectiveSignature(target){
    const r=this.rules.signature;let sig=target.baseSignature;
    if(target.emission){
      const nightFactor=clamp(1.15-this.battlefieldVisibility,.15,.90);
      sig*=1+(r.emission_multiplier-1)*nightFactor;
    }
    if(target.path.length)sig*=r.moving_multiplier;
    if(target.recentFire>0)sig*=r.firing_multiplier;
    sig*=1-this._effectiveCover(target)*r.cover_max_reduction;
    let nearby=0;
    for(const u of this.units.values())if(u.alive&&u.id!==target.id&&u.faction===target.faction&&dist(u,target)<r.local_cluster_radius)nearby++;
    sig*=1+Math.min(r.local_cluster_cap,nearby*r.local_cluster_step);
    return Math.max(1,sig);
  }

  _visualOpacity(u){return clamp(.5+.5*(this._effectiveSignature(u)/80),.5,1);}

  _lineOfSight(observer,target){
    const obsGround=this.heightAt(observer.x,observer.y),tarGround=this.heightAt(target.x,target.y);
    const obsZ=obsGround+observer.height,tarZ=tarGround+(target.height??.2)*.55;
    return this._lineOfSightPoints(observer.x,observer.y,obsZ,target.x,target.y,tarZ,observer.id,target.id);
  }

  _lineOfSightPoints(ax,ay,az,bx,by,bz,ignoreA=null,ignoreB=null){
    const r=this.rules.los,d=Math.hypot(bx-ax,by-ay);if(d<.01)return true;
    const n=Math.max(1,Math.ceil(d/r.sample_step));let occ=0,lastKey='';
    for(let i=1;i<n;i++){
      const t=i/n,x=lerp(ax,bx,t),y=lerp(ay,by,t),tile=this.tileAt(x,y),k=`${Math.floor(x)},${Math.floor(y)}`;
      if(k===lastKey)continue;lastKey=k;
      const rayZ=lerp(az,bz,t),terrainZ=tile.height;
      if(terrainZ>rayZ-r.elevation_margin)return false;
      const c=this.terrainDefs.terrain_presets[tile.terrain]?.cover??0;
      const heightFactor=clamp(1-(rayZ-terrainZ)/Math.max(1,az+bz),.15,1);
      occ+=c*r.cover_occlusion_scale*heightFactor;
      if(occ>r.occlusion_limit)return false;
    }
    const abx=bx-ax,aby=by-ay,ab2=abx*abx+aby*aby;
    for(const blocker of this.units.values()){
      if(!blocker.alive||blocker.id===ignoreA||blocker.id===ignoreB||blocker.locomotionClass==='air')continue;
      const apx=blocker.x-ax,apy=blocker.y-ay,t=clamp((apx*abx+apy*aby)/Math.max(.0001,ab2),0,1);
      if(t<=.05||t>=.95)continue;
      const cx=ax+abx*t,cy=ay+aby*t,lateral=Math.hypot(blocker.x-cx,blocker.y-cy),blockRadius=.10+Math.sqrt(blocker.footprint)*.09;
      if(lateral>blockRadius)continue;
      const rayZ=lerp(az,bz,t),blockerZ=this.heightAt(blocker.x,blocker.y)+blocker.height;
      if(blockerZ>=rayZ*.88)return false;
    }
    return true;
  }

  // ---------- sensors / intel ----------

  _visualRange(o){
    const s=this.rules.sensors,elev=this.heightAt(o.x,o.y);
    return s.visual_base_range+s.visual_height_range_scale*Math.sqrt(Math.max(0,o.height))+s.visual_elevation_range_scale*elev+(o.locomotionClass==='air'?s.visual_air_range_bonus:0);
  }

  _visualQuality(observer,target){
    const s=this.rules.sensors,d=dist(observer,target);
    const sameTile=Math.floor(observer.x)===Math.floor(target.x)&&Math.floor(observer.y)===Math.floor(target.y);
    if(sameTile||d<=s.visual_close_identify_range)return 1;
    const range=this._visualRange(observer);if(d>range||!this._lineOfSight(observer,target))return 0;
    const distanceFactor=1-.65*clamp(d/range,0,1);
    const visibilityFactor=s.visual_visibility_floor+(1-s.visual_visibility_floor)*this.battlefieldVisibility;
    const signatureFactor=.82+.18*clamp(this._effectiveSignature(target)/100,0,1);
    return clamp(distanceFactor*visibilityFactor*signatureFactor,0,1);
  }

  _specialQuality(observer,target){
    const s=this.rules.sensors,d=dist(observer,target);if(d>observer.sensorRange)return 0;
    const rangeFactor=Math.pow(clamp(1-d/Math.max(.001,observer.sensorRange),0,1),s.range_falloff_power);
    const strength=clamp(observer.sensorStrength/100,0,1),signature=clamp(this._effectiveSignature(target)/100,0,1);
    const raw=strength*s.strength_weight+signature*s.signature_weight;
    return clamp(raw*(.28+.72*rangeFactor),0,1);
  }

  _observation(observer,target){
    const visual=this._visualQuality(observer,target),special=this._specialQuality(observer,target);
    const q=Math.max(visual,special);
    const resolution=Math.max(visual*this.rules.sensors.visual_resolution/100,special*observer.sensorResolution/100);
    return {q,resolution,source:visual>=special?'eyes':'special'};
  }

  _intelFor(observerFaction,target){
    if(target.faction===observerFaction)return {level:'identified',q:1,resolution:1,source:'own'};
    return this.intel[observerFaction].get(target.id)??{level:'unknown',q:0,resolution:0,source:'none'};
  }

  _computeIntel(observerFaction,target){
    const s=this.rules.sensors;let bestQ=0,bestRes=0,source='none';
    for(const o of this.units.values())if(o.alive&&o.faction===observerFaction){
      const r=this._observation(o,target);
      if(r.q>bestQ){bestQ=r.q;source=r.source;}
      if(r.resolution>bestRes)bestRes=r.resolution;
    }
    let level='unknown';
    if(bestQ>=s.contact_threshold)level='contact';
    if(bestQ>=s.track_threshold)level='track';
    if(bestQ>=s.fire_control_threshold)level='fire_control';
    if(bestRes>=s.identification_threshold&&bestQ>=s.track_threshold)level='identified';
    return {level,q:bestQ,resolution:bestRes,source};
  }

  _updateIntel(){
    for(const faction of ['human','machine']){
      const map=this.intel[faction];map.clear();
      const mem=this.memory[faction];
      for(const target of this.units.values())if(target.alive&&target.faction!==faction){
        const intel=this._computeIntel(faction,target);map.set(target.id,intel);
        if(intel.level!=='unknown'){
          const mx=intel.level==='contact'?Math.floor(target.x)+.5:target.x;
          const my=intel.level==='contact'?Math.floor(target.y)+.5:target.y;
          mem.set(target.id,{...intel,x:mx,y:my,time:this.time});
        }
      }
      for(const [id,m] of [...mem])if(this.time-m.time>this.rules.sensors.memory_seconds)mem.delete(id);
    }
    this._updateFog();
  }

  _updateFog(){
    for(let y=0;y<this.map.height;y++)for(let x=0;x<this.map.width;x++)if(this.fog[y][x]===2)this.fog[y][x]=1;
    const humans=[...this.units.values()].filter(u=>u.alive&&u.faction==='human');
    for(const o of humans){
      const range=this._visualRange(o),oz=this.heightAt(o.x,o.y)+o.height;
      for(let y=Math.max(0,Math.floor(o.y-range));y<=Math.min(this.map.height-1,Math.ceil(o.y+range));y++)for(let x=Math.max(0,Math.floor(o.x-range));x<=Math.min(this.map.width-1,Math.ceil(o.x+range));x++){
        const tx=x+.5,ty=y+.5,d=Math.hypot(tx-o.x,ty-o.y);if(d>range)continue;
        const tz=this.map.tiles[y][x].height+.2;
        if(this._lineOfSightPoints(o.x,o.y,oz,tx,ty,tz,o.id,null))this.fog[y][x]=2;
      }
    }
  }

  _humanDisplayState(u){
    if(u.faction==='human'||(this.debugEnemyControl&&u.faction==='machine'))return {level:'identified',x:u.x,y:u.y};
    const intel=this._intelFor('human',u);
    if(intel.level!=='unknown')return {level:intel.level,x:intel.level==='contact'?Math.floor(u.x)+.5:u.x,y:intel.level==='contact'?Math.floor(u.y)+.5:u.y};
    const m=this.memory.human.get(u.id);
    if(m)return {level:'last_known',x:m.x,y:m.y};
    return {level:'unknown',x:u.x,y:u.y};
  }

  // ---------- combat ----------

  _armorAgainst(target,attacker){
    const incoming=Math.atan2(attacker.y-target.y,attacker.x-target.x);
    return angleDiff(incoming,target.heading)<=this.rules.combat.front_armor_half_angle_deg*Math.PI/180?target.armorFront:target.armorOther;
  }

  _selectAutoTarget(u){
    if(u.stance==='passive'||u.stance==='concealed'||u.rateOfFire<=0)return null;
    let best=null,bestScore=-Infinity;
    for(const e of this.units.values())if(e.alive&&e.faction!==u.faction){
      const intel=this._intelFor(u.faction,e);if(intel.level!=='fire_control'&&intel.level!=='identified')continue;
      const d=dist(u,e),chase=u.stance==='aggressive'?this.rules.ai.aggressive_chase_range:this.rules.ai.defensive_chase_range;
      if(d>u.weaponRange+chase)continue;
      const score=(1-d/(u.weaponRange+chase+.001))*2+(1-e.hp/e.maxHp);
      if(score>bestScore){bestScore=score;best=e;}
    }
    return best;
  }

  _fireAt(u,target){
    if(!u.alive||!target?.alive||u.supplyState<1||u.rateOfFire<=0)return false;
    const d=dist(u,target),minR=u.minRange??0;if(d>u.weaponRange||d<minR)return false;
    const obs=this._observation(u,target),s=this.rules.sensors;if(obs.q<s.track_threshold)return false;
    if(!u.indirectFire&&!this._lineOfSight(u,target))return false;

    u.supplyState=Math.max(0,u.supplyState-1);u.fireCooldown=1/Math.max(.01,u.rateOfFire);u.recentFire=this.rules.signature.firing_seconds;
    u.heading=Math.atan2(target.y-u.y,target.x-u.x);

    if(u.indirectFire){this._scheduleArtillery(u,target.x,target.y,.45+.55*obs.q);return true;}

    const c=this.rules.combat,supPenalty=1-(u.suppression/u.maxSuppression)*c.suppression_accuracy_penalty;
    let fc;
    if(obs.q<s.fire_control_threshold){
      const t=clamp((obs.q-s.track_threshold)/(s.fire_control_threshold-s.track_threshold),0,1);fc=lerp(c.weak_track_accuracy_min,c.weak_track_accuracy_max,t);
    }else{
      const t=clamp((obs.q-s.fire_control_threshold)/(1-s.fire_control_threshold),0,1);fc=lerp(c.fire_control_accuracy_min,1,t);
    }
    const effectiveAcc=clamp(u.accuracy*fc*supPenalty,.01,.98),hit=Math.random()<effectiveAcc;
    this._addEvent({type:'direct_shot',faction:u.faction,from:{x:u.x,y:u.y,z:u.z+.25},to:{x:target.x,y:target.y,z:target.z+.25},hit,duration:.22});

    const cover=this._effectiveCover(target),armor=this._armorAgainst(target,u),supRes=(1-cover*c.cover_suppression_reduction)*(1-clamp(armor/c.suppression_armor_scale,0,.55))/(1+target.size/c.suppression_size_scale);
    if(hit){
      if((u.splashRadius??0)>0){
        this._applySplashImpact(u,target.x,target.y,u.splashRadius,1,target);
      }else{
        const dmg=Math.max(0,u.damage-armor);target.hp=Math.max(0,target.hp-dmg);target.suppression=clamp(target.suppression+u.suppressionPower*supRes,0,target.maxSuppression);
        if(target.hp<=0)this._kill(target,u);
      }
    }else target.suppression=clamp(target.suppression+u.suppressionPower*.28*supRes,0,target.maxSuppression);
    return true;
  }

  _fireGround(u,x,y){
    if(!u.alive||u.supplyState<1||u.rateOfFire<=0)return false;
    const d=Math.hypot(x-u.x,y-u.y),minR=u.minRange??0;if(d>u.weaponRange||d<minR)return false;
    if(!u.indirectFire){
      const pseudo={id:null,x,y,height:.2};if(!this._lineOfSight(u,pseudo))return false;
    }
    u.supplyState=Math.max(0,u.supplyState-1);u.fireCooldown=1/Math.max(.01,u.rateOfFire);u.recentFire=this.rules.signature.firing_seconds;u.heading=Math.atan2(y-u.y,x-u.x);
    if(u.indirectFire)this._scheduleArtillery(u,x,y,1);
    else{
      const c=this.rules.combat,miss=Math.max(0,1-u.accuracy),a=Math.random()*TAU,r=Math.sqrt(Math.random())*miss*.55,ix=clamp(x+Math.cos(a)*r,.05,this.map.width-.05),iy=clamp(y+Math.sin(a)*r,.05,this.map.height-.05);
      this._addEvent({type:'direct_shot',faction:u.faction,from:{x:u.x,y:u.y,z:u.z+.25},to:{x:ix,y:iy,z:this.heightAt(ix,iy)+.2},hit:false,duration:.22});
      this._applySplashImpact(u,ix,iy,Math.max(c.direct_attack_ground_radius,u.splashRadius??0),.45);
    }
    return true;
  }

  _scheduleArtillery(u,x,y,accuracyFactor){
    const c=this.rules.combat,d=Math.hypot(x-u.x,y-u.y),miss=Math.max(0,1-u.accuracy*accuracyFactor),scatter=miss*c.artillery_scatter_scale*(.45+.55*d/Math.max(1,u.weaponRange)),a=Math.random()*TAU,r=Math.sqrt(Math.random())*scatter;
    const ix=clamp(x+Math.cos(a)*r,.05,this.map.width-.05),iy=clamp(y+Math.sin(a)*r,.05,this.map.height-.05);
    this._addEvent({type:'artillery_round',faction:u.faction,from:{x:u.x,y:u.y,z:u.z+.5},to:{x:ix,y:iy,z:this.heightAt(ix,iy)+.2},duration:c.artillery_flight_time,applied:false,shooterId:u.id,damage:u.damage,suppressionPower:u.suppressionPower,radius:Math.max(.01,u.splashRadius??0)});
  }

  _applySplashImpact(shooter,x,y,radius,damageScale=1,primaryTarget=null){
    const c=this.rules.combat,r=Math.max(.001,radius),k=c.splash_falloff_strength??4;
    for(const target of this.units.values())if(target.alive){
      const d=Math.hypot(target.x-x,target.y-y);if(d>r)continue;
      // Stable inverse-distance falloff: full effect at the epicentre, then rapidly
      // decreasing towards the edge. Cut off completely outside splashRadius.
      const falloff=1/(1+k*(d/r));
      const cover=this._effectiveCover(target);
      const armor=primaryTarget?.id===target.id ? this._armorAgainst(target,shooter) : (target.armorOther??0);
      const dmg=Math.max(0,shooter.damage*damageScale*falloff-armor);
      target.hp=Math.max(0,target.hp-dmg);
      const supRes=(1-cover*c.cover_suppression_reduction)*(1-clamp(armor/c.suppression_armor_scale,0,.55))/(1+target.size/c.suppression_size_scale);
      target.suppression=clamp(target.suppression+shooter.suppressionPower*falloff*supRes,0,target.maxSuppression);
      if(target.hp<=0)this._kill(target,shooter);
    }
    this._addEvent({type:'impact',faction:shooter.faction,at:{x,y,z:this.heightAt(x,y)+.15},radius:r,duration:.35});
  }

  _updateCombat(u,dt){
    const c=this.rules.combat;
    u.fireCooldown=Math.max(0,u.fireCooldown-dt);u.recentFire=Math.max(0,u.recentFire-dt);u.suppression=Math.max(0,u.suppression-c.suppression_decay_per_second*dt);

    if(u.groundTarget){if(u.fireCooldown<=0)this._fireGround(u,u.groundTarget.x,u.groundTarget.y);return;}

    // Explicit Attack Target is a hard player/AI intent and overrides stance.
    // Stance governs autonomous target acquisition only.
    if(u.manualTarget){
      const target=this.units.get(u.manualTarget);
      if(!target?.alive){this._clearExplicitCombatOrder(u);u.path=[];u.moveGoal=null;u.orderKind='idle';return;}
      const known=this._knownTargetPoint(u.faction,target);
      if(!known){this._clearExplicitCombatOrder(u);u.path=[];u.moveGoal=null;u.orderKind='idle';return;}
      if(['track','fire_control','identified'].includes(known.level))u.attackLastKnown={x:known.x,y:known.y,time:this.time};

      const hasTrack=['track','fire_control','identified'].includes(known.level);
      if(!hasTrack){
        const p=u.attackLastKnown??known,dKnown=Math.hypot(u.x-p.x,u.y-p.y);
        if(dKnown<=c.attack_last_known_arrival){
          this._clearExplicitCombatOrder(u);u.path=[];u.moveGoal=null;u.orderKind='idle';return;
        }
        this._navigateAttack(u,p);return;
      }

      const d=dist(u,target),minR=u.minRange??0,stopR=this._attackStopRange(u);
      if(d<minR){
        // No automatic kiting: minimum range is an intentional vulnerability.
        u.path=[];u.moveGoal=null;
        return;
      }
      if(d>u.weaponRange){this._navigateAttack(u,known);return;}
      if(d>stopR){
        // Enter the range band, then continue a little further before stopping.
        // This 0.2-tile hysteresis prevents move/fire oscillation at the exact boundary.
        this._navigateAttack(u,known);return;
      }

      u.path=[];u.moveGoal=null;u.attackPathTarget=null;
      if(u.fireCooldown<=0)this._fireAt(u,target);
      return;
    }

    let target=this._selectAutoTarget(u);u.autoTarget=target?.id??null;
    if(target){
      const d=dist(u,target),minR=u.minRange??0,stopR=this._attackStopRange(u);
      if(d>=minR&&d<=u.weaponRange){
        // Autonomous fire does not cancel an explicit Move destination.
        if(u.fireCooldown<=0)this._fireAt(u,target);
        return;
      }
      const autonomousPathFree=!u.moveGoal||u.orderKind==='auto_chase';
      if(autonomousPathFree&&d>u.weaponRange){
        if(u.stance==='aggressive'){
          this._navigateAttack(u,{x:target.x,y:target.y},'auto_chase');u.autoChasing=true;
        }else if(u.stance==='defensive'){
          const anchor=u.defensiveAnchor??{x:u.x,y:u.y};
          const maxFromAnchor=u.weaponRange+this.rules.ai.defensive_chase_range;
          if(Math.hypot(target.x-anchor.x,target.y-anchor.y)<=maxFromAnchor){
            this._navigateAttack(u,{x:target.x,y:target.y},'auto_chase');u.autoChasing=true;
          }
        }
      }
      return;
    }

    // AoE/C&C-style defensive leash: after an autonomous defensive chase, return.
    if(u.autoChasing&&u.stance==='defensive'&&!u.moveGoal){
      u.autoChasing=false;
      const a=u.defensiveAnchor??{x:u.x,y:u.y};
      if(Math.hypot(u.x-a.x,u.y-a.y)>.12){u.returningToAnchor=true;this._issueMove(u,a.x,a.y,false,true,'return_anchor');}
    }
  }

  _kill(u){u.alive=false;this.selected=this.selected.filter(id=>id!==u.id);this.view.removeEntity(u.id);this.view.setSelection(this.selected);for(const faction of ['human','machine']){this.intel[faction].delete(u.id);this.memory[faction].delete(u.id);}}

  // ---------- supply ----------

  _transferSupply(dt){
    const r=this.rules.supply,carriers=[...this.units.values()].filter(u=>u.alive&&u.configuration==='tracked_supply_carrier'&&u.supplyState>0);
    for(const c of carriers)for(const u of this.units.values())if(u.alive&&u.faction===c.faction&&u.id!==c.id&&u.supplyState<u.supplyCapacity-.01&&dist(c,u)<=r.transfer_range){
      const amount=Math.min(r.transfer_per_second*dt,c.supplyState,u.supplyCapacity-u.supplyState);c.supplyState-=amount;u.supplyState+=amount;
    }
  }

  _nearestKnownEnemy(faction,x,y){
    let best=null,bd=Infinity;for(const e of this.units.values())if(e.alive&&e.faction!==faction){const intel=this._intelFor(faction,e);if(intel.level==='unknown')continue;const d=Math.hypot(e.x-x,e.y-y);if(d<bd){bd=d;best=e;}}
    return {enemy:best,distance:bd};
  }

  _updateAutoSupply(){
    const r=this.rules.supply;if(this.time-this.lastSupplyThink<r.auto_think_seconds)return;this.lastSupplyThink=this.time;
    for(const c of this.units.values())if(c.alive&&c.configuration==='tracked_supply_carrier'&&c.autoSupply&&c.supplyState>0&&this.time>=c.manualMoveUntil){
      const local=this._nearestKnownEnemy(c.faction,c.x,c.y);
      if(local.enemy&&local.distance<r.auto_safe_enemy_range){
        const dx=c.x-local.enemy.x,dy=c.y-local.enemy.y,d=Math.hypot(dx,dy)||1;if(!c.path.length)this._issueMove(c,clamp(c.x+dx/d*2.5,.5,this.map.width-.5),clamp(c.y+dy/d*2.5,.5,this.map.height-.5),false);c.autoSupplyTarget=null;continue;
      }
      let current=this.units.get(c.autoSupplyTarget);if(current&&(!current.alive||current.faction!==c.faction||current.supplyState/current.supplyCapacity>=r.auto_stop_ratio))current=null;
      if(!current){
        const candidates=[...this.units.values()].filter(u=>u.alive&&u.faction===c.faction&&u.id!==c.id&&u.configuration!=='tracked_supply_carrier'&&u.supplyState/u.supplyCapacity<r.auto_request_ratio);
        candidates.sort((a,b)=>(a.supplyState/a.supplyCapacity-b.supplyState/b.supplyCapacity)*4+(dist(c,a)-dist(c,b))*.08);current=candidates[0]??null;c.autoSupplyTarget=current?.id??null;
      }
      if(current){
        const threat=this._nearestKnownEnemy(c.faction,current.x,current.y);if(threat.enemy&&threat.distance<r.auto_safe_enemy_range){c.autoSupplyTarget=null;continue;}
        if(dist(c,current)>r.transfer_range*.85&&!c.path.length){
          let gx=current.x,gy=current.y;if(threat.enemy){const dx=current.x-threat.enemy.x,dy=current.y-threat.enemy.y,d=Math.hypot(dx,dy)||1;gx+=dx/d*r.auto_standoff;gy+=dy/d*r.auto_standoff;}
          this._issueMove(c,clamp(gx,.4,this.map.width-.4),clamp(gy,.4,this.map.height-.4),false);
        }
      }
    }
  }

  // ---------- machine test AI ----------

  _updateAI(){
    const r=this.rules.ai;if(this.time-this.lastAiThink<r.think_seconds)return;this.lastAiThink=this.time;
    for(const u of this.units.values())if(u.alive&&u.faction==='machine'){
      if(u.hp/u.maxHp<r.retreat_hp_fraction&&u.stance!=='passive'){
        u.stance='passive';this._clearExplicitCombatOrder(u);u.autoTarget=null;
        const dx=u.x-this.map.width*.5,dy=u.y-this.map.height*.5,d=Math.hypot(dx,dy)||1;
        if(!u.path.length)this._issueMove(u,clamp(u.x+dx/d*3,.5,this.map.width-.5),clamp(u.y+dy/d*3,.5,this.map.height-.5),false,false,'retreat');
        continue;
      }
      if(u.configuration==='recon_drone'&&this.time>=u.nextReconPatrol&&!u.path.length&&!u.manualTarget){
        u.nextReconPatrol=this.time+r.recon_patrol_seconds;
        this._issueMove(u,clamp(this.map.width*.5+(Math.random()-.5)*8,.5,this.map.width-.5),clamp(this.map.height*.5+(Math.random()-.5)*8,.5,this.map.height-.5),false,false,'recon_patrol');
      }
      if(u.stance==='aggressive'&&!u.manualTarget&&!u.path.length&&!this._selectAutoTarget(u)){
        const memories=[...this.memory.machine.values()].sort((a,b)=>b.time-a.time),m=memories[0];
        if(m)this._issueMove(u,m.x,m.y,false,false,'search');
      }
    }
  }

  // ---------- transient events ----------

  _addEvent(e){this.events.push({id:this.nextFxId++,...e,age:0});}
  _updateEvents(dt){
    for(const e of this.events){
      e.age+=dt;
      if(e.type==='artillery_round'&&!e.applied&&e.age>=e.duration*.82){
        e.applied=true;
        const live=this.units.get(e.shooterId);
        const source=live??{damage:e.damage,suppressionPower:e.suppressionPower,faction:e.faction};
        this._applySplashImpact(source,e.to.x,e.to.y,e.radius,1);
      }
    }
    this.events=this.events.filter(e=>e.age<e.duration);
  }
  _eventVisibleToHuman(e){
    if(e.faction==='human')return true;
    const p=e.type==='impact'?e.at:e.to;const tile=this.fog[clamp(Math.floor(p.y),0,this.map.height-1)]?.[clamp(Math.floor(p.x),0,this.map.width-1)]??0;return tile>=2;
  }

  // ---------- presentation publication ----------

  _toView(u,intelLevel=null,displayPos=null){
    const level=intelLevel??(u.faction==='human'?'identified':this._humanDisplayState(u).level),pos=displayPos??{x:u.x,y:u.y};
    return {
      id:u.id,
      visual:{kind:'modular_unit',...u.assembly},
      x:pos.x,y:pos.y,z:this.heightAt(pos.x,pos.y)+(u.locomotionClass==='air'?1.8:0),
      faction:u.faction,
      intelLevel:level,
      visualOpacity:this._visualOpacity(u),
      hp:u.hp,maxHp:u.maxHp,
      suppression:u.suppression,maxSuppression:u.maxSuppression,
      supplyState:u.supplyState,supplyCapacity:u.supplyCapacity,
      sensorRange:u.sensorRange,
      visualSensorRange:this._visualRange(u),
      presentationIndicators:u.presentationIndicators
    };
  }

  _publishViews(force=false){
    for(const u of this.units.values())if(u.alive){
      const d=this._humanDisplayState(u),patch=this._toView(u,d.level,{x:d.x,y:d.y});
      this.view.updateEntity(u.id,patch);
    }
  }
}
