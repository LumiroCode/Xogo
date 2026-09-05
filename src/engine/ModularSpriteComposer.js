/**
 * Pure presentation compositor for modular units.
 * It knows visual module IDs and mount sockets, never gameplay statistics.
 * Composite sprites are cached by assembly, so rendering cost is paid once per unique loadout.
 */
export class ModularSpriteComposer {
  constructor(assetStore) {
    this.assets = assetStore;
    this.cache = new Map();
  }

  compose(visual) {
    const platformId = visual.platform;
    const weaponId = visual.weapon ?? 'none';
    const specializationId = visual.specialization;
    const key = `${platformId}|${weaponId}|${specializationId ?? '-'}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const platform = this.assets.getModule('platform', platformId);
    const weapon = this.assets.getModule('weapon', weaponId);
    const specialization = specializationId ? this.assets.getModule('specialization', specializationId) : null;
    const platformDef = this.assets.getDefinition('platform', platformId);
    if (!platform || !platformDef) throw new Error(`Missing visual platform module: ${platformId}`);
    if (!weapon) throw new Error(`Missing visual weapon module: ${weaponId}`);
    if (specializationId && !specialization) throw new Error(`Missing visual specialization module: ${specializationId}`);

    const cfg = this.assets.manifest.composition ?? { width: 160, height: 150, anchorX: 80, anchorY: 136 };
    const canvas = document.createElement('canvas');
    canvas.width = cfg.width;
    canvas.height = cfg.height;
    const ctx = canvas.getContext('2d');

    this._drawPlatform(ctx, platform, platformDef);
    if (specialization) this._drawMounted(ctx, specialization, platformDef.sockets?.specialization, specialization.opacity ?? 1);
    this._drawMounted(ctx, weapon, platformDef.sockets?.weapon, weapon.opacity ?? 1);

    const cropped = this._crop(canvas, cfg.anchorX, cfg.anchorY, 4);
    const result = {
      image: cropped.image,
      width: cropped.width,
      height: cropped.height,
      anchorX: cropped.anchorX,
      anchorY: cropped.anchorY,
      assembly: { platform: platformId, weapon: weaponId, specialization: specializationId },
      status: 'runtime-composite'
    };
    this.cache.set(key, result);
    return result;
  }

  _crop(source, anchorX, anchorY, padding = 2) {
    const ctx = source.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);
    let minX=width,minY=height,maxX=-1,maxY=-1;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      if(data[(y*width+x)*4+3]===0) continue;
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
    }
    if(maxX<minX||maxY<minY) return {image:source,width:source.width,height:source.height,anchorX,anchorY};
    minX=Math.max(0,minX-padding);minY=Math.max(0,minY-padding);maxX=Math.min(width-1,maxX+padding);maxY=Math.min(height-1,maxY+padding);
    const w=maxX-minX+1,h=maxY-minY+1,out=document.createElement('canvas');out.width=w;out.height=h;
    out.getContext('2d').drawImage(source,minX,minY,w,h,0,0,w,h);
    return {image:out,width:w,height:h,anchorX:anchorX-minX,anchorY:anchorY-minY};
  }

  _drawPlatform(ctx, module, def) {
    const d = def.draw;
    ctx.drawImage(module.image, d.x, d.y, d.width, d.height);
  }

  _drawMounted(ctx, module, socket, opacity = 1) {
    if (!socket || opacity <= 0) return;
    const scale = socket.scale ?? 1;
    const mount = module.mount ?? { x: module.width / 2, y: module.height / 2 };
    const w = module.width * scale;
    const h = module.height * scale;
    const x = socket.x - mount.x * scale;
    const y = socket.y - mount.y * scale;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(module.image, x, y, w, h);
    ctx.restore();
  }
}
