/* ============================================================
   3528B — EnvironmentLayer: the menu shell occupies a PLACE.
   Three composited layers on one canvas at ≤30 fps:
     1. depth-gradient drift  2. particle field w/ pointer parallax
     3. periodic light sweep
   Pauses when hidden; static frame under reduced motion.
   Never runs behind the live room (#/live disables it).
   ============================================================ */

const THEMES = {
  lobby:    { a: [26, 46, 92],  b: [10, 30, 52],  particle: '#7fb8d8', sweep: 'rgba(255,194,75,.05)' },
  practice: { a: [16, 60, 78],  b: [12, 34, 60],  particle: '#6fd8c8', sweep: 'rgba(57,214,255,.05)' },
  library:  { a: [58, 44, 20],  b: [14, 22, 44],  particle: '#d8b87f', sweep: 'rgba(255,194,75,.05)' },
  results:  { a: [18, 58, 62],  b: [30, 24, 66],  particle: '#7fd8c8', sweep: 'rgba(47,231,176,.05)' },
  progress: { a: [42, 34, 78],  b: [12, 26, 54],  particle: '#a696ff', sweep: 'rgba(166,150,255,.05)' },
};

export class EnvironmentLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = THEMES.lobby;
    this.enabled = true;
    this.reduced = false;
    this.t = 0;
    this.last = 0;
    this.pointer = { x: .5, y: .5, px: .5, py: .5 };
    this.particles = [];
    this.raf = null;
    this._makeParticles();
    addEventListener('resize', () => this._resize());
    addEventListener('pointermove', e => {
      this.pointer.x = e.clientX / innerWidth;
      this.pointer.y = e.clientY / innerHeight;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop(); else this.start();
    });
    this._resize();
  }

  _resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._drawFrame(this.t);
  }

  _makeParticles() {
    const n = innerWidth >= 1780 ? 110 : innerWidth >= 1280 ? 84 : 56;
    this.particles = Array.from({ length: n }, (_, i) => ({
      x: ((i * 127.3) % 100) / 100,
      y: ((i * 61.7) % 100) / 100,
      r: .8 + ((i * 37) % 17) / 10,
      a: .10 + ((i * 13) % 20) / 100,
      vx: (((i * 7) % 10) - 5) / 42000,
      vy: -(1 + ((i * 11) % 12)) / 60000,
      depth: .35 + ((i * 29) % 65) / 100,
    }));
  }

  setTheme(name) {
    this.theme = THEMES[name] || THEMES.lobby;
    if (this.reduced || !this.raf) this._drawFrame(this.t);
  }
  setEnabled(on) {
    this.enabled = on;
    this.canvas.style.opacity = on ? '1' : '0';
    if (on) this.start(); else this.stop();
  }
  setReduced(r) {
    this.reduced = r;
    if (r) { this.stop(); this._drawFrame(this.t); } else this.start();
  }

  start() {
    if (this.raf || this.reduced || !this.enabled) return;
    const loop = (ts) => {
      this.raf = requestAnimationFrame(loop);
      if (ts - this.last < 33) return; // 30 fps cap
      this.t += (ts - this.last) / 1000;
      this.last = ts;
      this._drawFrame(this.t);
    };
    this.last = performance.now();
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  _drawFrame(t) {
    const { ctx } = this;
    const w = innerWidth, h = innerHeight;
    const th = this.theme;
    // damped pointer parallax
    this.pointer.px += (this.pointer.x - this.pointer.px) * .04;
    this.pointer.py += (this.pointer.y - this.pointer.py) * .04;
    const ox = this.reduced ? 0 : (this.pointer.px - .5) * 12;
    const oy = this.reduced ? 0 : (this.pointer.py - .5) * 8;

    ctx.fillStyle = '#07090f';
    ctx.fillRect(0, 0, w, h);

    // layer 1: two drifting radial glows
    const d1x = w * (.28 + .03 * Math.sin(t / 19)) + ox * 2;
    const d1y = h * (.24 + .03 * Math.cos(t / 23)) + oy * 2;
    let g = ctx.createRadialGradient(d1x, d1y, 0, d1x, d1y, w * .55);
    g.addColorStop(0, `rgba(${th.a[0]},${th.a[1]},${th.a[2]},.55)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const d2x = w * (.76 - .03 * Math.cos(t / 26)) - ox * 2;
    const d2y = h * (.72 - .03 * Math.sin(t / 21)) - oy * 2;
    g = ctx.createRadialGradient(d2x, d2y, 0, d2x, d2y, w * .5);
    g.addColorStop(0, `rgba(${th.b[0]},${th.b[1]},${th.b[2]},.5)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // layer 2: particles
    ctx.fillStyle = th.particle;
    for (const p of this.particles) {
      if (!this.reduced) {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -0.02) { p.y = 1.02; p.x = (p.x + .37) % 1; }
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
      }
      const px = p.x * w + ox * p.depth * .6;
      const py = p.y * h + oy * p.depth * .6;
      ctx.globalAlpha = p.a;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // layer 3: light sweep every 26 s
    const phase = (t % 26) / 26;
    if (phase < .22 && !this.reduced) {
      const sx = (phase / .22) * (w + 700) - 350;
      ctx.save();
      ctx.translate(sx, h / 2);
      ctx.rotate(-.35);
      const sg = ctx.createLinearGradient(-140, 0, 140, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(.5, th.sweep);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(-140, -h, 280, h * 2);
      ctx.restore();
    }
  }
}
