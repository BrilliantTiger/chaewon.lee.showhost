// Two small WebGL scenes: the living studio wall behind the hero, and the
// liquid-cut gallery in BEST LIVE. Both fall back to CSS when WebGL is missing.

const VERT = `attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;

const NOISE = `
vec3 m289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 m289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 perm(vec4 x){return m289(((x*34.)+1.)*x);}
vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=m289(i);
  vec4 p=perm(perm(perm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const WALL = `precision highp float;varying vec2 vUv;
uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uHeat;uniform float uPulse;
${NOISE}
void main(){
  float ar=uRes.x/uRes.y;
  vec2 p=(vUv-.5)*vec2(ar,1.);
  float t=uTime*.07;
  float n=snoise(vec3(p*1.05,t))*.65+snoise(vec3(p*2.4+7.1,t*1.6))*.35;
  vec3 wall=vec3(.996,.525,.667);
  vec3 rose=vec3(1.,.42,.58);
  vec3 lilac=vec3(.99,.64,.82);
  vec3 col=mix(wall,rose,smoothstep(0.,.9,n)*.42);
  col=mix(col,lilac,smoothstep(.1,-.9,n)*.34);
  vec2 m=(uMouse-.5)*vec2(ar,1.);
  float spot=exp(-dot(p-m,p-m)*2.4);
  col+=vec3(.2,.15,.16)*spot*(.5+uHeat*.5);
  float band=smoothstep(.32,0.,abs(p.x*.8+p.y*.6-sin(uTime*.23)*1.3));
  col+=vec3(.07,.045,.055)*band;
  float ring=smoothstep(.06,0.,abs(length(p-m)-uPulse*1.6))*(1.-uPulse);
  col+=vec3(.25,.18,.2)*ring;
  col*=1.-.2*dot(p*.9,p*.9);
  float g=fract(sin(dot(gl_FragCoord.xy+fract(uTime)*91.7,vec2(12.9898,78.233)))*43758.5453);
  col+=(g-.5)*.034;
  gl_FragColor=vec4(col,1.);
}`;

const CUT = `precision highp float;varying vec2 vUv;
uniform sampler2D uA,uB;uniform vec2 uRes,uSa,uSb,uFa,uFb;uniform float uP,uTime,uHover;uniform vec2 uMouse;
${NOISE}
vec2 cover(vec2 uv,vec2 box,vec2 img,vec2 f){
  float rb=box.x/box.y,ri=img.x/img.y;
  vec2 s=rb>ri?vec2(1.,ri/rb):vec2(rb/ri,1.);
  return (uv-.5)*s+.5+(f-.5)*(1.-s);
}
void main(){
  vec2 uv=vUv;
  float n=snoise(vec3(uv*2.2,uTime*.12));
  float n2=snoise(vec3(uv*2.2+3.7,uTime*.12));
  float d=(1.-uv.y)*.7+uv.x*.3;
  float edge=smoothstep(uP*1.35-.18,uP*1.35,d+n*.14);
  float k=sin(uP*3.14159);
  vec2 disp=vec2(n,n2)*.07*k;
  vec2 m=uMouse;float r=distance(uv,m);
  disp+=(uv-m)/(r+1e-3)*sin(r*42.-uTime*5.)*.0045*uHover*smoothstep(.4,0.,r);
  vec2 ua=cover(uv+disp*edge,uRes,uSa,uFa);
  vec2 ub=cover(uv-disp*(1.-edge),uRes,uSb,uFb);
  float ca=.014*k+.002*uHover;
  vec3 A=vec3(texture2D(uA,ua+vec2(ca,0.)).r,texture2D(uA,ua).g,texture2D(uA,ua-vec2(ca,0.)).b);
  vec3 B=vec3(texture2D(uB,ub+vec2(ca,0.)).r,texture2D(uB,ub).g,texture2D(uB,ub-vec2(ca,0.)).b);
  vec3 col=mix(B,A,edge);
  float seam=smoothstep(0.,.5,edge)*smoothstep(1.,.5,edge);
  col+=vec3(1.,.55,.72)*seam*1.1*k;
  gl_FragColor=vec4(col,1.);
}`;

function context(canvas) {
  const opts = { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
  return canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
}

function build(gl, frag) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(prog, 0, 'p');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    u[info.name] = gl.getUniformLocation(prog, info.name);
  }
  return u;
}

function fit(canvas, gl, maxDpr, scale = 1) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr) * scale;
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  return [w, h];
}

