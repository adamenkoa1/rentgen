/* ==========================================================
   3D-ЧЕЛЮСТЬ СТОМАТОЛОГИИ (29.10.2026, владелец: «как у них, только в разы лучше — крутить, видно где пломба, где кариес,
   и для врача, и для пациента, ссылкой или PDF»).
   Один модуль на три места: карточка пациента в CRM (врач отмечает зубы прямо на модели), показ пациенту в кресле
   и страница по ссылке /smile.html (пациент смотрит дома). Данные — та же зубная формула, что на схеме (99k-dental.js):
   T = {"36":{s:'car',sf:['O','D'],n:'заметка'}, …}, состояния — DENT_ST.
   Зубы — четыре настоящие формы (резец, клык, премоляр, моляр) из Higgsfield → Meshy, упакованы scripts/dent3d-pack.mjs
   в teeth.bin/json; каждый из 32 зубов — та же форма своего размера на своём месте дуги. Дёсны и язык строятся кодом.
   Поверхности (М/Д/О/В/Л), коронки, импланты, каналы, «под удаление» рисует шейдер зуба — без текстур и лишних моделей.
   «Корни» — дёсны прозрачные: видно корни, импланты, пролеченные каналы и очаги у верхушки.
   ========================================================== */
import * as THREE from '../vendor/three-0169.min.js'

/* состояния — те же коды и цвета, что в CRM (DENT_ST) */
export const ST = {
  car: { n: 'Кариес', c: '#e5484d' }, fil: { n: 'Пломба', c: '#3b82f6' }, pul: { n: 'Пульпит', c: '#f76b15' }, per: { n: 'Периодонтит', c: '#b45309' },
  end: { n: 'Канал пролечен', c: '#8b5cf6' }, cr: { n: 'Коронка', c: '#ca8a04' }, imp: { n: 'Имплант', c: '#0d9488' }, br: { n: 'Мост', c: '#64748b' },
  ven: { n: 'Винир', c: '#db2777' }, mob: { n: 'Подвижность', c: '#a16207' }, ext: { n: 'Под удаление', c: '#e5484d' }, mis: { n: 'Отсутствует', c: '#9ca3af' }
}
/* что требует лечения — обводка цветом состояния */
export const PROB = ['car', 'pul', 'per', 'ext', 'mob']

/* размеры зубов, мм: ширина (мезио-дистально), толщина (щёчно-язычно), длина зуба; тип формы */
const UP = { 1: [8.6, 7, 23.5, 'inc'], 2: [6.6, 6.2, 22, 'inc'], 3: [7.6, 8, 24.5, 'can'], 4: [7, 9, 22, 'pre'], 5: [6.6, 9, 21.5, 'pre'], 6: [10.2, 11, 20.5, 'mol'], 7: [9.2, 11, 19.5, 'mol'], 8: [8.6, 10, 17.5, 'mol'] }
const LO = { 1: [5.2, 6, 21, 'inc'], 2: [5.8, 6.2, 23, 'inc'], 3: [7, 7.6, 23.5, 'can'], 4: [7, 7.6, 22, 'pre'], 5: [7.2, 8, 22.5, 'pre'], 6: [11, 10.4, 21, 'mol'], 7: [10.4, 10, 19.5, 'mol'], 8: [10, 9.6, 18, 'mol'] }
/* молочные: 5 зубов в четверти */
const KUP = { 1: [6.5, 5, 16, 'inc'], 2: [5.2, 4.8, 15.5, 'inc'], 3: [7, 6.8, 19, 'can'], 4: [7.2, 8.6, 14, 'mol'], 5: [8.8, 9.6, 14, 'mol'] }
const KLO = { 1: [4.2, 4, 14, 'inc'], 2: [4.6, 4.2, 15, 'inc'], 3: [5.6, 5.4, 17, 'can'], 4: [7.8, 7, 14, 'mol'], 5: [9.8, 8.8, 14, 'mol'] }

let PACK = null
async function loadPack(base) {
  if (PACK) return PACK
  const [j, b] = await Promise.all([fetch(base + 'teeth.json').then(r => r.json()), fetch(base + 'teeth.bin').then(r => r.arrayBuffer())])
  const G = {}
  for (const [k, o] of Object.entries(j.t)) {
    const p = new Int16Array(b, o.p, o.n * 3), nn = new Int8Array(b, o.nn, o.n * 3), ii = new Uint16Array(b, o.ii, o.i)
    const pos = new Float32Array(o.n * 3), nor = new Float32Array(o.n * 3)
    for (let i = 0; i < o.n * 3; i++) { pos[i] = p[i] * j.s; nor[i] = nn[i] / 127 }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(ii, 1))
    g.computeBoundingBox(); g.computeBoundingSphere()
    const bb = g.boundingBox; G[k] = { g, w: bb.max.x - bb.min.x, d: bb.max.z - bb.min.z, h: bb.max.y - bb.min.y, top: bb.max.y, bot: bb.min.y }
  }
  return PACK = G
}

