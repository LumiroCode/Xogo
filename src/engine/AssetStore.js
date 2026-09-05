export class AssetStore {
  constructor() { this.images = new Map(); this.manifest = {}; }
  async loadManifest(url) {
    const r = await fetch(url); if (!r.ok) throw new Error(`asset manifest: ${r.status}`);
    this.manifest = await r.json();
    const jobs = Object.entries(this.manifest.visuals).map(async ([key, def]) => {
      const img = new Image();
      img.src = def.file;
      await img.decode();
      this.images.set(key, { image: img, ...def });
    });
    await Promise.all(jobs);
  }
  get(key) { return this.images.get(key); }
}
