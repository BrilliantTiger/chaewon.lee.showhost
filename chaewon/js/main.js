import { Wall, Cut } from './gl.js';
import { Hearts } from './hearts.js';
import { Scenes } from './scenes.js';

const { gsap, ScrollTrigger, SplitText, CustomEase, DrawSVGPlugin, MorphSVGPlugin, ScrambleTextPlugin, Lenis } = window;
gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, DrawSVGPlugin, MorphSVGPlugin, ScrambleTextPlugin);
CustomEase.create('cut', 'M0,0 C0.62,0 0.08,1 1,1');
CustomEase.create('pop', 'M0,0 C0.18,1.5 0.4,1 1,1');

const html = document.documentElement;
const RM = html.classList.contains('rm');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const stacked = () => innerWidth / innerHeight < 0.9;   // portrait-ish: the phone sits above the copy

window.scrollTo(0, 0);

/* ---------- smooth scroll ---------- */

let lenis = null;
if (!RM) {
  lenis = new Lenis({ lerp: 0.11, smoothWheel: true, syncTouch: false, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scenes = lenis ? new Scenes(lenis) : null;

/* ---------- live clock + contact number ---------- */

const t0 = Date.now();
const clocks = $$('[data-clock]');
const tickClock = () => {
  const s = Math.floor((Date.now() - t0) / 1000);
  const txt = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  clocks.forEach((c) => { c.textContent = txt; });
};
tickClock();
setInterval(tickClock, 1000);

const telEl = $('[data-tel]');
const telText = $('[data-tel-text]');
const tel = String.fromCharCode(48, 49, 48, 45, 53, 48, 57, 49, 45, 54, 54, 49, 52);
telText.textContent = tel;
telEl.href = `tel:${tel.replace(/-/g, '')}`;

function flashText(el, msg) {
  const old = el.dataset.old || el.textContent;
  el.dataset.old = old;
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = old; }, 1600);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
telEl.addEventListener('click', async (e) => {
  if (coarse) return;
  e.preventDefault();
  if (await copy(tel)) flashText(telText, '번호를 복사했어요');
});
$$('[data-copy]').forEach((a) => a.addEventListener('click', async (e) => {
  e.preventDefault();
  const b = $('b', a);
  if (await copy(a.dataset.copy)) flashText(b, '주소를 복사했어요');
  else window.location.href = a.href;
}));

/* ---------- cursor ---------- */

if (fine && !RM) {
  html.classList.add('has-cursor');
  const cur = $('.cursor');
  const label = $('.cursor-ring b');
  const dx = gsap.quickTo('.cursor-dot', 'x', { duration: 0.08 });
  const dy = gsap.quickTo('.cursor-dot', 'y', { duration: 0.08 });
  const rx = gsap.quickTo('.cursor-ring', 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo('.cursor-ring', 'y', { duration: 0.45, ease: 'power3' });
  addEventListener('pointermove', (e) => { cur.classList.add('is-live'); dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => cur.classList.remove('is-live'));
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor], a, button');
    cur.classList.toggle('is-label', !!(t && t.dataset.cursor));
    cur.classList.toggle('is-hover', !!t && !(t && t.dataset.cursor));
    label.textContent = t && t.dataset.cursor ? t.dataset.cursor : '';
  });
}

/* ---------- endless loops only run while they are on screen ---------- */

function whileVisible(el, anim) {
  anim.pause();
  ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? anim.resume() : anim.pause()) });
  return anim;
}

/* ---------- scramble that always lands on the real text ---------- */

// The original text is kept on the element, so a scramble that starts while
// another is still running can never "land" on half-scrambled characters.
function scramble(el, opts = {}) {
  if (el.dataset.text == null) el.dataset.text = el.textContent;
  gsap.killTweensOf(el, 'scrambleText');
  const { chars = '0123456789', speed = 0.6, duration = 0.6, delay = 0, revealDelay = 0 } = opts;
  return gsap.to(el, { duration, delay, scrambleText: { text: el.dataset.text, chars, speed, revealDelay }, onInterrupt: () => { el.textContent = el.dataset.text; } });
}

/* ---------- section titles ---------- */