/* шейдер зуба: эмаль/корень по высоте, поверхности М/Д/О/В/Л пятнами (кариес — с шумом), коронка — свой цвет и металл,
   имплант — корня нет (вместо него винт), оттенок всего зуба (под удаление), прозрачность (снимок/«нет зуба») */
const NOISE = `float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`
function toothMat(env) {
  const U = {
    uSD: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector3()) }, uSO: { value: [0, 0, 0, 0, 0] }, uSC: { value: new THREE.Color() }, uCar: { value: 0 },
    uCT: { value: new THREE.Vector4(0, 0, 0, 0) }, uCM: { value: 0 }, uCR: { value: .3 }, uTint: { value: new THREE.Vector4(0, 0, 0, 0) },
    uNoRoot: { value: 0 }, uTop: { value: 9 }, uR: { value: 4 }, uHi: { value: 0 }
  }
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .34, metalness: 0, clearcoat: .55, clearcoatRoughness: .3, sheen: .25, sheenColor: new THREE.Color('#fff6e8'), envMap: env, envMapIntensity: .9 })
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp;varying vec3 vLn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp=position;vLn=normal;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLp;varying vec3 vLn;uniform vec3 uSD[5];uniform float uSO[5];uniform vec3 uSC;uniform float uCar;uniform vec4 uCT;uniform float uCM;uniform float uCR;uniform vec4 uTint;uniform float uNoRoot;uniform float uTop;uniform float uR;uniform float uHi;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if(uNoRoot>.5&&vLp.y<-.2) discard;
float cr=smoothstep(-.7,.9,vLp.y);
vec3 enamel=mix(vec3(.93,.90,.84),vec3(.985,.975,.955),smoothstep(1.,uTop*.8,vLp.y));
vec3 root=vec3(.86,.77,.58)+(vn(vLp*.8)-.5)*.05;
vec3 col=mix(root,enamel,cr);
col*=.97+.05*vn(vLp*2.3);
vec3 nn=normalize(vLn);float sm=0.;
for(int i=0;i<5;i++){ if(uSO[i]>.5){ float d=dot(nn,uSD[i]);
  float w=(i==2)?smoothstep(.3,.7,d)*smoothstep(uTop*.5,uTop*.75,vLp.y)*(1.-smoothstep(uR*(.38+.18*(1.-uCar)),uR*(.66+.16*(1.-uCar)),length(vLp.xz))):smoothstep(.25,.7,d)*smoothstep(uTop*.18,uTop*.42,vLp.y)*(1.-smoothstep(uTop*.86,uTop*.98,vLp.y));
  sm=max(sm,w);} }
if(uCar>.5){ float k=vn(vLp*1.4)*.65+vn(vLp*3.7)*.35; float c1=sm*smoothstep(.42,.6,k+sm*.18); col=mix(col,vec3(.62,.45,.27),clamp(sm*.8,0.,.7)); col=mix(col,uSC,clamp(c1*1.2,0.,.95));}
else col=mix(col,uSC,sm*.95);
col=mix(col,uCT.rgb,uCT.a*cr);
col=mix(col,uTint.rgb,uTint.a);
col=mix(col,vec3(.18,.82,.74),uHi*.18);
diffuseColor.rgb=col;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor=mix(metalnessFactor,uCM,smoothstep(-.7,.9,vLp.y));`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
material.clearcoat*=1.-sm*uCar*.9;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,uCR,smoothstep(-.7,.9,vLp.y)*step(.001,uCT.a));
roughnessFactor=mix(roughnessFactor,.8,sm*uCar);`)
  }
  m.userData.U = U
  return m
}

/* окружение для бликов: светлая «комната» из нескольких светящихся панелей (как RoomEnvironment, без аддонов) */
function makeEnv(renderer) {
  const s = new THREE.Scene(), box = new THREE.BoxGeometry(1, 1, 1)
  const room = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x9aa3ad, side: THREE.BackSide })); room.scale.set(30, 20, 30); s.add(room)
  const L = (c, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); s.add(m) }
  L(0xffffff, 0, 9.5, 0, 14, .2, 10); L(0xfff4e6, -14.5, 3, 0, .2, 8, 12); L(0xe6f3ff, 14.5, 4, -3, .2, 6, 10); L(0xffffff, 0, 4, 14.5, 12, 6, .2)
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(s, .04).texture; pm.dispose(); return t
}

