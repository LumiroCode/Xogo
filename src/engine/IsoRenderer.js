import { IsoMath } from './IsoMath.js';
import { Camera } from './Camera.js';
import { Scene } from './Scene.js';
import { AssetStore } from './AssetStore.js';

const TERRAIN = {
  grass: ['#526b4c','#465e42'], forest: ['#3d5b42','#344e3a'], road: ['#676863','#595a56'],
  rock: ['#626861','#555b55'], water: ['#375d6b','#315562'], dirt: ['#716452','#655846']
};

export class IsoRenderer {
  constructor(canvas, opts={}) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d',{alpha:false});
    this.iso=new IsoMath(opts.tileW??96,opts.tileH??48,opts.elevationStep??18);
    this.camera=new Camera(); this.scene=new Scene(); this.assets=new AssetStore(); this.map=null;
    this.flags={grid:false, heights:false, sensors:false, fog:true}; this.hoverId=null;
    this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(canvas); this.resize();
  }
  resize(){ const dpr=Math.min(devicePixelRatio||1,2); const r=this.canvas.getBoundingClientRect(); this.canvas.width=Math.max(1,Math.floor(r.width*dpr)); this.canvas.height=Math.max(1,Math.floor(r.height*dpr)); this.dpr=dpr; }
  setMap(map){ this.map=map; }
  setFlag(k,v){ this.flags[k]=v; }
  toggle(k){ this.flags[k]=!this.flags[k]; return this.flags[k]; }
  screenToWorld(clientX,clientY){
    const r=this.canvas.getBoundingClientRect();
    const p=this.camera.canvasToWorldScreen(clientX-r.left,clientY-r.top,r.width,r.height);
    const flat=this.iso.isoToWorld(p.x,p.y,0);
    if(!this.map) return flat;
    // Elevation-aware inverse pick: find the projected top diamond first, then
    // invert with that tile's z. This prevents commands from sliding downhill.
    let best=null;
    const bx=Math.floor(flat.x), by=Math.floor(flat.y);
    for(let y=Math.max(0,by-3);y<=Math.min(this.map.height-1,by+3);y++) for(let x=Math.max(0,bx-3);x<=Math.min(this.map.width-1,bx+3);x++){
      const h=this._tileHeight(x,y), c=this.iso.worldToIso(x+.5,y+.5,h);
      const metric=Math.abs((p.x-c.x)/(this.iso.tileW*.5))+Math.abs((p.y-c.y)/(this.iso.tileH*.5));
      if(metric<=1 && (!best || (x+y+h*.01)>best.order)) best={x,y,h,order:x+y+h*.01};
    }
    if(!best) return flat;
    const exact=this.iso.isoToWorld(p.x,p.y,best.h);
    return {x:Math.max(best.x,Math.min(best.x+.999,exact.x)),y:Math.max(best.y,Math.min(best.y+.999,exact.y))};
  }
  entityAt(clientX,clientY){
    const r=this.canvas.getBoundingClientRect(); const mx=clientX-r.left,my=clientY-r.top; let best=null;
    for(const e of this._sortedEntities().reverse()){
      if(e.visibility==='hidden') continue; const s=this._entityScreen(e,r.width,r.height); const a=this.assets.get(e.visual); if(!a) continue;
      const w=(a.width??86)*this.camera.zoom, h=(a.height??70)*this.camera.zoom;
      if(mx>=s.x-w/2 && mx<=s.x+w/2 && my>=s.y-h && my<=s.y+8*this.camera.zoom){ best=e; break; }
    }
    return best;
  }
  _entityScreen(e,w,h){ const p=this.iso.worldToIso(e.x,e.y,e.z??0); return this.camera.worldScreenToCanvas(p,w,h); }
  _sortedEntities(){ return this.scene.snapshot().sort((a,b)=>((a.x+a.y+(a.z??0)*.01)-(b.x+b.y+(b.z??0)*.01)) || (a.x-b.x)); }
  render(extra={}){
    const ctx=this.ctx,dpr=this.dpr,r=this.canvas.getBoundingClientRect(),W=r.width,H=r.height;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle='#172126'; ctx.fillRect(0,0,W,H);
    if(this.map) this._drawMap(ctx,W,H);
    this._drawObjects(ctx,W,H);
    if(this.flags.fog && extra.fog) this._drawFog(ctx,W,H,extra.fog);
    if(this.flags.sensors) this._drawSensors(ctx,W,H);
    if(extra.commandMarker) this._drawCommandMarker(ctx,W,H,extra.commandMarker);
  }
  _tileHeight(x,y){ return this.map?.tiles?.[y]?.[x]?.height??0; }
  _drawMap(ctx,W,H){
    const tw=this.iso.tileW,th=this.iso.tileH,z=this.camera.zoom;
    // Isometric painter order: diagonals from far to near.
    for(let sum=0;sum<=this.map.width+this.map.height-2;sum++) for(let x=0;x<this.map.width;x++){
      const y=sum-x; if(y<0||y>=this.map.height) continue;
      const t=this.map.tiles[y][x], p=this.iso.worldToIso(x+.5,y+.5,t.height), s=this.camera.worldScreenToCanvas(p,W,H);
      const colors=TERRAIN[t.terrain]??TERRAIN.grass; ctx.beginPath();
      ctx.moveTo(s.x,s.y-th*.5*z);ctx.lineTo(s.x+tw*.5*z,s.y);ctx.lineTo(s.x,s.y+th*.5*z);ctx.lineTo(s.x-tw*.5*z,s.y);ctx.closePath();
      ctx.fillStyle=colors[(x+y)&1];ctx.fill();
      if(t.height>0){
        ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.moveTo(s.x-tw*.5*z,s.y);ctx.lineTo(s.x,s.y+th*.5*z);ctx.lineTo(s.x,s.y+th*.5*z+t.height*this.iso.elevationStep*z);ctx.lineTo(s.x-tw*.5*z,s.y+t.height*this.iso.elevationStep*z);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.035)';ctx.beginPath();ctx.moveTo(s.x+tw*.5*z,s.y);ctx.lineTo(s.x,s.y+th*.5*z);ctx.lineTo(s.x,s.y+th*.5*z+t.height*this.iso.elevationStep*z);ctx.lineTo(s.x+tw*.5*z,s.y+t.height*this.iso.elevationStep*z);ctx.closePath();ctx.fill();
      }
      if(this.flags.grid){ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.stroke();}
      if(this.flags.heights&&t.height){ctx.fillStyle='rgba(255,255,255,.55)';ctx.font=`${10*z}px monospace`;ctx.fillText(String(t.height),s.x-3*z,s.y+3*z);}
    }
  }
  _drawObjects(ctx,W,H){
    const queue=[];
    if(this.map){
      for(let y=0;y<this.map.height;y++) for(let x=0;x<this.map.width;x++){
        const t=this.map.tiles[y][x]; if(t.decor) queue.push({kind:'decor',key:t.decor,x:x+.5,y:y+.5,z:t.height,offset:((x*17+y*11)%3)-1});
      }
    }
    for(const e of this.scene.entities.values()) if(e.visibility!=='hidden') queue.push({kind:'entity',e,x:e.x,y:e.y,z:e.z??0});
    queue.sort((a,b)=>((a.x+a.y+a.z*.01)-(b.x+b.y+b.z*.01))||(a.x-b.x));
    for(const item of queue){
      if(item.kind==='decor') this._drawDecor(ctx,W,H,item);
      else this._drawEntity(ctx,W,H,item.e);
    }
  }
  _drawDecor(ctx,W,H,d){
    const a=this.assets.get(d.key); if(!a)return;
    const p=this.iso.worldToIso(d.x+d.offset*.08,d.y-d.offset*.06,d.z),s=this.camera.worldScreenToCanvas(p,W,H),z=this.camera.zoom,w=(a.width??70)*z,h=(a.height??80)*z;
    ctx.drawImage(a.image,s.x-w/2,s.y-h,w,h);
  }
  _drawFog(ctx,W,H,fog){
    const tw=this.iso.tileW,th=this.iso.tileH,z=this.camera.zoom;
    for(let sum=0;sum<=this.map.width+this.map.height-2;sum++) for(let x=0;x<this.map.width;x++){
      const y=sum-x;if(y<0||y>=this.map.height)continue;const state=fog[y]?.[x]??0;if(state>=2)continue;
      const h=this._tileHeight(x,y),p=this.iso.worldToIso(x+.5,y+.5,h),s=this.camera.worldScreenToCanvas(p,W,H);ctx.beginPath();ctx.moveTo(s.x,s.y-th*.5*z);ctx.lineTo(s.x+tw*.5*z,s.y);ctx.lineTo(s.x,s.y+th*.5*z);ctx.lineTo(s.x-tw*.5*z,s.y);ctx.closePath();ctx.fillStyle=state===1?'rgba(9,15,18,.38)':'rgba(7,11,14,.76)';ctx.fill();
    }
  }
  _drawSensors(ctx,W,H){ for(const e of this.scene.entities.values()){if(e.faction!=='human'||!e.sensorRange)continue;const p=this.iso.worldToIso(e.x,e.y,e.z??0),s=this.camera.worldScreenToCanvas(p,W,H),rx=e.sensorRange*this.iso.tileW*.5*this.camera.zoom,ry=e.sensorRange*this.iso.tileH*.5*this.camera.zoom;ctx.beginPath();ctx.ellipse(s.x,s.y,rx,ry,0,0,Math.PI*2);ctx.fillStyle='rgba(98,190,225,.055)';ctx.fill();ctx.strokeStyle='rgba(120,205,235,.25)';ctx.stroke();} }
  _drawEntity(ctx,W,H,e){
    const a=this.assets.get(e.visual);if(!a)return;const s=this._entityScreen(e,W,H),z=this.camera.zoom,w=(a.width??86)*z,h=(a.height??70)*z;
    ctx.save();if(e.visibility==='lastKnown')ctx.globalAlpha=.35;else if(e.visibility==='contact')ctx.globalAlpha=.58;
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(s.x,s.y+3*z,w*.32,9*z,0,0,Math.PI*2);ctx.fill();
    if(e.faction==='machine')ctx.filter='hue-rotate(155deg) saturate(1.15)';ctx.drawImage(a.image,s.x-w/2,s.y-h,w,h);ctx.filter='none';
    if(this.scene.selected.has(e.id)){ctx.strokeStyle='#e8f6ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(s.x,s.y,w*.38,12*z,0,0,Math.PI*2);ctx.stroke();}
    if(e.hp!=null){const bw=52*z,bh=4*z;ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(s.x-bw/2,s.y-h-8*z,bw,bh);ctx.fillStyle=e.faction==='human'?'#75c997':'#df726b';ctx.fillRect(s.x-bw/2,s.y-h-8*z,bw*Math.max(0,e.hp/e.maxHp),bh);}
    if(e.visibility==='contact'){ctx.fillStyle='#ffd37b';ctx.font=`bold ${13*z}px system-ui`;ctx.fillText('?',s.x+20*z,s.y-h+15*z);}ctx.restore();
  }

  _drawCommandMarker(ctx,W,H,m){ const h=this._tileHeight(Math.floor(m.x),Math.floor(m.y));const p=this.iso.worldToIso(m.x,m.y,h),s=this.camera.worldScreenToCanvas(p,W,H);const age=(performance.now()-m.time)/1000;if(age>1.2)return;ctx.save();ctx.globalAlpha=Math.max(0,1-age/1.2);ctx.strokeStyle='#d7f3ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(s.x,s.y,18*this.camera.zoom*(1+age),9*this.camera.zoom*(1+age),0,0,Math.PI*2);ctx.stroke();ctx.restore(); }
}