/** Animated pink studio wall. `heat` brightens the pointer light, `pulse()` sends a ring. */
export class Wall {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = context(canvas);
    if (!this.gl) throw new Error('no webgl');
    this.u = build(this.gl, WALL);
    this.mouse = [0.62, 0.42];
    this.target = [0.62, 0.42];
    this.heat = 0;
    this.pulse = 1;
    this.visible = true;
    this.t0 = performance.now();
    this.frame = this.frame.bind(this);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; }).observe(canvas);
    requestAnimationFrame(this.frame);
  }
  point(x, y) { this.target = [x, 1 - y]; }
  ping(x, y) { this.mouse = [x, 1 - y]; this.target = [x, 1 - y]; this.pulse = 0; }
  frame(now) {
    requestAnimationFrame(this.frame);
    if (!this.visible || this.lost || document.hidden) return;
    const gl = this.gl;
    // the wall is soft light and grain: rendering it at about half resolution looks the same and costs a quarter
    const [w, h] = fit(this.canvas, gl, 1, 0.6);
    this.mouse[0] += (this.target[0] - this.mouse[0]) * 0.06;
    this.mouse[1] += (this.target[1] - this.mouse[1]) * 0.06;
    this.pulse = Math.min(1, this.pulse + 0.012);
    gl.uniform2f(this.u.uRes, w, h);
    gl.uniform1f(this.u.uTime, (now - this.t0) / 1000);
    gl.uniform2f(this.u.uMouse, this.mouse[0], this.mouse[1]);
    gl.uniform1f(this.u.uHeat, this.heat);
    gl.uniform1f(this.u.uPulse, this.pulse);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

/** Gallery that cuts between images with a noisy liquid wipe and a chromatic seam. */
export class Cut {
  constructor(canvas, sources) {
    this.canvas = canvas;
    this.gl = context(canvas);
    if (!this.gl) throw new Error('no webgl');
    this.u = build(this.gl, CUT);
    this.items = sources.map((s) => ({ ...s, tex: null, size: [1, 1], ready: false }));
    this.a = 0;
    this.b = 0;
    this.p = 0;
    this.hover = 0;
    this.hoverTarget = 0;
    this.mouse = [0.5, 0.5];
    this.visible = true;
    this.t0 = performance.now();
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(this.u.uA, 0);
    gl.uniform1i(this.u.uB, 1);
    this.loaded = Promise.all(this.items.map((it, i) => this.load(it, i)));
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
      this.hoverTarget = 1;
    });
    canvas.addEventListener('pointerleave', () => { this.hoverTarget = 0; });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; }).observe(canvas);
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }
  load(it) {
    return new Promise((res) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const gl = this.gl;
        it.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, it.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        it.size = [img.naturalWidth, img.naturalHeight];
        it.ready = true;
        res();
      };
      img.onerror = () => res();
      img.src = it.src;
    });
  }
  /** Set the cut: show `from` → `to` at progress p (0..1). */
  set(from, to, p) { this.a = from; this.b = to; this.p = p; }
  frame(now) {
    requestAnimationFrame(this.frame);
    if (!this.visible || this.lost || document.hidden) return;
    const A = this.items[this.a];
    const B = this.items[this.b];
    if (!A.ready || !B.ready) return;
    const gl = this.gl;
    const [w, h] = fit(this.canvas, gl, 2);
    this.hover += (this.hoverTarget - this.hover) * 0.08;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, B.tex);
    gl.uniform2f(this.u.uRes, w, h);
    gl.uniform2f(this.u.uSa, A.size[0], A.size[1]);
    gl.uniform2f(this.u.uSb, B.size[0], B.size[1]);
    gl.uniform2f(this.u.uFa, A.focus[0], A.focus[1]);
    gl.uniform2f(this.u.uFb, B.focus[0], B.focus[1]);
    gl.uniform1f(this.u.uP, this.p);
    gl.uniform1f(this.u.uTime, (now - this.t0) / 1000);
    gl.uniform1f(this.u.uHover, this.hover);
    gl.uniform2f(this.u.uMouse, this.mouse[0], this.mouse[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