/* дуга: x = W·sin θ, z = −D·(1−cos θ); точки по длине дуги — чтобы ставить зубы вплотную */
function arch(W, D) {
  const P = [], S = [0]; const N = 400
  for (let i = 0; i <= N; i++) { const t = i / N * 1.95; P.push(new THREE.Vector2(W * Math.sin(t), -D * (1 - Math.cos(t)) * (1 + .12 * t))) }
  for (let i = 1; i <= N; i++) S.push(S[i - 1] + P[i].distanceTo(P[i - 1]))
  const at = s => { s = Math.max(0, Math.min(S[N], s)); let i = 1; while (i < N && S[i] < s) i++; const f = (s - S[i - 1]) / (S[i] - S[i - 1] || 1)
    const p = P[i - 1].clone().lerp(P[i], f), tg = P[i].clone().sub(P[i - 1]).normalize(); return { p, tg } }
  return { at, len: S[N] }
}

/* винт импланта: резьба профилем (Lathe) + абатмент */
function implantGeo(len) {
  const pts = [new THREE.Vector2(0, -len), new THREE.Vector2(1.1, -len + .3)]
  const n = Math.floor((len - 2) / .9)
  for (let i = 0; i < n; i++) { const y = -len + 1 + i * .9, r = 1.55 + .45 * Math.min(1, i / 3); pts.push(new THREE.Vector2(r + .5, y + .2), new THREE.Vector2(r, y + .65)) }
  pts.push(new THREE.Vector2(2.05, -.6), new THREE.Vector2(1.45, -.2), new THREE.Vector2(1.45, 1.6), new THREE.Vector2(0, 1.9))
  return new THREE.LatheGeometry(pts, 32)
}

/* дёсны: сечение вдоль дуги; край десны с сосочками между зубами (выше в промежутках), снизу/сверху — альвеолярный отросток */
function gumGeo(A, ends, wd, sgn, papilla, deep) {
  const prof = (w, mg) => { /* w — полутолщина у шейки, mg — высота края десны; точки (r наружу, y вглубь кости — со знаком) */
    const b = w + 1.3; mg -= 1.6
    return [[b - 2.2, -deep], [b + .3, -deep * .9], [b + 1.3, -deep * .66], [b + 1.4, -deep * .38], [b + .7, mg - 3], [w + .45, mg - .9], [w - .3, mg + .05], [w * .5, mg - .2], [0, mg - .35],
      [-w * .5, mg - .2], [-w + .3, mg + .05], [-w - .45, mg - .9], [-b - .4, mg - 3.2], [-b - 1.1, -deep * .4], [-b - .9, -deep * .7], [-b + .4, -deep * .92], [-b + 2.4, -deep]]
  }
  const segs = 260, ring = 17, pos = [], idx = [], [s0, s1] = ends
  for (let i = 0; i <= segs; i++) {
    const s = s0 + (s1 - s0) * i / segs, { p, tg } = A.at(Math.abs(s)), side = s < 0 ? -1 : 1
    const nrm = new THREE.Vector2(-tg.y, tg.x)   /* наружу (к губам и щекам) */
    const { w, pap } = wd(Math.abs(s)), cap = Math.min(1, (s - s0) / 4, (s1 - s) / 4)
    const pr = prof(w * (.55 + .45 * Math.sqrt(Math.max(0, cap))), papilla * pap * Math.max(0, cap))
    for (const [r, y] of pr) pos.push((p.x + nrm.x * r) * side, y * sgn, p.y + nrm.y * r)
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < ring - 1; k++) { const a = i * ring + k, b = a + ring
    if (sgn > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1) }
  /* торцы */
  const cap = (i0, rev) => { const c = pos.length / 3; let cx = 0, cy = 0, cz = 0
    for (let k = 0; k < ring; k++) { cx += pos[(i0 + k) * 3]; cy += pos[(i0 + k) * 3 + 1]; cz += pos[(i0 + k) * 3 + 2] }
    pos.push(cx / ring, cy / ring, cz / ring)
    for (let k = 0; k < ring - 1; k++) (rev ^ (sgn < 0)) ? idx.push(c, i0 + k + 1, i0 + k) : idx.push(c, i0 + k, i0 + k + 1) }
  cap(0, 0); cap(segs * ring, 1)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g
}

