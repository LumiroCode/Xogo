export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.45;
    this.maxZoom = 2.2;
  }
  worldScreenToCanvas(p, width, height) {
    return { x: (p.x - this.x) * this.zoom + width / 2, y: (p.y - this.y) * this.zoom + height / 2 };
  }
  canvasToWorldScreen(x, y, width, height) {
    return { x: (x - width / 2) / this.zoom + this.x, y: (y - height / 2) / this.zoom + this.y };
  }
  pan(dx, dy) { this.x += dx / this.zoom; this.y += dy / this.zoom; }
  zoomAt(factor, cx, cy, width, height) {
    const before = this.canvasToWorldScreen(cx, cy, width, height);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.canvasToWorldScreen(cx, cy, width, height);
    this.x += before.x - after.x; this.y += before.y - after.y;
  }
}
