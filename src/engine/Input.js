export class Input {
  constructor(canvas, camera, hooks={}) {
    this.canvas=canvas; this.camera=camera; this.hooks=hooks; this.keys=new Set(); this.drag=false; this.last=null;
    canvas.addEventListener('contextmenu', e=>e.preventDefault());
    canvas.addEventListener('pointerdown', e=>{
      if(e.button===1 || (e.button===0 && e.altKey)) { this.drag=true; this.last={x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId); return; }
      hooks.pointerDown?.(e);
    });
    canvas.addEventListener('pointermove', e=>{
      if(this.drag) { const dx=this.last.x-e.clientX, dy=this.last.y-e.clientY; camera.pan(dx,dy); this.last={x:e.clientX,y:e.clientY}; }
      hooks.pointerMove?.(e);
    });
    canvas.addEventListener('pointerup', e=>{ this.drag=false; hooks.pointerUp?.(e); });
    canvas.addEventListener('wheel', e=>{ e.preventDefault(); camera.zoomAt(e.deltaY<0?1.12:0.89,e.clientX,e.clientY,canvas.clientWidth,canvas.clientHeight); }, {passive:false});
    window.addEventListener('keydown', e=>{ this.keys.add(e.code); hooks.keyDown?.(e); });
    window.addEventListener('keyup', e=>this.keys.delete(e.code));
  }
  update(dt) {
    const s=540*dt;
    if(this.keys.has('KeyW')||this.keys.has('ArrowUp')) this.camera.pan(0,-s);
    if(this.keys.has('KeyS')||this.keys.has('ArrowDown')) this.camera.pan(0,s);
    if(this.keys.has('KeyA')||this.keys.has('ArrowLeft')) this.camera.pan(-s,0);
    if(this.keys.has('KeyD')||this.keys.has('ArrowRight')) this.camera.pan(s,0);
  }
}
