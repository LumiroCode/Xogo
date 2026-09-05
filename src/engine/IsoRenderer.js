import { IsoMath } from './IsoMath.js';
import { Camera } from './Camera.js';
import { Scene } from './Scene.js';
import { AssetStore } from './AssetStore.js';

const FALLBACK_TERRAIN = ['#526b4c','#465e42'];

export class IsoRenderer {
  constructor(canvas, opts={}) {
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d',{alpha:false});
    this.iso=new IsoMath(opts.tileW??96,opts.tileH??48,opts.elevationStep??18);
    this.camera=new Camera();
    this.scene=new Scene();
    this.assets=new AssetStore();
    this.map=null;
    this.flags={grid:false, heights:false, sensors:false, fog:true};
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize(){
    const dpr=Math.min(devicePixelRatio||1,2), r=this.canvas.getBoundingClientRect();
    this.canvas.width=Math.max(1,Math.floor(r.width*dpr));
    this.canvas.height=Math.max(1,Math.floor(r.height*dpr));
    this.dpr=dpr;
  }
  setMap(map){ this.map=map; }
  setFlag(k,v){ this.flags[k]=v; }
  toggle(k){ this.flags[k]=!this.flags[k]; return this.flags[k]; }

  screenToWorld(clientX,clientY){
    const r=this.canvas.getBoundingClientRect();
    const p=this.camera.canvasToWorldScreen(clientX-r.left,clientY-r.top,r.width,r.height);
    const flat=this.iso.isoToWorld(p.x,p.y,0);
    if(!this.map) return flat;
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
    const r=this.canvas.getBoundingClientRect(), mx=clientX-r.left, my=clientY-r.top;
    for(const e of this._sortedEntities().reverse()){
      if(e.visibility==='hidden') continue;
      const a=this.assets.resolve(e.visual); if(!a) continue;
      const s=this._entityScreen(e,r.width,r.height), z=this.camera.zoom;
      const w=(a.width??86)*z,h=(a.height??70)*z;
      const ax=(a.anchorX??(a.width??86)/2)*z, ay=(a.anchorY??(a.height??70))*z;
      if(mx>=s.x-ax && mx<=s.x+(w-ax) && my>=s.y-ay && my<=s.y+(h-ay)+8*z) return e;
    }
    return null;
  }

  _entityScreen(e,w,h){ const p=this.iso.worldToIso(e.x,e.y,e.z??0); return this.camera.worldScreenToCanvas(p,w,h); }
  _sortedEntities(){ return this.scene.snapshot().sort((a,b)=>((a.x+a.y+(a.z??0)*.01)-(b.x+b.y+(b.z??0)*.01)) || (a.x-b.x)); }

  render(extra={}){
    const ctx=this.ctx,dpr=this.dpr,r=this.canvas.getBoundingClientRect(),W=r.width,H=r.height;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle='#172126'; ctx.fillRect(0,0,W,H);
    if(this.map) this._drawMap(ctx,W,H);
    this._drawObjects(ctx,W,H);
    if(extra.effects) this._drawEffects(ctx,W,H,extra.effects);
    if(this.flags.fog && extra.fog) this._drawFog(ctx,W,H,extra.fog);
    if(this.flags.sensors) this._drawSensors(ctx,W,H);
    if(extra.commandMarker) this._drawCommandMarker(ctx,W,H,extra.commandMarker);
  }

  _tileHeight(x,y){ return this.map?.tiles?.[y]?.[x]?.height??0; }

  _drawMap(ctx,W,H){
    const tw=this.iso.tileW,th=this.iso.tileH,z=this.camera.zoom;
    for(let sum=0;sum<=this.map.width+this.map.height-2;sum++) for(let x=0;x<this.map.width;x++){
      const y=sum-x; if(y<0||y>=this.map.height) continue;
      const t=this.map.tiles[y][x], p=this.iso.worldToIso(x+.5,y+.5,t.height), s=this.camera.worldScreenToCanvas(p,W,H);
      const colors=this.assets.terrainStyle(t.terrain)??FALLBACK_TERRAIN;
      ctx.beginPath();ctx.moveTo(s.x,s.y-th*.5*z);ctx.lineTo(s.x+tw*.5*z,s.y);ctx.lineTo(s.x,s.y+th*.5*z);ctx.lineTo(s.x-tw*.5*z,s.y);ctx.closePath();
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
        const t=this.map.tiles[y][x];
        if(t.decor) queue.push({kind:'decor',key:t.decor,x:x+.5,y:y+.5,z:t.height,offset:((x*17+y*11)%3)-1});
      }
    }
    for(const e of this.scene.entities.values()) if(e.visibility!=='hidden') queue.push({kind:'entity',e,x:e.x,y:e.y,z:e.z??0});
    queue.sort((a,b)=>((a.x+a.y+a.z*.01)-(b.x+b.y+b.z*.01))||(a.x-b.x));
    for(const item of queue) item.kind==='decor' ? this._drawDecor(ctx,W,H,item) : this._drawEntity(ctx,W,H,item.e);
  }

