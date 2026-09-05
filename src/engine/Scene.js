export class Scene {
  constructor() { this.entities = new Map(); this.selected = new Set(); }
  spawn(def) { this.entities.set(def.id, structuredClone(def)); }
  update(id, patch) { const e=this.entities.get(id); if(e) Object.assign(e, patch); }
  remove(id) { this.entities.delete(id); this.selected.delete(id); }
  setSelection(ids) { this.selected = new Set(ids); }
  snapshot() { return [...this.entities.values()]; }
}
