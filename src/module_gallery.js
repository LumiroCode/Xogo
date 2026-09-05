import { AssetStore } from './engine/AssetStore.js';

const [unitDefs] = await Promise.all([fetch('./data/unit_definitions.json').then(r=>r.json())]);
const assets = new AssetStore();
await assets.loadManifest('./data/assets.json');
const missing=assets.validateModularCatalog(unitDefs);if(missing.length)throw new Error(`Missing proxy modules: ${missing.join(', ')}`);
const grid=document.querySelector('#grid');let count=0;
for(const platform of Object.keys(unitDefs.platforms)){
  for(const weapon of Object.keys(unitDefs.weapons)){
    for(const specialization of Object.keys(unitDefs.specializations)){
      const visual={kind:'modular_unit',platform,weapon,specialization};
      const composite=assets.resolve(visual);
      const card=document.createElement('article');card.className='card';
      const preview=document.createElement('div');preview.className='preview';
      const canvas=document.createElement('canvas');canvas.width=composite.width;canvas.height=composite.height;
      canvas.getContext('2d').drawImage(composite.image,0,0);preview.append(canvas);
      const ids=document.createElement('div');ids.className='ids';ids.innerHTML=`<strong>${platform}</strong><br>${weapon}<br>${specialization}`;
      card.append(preview,ids);grid.append(card);count++;
    }
  }
}
document.querySelector('#count').textContent=`${count} kombinacji · ${assets.composer.cache.size} cache`;