  _drawDecor(ctx,W,H,d){
    const a=this.assets.getStatic(d.key); if(!a)return;
    const p=this.iso.worldToIso(d.x+d.offset*.08,d.y-d.offset*.06,d.z),s=this.camera.worldScreenToCanvas(p,W,H),z=this.camera.zoom,w=(a.width??70)*z,h=(a.height??80)*z;
    ctx.drawImage(a.image,s.x-w/2,s.y-h,w,h);
  }

  _drawFog(ctx,W,H,fog){
    const tw=this.iso.tileW,th=this.iso.tileH,z=this.camera.zoom;
    for(let sum=0;sum<=this.map.width+this.map.height-2;sum++) for(let x=0;x<this.map.width;x++){
      const y=sum-x;if(y<0||y>=this.map.height)continue;const state=fog[y]?.[x]??0;if(state>=2)continue;
      const h=this._tileHeight(x,y),p=this.iso.worldToIso(x+.5,y+.5,h),s=this.camera.worldScreenToCanvas(p,W,H);
      ctx.beginPath();ctx.moveTo(s.x,s.y-th*.5*z);ctx.lineTo(s.x+tw*.5*z,s.y);ctx.lineTo(s.x,s.y+th*.5*z);ctx.lineTo(s.x-tw*.5*z,s.y);ctx.closePath();ctx.fillStyle=state===1?'rgba(9,15,18,.38)':'rgba(7,11,14,.76)';ctx.fill();
    }
  }

  _drawSensors(ctx,W,H){
    for(const e of this.scene.entities.values()){
      if(!e.sensorOverlayRadius)continue;
      const p=this.iso.worldToIso(e.x,e.y,e.z??0),s=this.camera.worldScreenToCanvas(p,W,H),rx=e.sensorOverlayRadius*this.iso.tileW*.5*this.camera.zoom,ry=e.sensorOverlayRadius*this.iso.tileH*.5*this.camera.zoom;
      ctx.beginPath();ctx.ellipse(s.x,s.y,rx,ry,0,0,Math.PI*2);ctx.fillStyle='rgba(98,190,225,.055)';ctx.fill();ctx.strokeStyle='rgba(120,205,235,.25)';ctx.stroke();
    }
  }

