/**
 * Boundary between simulation and presentation.
 * The simulation owns truth. PresentationBinder translates arbitrary domain state
 * into renderer-facing visual state. Renderer never receives the binding rules.
 */
export class GameViewAdapter {
  constructor(renderer, binder = null) {
    this.r = renderer;
    this.binder = binder;
    this.sources = new Map();
  }

  setMap(map){ this.r.setMap(map); }

  spawnEntity(source){
    this.sources.set(source.id, structuredClone(source));
    this.r.scene.spawn(this._bind(source));
  }

  updateEntity(id, patch){
    const current = this.sources.get(id);
    if (!current) return;
    Object.assign(current, structuredClone(patch));
    this.r.scene.update(id, this._bind(current));
  }

  removeEntity(id){ this.sources.delete(id); this.r.scene.remove(id); }
  setSelection(ids){ this.r.scene.setSelection(ids); }
  setVisibility(id, state){ this.updateEntity(id,{visibility:state}); }
  setFlag(name,value){ this.r.setFlag(name,value); }
  toggleFlag(name){ return this.r.toggle(name); }
  pick(clientX,clientY){ return this.r.entityAt(clientX,clientY); }
  pickRect(rect,options={}){ return this.r.entitiesInRect(rect,options); }
  entityIdsOnScreen(options={}){ return this.r.entityIdsOnScreen(options); }
  screenToWorld(clientX,clientY){ return this.r.screenToWorld(clientX,clientY); }
  render(frameState={}){ this.r.render(frameState); }

  _bind(source){
    if (!this.binder) return structuredClone(source);
    return this.binder.bindEntity(source);
  }
}
