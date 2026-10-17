// Live-stream reactions: hearts that float up, and bursts for taps and confetti.

const COLORS = ['#ff4f8b', '#ff2d55', '#ffffff', '#ffb3c9', '#8fa9ff', '#ffd166'];

function heart(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.42);
  ctx.bezierCurveTo(-s * 1.15, -s * 0.3, -s * 0.6, -s * 1.08, 0, -s * 0.42);
  ctx.bezierCurveTo(s * 0.6, -s * 1.08, s * 1.15, -s * 0.3, 0, s * 0.42);
  ctx.closePath();
}

function sprite(color) {
  const S = 72;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.translate(S / 2, S / 2 + 4);
  heart(x, 24);
  const g = x.createLinearGradient(-20, -26, 20, 16);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.28, color);
  g.addColorStop(1, color);
  x.fillStyle = color === '#ffffff' ? '#fff' : g;
  x.shadowColor = 'rgba(120, 20, 50, .18)';
  x.shadowBlur = 5;
  x.shadowOffsetY = 2;
  x.fill();
  if (color === '#ffffff') {
    x.shadowColor = 'transparent';
    x.lineWidth = 3;
    x.strokeStyle = '#ff4f8b';
    x.stroke();
  }
  return c;
}

export class Hearts {
  constructor(canvas, { max = 90 } = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.max = max;
    this.parts = [];
    this.sprites = COLORS.map(sprite);
    this.running = false;
    this.tick = this.tick.bind(this);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }
  resize() {
    const r = this.c.getBoundingClientRect();
    this.d = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width;
    this.h = r.height;
    this.c.width = Math.max(1, Math.round(r.width * this.d));
    this.c.height = Math.max(1, Math.round(r.height * this.d));
  }
  add(p) {
    if (this.parts.length >= this.max) this.parts.shift();
    this.parts.push(p);
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.tick);
    }
  }
  /** One reaction floating up from (x, y). */
  float(x, y, scale = 1) {
    this.add({
      x, y, vx: (Math.random() - 0.5) * 30, vy: -(110 + Math.random() * 90) * scale, g: 12,
      life: 0, max: 2.2 + Math.random() * 1.1, s: (16 + Math.random() * 16) * scale,
      rot: (Math.random() - 0.5) * 0.5, spin: (Math.random() - 0.5) * 0.8,
      sway: Math.random() * 6.28, swayAmp: 18 + Math.random() * 26,
      img: this.sprites[(Math.random() * this.sprites.length) | 0],
    });
  }
  /** A pop of hearts around (x, y). */
  burst(x, y, n = 16, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
      const v = (180 + Math.random() * 300) * power;
      this.add({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 420 * power, drag: 1.6,
        life: 0, max: 1.1 + Math.random() * 0.8, s: 12 + Math.random() * 18,
        rot: (Math.random() - 0.5) * 1.2, spin: (Math.random() - 0.5) * 6,
        sway: 0, swayAmp: 0, img: this.sprites[(Math.random() * this.sprites.length) | 0],
      });
    }
  }
  tick(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const { ctx, d } = this;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const keep = [];
    for (const p of this.parts) {
      p.life += dt;
      if (p.life >= p.max) continue;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt * 0.4; }
      p.vy += p.g * dt;
      p.x += (p.vx + Math.sin(p.life * 3 + p.sway) * p.swayAmp) * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const k = p.life / p.max;
      const grow = Math.min(1, p.life / 0.22);
      const scale = (0.35 + 0.65 * (1 - Math.pow(1 - grow, 3))) * (k > 0.8 ? 1 - (k - 0.8) * 1.2 : 1);
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      const s = p.s * scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(p.img, -s, -s, s * 2, s * 2);
      ctx.restore();
      keep.push(p);
    }
    ctx.globalAlpha = 1;
    this.parts = keep;
    if (keep.length) requestAnimationFrame(this.tick);
    else this.running = false;
  }
}
