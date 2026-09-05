export class IsoMath {
  constructor(tileW = 96, tileH = 48, elevationStep = 18) {
    this.tileW = tileW;
    this.tileH = tileH;
    this.elevationStep = elevationStep;
  }

  worldToIso(x, y, z = 0) {
    return {
      x: (x - y) * this.tileW * 0.5,
      y: (x + y) * this.tileH * 0.5 - z * this.elevationStep,
    };
  }

  isoToWorld(sx, sy, z = 0) {
    const yy = sy + z * this.elevationStep;
    return {
      x: sx / this.tileW + yy / this.tileH,
      y: yy / this.tileH - sx / this.tileW,
    };
  }
}