export async function mountJaw(el, o) {
  o = Object.assign({ base: new URL('./', import.meta.url).href, T: {}, kid: false, plan: new Set(), sel: new Set(), labels: true, view: 'all', roots: false, sway: false, onPick: null, onHover: null }, Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined)))
  const G = await loadPack(o.base)
  const W0 = el.clientWidth || 600, H0 = el.clientHeight || 420
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!o.snapshots })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace
  el.style.position = el.style.position || 'relative'
  const cv = renderer.domElement; cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none'; el.appendChild(cv)
  const lab = document.createElement('div'); lab.className = 'j3-labs'; el.appendChild(lab)
  const env = makeEnv(renderer)
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W0 / H0, 1, 1000)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c7c0, .9))
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(30, 60, 80); scene.add(key)
  const rim = new THREE.DirectionalLight(0xdbeafe, .7); rim.position.set(-60, 20, -40); scene.add(rim)
  const fill = new THREE.DirectionalLight(0xfff1e6, .5); fill.position.set(0, -60, 60); scene.add(fill)

  const root = new THREE.Group(); scene.add(root)
  const upG = new THREE.Group(), loG = new THREE.Group(); root.add(upG, loG)
  const gumMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#d98a8f'), roughness: .5, clearcoat: .35, clearcoatRoughness: .45, sheen: 1, sheenColor: new THREE.Color('#ffb3bd'), sheenRoughness: .5, envMap: env, envMapIntensity: .6, transparent: true, opacity: 1 })
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: .16, depthWrite: false })
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xaab3bd, metalness: 1, roughness: .28, envMap: env, envMapIntensity: 1.3 })
  const red = new THREE.MeshBasicMaterial({ color: 0xe5484d, transparent: true, opacity: .85, depthTest: false })
  const canalMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, depthTest: false, transparent: true, opacity: .95 })
  const T = {}   /* номер → {m, out, ghost, imp, xr:[], kind, quad, pos, nrm} */
  let built = null

  function build(kid) {
    for (const g of [upG, loG]) while (g.children.length) g.remove(g.children[0])
    for (const k of Object.keys(T)) delete T[k]
    const Q = kid ? [[5, KUP, 1], [6, KUP, -1], [8, KLO, 1], [7, KLO, -1]] : [[1, UP, 1], [2, UP, -1], [4, LO, 1], [3, LO, -1]]
    /* правая сторона пациента (1-я и 4-я четверти) — слева на экране, как врач смотрит на пациента: x < 0 */
    const AU = kid ? arch(21, 26) : arch(26.5, 34), AL = kid ? arch(19, 24) : arch(24, 32)
    const total = (D) => Object.values(D).reduce((s, x) => s + x[0], 0) * .965
    for (const [q, D, side] of Q) {
      const up = q === 1 || q === 2 || q === 5 || q === 6, A = up ? AU : AL, grp = up ? upG : loG, nT = kid ? 5 : 8
      let s = 0
      for (let i = 1; i <= nT; i++) {
        const [w, d, len, kind] = D[i], sc = s + w * .965 / 2; s += w * .965
        const { p, tg } = A.at(sc), num = q * 10 + i, base = G[kind]
        const sx = -side   /* правая сторона пациента → экранная слева */
        const pos = new THREE.Vector3(p.x * sx, 0, p.y)
        const along = new THREE.Vector3(tg.x * sx, 0, tg.y).normalize()      /* от середины назад */
        const out = new THREE.Vector3(along.z, 0, -along.x); if (out.dot(new THREE.Vector3(pos.x, 0, pos.z + 22)) < 0) out.negate()
        const m = new THREE.Mesh(base.g, toothMat(env))
        /* локально: x — вдоль дуги, y — к коронке, z — наружу (губы/щёки) */
        const ax = new THREE.Vector3(0, 1, 0).cross(out)   /* x × y = z: базис без зеркала, иначе поворот ломается */
        const basis = new THREE.Matrix4().makeBasis(ax, new THREE.Vector3(0, 1, 0), out)
        const tilt = new THREE.Matrix4().makeRotationX((kind === 'inc' ? (up ? .3 : .2) : kind === 'can' ? .14 : up ? .06 : -.05) * 1)
        const g0 = new THREE.Group(); g0.position.copy(pos)
        const g = new THREE.Group(); g0.add(g)   /* g — зуб в своих осях; качается (подвижность) внутри g0 */
        const rot = new THREE.Matrix4().multiplyMatrices(basis, tilt)
        if (up) rot.multiply(new THREE.Matrix4().makeRotationZ(Math.PI))
        g0.quaternion.setFromRotationMatrix(rot)
        g0.position.y = up ? 10.5 : -10.5
        m.scale.set(w / base.w, len / base.h, d / base.d)
        m.userData.num = num; g.add(m)
        const outl = new THREE.Mesh(base.g, new THREE.MeshBasicMaterial({ color: 0x14b8a6, side: THREE.BackSide, transparent: true, opacity: .95 }))
        outl.scale.copy(m.scale).multiply(new THREE.Vector3(1.09, 1.03, 1.09)); outl.position.y = -.15; outl.visible = false; g.add(outl)
        const ghost = new THREE.Mesh(base.g, ghostMat); ghost.scale.copy(m.scale); ghost.visible = false; ghost.userData.num = num; g.add(ghost)
        grp.add(g0)
        const top = base.top * m.scale.y
        m.material.userData.U.uTop.value = base.top; m.material.userData.U.uR.value = Math.min(base.w, base.d) / 2
        /* направления поверхностей в осях зуба (до масштаба): M — к середине дуги, D — назад, O — к коронке, V — наружу, L — внутрь */
        const inv = g0.quaternion.clone().invert(), toL = v => v.clone().applyQuaternion(inv).normalize()
        const midDir = along.clone().negate()
        const sd = { M: toL(midDir), D: toL(along), V: toL(out), L: toL(out.clone().negate()) }
        T[num] = { m, outl, ghost, g, kind, up, top, len, w, d, sd, pos: g0.position.clone(), out, xr: [], imp: null, phase: Math.random() * 6 }
      }
    }
    /* дёсны: та же дуга; толщина — по зубу на этом месте */
    const mkGum = (A, D, nT, sgn, grp) => {
      const cum = []; let s = 0; for (let i = 1; i <= nT; i++) { cum.push([s, s + D[i][0] * .965, D[i]]); s += D[i][0] * .965 }
      const wd = x => { const c = cum.find(c => x <= c[1]) || cum[cum.length - 1], f = Math.min(1, Math.max(0, (x - c[0]) / (c[1] - c[0])))
        return { w: c[2][1] / 2, pap: x > s ? 0 : Math.pow(Math.cos(f * Math.PI), 2) } }
      const g = new THREE.Mesh(gumGeo(A, [-s - 3, s + 3], wd, sgn, 4.2, kid ? 11 : 15), gumMat); g.position.y = sgn < 0 ? 10.5 : -10.5; g.renderOrder = 2; grp.add(g); return g
    }
    const gu = mkGum(AU, kid ? KUP : UP, kid ? 5 : 8, -1, upG), gl = mkGum(AL, kid ? KLO : LO, kid ? 5 : 8, 1, loG)
    /* язык */
    const tg = new THREE.SphereGeometry(1, 48, 32), tp = tg.attributes.position
    for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i); tp.setY(i, y * (y > 0 ? 1 - .55 * Math.exp(-x * x * 40) * .35 : 1)); tp.setZ(i, z * (1 + .15 * (z < 0 ? 1 : 0))) }
    tg.computeVertexNormals()
    const tongue = new THREE.Mesh(tg, new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#d9666e'), roughness: .62, sheen: 1, sheenColor: new THREE.Color('#ff9aa5'), clearcoat: .25, envMap: env, envMapIntensity: .4 }))
    tongue.scale.set(kid ? 15 : 19, kid ? 6 : 7.5, kid ? 18 : 24); tongue.position.set(0, -14, kid ? -14 : -19); loG.add(tongue)
    built = { kid, gu, gl, tongue }
  }

  /* ---------- состояния на модели ---------- */
  let data = { T: o.T, plan: o.plan, sel: o.sel }
  function paint() {
    const R = data.T || {}, xray = !!o.roots
    gumMat.opacity = xray ? .22 : 1; gumMat.depthWrite = !xray; if (built) built.tongue.visible = !xray && o.view !== 'up'
    for (const [num, t] of Object.entries(T)) {
      const x = R[num] || {}, s = x.s || '', sf = (x.sf && x.sf.length ? x.sf : (s === 'car' || s === 'fil' ? ['O'] : [])), U = t.m.material.userData.U
      t.m.visible = s !== 'mis'; t.ghost.visible = s === 'mis'
      U.uSO.value = [0, 0, 0, 0, 0]
      const order = ['M', 'D', 'O', 'V', 'L']
      order.forEach((k, i) => { U.uSD.value[i].copy(k === 'O' ? new THREE.Vector3(0, 1, 0) : t.sd[k]); U.uSO.value[i] = (s === 'car' || s === 'fil') && sf.includes(k) ? 1 : 0 })
      U.uSC.value.set(s === 'car' ? '#2b170b' : '#6b98f2'); U.uCar.value = s === 'car' ? 1 : 0
      const ct = { cr: ['#e2bf63', .92], br: ['#c3cad3', .9], ven: ['#ffffff', .5], imp: ['#f3f5f7', .55], end: ['#a78bfa', .12], pul: ['#f97316', .14] }[s]
      U.uCT.value.set(...(ct ? new THREE.Color(ct[0]).toArray() : [0, 0, 0]), ct ? ct[1] : 0)
      U.uCM.value = s === 'cr' ? .65 : s === 'br' ? .8 : 0; U.uCR.value = s === 'cr' ? .22 : s === 'br' ? .25 : s === 'ven' ? .12 : .3
      U.uTint.value.set(...(s === 'ext' ? [.9, .25, .27, .3] : [0, 0, 0, 0]))
      U.uNoRoot.value = s === 'imp' ? 1 : 0
      const sel = data.sel && data.sel.has(String(num)), prob = PROB.includes(s)
      t.outl.visible = sel || prob
      t.outl.material.color.set(sel ? '#14b8a6' : ST[s] ? ST[s].c : '#14b8a6'); t.outl.material.opacity = sel ? 1 : .8
      U.uHi.value = sel ? 1 : 0
      /* имплант, каналы, очаги у верхушки — внутри десны, видны в режиме «Корни» (каналы и очаг — поверх всего) */
      if (t.imp) { t.g.remove(t.imp); t.imp = null }
      t.xr.forEach(m => t.g.remove(m)); t.xr = []
      const rl = t.len - t.top   /* длина корня, мм */
      if (s === 'imp') { const im = new THREE.Mesh(implantGeo(Math.min(13, rl * .85)), metal); t.g.add(im); t.imp = im }
      if (s === 'end' || s === 'per' || s === 'pul') {
        const n = t.kind === 'mol' ? (t.up ? 3 : 2) : t.kind === 'pre' && t.up ? 2 : 1
        for (let k = 0; k < n; k++) {
          const off = n === 1 ? 0 : (k - (n - 1) / 2) * t.w * .32
          const c = new THREE.Mesh(new THREE.CylinderGeometry(.32, .14, rl * .9, 8), s === 'end' ? canalMat : new THREE.MeshBasicMaterial({ color: 0xfb923c, depthTest: false, transparent: true, opacity: .8 }))
          c.position.set(off, -rl * .45 + .5, 0); c.renderOrder = 5; c.visible = xray; t.g.add(c); t.xr.push(c)
        }
        if (s === 'pul') { const p = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: .55, depthTest: false })); p.position.y = t.top * .3; p.scale.set(t.w / 7, 1, t.d / 8); p.renderOrder = 6; p.visible = xray; t.g.add(p); t.xr.push(p) }
      }
      if (s === 'per') { const a = new THREE.Mesh(new THREE.SphereGeometry(2.3, 20, 14), red); a.position.y = -rl + .8; a.renderOrder = 6; a.visible = xray; t.g.add(a); t.xr.push(a) }
    }
    labels()
  }

  /* ---------- подписи над зубами: номер и цвет состояния (выбранные, проблемные, в плане) ---------- */
  function labels() {
    if (!o.labels) { lab.innerHTML = ''; return }
    const R = data.T || {}
    lab.innerHTML = Object.keys(T).map(n => { const x = R[n] || {}, s = x.s, sel = data.sel && data.sel.has(String(n)), pl = data.plan && data.plan.has(String(n))
      if (!s && !sel && !pl && o.labels !== 'all') return ''
      const c = sel ? '#0d9488' : ST[s] ? ST[s].c : '#0d9488'
      return `<span class="j3-l${sel ? ' on' : ''}" data-n="${n}" style="--c:${c}"><b>${n}</b>${s ? `<i>${ST[s] ? ST[s].n : ''}</i>` : ''}${pl ? '<em></em>' : ''}</span>` }).join('')
    place()
  }
  const v3 = new THREE.Vector3()
  function place() {
    const W = el.clientWidth, H = el.clientHeight
    lab.querySelectorAll('.j3-l').forEach(e => { const t = T[e.dataset.n]; if (!t) return
      const grp = t.up ? upG : loG; if (!grp.visible) { e.style.display = 'none'; return }
      v3.set(0, t.top + 2.5, 0); t.g.localToWorld(v3)
      const toCam = cam.position.clone().sub(v3).normalize(), facing = t.out.clone().applyQuaternion(root.quaternion).dot(toCam)
      const yFace = (t.up ? -1 : 1) * toCam.y
      v3.project(cam)
      const vis = v3.z < 1 && (facing > -.25 || yFace > .5)
      e.style.display = vis ? '' : 'none'; e.style.transform = `translate(${(v3.x * .5 + .5) * W}px,${(-v3.y * .5 + .5) * H}px) translate(-50%,-100%)` })
  }

  /* ---------- камера: вращение пальцем/мышью, колесо и щипок — масштаб ---------- */
  const VIEWS = { all: [0, .1, 150], up: [0, -1.1, 140], low: [0, 1.1, 140], left: [-.95, .12, 150], right: [.95, .12, 150] }
  let yaw = 0, pitch = .1, dist = 150, tYaw = 0, tPitch = .1, tDist = 150, idle = 0, open = 1, tOpen = 1
  const target = new THREE.Vector3(0, 0, -22)
  function setView(v) { o.view = v; const [a, b, c] = VIEWS[v] || VIEWS.all; tYaw = a; tPitch = b; tDist = c
    tOpen = v === 'all' || v === 'left' || v === 'right' ? 1 : 1.6
    upG.visible = v !== 'low'; loG.visible = v !== 'up'; if (built) built.tongue.visible = !o.roots && v !== 'up' }
  function applyCam() {
    yaw += (tYaw - yaw) * .14; pitch += (tPitch - pitch) * .14; dist += (tDist - dist) * .14; open += (tOpen - open) * .1
    const sw = o.sway && idle > 120 ? Math.sin(performance.now() / 2600) * .35 : 0
    const y = yaw + sw
    cam.position.set(target.x + dist * Math.sin(y) * Math.cos(pitch), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(y) * Math.cos(pitch))
    cam.lookAt(target)
    /* «рот открыт»: верх выше, низ откинут на шарнире у моляров */
    upG.position.y = 3.5 * open; loG.position.y = -2.5 * open
    loG.rotation.x = .1 * open; upG.rotation.x = -.06 * open
  }
  const ptr = new Map(); let drag = null, moved = 0, pinch0 = 0
  cv.addEventListener('pointerdown', e => { ptr.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId); idle = 0; moved = 0
    if (ptr.size === 1) drag = [e.clientX, e.clientY, tYaw, tPitch]; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]) / tDist; drag = null }
    cv.style.cursor = 'grabbing' })
  cv.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) { hover(e); return }
    ptr.set(e.pointerId, [e.clientX, e.clientY]); idle = 0
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; tDist = Math.max(70, Math.min(320, Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0)); moved = 99; return }
    if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy))
    tYaw = drag[2] - dx * .008; tPitch = Math.max(-1.45, Math.min(1.45, drag[3] + dy * .008)) })
  const up_ = e => { const wasDrag = moved > 6; ptr.delete(e.pointerId); if (!ptr.size) { drag = null; cv.style.cursor = 'grab' } if (!wasDrag && e.type === 'pointerup') pick(e) }
  cv.addEventListener('pointerup', up_); cv.addEventListener('pointercancel', up_)
  cv.addEventListener('wheel', e => { e.preventDefault(); idle = 0; tDist = Math.max(70, Math.min(320, tDist * (e.deltaY > 0 ? 1.1 : 1 / 1.1))) }, { passive: false })
  const rc = new THREE.Raycaster(), mv = new THREE.Vector2()
  function hit(e) { const r = cv.getBoundingClientRect(); mv.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); rc.setFromCamera(mv, cam)
    const L = Object.values(T).filter(t => (t.up ? upG : loG).visible).map(t => t.m.visible ? t.m : t.ghost)
    const h = rc.intersectObjects(L, false)[0]; return h ? h.object.userData.num : null }
  let hov = null
  function hover(e) { if (!o.onPick) return; const n = hit(e); if (n === hov) return; hov = n; cv.style.cursor = n ? 'pointer' : 'grab'
    Object.entries(T).forEach(([k, t]) => { if (!(data.sel && data.sel.has(k))) t.m.material.userData.U.uHi.value = +k === n ? .6 : 0 }); if (o.onHover) o.onHover(n) }
  function pick(e) { const n = hit(e); if (n && o.onPick) o.onPick(n) }

  /* ---------- цикл: рисуем, пока окно видно ---------- */
  let raf = 0, alive = true, vis = true
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && !raf) loop() }) : null; if (io) io.observe(el)
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => resize()) : null; if (ro) ro.observe(el)
  function resize() { const W = el.clientWidth, H = el.clientHeight; if (!W || !H) return; renderer.setSize(W, H); cam.aspect = W / H
    cam.fov = W / H < .9 ? 42 : 30; cam.updateProjectionMatrix() }
  function loop() { raf = 0; if (!alive || !vis || document.hidden) return; idle++
    const now = performance.now()
    for (const [k, t] of Object.entries(T)) { const s = (data.T[k] || {}).s
      t.g.rotation.z = s === 'mob' ? Math.sin(now / 160 + t.phase) * .04 : 0
      if (PROB.includes(s) && !(data.sel && data.sel.has(k))) t.outl.material.opacity = .55 + .4 * Math.sin(now / 420 + t.phase) }
    applyCam(); renderer.render(scene, cam); place(); raf = requestAnimationFrame(loop) }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !raf) loop() })

  build(!!o.kid); setView(o.view); resize(); paint(); yaw = tYaw; pitch = tPitch; dist = tDist; loop()

  return {
    set(nd) { if (nd.kid != null && !!nd.kid !== built.kid) { build(!!nd.kid) } Object.assign(data, nd); paint() },
    view: setView,
    roots(v) { o.roots = v == null ? !o.roots : !!v; paint(); return o.roots },
    zoom(k) { idle = 0; tDist = Math.max(70, Math.min(320, tDist * k)) },
    reset() { setView(o.view || 'all') },
    get state() { return { view: o.view, roots: !!o.roots } },
    /* снимок для PDF: вид, размер; рендер вне цикла */
    snap(v, w, h) { const pv = o.view, sz = [el.clientWidth, el.clientHeight], lb = o.labels
      setView(v); yaw = tYaw; pitch = tPitch; dist = tDist; open = tOpen; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = 30; cam.updateProjectionMatrix()
      applyCam(); for (const t of Object.values(T)) t.g.rotation.z = 0
      renderer.render(scene, cam); const url = renderer.domElement.toDataURL('image/png')
      o.labels = lb; setView(pv); renderer.setSize(sz[0], sz[1], false); resize(); cv.style.width = '100%'; cv.style.height = '100%'; return url },
    dispose() { alive = false; cancelAnimationFrame(raf); if (io) io.disconnect(); if (ro) ro.disconnect(); renderer.dispose(); env.dispose(); el.innerHTML = '' }
  }
}

