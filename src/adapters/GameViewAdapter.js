/**
 * Boundary between simulation and presentation.
 * The simulation owns truth. The renderer only receives presentation state.
 */
export class GameViewAdapter {
  constructor(renderer) { this.r=renderer; }
  setMap(map){ this.r.setMap(map); }
  spawnEntity(view){ this.r.scene.spawn(view); }
  updateEntity(id, patch){ this.r.scene.update(id, patch); }
  removeEntity(id){ this.r.scene.remove(id); }
  setSelection(ids){ this.r.scene.setSelection(ids); }
  setVisibility(id, state){ this.r.scene.update(id,{visibility:state}); }
  setFlag(name,value){ this.r.setFlag(name,value); }
  toggleFlag(name){ return this.r.toggle(name); }
  pick(clientX,clientY){ return this.r.entityAt(clientX,clientY); }
  screenToWorld(clientX,clientY){ return this.r.screenToWorld(clientX,clientY); }
  render(frameState={}){ this.r.render(frameState); }
}
