import { ModularSpriteComposer } from './ModularSpriteComposer.js';

export class AssetStore {
  constructor() {
    this.images = new Map();
    this.manifest = {};
    this.composer = null;
  }

  async loadManifest(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`asset manifest: ${r.status}`);
    this.manifest = await r.json();

    const jobs = [];
    for (const [kind, defs] of Object.entries({
      platform: this.manifest.platforms ?? {},
      weapon: this.manifest.weapons ?? {},
      specialization: this.manifest.specializations ?? {},
      static: this.manifest.staticVisuals ?? {},
      indicator: this.manifest.indicatorGraphics ?? {}
    })) {
      for (const [key, def] of Object.entries(defs)) {
        jobs.push(this._load(`${kind}:${key}`, def));
      }
    }
    await Promise.all(jobs);
    this.composer = new ModularSpriteComposer(this);
  }

  async _load(key, def) {
    const img = new Image();
    img.src = def.file;
    await img.decode();
    this.images.set(key, { image: img, ...def });
  }

  getStatic(key) { return this.images.get(`static:${key}`); }
  getModule(kind, key) { return this.images.get(`${kind}:${key}`); }
  getIndicatorGraphic(key) { return this.images.get(`indicator:${key}`); }
  getDefinition(kind, key) {
    const table = kind === 'platform' ? this.manifest.platforms
      : kind === 'weapon' ? this.manifest.weapons
      : kind === 'specialization' ? this.manifest.specializations
      : kind === 'indicator' ? this.manifest.indicatorGraphics
      : this.manifest.staticVisuals;
    return table?.[key];
  }

  resolve(visual) {
    if (typeof visual === 'string') return this.getStatic(visual);
    if (visual?.kind === 'modular_unit') return this.composer?.compose(visual);
    return null;
  }

  terrainStyle(id) { return this.manifest.terrainStyles?.[id] ?? null; }

  validateModularCatalog(unitDefinitions) {
    const missing = [];
    for (const key of Object.keys(unitDefinitions.platforms ?? {})) if (!this.manifest.platforms?.[key]) missing.push(`platform:${key}`);
    for (const key of Object.keys(unitDefinitions.weapons ?? {})) if (!this.manifest.weapons?.[key]) missing.push(`weapon:${key}`);
    for (const key of Object.keys(unitDefinitions.specializations ?? {})) if (!this.manifest.specializations?.[key]) missing.push(`specialization:${key}`);
    return missing;
  }
}