/* подписи и кнопки поверх 3D — общий стиль для CRM и страницы пациента */
export const CSS = `.j3{position:relative;overflow:hidden;border-radius:18px;background:radial-gradient(120% 80% at 50% 35%,#ffffff 0%,#eef3f5 60%,#e3eaee 100%);user-select:none;-webkit-user-select:none}
.j3-labs{position:absolute;inset:0;pointer-events:none}
.j3-l{position:absolute;left:0;top:0;display:flex;align-items:center;gap:4px;padding:2px 7px 2px 3px;border-radius:99px;background:rgba(255,255,255,.92);box-shadow:0 2px 8px rgba(15,23,42,.14);font:600 11px/16px system-ui,-apple-system,sans-serif;color:#0f172a;white-space:nowrap;border:1.5px solid var(--c)}
.j3-l b{min-width:20px;height:16px;border-radius:99px;background:var(--c);color:#fff;display:grid;place-items:center;font-size:10px;padding:0 4px}
.j3-l i{font-style:normal;font-weight:600;color:#334155}.j3-l em{width:6px;height:6px;border-radius:50%;background:#0d9488;box-shadow:0 0 0 2px rgba(13,148,136,.25)}
.j3-l.on{box-shadow:0 0 0 3px rgba(20,184,166,.25),0 2px 8px rgba(15,23,42,.14)}
.j3-tb{position:absolute;left:10px;top:10px;display:flex;gap:4px;padding:3px;border-radius:12px;background:rgba(255,255,255,.85);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 1px 6px rgba(15,23,42,.08)}
.j3-tb button,.j3-zm button{border:0;background:none;font:600 12px system-ui,-apple-system,sans-serif;color:#475569;padding:6px 10px;border-radius:9px;cursor:pointer}
.j3-tb button[aria-pressed=true]{background:#0d9488;color:#fff}
.j3-zm{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:4px}
.j3-zm button{width:34px;height:34px;padding:0;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 1px 6px rgba(15,23,42,.1);font-size:16px;color:#0f172a}
.j3-zm button[aria-pressed=true]{background:#0d9488;color:#fff}
.j3-hint{position:absolute;left:12px;bottom:9px;font:500 11px system-ui,-apple-system,sans-serif;color:#64748b;pointer-events:none}
.j3-load{position:absolute;inset:0;display:grid;place-items:center;font:500 13px system-ui,sans-serif;color:#64748b}
@media(max-width:600px){.j3-tb button{padding:6px 8px}.j3-l i{display:none}}`

