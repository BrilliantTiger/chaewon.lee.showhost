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
    this.wheel = { last: 0, v: 0, peak: 0, decayed: false, acc: 0, dir: 0, used: false };
    this.touch = { y: null, used: false };
    this.input = 'wheel';
    this.touchHold = false;   // after a touch release the finger must not fight the glide
    this.frozen = false;      // set while the intro plays: no scrolling under the loader
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
    document.addEventListener('focusin', (e) => this.onFocus(e));
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
    // a native jump (Home/End, scrollTo, a resize) lands where it lands; only real scrolling gets caught
    if (this.lenis.isScrolling !== 'smooth' && Math.abs(y - this.prevY) > window.innerHeight * 1.5) {
      this.prevY = y;
      this.settle(dir, y <= 1 ? 0 : null);
      return;
    }
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
      // wheel: the glide stays catchable, so a fling that keeps going still stops at the next scene.
      // touch: the glide is locked and the rest of the swipe is held, or native scrolling cancels it.
      const viaTouch = this.input === 'touch';
      this.touchHold = viaTouch;
      this.navigate(Math.max(0, Math.min(max, to)), 1.05, dir, false, null, viaTouch);
    }
  }

  /** Programmatic scroll. With `guard` (anchor links) it never gets caught on the way. */
  navigate(y, duration = 1.3, dir = 0, guard = true, landStep = null, lock = false) {
    this.nav = guard;
    clearTimeout(this.navTimer);
    const done = () => {
      clearTimeout(this.navTimer);
      this.nav = false;
      this.touchHold = false;
      this.prevY = window.scrollY;
      this.settle(dir, landStep);
    };
    this.navTimer = setTimeout(done, duration * 1000 + 200);
    this.lenis.scrollTo(y, { duration, easing: easeOut, force: true, lock, onComplete: done });
  }

  /** After a glide or a jump that ends exactly on a scene, hold it there. */
  settle(dir, landStep = null) {
    if (this.active) return;
    const y = window.scrollY;
    for (const s of this.list) {
      if (Math.abs(this.anchor(s) - y) < 2) {
        this.lock(s, landStep != null ? landStep : dir < 0 ? s.steps - 1 : 0);
        return;
      }
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
    // a step that never reports back must not freeze the page
    try { await Promise.race([s.go(next, prev, dir), new Promise((r) => setTimeout(r, 3000))]); } finally { this.busy = false; }
  }

  freeze(on) {
    this.frozen = on;
    document.documentElement.classList.toggle('is-locked', on || !!this.active);
    if (on) this.lenis.stop();
    else if (!this.active) this.lenis.start();
  }

  onWheel(e) {
    if (this.frozen) { if (e.cancelable) e.preventDefault(); return; }
    // event time, not handler time: a busy frame must not turn a momentum tail into a new swipe
    const now = e.timeStamp || performance.now();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 32;
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    const abs = Math.abs(dy);
    const w = this.wheel;
    const gap = now - w.last;
    // Speed per event, with the interval held between one and three frames: events coalesced after
    // a stall carry a big delta over a long gap, and a queued burst arrives with tiny gaps.
    const v = abs / Math.min(50, Math.max(16, gap));
    // A new gesture is a pause, a turn, or a push that comes back after the momentum tail had
    // decayed. A swipe's own run-up (speed still climbing to its peak) is never a new gesture.
    const fresh = gap > 180
      || (abs > 8 && Math.sign(dy) !== w.dir && w.dir !== 0)
      || (w.decayed && v > w.v * 1.6 && v > 1.2);
    w.last = now;
    if (fresh) {
      w.peak = v; w.decayed = false;
      w.acc = 0; w.used = false; w.dir = Math.sign(dy);
    } else {
      w.peak = Math.max(w.peak, v);
      if (v < w.peak * 0.5) w.decayed = true;
    }
    w.v = v;
    if (!this.active) {
      if (this.nav && fresh) { clearTimeout(this.navTimer); this.nav = false; this.prevY = window.scrollY; }
      return;
    }
    if (e.ctrlKey) return;
    if (e.cancelable) e.preventDefault();
    this.input = 'wheel';
    if (Math.abs(e.deltaX) > abs) return;
    if (this.busy || w.used) return;
    w.acc += dy;
    // a step needs a real push: enough distance, and at least some speed (resting fingers drift slowly)
    if (Math.abs(w.acc) > 30 && w.peak > 0.35) { w.used = true; this.go(Math.sign(w.acc)); }
  }

  onTouchStart(e) {
    this.touch.y = e.touches[0].clientY;
    this.touch.used = false;
    if (this.nav && !this.active && !this.touchHold) { clearTimeout(this.navTimer); this.nav = false; this.prevY = window.scrollY; }
  }

  onTouchMove(e) {
    if (this.frozen || this.touchHold) { if (e.cancelable) e.preventDefault(); return; }
    if (!this.active) return;
    this.input = 'touch';
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
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const k = e.key;
    if (this.frozen) {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(k)) e.preventDefault();
      return;
    }
    if (k === 'Home' || k === 'End') {
      e.preventDefault();
      if (this.active) this.release(0, false);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.navigate(k === 'Home' ? 0 : max, 1.4, k === 'Home' ? -1 : 1, true, k === 'Home' ? 0 : null);
      return;
    }
    if (!this.active) return;
    let dir = 0;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) dir = 1;
    else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) dir = -1;
    if (!dir) return;
    if (k === ' ' && tag === 'button') return;
    e.preventDefault();
    this.input = 'key';
    this.go(dir);
  }

  onFocus(e) {
    const s = this.active;
    if (!s || this.frozen || !e.target || s.el.contains(e.target) || !document.body.contains(e.target)) return;
    if (!e.target.matches(':focus-visible')) return;     // pointer clicks are handled by their own links
    this.release(0, false);
    const r = e.target.getBoundingClientRect();
    this.lenis.scrollTo(r.top + window.scrollY - window.innerHeight / 3, { immediate: true, force: true });
    this.prevY = window.scrollY;
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