  _drawEntity(ctx,W,H,e){
    const s=this._entityScreen(e,W,H),z=this.camera.zoom;

    // Generic presentation modes. Their game meaning is decided by bindings, not renderer.
    if(e.visibility==='contact'){
      ctx.save();ctx.globalAlpha=.95*(e.opacity??1);
      ctx.fillStyle='#ffd37b';ctx.beginPath();ctx.arc(s.x,s.y,5*z,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff0c7';ctx.font=`bold ${13*z}px system-ui`;ctx.textAlign='center';ctx.fillText('?',s.x,s.y-9*z);ctx.restore();
      return;
    }
    if(e.visibility==='track'){
      ctx.save();ctx.globalAlpha=.9*(e.opacity??1);ctx.strokeStyle='#ffd37b';ctx.lineWidth=2*z;
      const r=8*z;ctx.beginPath();ctx.moveTo(s.x,s.y-r);ctx.lineTo(s.x+r,s.y);ctx.lineTo(s.x,s.y+r);ctx.lineTo(s.x-r,s.y);ctx.closePath();ctx.stroke();ctx.restore();
      return;
    }
    if(e.visibility==='lastKnown'){
      ctx.save();ctx.globalAlpha=.38;ctx.strokeStyle='#d9a567';ctx.lineWidth=2*z;const r=7*z;
      ctx.beginPath();ctx.moveTo(s.x-r,s.y-r);ctx.lineTo(s.x+r,s.y+r);ctx.moveTo(s.x+r,s.y-r);ctx.lineTo(s.x-r,s.y+r);ctx.stroke();ctx.restore();
      return;
    }

    const a=this.assets.resolve(e.visual);if(!a)return;
    const w=(a.width??86)*z,h=(a.height??70)*z;
    const ax=(a.anchorX??(a.width??86)/2)*z, ay=(a.anchorY??(a.height??70))*z;
    const left=s.x-ax, top=s.y-ay;
    ctx.save();
    ctx.globalAlpha=(e.visibility==='fireControl' ? .58 : 1)*(e.opacity??1);
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(s.x,s.y+3*z,Math.min(w*.32,44*z),9*z,0,0,Math.PI*2);ctx.fill();
    if(e.visibility==='fireControl') ctx.filter='grayscale(1) brightness(.65)';
    else if(e.spriteFilter)ctx.filter=e.spriteFilter;
    ctx.drawImage(a.image,left,top,w,h);ctx.filter='none';
    if(this.scene.selected.has(e.id)){ctx.strokeStyle='#e8f6ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(s.x,s.y,Math.min(w*.34,48*z),12*z,0,0,Math.PI*2);ctx.stroke();}
    this._drawIndicators(ctx,e,{x:s.x,y:s.y,left,top,width:w,height:h,zoom:z});
    ctx.restore();
  }

  _drawEffects(ctx,W,H,effects){
    for(const e of effects){
      if(!e||!e.kind)continue;
      ctx.save();ctx.globalAlpha=e.alpha??1;ctx.strokeStyle=e.color??'#fff';ctx.fillStyle=e.color??'#fff';ctx.lineWidth=(e.width??2)*this.camera.zoom;
      if(e.dashed)ctx.setLineDash([5*this.camera.zoom,5*this.camera.zoom]);
      if(e.kind==='line'){
        const a=this._worldPointScreen(e.from,W,H),b=this._worldPointScreen(e.to,W,H);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        if(e.endDot){ctx.setLineDash([]);ctx.beginPath();ctx.arc(b.x,b.y,e.endDot*this.camera.zoom,0,Math.PI*2);ctx.fill();}
      }else if(e.kind==='projectile'){
        const t=Math.max(0,Math.min(1,e.progress??0)),x=(e.from.x+(e.to.x-e.from.x)*t),y=(e.from.y+(e.to.y-e.from.y)*t),z=(e.from.z??0)+((e.to.z??0)-(e.from.z??0))*t+Math.sin(Math.PI*t)*1.3;
        const p=this._worldPointScreen({x,y,z},W,H);ctx.beginPath();ctx.arc(p.x,p.y,(e.radius??4)*this.camera.zoom,0,Math.PI*2);ctx.fill();
      }else if(e.kind==='ring'){
        const p=this._worldPointScreen(e.at,W,H),radius=(e.radius??1)*(e.progress??1),rx=radius*this.iso.tileW*.5*this.camera.zoom,ry=radius*this.iso.tileH*.5*this.camera.zoom;ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }
  }

  _worldPointScreen(p,W,H){
    const iso=this.iso.worldToIso(p.x,p.y,p.z??0);return this.camera.worldScreenToCanvas(iso,W,H);
  }

  _drawIndicators(ctx,e,box){
    const indicators = Array.isArray(e.indicators) ? e.indicators : [];
    for(const indicator of indicators) this._drawIndicator(ctx, indicator, box);
  }

  _drawIndicator(ctx, indicator, box){
    if(!indicator) return;
    const kind = indicator.kind ?? indicator.type ?? 'bar';
    const direction = indicator.direction ?? 'left-to-right';
    const zoom = box.zoom;
    const size = this._indicatorSize(indicator, kind, direction, zoom, box);
    const rect = this._indicatorRect(indicator, size, box);
    const ratio = this._indicatorRatio(indicator);
    if(size.width <= 0 || size.height <= 0) return;
    if(kind === 'pips' || kind === 'segments'){
      this._drawPipIndicator(ctx, indicator, rect, size, ratio, direction);
    } else {
      this._drawBarIndicator(ctx, indicator, rect, ratio, direction);
    }
  }

  _indicatorRatio(indicator){
    if(typeof indicator.value === 'number') return Math.max(0, Math.min(1, indicator.value));
    const current = Number(indicator.current ?? 0);
    const max = Number(indicator.max ?? 1);
    if(!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(1, current / max));
  }

  _indicatorSize(indicator, kind, direction, zoom, box){
    const margin = (indicator.margin ?? 4) * zoom;
    const defaultHorizontal = Math.max(30 * zoom, Math.min(box.width * 0.7, 58 * zoom));
    const defaultVertical = Math.max(24 * zoom, Math.min(box.height * 0.45, 48 * zoom));
    if(kind === 'pips' || kind === 'segments'){
      const count = Math.max(1, Math.floor(indicator.segments ?? indicator.count ?? 4));
      const cellW = (indicator.cellWidth ?? indicator.cellSize ?? 10) * zoom;
      const cellH = (indicator.cellHeight ?? indicator.cellSize ?? 10) * zoom;
      const gap = (indicator.gap ?? 2) * zoom;
      const horizontal = direction === 'left-to-right' || direction === 'right-to-left';
      return {
        width: horizontal ? count * cellW + Math.max(0, count - 1) * gap : cellW,
        height: horizontal ? cellH : count * cellH + Math.max(0, count - 1) * gap,
        cellW, cellH, gap, count, margin
      };
    }
    const thickness = (indicator.thickness ?? 5) * zoom;
    const horizontal = direction === 'left-to-right' || direction === 'right-to-left';
    const length = (indicator.length ?? indicator.size ?? (horizontal ? defaultHorizontal : defaultVertical) / zoom) * zoom;
    return {width: horizontal ? length : thickness, height: horizontal ? thickness : length, margin};
  }

  _indicatorRect(indicator, size, box){
    const placement = indicator.placement ?? 'above';
    const ox = (indicator.offsetX ?? 0) * box.zoom;
    const oy = (indicator.offsetY ?? 0) * box.zoom;
    const m = size.margin ?? 0;
    const centerX = box.x;
    const centerY = box.top + box.height * 0.5;
    switch(placement){
      case 'below':
        return {x:centerX-size.width/2+ox,y:box.top+box.height+m+oy,width:size.width,height:size.height};
      case 'left':
        return {x:box.left-size.width-m+ox,y:centerY-size.height/2+oy,width:size.width,height:size.height};
      case 'right':
        return {x:box.left+box.width+m+ox,y:centerY-size.height/2+oy,width:size.width,height:size.height};
      case 'inside-top-left':
        return {x:box.left+m+ox,y:box.top+m+oy,width:size.width,height:size.height};
      case 'inside-top-right':
        return {x:box.left+box.width-size.width-m+ox,y:box.top+m+oy,width:size.width,height:size.height};
      case 'inside-bottom-left':
        return {x:box.left+m+ox,y:box.top+box.height-size.height-m+oy,width:size.width,height:size.height};
      case 'inside-bottom-right':
        return {x:box.left+box.width-size.width-m+ox,y:box.top+box.height-size.height-m+oy,width:size.width,height:size.height};
      case 'above':
      default:
        return {x:centerX-size.width/2+ox,y:box.top-size.height-m+oy,width:size.width,height:size.height};
    }
  }

  _drawBarIndicator(ctx, indicator, rect, ratio, direction){
    this._paintStyle(ctx, indicator.background ?? indicator.empty ?? {type:'color', value:'rgba(0,0,0,.55)'}, rect);
    const fill = this._filledRect(rect, ratio, direction);
    if(fill.width > 0 && fill.height > 0){
      this._paintStyle(ctx, indicator.foreground ?? {type:'color', value:'#ffffff'}, rect, fill);
    }
  }

  _drawPipIndicator(ctx, indicator, rect, size, ratio, direction){
    const count = size.count ?? 4;
    const fillMode = indicator.segmentFill ?? 'partial';
    const filled = ratio * count;
    const discreteCount = ratio <= 0 ? 0 : Math.min(count, Math.ceil(filled - 1e-9));
    const horizontal = direction === 'left-to-right' || direction === 'right-to-left';
    const reverse = direction === 'right-to-left' || direction === 'bottom-to-top';
    for(let i=0;i<count;i++){
      const drawIndex = reverse ? (count - 1 - i) : i;
      const x = horizontal ? rect.x + drawIndex * (size.cellW + size.gap) : rect.x;
      const y = horizontal ? rect.y : rect.y + drawIndex * (size.cellH + size.gap);
      const slot = {x, y, width:size.cellW, height:size.cellH};
      this._paintStyle(ctx, indicator.background ?? indicator.empty ?? {type:'color', value:'rgba(0,0,0,.55)'}, slot);
      const remainder = fillMode === 'discrete'
        ? (i < discreteCount ? 1 : 0)
        : Math.max(0, Math.min(1, filled - i));
      if(remainder > 0){
        const fill = this._filledRect(slot, remainder, direction);
        this._paintStyle(ctx, indicator.foreground ?? {type:'color', value:'#ffffff'}, slot, fill);
      }
    }
  }

  _filledRect(rect, ratio, direction){
    const r = Math.max(0, Math.min(1, ratio));
    switch(direction){
      case 'right-to-left': return {x:rect.x + rect.width * (1-r), y:rect.y, width:rect.width * r, height:rect.height};
      case 'top-to-bottom': return {x:rect.x, y:rect.y, width:rect.width, height:rect.height * r};
      case 'bottom-to-top': return {x:rect.x, y:rect.y + rect.height * (1-r), width:rect.width, height:rect.height * r};
      case 'left-to-right':
      default: return {x:rect.x, y:rect.y, width:rect.width * r, height:rect.height};
    }
  }

  _paintStyle(ctx, style, targetRect, clipRect=null){
    const normalized = this._normalizeStyle(style);
    if(!normalized) return;
    ctx.save();
    if(clipRect){
      ctx.beginPath();
      ctx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
      ctx.clip();
    }
    if(normalized.type === 'graphic'){
      const asset = this.assets.getIndicatorGraphic(normalized.key);
      if(asset) ctx.drawImage(asset.image, targetRect.x, targetRect.y, targetRect.width, targetRect.height);
    } else {
      ctx.fillStyle = normalized.value;
      ctx.fillRect(targetRect.x, targetRect.y, targetRect.width, targetRect.height);
    }
    ctx.restore();
  }

  _normalizeStyle(style){
    if(!style) return null;
    if(typeof style === 'string') return {type:'color', value:style};
    if(style.type === 'graphic' && style.key) return style;
    if(style.type === 'color' && style.value) return style;
    if(style.key) return {type:'graphic', key:style.key};
    if(style.value) return {type:'color', value:style.value};
    return null;
  }

  _drawCommandMarker(ctx,W,H,m){
    const h=this._tileHeight(Math.floor(m.x),Math.floor(m.y)),p=this.iso.worldToIso(m.x,m.y,h),s=this.camera.worldScreenToCanvas(p,W,H),age=(performance.now()-m.time)/1000;
    if(age>1.2)return;ctx.save();ctx.globalAlpha=Math.max(0,1-age/1.2);ctx.strokeStyle='#d7f3ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(s.x,s.y,18*this.camera.zoom*(1+age),9*this.camera.zoom*(1+age),0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
}
