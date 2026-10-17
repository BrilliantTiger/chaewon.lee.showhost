// Scenes hold the page on a full-screen section and advance one step per
// gesture: a wheel swipe, a touch swipe or an arrow key. A fling of any size
// stops at the first scene it crosses, and the momentum tail of the gesture
// that got caught never counts as a new step.

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class Scenes {
  constructor(lenis) {
    this.lenis = lenis;
    this.list = [];
    this.active = null;
    this.step = 0;
    this.busy = false;
    this.nav = false;
    this.prevY = window.scrollY;
    this.wheel = { last: 0, abs: 0, acc: 0, dir: 0, used: false };
    this.touch = { y: null, used: false };
    this.onLock = null;

    this.onWheel = this.onWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onScroll = this.onScroll.bind(this);

    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    lenis.on('scroll', () => this.check(window.scrollY));
    window.addEventListener('resize', () => {
      if (this.active) window.scrollTo(0, this.anchor(this.active));
    });
  }

  add(scene) {
    this.list.push(scene);
    return scene;
  }

  anchor(s) {
    return Math.round(s.el.getBoundingClientRect().top + window.scrollY);
  }

  /** Called on every scroll frame: catch the first scene crossed since the last frame. */
  check(y) {
    if (this.active) return;
    if (this.nav) { this.prevY = y; return; }
    const dir = Math.sign(y - this.prevY);
    if (dir) {
      let hit = null;
      let best = Infinity;
      for (const s of this.list) {
        const a = this.anchor(s);
        const crossed = dir > 0 ? this.prevY < a && y >= a : this.prevY > a && y <= a;
        const dist = Math.abs(a - this.prevY);
        if (crossed && dist < best) { best = dist; hit = s; }
      }
      if (hit) { this.lock(hit, dir > 0 ? 0 : hit.steps - 1); return; }
    }
    this.prevY = y;
  }

  lock(s, step) {
    this.active = s;
    const prev = this.step;
    this.step = step;
    this.wheel.used = true;           // the gesture that got us here is spent
    this.touch.used = true;
    const y = this.anchor(s);
    this.lenis.scrollTo(y, { immediate: true, force: true });
    this.lenis.stop();
    window.scrollTo(0, y);
    document.documentElement.classList.add('is-locked');
    this.prevY = y;
    s.enter?.(step, prev);
    this.onLock?.(s, step);
  }

  release(dir, glide = true) {
    const s = this.active;
    if (!s) return;
    this.active = null;
    document.documentElement.classList.remove('is-locked');
    this.lenis.start();
    s.leave?.(dir);
    const a = this.anchor(s);
    this.prevY = a;
    if (glide && dir) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const to = dir > 0 ? a + s.el.offsetHeight : a - window.innerHeight;
      // the glide stays catchable: a fling that keeps going still stops at the next scene
      this.navigate(Math.max(0, Math.min(max, to)), 1.05, dir, false);
    }
  }

  /** Programmatic scroll. With `guard` (anchor links) it never gets caught on the way. */
  navigate(y, duration = 1.3, dir = 0, guard = true) {
    this.nav = guard;
    clearTimeout(this.navTimer);
    const done = () => {
      clearTimeout(this.navTimer);
      this.nav = false;
      this.prevY = window.scrollY;
      this.settle(dir);
    };
    this.navTimer = setTimeout(done, duration * 1000 + 200);
    this.lenis.scrollTo(y, { duration, easing: easeOut, force: true, onComplete: done });
  }

  /** After a glide that ends exactly on a scene, hold it there. */
  settle(dir) {
    if (this.active) return;
    const y = window.scrollY;
    for (const s of this.list) {
      if (Math.abs(this.anchor(s) - y) < 2) { this.lock(s, dir < 0 ? s.steps - 1 : 0); return; }
    }
  }

  goTo(el) {
    const y = Math.round(el.getBoundingClientRect().top + window.scrollY);
    if (this.active) this.release(0, false);
    this.navigate(y, 1.4, Math.sign(y - window.scrollY));
  }

  async go(dir) {
    const s = this.active;
    if (!s || this.busy) return;
    const next = this.step + dir;
    if (next < 0 && this.anchor(s) <= 0) return;       // nothing above the first scene
    if (next < 0 || next >= s.steps) { this.release(dir); return; }
    await this.run(s, next, dir);
  }

  async jump(next) {
    const s = this.active;
    if (!s || this.busy || next === this.step) return;
    await this.run(s, next, Math.sign(next - this.step));
  }

  async run(s, next, dir) {
    this.busy = true;
    const prev = this.step;
    this.step = next;
    try { await s.go(next, prev, dir); } finally { this.busy = false; }
  }

  onWheel(e) {
    const now = performance.now();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 32;
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    const abs = Math.abs(dy);
    const w = this.wheel;
    const gap = now - w.last;
    const fresh = gap > 180 || (abs > 30 && abs > w.abs * 2.2) || (abs > 8 && Math.sign(dy) !== w.dir && w.dir !== 0);
    w.last = now;
    w.abs = abs;
    if (fresh) { w.acc = 0; w.used = false; w.dir = Math.sign(dy); }
    if (!this.active) {
      if (this.nav && fresh) { clearTimeout(this.navTimer); this.nav = false; this.prevY = window.scrollY; }
      return;
    }
    if (e.ctrlKey) return;
    if (e.cancelable) e.preventDefault();
    if (Math.abs(e.deltaX) > abs) return;
    if (this.busy || w.used) return;
    w.acc += dy;
    if (Math.abs(w.acc) > 26) { w.used = true; this.go(Math.sign(w.acc)); }
  }

  onTouchStart(e) {
    this.touch.y = e.touches[0].clientY;
    this.touch.used = false;
    if (this.nav && !this.active) { clearTimeout(this.navTimer); this.nav = false; this.prevY = window.scrollY; }
  }

  onTouchMove(e) {
    if (!this.active) return;
    if (e.cancelable) e.preventDefault();
    const t = this.touch;
    if (t.y == null || t.used || this.busy) return;
    const dy = t.y - e.touches[0].clientY;
    if (Math.abs(dy) > 40) { t.used = true; this.go(Math.sign(dy)); }
  }

  onTouchEnd() {
    this.touch.y = null;
  }

  onKey(e) {
    if (!this.active || e.altKey || e.metaKey || e.ctrlKey) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const k = e.key;
    let dir = 0;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) dir = 1;
    else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) dir = -1;
    if (!dir) return;
    if (k === ' ' && tag === 'button') return;
    e.preventDefault();
    this.go(dir);
  }

  onScroll() {
    if (this.active) {
      const a = this.anchor(this.active);
      if (Math.abs(window.scrollY - a) > 1) window.scrollTo(0, a);
      return;
    }
    this.check(window.scrollY);
  }
}
