/**
 * Raw pointer/keyboard gesture layer.
 *
 * Policy:
 * - LMB click is selection.
 * - LMB drag is box selection (after a small threshold).
 * - MMB or Alt+LMB pans camera.
 * - RMB is a contextual command.
 *
 * Domain meaning is deliberately delegated to hooks; this class only recognizes gestures.
 */
export class Input {
  constructor(canvas, camera, hooks={}) {
    this.canvas=canvas;
    this.camera=camera;
    this.hooks=hooks;
    this.keys=new Set();
    this.dragThreshold=5;

    this.cameraDrag=false;
    this.cameraLast=null;
    this.leftCandidate=null;
    this.selectionBox=null;

    canvas.addEventListener('contextmenu', e=>e.preventDefault());

    canvas.addEventListener('pointerdown', e=>{
      if(e.button===1 || (e.button===0 && e.altKey)){
        this.cameraDrag=true;
        this.cameraLast={x:e.clientX,y:e.clientY};
        canvas.setPointerCapture?.(e.pointerId);
        hooks.cameraDragStart?.(e);
        return;
      }

      if(e.button===0){
        const p=this._local(e);
        this.leftCandidate={
          pointerId:e.pointerId,
          startX:p.x,startY:p.y,
          clientStartX:e.clientX,clientStartY:e.clientY,
          additive:e.shiftKey,
          ctrl:e.ctrlKey,
          dragging:false
        };
        canvas.setPointerCapture?.(e.pointerId);
        return;
      }

      if(e.button===2){
        hooks.contextCommand?.(e);
      }
    });

    canvas.addEventListener('pointermove', e=>{
      if(this.cameraDrag){
        const dx=this.cameraLast.x-e.clientX,dy=this.cameraLast.y-e.clientY;
        camera.pan(dx,dy);
        this.cameraLast={x:e.clientX,y:e.clientY};
        hooks.cameraDrag?.(e);
        return;
      }

      if(this.leftCandidate && e.pointerId===this.leftCandidate.pointerId){
        const p=this._local(e);
        const d=Math.hypot(p.x-this.leftCandidate.startX,p.y-this.leftCandidate.startY);
        if(!this.leftCandidate.dragging && d>=this.dragThreshold){
          this.leftCandidate.dragging=true;
          hooks.selectionBoxStart?.(this._rect(this.leftCandidate.startX,this.leftCandidate.startY,p.x,p.y),e);
        }
        if(this.leftCandidate.dragging){
          this.selectionBox=this._rect(this.leftCandidate.startX,this.leftCandidate.startY,p.x,p.y);
          hooks.selectionBoxMove?.(this.selectionBox,e);
        }
      }
      hooks.pointerMove?.(e);
    });

    canvas.addEventListener('pointerup', e=>{
      if(this.cameraDrag && (e.button===1 || e.button===0)){
        this.cameraDrag=false;
        this.cameraLast=null;
        hooks.cameraDragEnd?.(e);
        return;
      }

      if(e.button===0 && this.leftCandidate && e.pointerId===this.leftCandidate.pointerId){
        const candidate=this.leftCandidate;
        if(candidate.dragging){
          const p=this._local(e);
          const rect=this._rect(candidate.startX,candidate.startY,p.x,p.y);
          this.selectionBox=null;
          hooks.selectionBoxEnd?.(rect,e,{additive:candidate.additive,ctrl:candidate.ctrl});
        }else{
          hooks.primaryClick?.(e,{additive:candidate.additive,ctrl:candidate.ctrl});
        }
        this.leftCandidate=null;
      }
    });

    canvas.addEventListener('pointercancel', e=>{
      this.cameraDrag=false;
      this.cameraLast=null;
      this.leftCandidate=null;
      this.selectionBox=null;
      hooks.pointerCancel?.(e);
    });

    canvas.addEventListener('dblclick', e=>{
      if(e.button===0 && !e.altKey) hooks.primaryDoubleClick?.(e,{additive:e.shiftKey,ctrl:e.ctrlKey});
    });

    canvas.addEventListener('wheel', e=>{
      e.preventDefault();
      camera.zoomAt(e.deltaY<0?1.12:0.89,e.clientX,e.clientY,canvas.clientWidth,canvas.clientHeight);
    }, {passive:false});

    window.addEventListener('keydown', e=>{this.keys.add(e.code);hooks.keyDown?.(e);});
    window.addEventListener('keyup', e=>this.keys.delete(e.code));
  }

  getSelectionBox(){return this.selectionBox?{...this.selectionBox}:null;}
  isSelecting(){return !!this.selectionBox;}

  update(dt) {
    const s=540*dt;
    if(this.keys.has('KeyW')||this.keys.has('ArrowUp')) this.camera.pan(0,-s);
    if(this.keys.has('KeyS')||this.keys.has('ArrowDown')) this.camera.pan(0,s);
    if(this.keys.has('KeyA')||this.keys.has('ArrowLeft')) this.camera.pan(-s,0);
    if(this.keys.has('KeyD')||this.keys.has('ArrowRight')) this.camera.pan(s,0);
  }

  _local(e){
    const r=this.canvas.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  }

  _rect(x1,y1,x2,y2){
    const left=Math.min(x1,x2),right=Math.max(x1,x2),top=Math.min(y1,y2),bottom=Math.max(y1,y2);
    return {left,top,right,bottom,x:left,y:top,width:right-left,height:bottom-top};
  }
}