/* панель вида (Все / Верх / Низ / Корни) и масштаб — одна разметка для CRM и страницы пациента */
export function chrome(el, api, opt) {
  opt = opt || {}
  const tb = document.createElement('div'); tb.className = 'j3-tb'
  const V = [['all', 'Все'], ['up', 'Верх'], ['low', 'Низ']]
  tb.innerHTML = V.map(([k, l]) => `<button data-v="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('')
  tb.onclick = e => { const b = e.target.closest('button'); if (!b) return; api.view(b.dataset.v); tb.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))) }
  const zm = document.createElement('div'); zm.className = 'j3-zm'
  zm.innerHTML = `<button data-z="in" title="Ближе">+</button><button data-z="out" title="Дальше">−</button><button data-z="reset" title="Сначала">↺</button><button data-z="roots" title="Корни: прозрачные дёсны" aria-pressed="false">R</button>`
  zm.onclick = e => { const b = e.target.closest('button'); if (!b) return; const z = b.dataset.z
    if (z === 'in') api.zoom(1 / 1.2); if (z === 'out') api.zoom(1.2); if (z === 'reset') api.reset(); if (z === 'roots') b.setAttribute('aria-pressed', String(api.roots())) }
  const h = document.createElement('div'); h.className = 'j3-hint'; h.textContent = opt.hint || 'Крутите пальцем · нажмите на зуб'
  el.append(tb, zm, h)
}