function splitTitles() {
  if (RM) return;   // reduced motion: titles are simply there
  $$('.sec-title[data-split]').forEach((el) => {
    const split = new SplitText(el, { type: 'words,chars', wordsClass: 'w', charsClass: 'ch' });
    gsap.set(el, { perspective: 600 });
    gsap.from(split.chars, {
      yPercent: 110, autoAlpha: 0, duration: 1, ease: 'expo.out', stagger: 0.035,
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
  $$('.sec-no').forEach((el) => {
    gsap.from(el, { autoAlpha: 0, x: -16, duration: 0.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => scramble(el, { duration: 0.8, speed: 0.5 }) });
  });
  $$('.sec-sub').forEach((el) => {
    gsap.from(el, { autoAlpha: 0, y: 18, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
  });
}

/* ---------- HERO ---------- */

const heroSec = $('#hero');
const stage = $('.stage', heroSec);
const person = $('.person', heroSec);
const shadow = $('.person-shadow', heroSec);
const typeRows = $$('.stage-row', heroSec);
const tags = $$('.tag', heroSec);
const phone = $('.phone', heroSec);
const statement = $('.statement', heroSec);
const heartsCanvas = $('.hearts', heroSec);
const hearts = RM ? null : new Hearts(heartsCanvas);
let wall = null;
if (!RM) { try { wall = new Wall($('.stage-gl', heroSec)); } catch { wall = null; } }

stage.dataset.cursor = '♥ TAP';
let heroStep = 0;

function phoneRect() {
  const W = heroSec.clientWidth;
  const H = heroSec.clientHeight;
  const ratio = 9 / 19.5;
  let ph;
  let cx;
  let cy;
  if (stacked()) {
    const top = Math.max(26, H * 0.045);
    const reserve = statement.offsetHeight + parseFloat(getComputedStyle(statement).bottom || 0) + 26;
    ph = Math.max(220, Math.min(H - top - reserve, H * 0.62, (W - 40) / ratio));
    cx = W / 2;
    cy = top + ph / 2;
  } else {
    ph = Math.min(H * 0.8, 780);
    cx = Math.max(ph * ratio / 2 + 40, W * 0.29);
    cy = H / 2;
  }
  const pw = ph * ratio;
  return { W, H, x: cx - pw / 2, y: cy - ph / 2, w: pw, h: ph, cx, cy, r: Math.max(18, pw * 0.13) };
}

const statementSplit = RM ? null : new SplitText($('.statement-title', statement), { type: 'words,chars', wordsClass: 'sw', charsClass: 'sch' });

function decorate() {
  const energy = $('.w-energy', statement);
  const trust = $('.w-trust', statement);
  energy.insertAdjacentHTML('beforeend', '<svg class="scribble" viewBox="0 0 213 100" aria-hidden="true"><path d="M16,26 L2,4"/><path d="M40,14 L35,-8"/><path d="M173,14 L178,-8"/><path d="M197,26 L211,4"/></svg>');
  trust.insertAdjacentHTML('beforeend', '<svg class="scribble" viewBox="0 0 142 100" aria-hidden="true"><path d="M6,96 C30,86 50,104 74,92 S116,86 138,95"/></svg>');
}

let heroTl = null;

// The dot of each category tag sits on a point of her outfit. The offsets are percentages
// (plus half a dot), so they stay right when the tag changes size at a breakpoint.
function anchorTags() {
  if (RM) return;
  tags.forEach((t) => {
    const reversed = getComputedStyle(t).flexDirection === 'row-reverse';
    const half = $('i', t).offsetWidth / 2;
    gsap.set(t, { xPercent: reversed ? -100 : 0, yPercent: -50, x: reversed ? half : -half });
  });
}
function buildPhone() {
  heroSec.classList.toggle('is-stacked', stacked());
  const R = phoneRect();
  const s = R.h / R.H;
  const insetX = Math.max(0, (R.W - R.w / s) / 2);
  const progress = heroTl ? heroTl.progress() : 0;
  // revert, not kill: from() tweens record their end state when they are created, so a rebuild
  // on top of a half-hidden layout (every resize, and every iOS toolbar change) would hide the UI for good
  if (heroTl) heroTl.revert();
  phone.classList.toggle('is-tiny', R.w < 175);
  anchorTags();
  gsap.set([stage, phone, statement], { clearProps: 'all' });
  Object.entries({ '--px': R.x, '--py': R.y, '--pw': R.w, '--ph': R.h, '--pr': R.r }).forEach(([k, v]) => phone.style.setProperty(k, `${v}px`));

  const heroOut = [...$$('.hero-eyebrow > *', heroSec), $('.hero-name', heroSec), ...$$('.hero-tagline span', heroSec)];
  const ui = [$('.phone-top', phone), $('.phone-side', phone), $('.phone-card', phone)];
  const hl = $$('.hl', statement);
  const energyChars = $$('.w-energy .sch', statement);
  const sparks = $$('.w-energy .scribble path', statement);
  const wave = $$('.w-trust .scribble path', statement);

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' } });
  tl.to(heroOut, { autoAlpha: 0, y: -26, duration: 0.45, stagger: 0.03, ease: 'power2.in' }, 0)
    .to(tags, { scale: 0, autoAlpha: 0, duration: 0.35, stagger: 0.04, ease: 'back.in(2)' }, 0)
    .to(['.viewfinder', '.scroll-cue'], { autoAlpha: 0, duration: 0.3 }, 0)
    .to(typeRows, { yPercent: -30, autoAlpha: 0, duration: 0.6, stagger: 0.06, ease: 'power2.in' }, 0.05)
    .fromTo(stage, { x: 0, y: 0, scale: 1, clipPath: 'inset(0px 0px round 0px)' }, {
      x: R.cx - R.W / 2, y: R.cy - R.H / 2, scale: s, clipPath: `inset(0px ${insetX}px round ${R.r / s}px)`, duration: 1.05, ease: 'expo.inOut',
    }, 0.12)
    .fromTo(phone, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power2.out' }, 0.95)
    .from(ui, { autoAlpha: 0, y: 12, duration: 0.45, stagger: 0.07, ease: 'power3.out' }, 1.05)
    .set(statement, { autoAlpha: 1 }, 0.95)
    .from($('.statement-kicker', statement), { autoAlpha: 0, x: -24, duration: 0.55, ease: 'power3.out' }, 0.95);
  if (statementSplit) {
    tl.from(statementSplit.chars, { yPercent: 70, autoAlpha: 0, duration: 0.7, stagger: 0.018, ease: 'expo.out' }, 1.0);
  }
  tl.fromTo($$('.statement em', statement), { backgroundColor: 'rgba(34, 50, 79, 0)' }, { backgroundColor: 'rgba(34, 50, 79, 1)', duration: 0.35, stagger: 0.12, ease: 'power2.out' }, 1.3)
    .fromTo(hl, { backgroundSize: '0% 38%' }, { backgroundSize: '100% 38%', duration: 0.55, stagger: 0.18, ease: 'power2.inOut' }, 1.35)
    .fromTo(energyChars, { y: 0 }, { y: -14, duration: 0.18, stagger: 0.05, ease: 'power2.out', yoyo: true, repeat: 1 }, 1.55)
    .fromTo(sparks, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.3, stagger: 0.05, ease: 'power2.out' }, 1.62)
    .fromTo(wave, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.55, ease: 'power2.inOut' }, 1.75)
    .from($$('.statement-cats li', statement), { autoAlpha: 0, y: 14, scale: 0.85, duration: 0.45, stagger: 0.06, ease: 'back.out(2.2)' }, 1.8);
  heroTl = tl;
  tl.progress(progress);
  phone.classList.toggle('is-on', progress > 0.5);
}

function heroGo(next) {
  heroStep = next;
  return new Promise((res) => {
    if (next === 1) {
      phone.classList.add('is-on');
      heroTl.timeScale(1).eventCallback('onComplete', null).play();
      gsap.delayedCall(1.45, res);   // the stream is up and the line is in: the next gesture may move on
      wall?.ping(0.5, 0.5);
      const R = phoneRect();
      setTimeout(() => hearts?.burst(R.x + R.w - 28, R.y + R.h - 120, 14, 0.8), 1050);
    } else {
      phone.classList.remove('is-on');
      // resolve on the clock, not on onReverseComplete: a rebuild mid-rewind would never fire it
      gsap.delayedCall(Math.max(0.3, heroTl.time() / 1.5), res);
      heroTl.timeScale(1.5).reverse();
    }
  });
}

// pointer parallax + taps on the hero
if (!RM) {
  const rowX = typeRows.map((r) => gsap.quickTo(r, 'x', { duration: 1.1, ease: 'power3' }));
  const rowY = typeRows.map((r) => gsap.quickTo(r, 'y', { duration: 1.1, ease: 'power3' }));
  const perX = gsap.quickTo(person, 'x', { duration: 1.2, ease: 'power3' });
  const perR = gsap.quickTo(person, 'rotationY', { duration: 1.2, ease: 'power3' });
  const shX = gsap.quickTo(shadow, 'x', { duration: 1.4, ease: 'power3' });
  gsap.set([person, shadow], { xPercent: -50, left: '50%' });
  gsap.set(person, { transformPerspective: 1200 });
  heroSec.addEventListener('pointermove', (e) => {
    const r = heroSec.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width;
    const my = (e.clientY - r.top) / r.height;
    wall?.point(mx, my);
    if (wall) wall.heat = 1;
    if (heroStep !== 0) return;
    rowX.forEach((f, i) => f((mx - 0.5) * (i ? 46 : -46)));
    rowY.forEach((f) => f((my - 0.5) * -18));
    perX((mx - 0.5) * 16);
    perR((mx - 0.5) * 6);
    shX((mx - 0.5) * 6);
  });
  heroSec.addEventListener('pointerleave', () => { if (wall) wall.heat = 0; });
  stage.addEventListener('click', (e) => {
    const r = heroSec.getBoundingClientRect();
    hearts.burst(e.clientX - r.left, e.clientY - r.top, 18);
    wall?.ping((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  let count = 0;
  const countEl = $('[data-hearts-count]');
  $('.phone-heart').addEventListener('click', (e) => {
    e.stopPropagation();
    const r = heroSec.getBoundingClientRect();
    const b = e.currentTarget.getBoundingClientRect();
    hearts.burst(b.left + b.width / 2 - r.left, b.top - r.top, 12, 0.7);
    count += 1;
    countEl.textContent = count;
    gsap.fromTo(e.currentTarget, { scale: 0.85 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1.2, .4)' });
  });
  const ambient = () => {
    if (document.hidden || window.scrollY > heroSec.offsetHeight) return;
    if (heroStep === 0) {
      // phones keep the hero clear: the category tags sit where the stream would rise
      if (!stacked()) hearts.float(heroSec.clientWidth * (0.84 + Math.random() * 0.08), heroSec.clientHeight * 0.94, 0.9);
    } else {
      const b = $('.phone-heart').getBoundingClientRect();
      const r = heroSec.getBoundingClientRect();
      if (b.width) hearts.float(b.left + b.width / 2 - r.left, b.top - r.top, 0.7);
    }
  };
  setInterval(ambient, 650);
}

/* ---------- BEST LIVE ---------- */

const best = $('#best');
const bestItems = $$('.best-item', best);
const bestDots = $$('.best-dots i', best);
const bestWord = $('.best-word', best);
const bestFrame = $('.best-frame', best);
const FOCUS = [[0.5, 0.56], [0.5, 0.5], [0.5, 0.66], [0.5, 0.5]];
const bestData = bestItems.map((li, i) => ({
  src: $('.best-img', li).getAttribute('src'), bg: li.dataset.bg, ink: li.dataset.ink,
  title: $('.best-title', li).textContent, focus: FOCUS[i],
}));
let cut = null;
let bestShown = 0;
const bestSplits = [];

function initBest() {
  // chips: keep the text readable on the chip colour
  $$('.best-cat', best).forEach((c) => { c.innerHTML = `<span class="best-cat-t">${c.innerHTML}</span>`; });
  if (RM) return;
  try {
    cut = new Cut($('.best-gl', best), bestData.map((d) => ({ src: d.src, focus: d.focus })));
  } catch {
    cut = null;
    bestFrame.insertAdjacentHTML('afterbegin', bestData.map((d, i) => `<img class="best-fallback" src="${d.src}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${i ? 0 : 1}">`).join(''));
  }
  bestItems.forEach((li) => bestSplits.push(new SplitText($('.best-title', li), { type: 'words,chars', wordsClass: 'bw', charsClass: 'bch' })));
  gsap.set(best, { backgroundColor: bestData[0].bg, color: bestData[0].ink });
  bestItems[0].classList.add('is-on');
  bestDots[0].classList.add('is-on');
  bestWord.textContent = bestData[0].title;
  cut?.set(0, 0, 0);
  gsap.set(best, { perspective: 1200 });
  gsap.from(bestFrame, { autoAlpha: 0, scale: 0.86, rotateY: -12, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: best, start: 'top 70%' } });
  gsap.from(bestItems[0].children, { autoAlpha: 0, y: 30, duration: 0.9, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: best, start: 'top 60%' } });
  if (fine) {
    const tx = gsap.quickTo(bestFrame, 'rotationY', { duration: 0.8, ease: 'power3' });
    const ty = gsap.quickTo(bestFrame, 'rotationX', { duration: 0.8, ease: 'power3' });
    best.addEventListener('pointermove', (e) => {
      const r = best.getBoundingClientRect();
      tx(((e.clientX - r.left) / r.width - 0.5) * 10);
      ty(((e.clientY - r.top) / r.height - 0.5) * -8);
    });
  }
  bestDots.forEach((d, i) => {
    d.style.pointerEvents = 'auto';
    d.style.cursor = 'pointer';
    d.addEventListener('click', () => scenes?.active === bestScene && scenes.jump(i));
  });
}

function showBest(i, prev, dir) {
  return new Promise((res) => {
    if (i === prev) { res(); return; }
    const out = bestItems[prev];
    const inn = bestItems[i];
    const d = bestData[i];
    bestShown = i;
    const tl = gsap.timeline({ onComplete: () => { out.classList.remove('is-on'); res(); } });
    const outKids = [...out.children].filter((c) => !c.classList.contains('best-img'));
    const inKids = [...inn.children].filter((c) => !c.classList.contains('best-img') && !c.classList.contains('best-title'));
    tl.to(bestSplits[prev].chars, { yPercent: -110 * dir, autoAlpha: 0, duration: 0.4, stagger: 0.012, ease: 'power2.in' }, 0)
      .to(outKids.filter((c) => !c.classList.contains('best-title')), { autoAlpha: 0, y: -20 * dir, duration: 0.35, stagger: 0.03, ease: 'power2.in' }, 0)
      .add(() => { inn.classList.add('is-on'); }, 0.38)
      .fromTo(bestSplits[i].chars, { yPercent: 110 * dir, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.8, stagger: 0.03, ease: 'expo.out' }, 0.42)
      .fromTo(inKids, { autoAlpha: 0, y: 26 * dir }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'expo.out' }, 0.45)
      .to(best, { backgroundColor: d.bg, color: d.ink, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(bestWord, { xPercent: -8 * dir, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0)
      .add(() => { bestWord.textContent = d.title; }, 0.4)
      .fromTo(bestWord, { xPercent: 8 * dir, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 0.16, duration: 0.9, ease: 'expo.out' }, 0.42)
      .fromTo(bestFrame, { scale: 1 }, { scale: 0.94, duration: 0.45, ease: 'power2.in', yoyo: true, repeat: 1 }, 0);
    const no = $('.best-no', inn);
    tl.add(() => scramble(no), 0.42);
    bestDots.forEach((dot, k) => dot.classList.toggle('is-on', k === i));
    if (cut) {
      const st = { p: 0 };
      tl.to(st, { p: 1, duration: 1.15, ease: 'power2.inOut', onUpdate: () => cut.set(prev, i, st.p), onComplete: () => cut.set(i, i, 0) }, 0);
    } else {
      const imgs = $$('.best-fallback', bestFrame);
      tl.to(imgs[prev], { autoAlpha: 0, duration: 0.8 }, 0).to(imgs[i], { autoAlpha: 1, duration: 0.8 }, 0);
    }
  });
}

/* ---------- 01 LIVE DATA ---------- */

function initData() {
  $$('.odo').forEach((el) => {
    const value = el.dataset.value;
    const unit = el.dataset.unit || '';
    el.setAttribute('aria-label', value + unit);
    el.innerHTML = '';
    const strips = [];
    [...value].forEach((ch) => {
      const col = document.createElement('span');
      col.className = 'odo-col';
      col.setAttribute('aria-hidden', 'true');
      const strip = document.createElement('span');
      strip.className = 'odo-strip';
      for (let k = 0; k < 20; k++) strip.insertAdjacentHTML('beforeend', `<span>${k % 10}</span>`);
      col.appendChild(strip);
      el.appendChild(col);
      strips.push([strip, Number(ch)]);
    });
    if (unit) el.insertAdjacentHTML('beforeend', `<span class="odo-unit" aria-hidden="true">${unit}</span>`);
    if (RM) { strips.forEach(([s, n]) => gsap.set(s, { yPercent: -5 * (10 + n) })); return; }
    gsap.set(strips.map((s) => s[0]), { yPercent: 0 });
    ScrollTrigger.create({
      trigger: el, start: 'top 96%', once: true,
      onEnter: () => {
        strips.forEach(([s, n], k) => gsap.to(s, { yPercent: -5 * (10 + n), duration: 1.6 + k * 0.25, ease: 'expo.out', delay: 0.05 * k }));
        const u = $('.odo-unit', el);
        if (u) gsap.from(u, { autoAlpha: 0, x: -10, duration: 0.6, delay: 1.2, ease: 'power3.out' });
      },
    });
  });
  if (RM) return;
  gsap.from('.stat-label, .stat-note', { autoAlpha: 0, y: 14, duration: 0.7, stagger: 0.05, ease: 'power3.out', scrollTrigger: { trigger: '.stats', start: 'top 82%' } });

  const ranks = $$('.rank');
  gsap.set($$('.rank-bar'), { scaleX: 0 });
  ScrollTrigger.create({
    trigger: '.rank-list', start: 'top 80%', once: true,
    onEnter: () => {
      ranks.forEach((r, k) => {
        const bar = $('.rank-bar', r);
        const val = $('.rank-val', r);
        const target = Number(val.dataset.count);
        const o = { v: 0 };
        gsap.to(bar, { scaleX: 1, duration: 1.4, ease: 'expo.out', delay: 0.12 * k });
        gsap.fromTo(val, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.6, delay: 0.12 * k + 0.2 });
        gsap.to(o, { v: target, duration: 1.4, ease: 'expo.out', delay: 0.12 * k, onUpdate: () => { val.textContent = `${Math.round(o.v).toLocaleString('ko-KR')}회`; } });
      });
    },
  });
  gsap.from(ranks, { autoAlpha: 0, x: 30, duration: 0.8, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.rank-list', start: 'top 85%' } });
  // the left card shows the row under the pointer, so nothing ever floats over the bars
  const detail = $('.rank-detail');
  const parts = { k: $('[data-k]', detail), t: $('[data-t]', detail), c: $('[data-c]', detail) };
  let pickTl = null;
  const pick = (r) => {
    if (r.classList.contains('is-on')) return;
    ranks.forEach((x) => x.classList.toggle('is-on', x === r));
    const val = $('.rank-val', r).dataset.count;
    detail.href = $('.rank-name a', r).href;
    pickTl?.kill();
    pickTl = gsap.timeline()
      .to(Object.values(parts), { yPercent: -60, autoAlpha: 0, duration: 0.16, stagger: 0.03, ease: 'power2.in' })
      .add(() => {
        parts.k.textContent = `${$('.rank-no', r).textContent}위 · ${$('.rank-name small', r).textContent}`;
        parts.t.textContent = r.dataset.title;
        parts.c.textContent = `${r.dataset.channel || $('.rank-name a', r).textContent} · ${Number(val).toLocaleString('ko-KR')}회`;
      })
      .fromTo(Object.values(parts), { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.35, stagger: 0.04, ease: 'expo.out' });
  };
  ranks.forEach((r) => { r.addEventListener('pointerenter', () => pick(r)); r.addEventListener('focusin', () => pick(r)); });
  ranks[0].classList.add('is-on');
  gsap.from(detail, { autoAlpha: 0, y: 30, rotateX: -20, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: '.ranking', start: 'top 80%' } });
  gsap.from('.ranking-head > h3, .ranking-head > p', { autoAlpha: 0, y: 20, duration: 0.8, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.ranking', start: 'top 85%' } });
}

/* ---------- marquees that lean into the scroll ---------- */

function marquee(track, width, dir, seconds) {
  // `width` was measured up front: copies to fill 2.2 screens, then the whole set twice for a seamless loop
  const items = [...track.children];
  const copies = Math.max(0, Math.ceil((innerWidth * 2.2) / Math.max(1, width)) - 1);
  const frag = document.createDocumentFragment();
  for (let c = 0; c < copies; c++) items.forEach((n) => { const k = n.cloneNode(true); k.setAttribute('aria-hidden', 'true'); frag.appendChild(k); });
  track.appendChild(frag);
  const half = [...track.children];
  const frag2 = document.createDocumentFragment();
  half.forEach((n) => { const k = n.cloneNode(true); k.setAttribute('aria-hidden', 'true'); frag2.appendChild(k); });
  track.appendChild(frag2);
  return gsap.fromTo(track, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: seconds, ease: 'none', repeat: -1 });
}

function initMarquees() {
  if (RM) return;
  const tracks = [...$$('.brandwall-track').map((t, k) => [t, k % 2 ? -1 : 1, 38]), [$('.contact-marquee p'), 1, 26], [$('.platforms-track'), -1, 30]];
  const widths = tracks.map(([t]) => t.scrollWidth);          // read everything once…
  const tweens = tracks.map(([t, dir, sec], k) => whileVisible(t.parentElement, marquee(t, widths[k], dir, sec)));   // …then write
  const skews = [...$$('.brandwall-track'), $('.contact-marquee p'), $('.platforms-track')].map((el) => gsap.quickTo(el, 'skewX', { duration: 0.5, ease: 'power3' }));
  let speed = 1;
  let target = 1;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const v = self.getVelocity();
      target = gsap.utils.clamp(-5, 5, v / 260) || 1;
      if (Math.abs(target) < 1) target = Math.sign(target || 1);
      skews.forEach((f) => f(gsap.utils.clamp(-10, 10, -v / 220)));
    },
  });
  gsap.ticker.add(() => {
    speed += (target - speed) * 0.08;
    target += (Math.sign(target) - target) * 0.05;
    tweens.forEach((t) => t.timeScale(speed));
    if (Math.abs(target - Math.sign(target)) < 0.02) skews.forEach((f) => f(0));
  });
}

/* ---------- 03 SIGNATURE ---------- */

function initSignature() {
  if (RM) return;
  const rows = $$('.sig-row');
  rows.forEach((r) => r.insertAdjacentHTML('beforeend', '<i class="sig-wipe" aria-hidden="true"></i>'));
  rows.forEach((r) => {
    const wipe = $('.sig-wipe', r);
    const kids = [...r.children].filter((c) => c !== wipe);
    gsap.set(wipe, { scaleX: 0, transformOrigin: 'left center' });
    gsap.set(kids, { autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: r, start: 'top 86%', once: true,
      onEnter: () => {
        gsap.timeline()
          .to(wipe, { scaleX: 1, duration: 0.45, ease: 'expo.in' })
          .set(kids, { autoAlpha: 1 })
          .set(wipe, { transformOrigin: 'right center' })
          .to(wipe, { scaleX: 0, duration: 0.6, ease: 'expo.out' })
          .from($('.sig-main', r), { x: -40, duration: 0.9, ease: 'expo.out' }, '<')
          .from($('.sig-tag', r), { scale: 0.4, rotate: -12, duration: 0.7, ease: 'back.out(3)' }, '<0.05');
      },
    });
  });
  const sticker = $('.sig-sticker svg');
  const spin = whileVisible('.sig', gsap.to(sticker, { rotation: 360, duration: 16, repeat: -1, ease: 'none', transformOrigin: '50% 50%' }));
  ScrollTrigger.create({
    trigger: '.sig', start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => { spin.timeScale(1 + Math.min(Math.abs(self.getVelocity()) / 300, 6)); gsap.to(spin, { timeScale: 1, duration: 1.2, overwrite: true, delay: 0.1 }); },
  });
  gsap.from('.sig-sticker', { scale: 0, rotate: -120, duration: 1.2, ease: 'back.out(1.8)', scrollTrigger: { trigger: '.sig', start: 'top 70%' } });
  gsap.from('.platforms-row', { autoAlpha: 0, y: 40, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: '.platforms', start: 'top 90%' } });
}

/* ---------- 04 HOW I HOST ---------- */

function initStyle() {
  const em = $('.style-quote-text em');
  em.insertAdjacentHTML('beforeend', '<svg class="style-burst" viewBox="-50 -50 100 100" aria-hidden="true">' +
    [0, 40, 80, 140, 180, 220, 260, 320].map((a) => {
      const r = (a * Math.PI) / 180;
      return `<path d="M${(Math.cos(r) * 30).toFixed(1)},${(Math.sin(r) * 30).toFixed(1)} L${(Math.cos(r) * 42).toFixed(1)},${(Math.sin(r) * 42).toFixed(1)}"/>`;
    }).join('') + '</svg>');
  $$('.style-burst path').forEach((p) => p.setAttribute('vector-effect', 'non-scaling-stroke'));
  if (RM) return;
  const quote = new SplitText('.style-quote-text', { type: 'words,chars', wordsClass: 'qw', charsClass: 'qch' });
  gsap.timeline({ scrollTrigger: { trigger: '.style-quote', start: 'top 80%' } })
    .from(quote.chars, { yPercent: 80, autoAlpha: 0, duration: 0.8, stagger: 0.03, ease: 'expo.out' })
    .fromTo('.style-burst path', { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.35, stagger: 0.02, ease: 'power2.out' }, '-=0.3')
    .to('.style-burst path', { drawSVG: '100% 100%', duration: 0.35, stagger: 0.02, ease: 'power2.in' })
    .fromTo(em, { scale: 1 }, { scale: 1.16, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, '<-0.4')
    .from('.style-quote-sub', { autoAlpha: 0, y: 20, duration: 0.8, ease: 'power3.out' }, '<');

  // the hashtags roll through like a live chat
  const track = $('.chat-track');
  const items = [...track.children];
  items.forEach((n) => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
  const loopH = () => items.reduce((h, n) => h + n.offsetHeight + 10, 0);
  const chat = whileVisible('.chat', gsap.fromTo(track, { y: 0 }, { y: () => -loopH(), duration: 12, ease: 'none', repeat: -1 }));
  gsap.from('.chat', { autoAlpha: 0, x: 40, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.chat', start: 'top 85%' } });
  addEventListener('resize', () => { const paused = chat.paused(); chat.invalidate().restart(); if (paused) chat.pause(); });

  const cards = $$('.style-card');
  gsap.from(cards, { rotateY: -70, autoAlpha: 0, x: -40, transformOrigin: 'left center', duration: 1.1, stagger: 0.14, ease: 'expo.out', scrollTrigger: { trigger: '.style-cards', start: 'top 82%' } });
  cards.forEach((c) => {
    const no = $('.style-no', c);
    c.addEventListener('pointerenter', () => scramble(no, { duration: 0.5, speed: 0.7 }));
    if (!fine) return;
    const rx = gsap.quickTo(c, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(c, 'rotationY', { duration: 0.6, ease: 'power3' });
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      rx(((e.clientY - r.top) / r.height - 0.5) * -10);
      ry(((e.clientX - r.left) / r.width - 0.5) * 10);
    });
    c.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  // 매출 · 재미 · 감동 on the beat
  const beats = $$('.beats-a span');
  gsap.from(beats, { scale: 0, autoAlpha: 0, duration: 0.8, stagger: 0.15, ease: 'back.out(2.4)', scrollTrigger: { trigger: '.beats', start: 'top 85%' } });
  gsap.from('.beats-s, .beats-q', { autoAlpha: 0, y: 16, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.beats', start: 'top 85%' } });
  const beat = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });
  beats.forEach((b, k) => {
    beat.to(b, { scale: 1.14, backgroundColor: '#ff2d55', duration: 0.12, ease: 'power2.out' }, k * 0.42)
      .to(b, { scale: 1, backgroundColor: '#22324f', duration: 0.3, ease: 'power2.in' }, k * 0.42 + 0.14)
      .fromTo(b, { '--r': 0 }, { '--r': 1, duration: 0.5 }, k * 0.42);
  });
  ScrollTrigger.create({ trigger: '.beats', start: 'top 90%', end: 'bottom top', onToggle: (self) => (self.isActive ? beat.play() : beat.pause()) });
}

/* ---------- 06 LIVE LOG ---------- */

let currentYear = '2026';
let yearSwitch = null;
function selectYear(year, animate = true) {
  const rows = $$('.lg-row');
  if (year === currentYear && animate) return;
  currentYear = year;
  $$('.year').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.year === year)));
  const show = rows.filter((r) => r.dataset.year === year);
  const hide = rows.filter((r) => r.dataset.year !== year);
  if (!animate || RM) {
    hide.forEach((r) => { r.hidden = true; });
    show.forEach((r) => { r.hidden = false; });
    return;
  }
  const list = $('.board-rows');
  yearSwitch?.kill();
  gsap.killTweensOf(rows);
  const out = rows.filter((r) => !r.hidden && r.dataset.year !== year);
  const swap = () => {
    if (year !== currentYear) return;
    const from = list.offsetHeight;
    rows.forEach((r) => { r.hidden = r.dataset.year !== year; });
    const to = list.offsetHeight;
    gsap.fromTo(list, { height: from }, { height: to, duration: 0.45, ease: 'power3.inOut', overwrite: true, onComplete: () => { gsap.set(list, { clearProps: 'height' }); ScrollTrigger.refresh(); } });
    flapIn(show);
  };
  yearSwitch = out.length
    ? gsap.to(out, { rotateX: 90, autoAlpha: 0, duration: 0.18, stagger: 0.025, ease: 'power2.in', onComplete: swap })
    : gsap.delayedCall(0, swap);
}

function flapIn(rows) {
  gsap.fromTo(rows, { rotateX: -90, autoAlpha: 0 }, { rotateX: 0, autoAlpha: 1, duration: 0.55, stagger: 0.06, ease: 'back.out(1.6)', overwrite: true });
  rows.forEach((r, k) => {
    ['time', '.lg-brand', '.lg-title'].forEach((sel, j) => {
      scramble($(sel, r), { duration: 0.7 + j * 0.15, delay: 0.06 * k, speed: 0.9, revealDelay: 0.15,
        chars: sel === 'time' ? '0123456789.' : '가나다라마바사아자차카타파하ABCDEFGHJKLMNOPRSTUVWXYZ' });
    });
  });
}

function initLog() {
  $$('.year').forEach((b) => b.addEventListener('click', () => selectYear(b.dataset.year)));
  selectYear('2026', false);
  $$('.lg-row > a').forEach((a) => { a.dataset.cursor = 'PLAY'; });
  if (RM) return;
  ScrollTrigger.create({ trigger: '.board', start: 'top 80%', once: true, onEnter: () => flapIn($$('.lg-row').filter((r) => !r.hidden)) });
  gsap.from('.year', { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.06, ease: 'back.out(2)', scrollTrigger: { trigger: '.years', start: 'top 88%' } });
  gsap.from('.board', { y: 60, autoAlpha: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.board', start: 'top 92%' } });
}

/* ---------- 03 ALL LIVE ---------- */

const tabs = $$('.tab');
const ink = $('.tab-ink');
const cards = $$('.card');
const notes = $$('.cat-note');
let currentCat = 'fashion';
let catSwitch = null;

function placeInk(immediate) {
  const t = tabs.find((x) => x.dataset.cat === currentCat);
  const p = t.parentElement.getBoundingClientRect();
  const r = t.getBoundingClientRect();
  const props = { x: r.left - p.left + t.parentElement.scrollLeft, y: r.top - p.top, width: r.width, height: r.height };
  if (immediate) gsap.set(ink, props);
  else gsap.to(ink, { ...props, duration: 0.7, ease: 'elastic.out(1, .75)' });
}

function staticBurst() {
  const cv = $('.static');
  const ctx = cv.getContext('2d');
  cv.width = 160;
  cv.height = 100;
  const img = ctx.createImageData(cv.width, cv.height);
  let alive = true;
  const draw = () => {
    if (!alive) return;
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v; img.data[i + 1] = v * 0.86; img.data[i + 2] = v * 0.92; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    requestAnimationFrame(draw);
  };
  draw();
  gsap.timeline({ onComplete: () => { alive = false; } })
    .fromTo(cv, { opacity: 0 }, { opacity: 0.9, duration: 0.08 })
    .to(cv, { opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.22);
  const grid = $('.grid');
  gsap.timeline()
    .to(grid, { x: () => gsap.utils.random(-14, 14), skewX: () => gsap.utils.random(-4, 4), duration: 0.06, repeat: 4, yoyo: true })
    .set(grid, { x: 0, skewX: 0 });
}

function selectCat(cat, animate = true) {
  if (cat === currentCat && animate) return;
  currentCat = cat;
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.cat === cat)));
  const strip = $('.tabs');
  const active = tabs.find((t) => t.dataset.cat === cat);
  if (strip.scrollWidth > strip.clientWidth + 2) {
    strip.scrollTo({ left: active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2, behavior: animate && !RM ? 'smooth' : 'auto' });
  }
  placeInk(!animate);
  notes.forEach((n) => n.classList.toggle('is-on', n.dataset.cat === cat));
  const on = notes.find((n) => n.dataset.cat === cat);
  const incoming = cards.filter((c) => c.dataset.cat === cat);
  const outgoing = cards.filter((c) => !c.hidden && c.dataset.cat !== cat);
  if (!animate || RM) {
    cards.forEach((c) => { c.hidden = c.dataset.cat !== cat; });
    if (!RM) gsap.set(incoming, { autoAlpha: 1, y: 0, rotate: 0, scale: 1 });
    notes.forEach((n) => gsap.set(n, { autoAlpha: n.dataset.cat === cat ? 1 : 0 }));
    return;
  }
  gsap.killTweensOf(notes);
  gsap.set(notes.filter((n) => n !== on), { autoAlpha: 0, y: 0 });
  gsap.fromTo(on, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' });
  staticBurst();
  catSwitch?.kill();
  gsap.killTweensOf(cards);
  const swap = () => {
    if (cat !== currentCat) return;
    cards.forEach((c) => { c.hidden = c.dataset.cat !== cat; });
    gsap.fromTo(incoming, { autoAlpha: 0, y: 60, rotate: () => gsap.utils.random(-8, 8), scale: 0.9 }, {
      autoAlpha: 1, y: 0, rotate: 0, scale: 1, duration: 0.9, stagger: 0.06, ease: 'expo.out',
    });
    ScrollTrigger.refresh();
  };
  catSwitch = outgoing.length
    ? gsap.to(outgoing, { autoAlpha: 0, y: -24, rotate: () => gsap.utils.random(-6, 6), scale: 0.92, duration: 0.25, stagger: 0.02, ease: 'power2.in', onComplete: swap })
    : gsap.delayedCall(0, swap);
}

function initLives() {
  tabs.forEach((t) => t.addEventListener('click', () => selectCat(t.dataset.cat)));
  $('.tabs').addEventListener('keydown', (e) => {
    const i = tabs.findIndex((t) => t.dataset.cat === currentCat);
    const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!n) return;
    const next = tabs[(i + n + tabs.length) % tabs.length];
    next.focus();
    selectCat(next.dataset.cat);
  });
  selectCat('fashion', false);
  requestAnimationFrame(() => placeInk(true));
  addEventListener('resize', () => placeInk(true));
  cards.forEach((c) => {
    const a = $('a', c);
    if (a) a.dataset.cursor = 'PLAY';
    c.insertAdjacentHTML('beforeend', '<i class="card-shine" aria-hidden="true"></i>');
  });
  if (RM) return;
  ScrollTrigger.create({
    trigger: '.grid', start: 'top 82%', once: true,
    onEnter: () => gsap.fromTo(cards.filter((c) => !c.hidden), { autoAlpha: 0, y: 80, rotate: () => gsap.utils.random(-6, 6) }, { autoAlpha: 1, y: 0, rotate: 0, duration: 1, stagger: 0.07, ease: 'expo.out' }),
  });
  gsap.from('.tab', { autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.06, ease: 'back.out(2)', scrollTrigger: { trigger: '.tabs', start: 'top 88%' }, onComplete: () => placeInk(true) });
  if (fine) {
    cards.forEach((c) => {
      const rx = gsap.quickTo(c, 'rotationX', { duration: 0.6, ease: 'power3' });
      const ry = gsap.quickTo(c, 'rotationY', { duration: 0.6, ease: 'power3' });
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        gsap.set(c, { transformPerspective: 800 });
        rx((0.5 - y) * 14);
        ry((x - 0.5) * 14);
        c.style.setProperty('--mx', `${x * 100}%`);
        c.style.setProperty('--my', `${y * 100}%`);
      });
      c.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }
}

/* ---------- 04 HISTORY ---------- */

function initHistory() {
  $$('.badge').forEach((b, i) => {
    const award = b.classList.contains('badge--award');
    const txt = award ? '★ AWARD ★ AWARD ★ AWARD ★ AWARD ' : 'BEAUTY MODEL · BEAUTY MODEL · BEAUTY MODEL · ';
    b.insertAdjacentHTML('afterbegin', `<svg class="badge-ring" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="ring${i}" d="M50,50 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/></defs><text><textPath href="#ring${i}">${txt}</textPath></text></svg>`);
  });
  if (RM) return;
  const route = $$('.route li');
  gsap.set(route, { '--k': 0 });
  gsap.timeline({ scrollTrigger: { trigger: '.route', start: 'top 85%' } })
    .from(route, { autoAlpha: 0, x: -18, duration: 0.5, stagger: 0.12, ease: 'power3.out' })
    .to(route, { '--k': 1, duration: 0.4, stagger: 0.12, ease: 'power2.out' }, 0.1)
    .from(route[route.length - 1], { scale: 0.6, duration: 0.6, ease: 'elastic.out(1, .5)' }, '-=0.2');
  gsap.fromTo('.tl-line', { scaleY: 0 }, { scaleY: 1, transformOrigin: '50% 0%', ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 65%', scrub: 0.6 } });
  $$('.tl').forEach((li) => {
    gsap.from(li, { autoAlpha: 0, x: 34, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: li, start: 'top 86%' } });
  });
  gsap.from('.awards-title', { autoAlpha: 0, y: 16, duration: 0.6, scrollTrigger: { trigger: '.awards', start: 'top 85%' } });
  const badges = $$('.badge');
  gsap.set(badges, { autoAlpha: 0 });
  ScrollTrigger.create({
    trigger: '.badges', start: 'top 80%', once: true,
    onEnter: () => {
      gsap.timeline()
        .fromTo(badges, { autoAlpha: 0, scale: 1.9, rotate: -28 }, { autoAlpha: 1, scale: 1, rotate: () => gsap.utils.random(-7, 7), duration: 0.55, stagger: 0.16, ease: 'back.out(2.6)' })
        .fromTo('.badges', { x: 0 }, { x: 5, duration: 0.05, repeat: 5, yoyo: true, ease: 'none' }, 0.32);
    },
  });
  $$('.badge-ring').forEach((r, i) => whileVisible('.awards', gsap.to(r, { rotation: i % 2 ? -360 : 360, duration: 22, repeat: -1, ease: 'none', transformOrigin: '50% 50%' })));
}

/* ---------- 05 FITTING ---------- */

function countUp(el, to, duration = 1.4, delay = 0) {
  const o = { v: 0 };
  return gsap.to(o, { v: to, duration, delay, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
}

/** Count every number inside a label like "44반–55" or "235–240", leaving the rest as it is. */
function countText(el, duration = 1.3, delay = 0) {
  const parts = el.textContent.split(/(\d+)/);
  const o = { p: 0 };
  return gsap.to(o, { p: 1, duration, delay, ease: 'expo.out', onUpdate: () => {
    el.textContent = parts.map((t, i) => (i % 2 ? Math.round(Number(t) * o.p) : t)).join('');
  } });
}

function initFitting() {
  if (RM) return;
  const fig = $('.fit-figure');
  const scan = $('.fit-scan');
  const color = $('.fit-color');
  const ruler = $('.fit-ruler');
  ScrollTrigger.create({
    trigger: fig, start: 'top 65%', once: true,
    onEnter: () => {
      const tl = gsap.timeline();
      tl.set(scan, { opacity: 1, top: '0%' })
        .to(scan, { top: '100%', duration: 1.9, ease: 'power1.inOut' }, 0)
        .fromTo(color, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.9, ease: 'power1.inOut' }, 0)
        .to(scan, { opacity: 0, duration: 0.3 }, 1.8)
        .fromTo(ruler, { scaleY: 0 }, { scaleY: 1, duration: 1.3, ease: 'expo.out' }, 0.3)
        .add(() => countUp($('.fit-ruler-val [data-count]'), 168, 1.4), 0.35)
        .add(() => {
          whileVisible(fig, gsap.timeline({ repeat: -1, repeatDelay: 2.4 })
            .set(scan, { top: '0%', opacity: 0 })
            .to(scan, { opacity: 0.55, duration: 0.2 })
            .to(scan, { top: '100%', duration: 2.4, ease: 'none' }, 0)
            .to(scan, { opacity: 0, duration: 0.3 }, 2.1));
        }, 2.2);
    },
  });
  const rows = $$('.spec-row');
  ScrollTrigger.create({
    trigger: '.spec', start: 'top 78%', once: true,
    onEnter: () => {
      gsap.from(rows, { autoAlpha: 0, x: 40, duration: 0.8, stagger: 0.1, ease: 'expo.out' });
      rows.forEach((r, k) => {
        const b = $('b[data-count]', r);
        if (b) countUp(b, Number(b.dataset.count), 1.3, 0.1 * k);
        else countText($('b', r), 1.3, 0.1 * k);
      });
    },
  });
}

/* ---------- CONTACT ---------- */

function initContact() {
  const confetti = RM ? null : new Hearts($('.confetti'), { max: 140 });
  $('.ticket-cta').addEventListener('click', (e) => {
    if (!confetti) return;
    const r = $('.contact').getBoundingClientRect();
    const b = e.currentTarget.getBoundingClientRect();
    confetti.burst(b.left + b.width / 2 - r.left, b.top - r.top, 34, 1.2);
  });
  if (RM) return;
  gsap.from('.contact-kicker', { autoAlpha: 0, y: 16, duration: 0.6, scrollTrigger: { trigger: '.contact-in', start: 'top 85%' } });
  gsap.from('.contact-title span', { yPercent: 60, autoAlpha: 0, duration: 1, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.contact-title', start: 'top 85%' } });
  gsap.set('.contact-in', { perspective: 1000 });
  gsap.from('.ticket', { y: 90, rotateX: 28, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.ticket', start: 'top 90%' } });
  gsap.from('.ticket-row', { autoAlpha: 0, x: 24, duration: 0.6, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.ticket', start: 'top 80%' } });
  if (fine) {
    const cta = $('.ticket-cta');
    const mx = gsap.quickTo(cta, 'x', { duration: 0.5, ease: 'power3' });
    const my = gsap.quickTo(cta, 'y', { duration: 0.5, ease: 'power3' });
    cta.addEventListener('pointermove', (e) => {
      const r = cta.getBoundingClientRect();
      mx((e.clientX - r.left - r.width / 2) * 0.12);
      my((e.clientY - r.top - r.height / 2) * 0.3);
    });
    cta.addEventListener('pointerleave', () => { mx(0); my(0); });
  }
}

/* ---------- anchors: category tags jump to ALL LIVE ---------- */

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const target = $(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  if (a.dataset.cat) selectCat(a.dataset.cat, false);
  if (scenes) scenes.goTo(target);
  else target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
});

/* ---------- progress ---------- */

if (!RM) gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

/* ---------- intro ---------- */

function imgReady(img) {
  return img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; });
}

function heroIntro() {
  const split = new SplitText($('.hero-ko', heroSec), { type: 'words,chars', wordsClass: 'hw', charsClass: 'hch' });
  const tl = gsap.timeline();
  gsap.set(heroSec, { perspective: 1000 });
  tl.from(typeRows, { yPercent: 70, scaleY: 1.5, autoAlpha: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out' }, 0)
    .from(person, { y: '7%', scale: 1.05, autoAlpha: 0, duration: 1.5, ease: 'expo.out' }, 0.1)
    .from(shadow, { autoAlpha: 0, duration: 1.2, ease: 'power2.out' }, 0.5)
    .from($$('.hero-eyebrow > *', heroSec), { autoAlpha: 0, y: -14, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, 0.5)
    .from(split.chars, { yPercent: 110, autoAlpha: 0, duration: 0.9, stagger: 0.05, ease: 'expo.out' }, 0.55)
    .from($('.hero-en', heroSec), { autoAlpha: 0, letterSpacing: '1em', duration: 1.1, ease: 'expo.out' }, 0.75)
    .from($$('.hero-tagline span', heroSec), { autoAlpha: 0, x: 30, duration: 0.8, stagger: 0.12, ease: 'expo.out' }, 0.8)
    .from(tags, { scale: 0, autoAlpha: 0, duration: 0.6, stagger: 0.1, ease: 'back.out(2.4)' }, 1.0)
    .from($$('.viewfinder i', heroSec), { scale: 1.6, autoAlpha: 0, duration: 0.7, stagger: 0.05, ease: 'expo.out' }, 0.3)
    .from('.scroll-cue', { autoAlpha: 0, y: 10, duration: 0.6 }, 1.3)
    .add(() => {
      wall?.ping(0.5, 0.55);
      hearts?.burst(heroSec.clientWidth / 2, heroSec.clientHeight * 0.75, 22, 1);
    }, 0.6);
  return tl;
}

async function intro() {
  const loader = $('.loader');
  if (RM || !loader) { loader?.remove(); return; }
  const num = $('.loader-num', loader);
  const ring = $('.loader-ring circle', loader);
  let skip = false;
  loader.addEventListener('click', () => { skip = true; gsap.globalTimeline.timeScale(3); }, { once: true });
  const lineTw = gsap.to('.loader-line i', { scaleX: 0.85, duration: 2.4, ease: 'power2.out' });
  await Promise.race([
    Promise.all([imgReady($('.person-cut', heroSec)), imgReady($('.person-shadow', heroSec)), document.fonts.ready]),
    wait(5000),
  ]);
  lineTw.kill();
  await gsap.to('.loader-line i', { scaleX: 1, duration: 0.25, ease: 'power2.out' });
  performance.mark('intro:countdown');
  gsap.set(ring, { drawSVG: '0%' });
  for (const [k, n] of ['3', '2', '1'].entries()) {
    num.textContent = n;
    await gsap.timeline()
      .fromTo(num, { scale: 1.6, autoAlpha: 0, filter: 'blur(14px)' }, { scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 0.2, ease: 'power3.out' })
      .to(ring, { drawSVG: `${(k + 1) * 33.4}%`, duration: 0.24, ease: 'power2.out' }, 0)
      .to(num, { scale: 0.7, autoAlpha: 0, duration: 0.12, ease: 'power2.in' }, 0.28);
  }
  num.textContent = 'LIVE';
  num.classList.add('is-word');
  // the countdown ring fills, turns into a heart, and the heart opens onto the stage
  const heart = $('.loader-heart', loader);
  const shape = $('.loader-heart-from', heart);
  await gsap.timeline()
    .fromTo(num, { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'pop' })
    .set(heart, { visibility: 'visible' }, 0.1)
    .fromTo(shape, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.1)
    .to('.loader-ring', { autoAlpha: 0, duration: 0.2 }, 0.15)
    .to(num, { color: '#fff', scale: 0.62, y: -6, duration: 0.3, ease: 'power3.out' }, 0.15)
    .to(shape, { morphSVG: '.loader-heart-to', duration: 0.45, ease: 'back.out(1.8)' }, 0.3)
    .to(heart, { scale: 0.86, duration: 0.12, ease: 'power2.in' }, 0.78)
    .to(heart, { scale: 1.06, duration: 0.14, ease: 'power2.out' }, 0.9);
  gsap.to(['.loader-live', '.loader-msg', '.loader-line', num], { autoAlpha: 0, duration: 0.2 });
  await gsap.timeline()
    .to(heart, { scale: 6, duration: 0.55, ease: 'expo.in', transformOrigin: '50% 58%' })
    .to(loader, { backgroundColor: '#fe86aa', duration: 0.3, ease: 'power2.in' }, 0.25);
  gsap.set(heart, { autoAlpha: 0 });
  if (skip) gsap.globalTimeline.timeScale(1);
  performance.mark('intro:hero');
  const heroAnim = heroIntro();
  await gsap.to(loader, { autoAlpha: 0, duration: 0.5, ease: 'power2.out' });
  loader.remove();
  await heroAnim;
}

/* ---------- boot ---------- */

const heroScene = {
  el: heroSec, steps: 2,
  go: (next) => heroGo(next),
  enter: (step) => {
    if (step !== heroStep) {
      heroStep = step;
      heroTl.progress(step);
      phone.classList.toggle('is-on', step === 1);
    }
  },
};
const bestScene = {
  el: best, steps: bestItems.length,
  go: (next, prev, dir) => showBest(next, prev, dir),
  enter: (step) => { if (step !== bestShown) showBest(step, bestShown, step > bestShown ? 1 : -1); },
};

async function boot() {
  performance.mark('boot:start');
  scenes?.freeze(true);
  initBest();
  initData();
  initSignature();
  initStyle();
  initLives();
  initLog();
  initHistory();
  initFitting();
  initContact();
  await document.fonts.ready;
  splitTitles();
  if (!RM) {
    decorate();
    buildPhone();
    initMarquees();
    let rz;
    addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(() => { buildPhone(); heroTl.progress(heroStep); ScrollTrigger.refresh(); }, 160);
    });
  }
  performance.mark('boot:ready');
  await intro();
  if (scenes) {
    scenes.add(heroScene);
    scenes.add(bestScene);
    window.scrollTo(0, 0);
    scenes.freeze(false);
    scenes.lock(heroScene, 0);
  }
  ScrollTrigger.refresh();
  window.__show = { scenes, heroScene, bestScene };
}

boot();
