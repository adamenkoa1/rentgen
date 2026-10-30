/* ==========================================================
   СТРАНИЦА ПАЦИЕНТА «Ваши зубы» (29.10.2026): 3D-челюсть + что нужно лечить, что уже сделано, план и стоимость, кнопка записи.
   Одна и та же страница — в кресле (CRM открывает её поверх карточки: «Показать пациенту») и дома по ссылке /smile.html#…
   Данные ссылки — в части после # (на сервер не уходят): сжатый JSON без фамилии, телефона и даты рождения пациента.
   Формат: {v:1, c:клиника, ph:телефон клиники, a:адрес, n:имя, d:дата, doc:врач, k:молочные, t:{зуб:[сост, поверхности, заметка]},
   pl:[зубы в плане], p:{n, tot, st:[[этап, сумма, [[зубы, услуга, сделано]]]]}, cur:'₴'}
   ========================================================== */
import { mountJaw, chrome, CSS, ST, PROB } from './jaw.js'
export { mountJaw, chrome, CSS, ST }

const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)) }
async function pipe(u8, T) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(T)).arrayBuffer()) }
export async function encode(d) {
  const raw = new TextEncoder().encode(JSON.stringify(d))
  if (typeof CompressionStream === 'function') try { return '1.' + b64u(await pipe(raw, new CompressionStream('deflate-raw'))) } catch (_) {}
  return '0.' + b64u(raw)
}
export async function decode(h) {
  const [v, s] = String(h || '').replace(/^#/, '').split('.')
  if (!s) return null
  const u8 = unb64u(s), raw = v === '1' ? await pipe(u8, new DecompressionStream('deflate-raw')) : u8
  return JSON.parse(new TextDecoder().decode(raw))
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const SF = { M: 'боковая к центру', D: 'боковая дальняя', O: 'жевательная', V: 'передняя', L: 'внутренняя' }
/* человеческим языком: что это значит для пациента */
const SAY = {
  car: 'Кариес — разрушение эмали. Пока маленький, лечится одной пломбой за визит.', pul: 'Воспаление нерва — зуб может болеть ночью. Нужно лечение каналов.',
  per: 'Воспаление у верхушки корня. Без лечения — риск потерять зуб.', ext: 'Зуб не сохранить — врач рекомендует удалить.', mob: 'Зуб шатается — нужно укрепить дёсны и кость.',
  fil: 'Стоит пломба', end: 'Каналы пролечены', cr: 'Стоит коронка', imp: 'Стоит имплант', br: 'Часть моста', ven: 'Стоит винир', mis: 'Зуба нет'
}
const money = (x, cur) => (Math.round(+x || 0)).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ' + (cur || '₴')
const dmy = s => s ? String(s).slice(0, 10).split('-').reverse().join('.') : ''

export async function renderPatient(el, d, opt) {
  opt = opt || {}
  if (!document.getElementById('j3css')) { const st = document.createElement('style'); st.id = 'j3css'; st.textContent = CSS + PCSS; document.head.appendChild(st) }
  const T = {}; Object.entries(d.t || {}).forEach(([n, x]) => { T[n] = { s: x[0] || '', sf: (x[1] || '').split('').filter(Boolean), n: x[2] || '' } })
  const nums = Object.keys(T).sort((a, b) => a - b), bad = nums.filter(n => PROB.includes(T[n].s)), done = nums.filter(n => ['fil', 'end', 'cr', 'imp', 'br', 'ven'].includes(T[n].s)), miss = nums.filter(n => T[n].s === 'mis')
  const plan = new Set((d.pl || []).map(String)), p = d.p
  const row = n => { const x = T[n], s = ST[x.s] || {}
    return `<button class="pv-t" data-n="${n}" style="--c:${s.c || '#0d9488'}"><b>${n}</b><span><strong>${esc(s.n || '')}</strong>${x.sf.length && (x.s === 'car' || x.s === 'fil') ? ` · ${x.sf.map(k => SF[k]).join(', ')}` : ''}<i>${esc(x.n || SAY[x.s] || '')}</i></span>${plan.has(n) ? '<em>в плане</em>' : ''}</button>` }
  el.innerHTML = `<div class="pv">
    <header class="pv-h"><div class="pv-hc">${esc(d.c || 'Стоматология')}</div><h1>${d.n ? esc(d.n) + ', ваши зубы' : 'Ваши зубы'}</h1><p>Карта осмотра${d.d ? ' от ' + dmy(d.d) : ''}${d.doc ? ' · врач ' + esc(d.doc) : ''}</p></header>
    <div class="pv-kpi"><div class="${bad.length ? 'neg' : 'pos'}"><b>${bad.length}</b><span>${bad.length ? 'требуют лечения' : 'проблем не найдено'}</span></div><div><b>${done.length}</b><span>уже пролечено</span></div><div><b>${(d.k ? 20 : 32) - miss.length}</b><span>зубов на месте</span></div></div>
    <div class="pv-3d j3" id="pv3d"><div class="j3-load">Загружаем 3D-модель…</div></div>
    <div class="pv-leg">${Object.entries(ST).filter(([k]) => nums.some(n => T[n].s === k)).map(([k, s]) => `<span><i style="background:${s.c}"></i>${s.n}</span>`).join('')}${plan.size ? '<span><i class="pl"></i>в плане лечения</span>' : ''}</div>
    ${bad.length ? `<section><h2>Что нужно лечить</h2>${bad.map(row).join('')}</section>` : ''}
    ${p && p.st && p.st.length ? `<section class="pv-p"><h2>${esc(p.n || 'План лечения')}</h2>${p.st.map((g, i) => `<div class="pv-s"><div class="pv-sh"><span>${i + 1}</span><b>${esc(g[0])}</b><em>${money(g[1], d.cur)}</em></div>${(g[2] || []).map(it => `<div class="pv-i${it[2] ? ' ok' : ''}"><b>${esc(it[0] || '')}</b><span>${esc(it[1])}</span>${it[2] ? '<i>сделано</i>' : ''}</div>`).join('')}</div>`).join('')}
      <div class="pv-tot"><span>Итого по плану</span><b>${money(p.tot, d.cur)}</b></div>${p.st.length > 1 ? '<div class="pv-note">Можно лечиться и оплачивать по этапам.</div>' : ''}</section>` : ''}
    ${done.length ? `<section><h2>Что уже сделано</h2>${done.map(row).join('')}</section>` : ''}
    ${!opt.inCrm && d.ph ? `<a class="pv-cta" href="tel:${esc(String(d.ph).replace(/[^0-9+]/g, ''))}">Записаться на лечение · ${esc(d.ph)}</a>` : ''}
    <footer class="pv-f">${d.a ? esc(d.a) + '<br>' : ''}Карта составлена врачом по осмотру и снимкам. Точный план и стоимость врач уточнит на приёме.</footer>
  </div>`
  const box = el.querySelector('#pv3d'), sel = new Set()
  const api = await mountJaw(box, { T, kid: !!d.k, plan, sel, sway: true, base: opt.base, onPick: n => { pickRow(String(n)) } })
  box.querySelector('.j3-load')?.remove(); chrome(box, api, { hint: 'Крутите пальцем · нажмите на зуб' })
  function pickRow(n) { sel.clear(); sel.add(n); api.set({ sel })
    el.querySelectorAll('.pv-t').forEach(b => b.classList.toggle('on', b.dataset.n === n))
    const b = el.querySelector(`.pv-t[data-n="${n}"]`); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }
  el.querySelectorAll('.pv-t').forEach(b => b.onclick = () => { pickRow(b.dataset.n); const t = T[b.dataset.n]; const up = +b.dataset.n < 30 || (+b.dataset.n > 50 && +b.dataset.n < 70)
    api.view(t && ['car', 'fil'].includes(t.s) && t.sf.includes('O') ? (up ? 'up' : 'low') : 'all'); box.scrollIntoView({ behavior: 'smooth', block: 'center' }) })
  return api
}

const PCSS = `.pv{max-width:760px;margin:0 auto;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;padding:0 0 28px}
.pv-h{background:linear-gradient(135deg,#0f766e,#115e59 55%,#134e4a);color:#fff;border-radius:0 0 28px 28px;padding:22px 20px 26px;position:relative;overflow:hidden}
.pv-h::after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;border:1px solid rgba(255,255,255,.14)}
.pv-hc{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.8}.pv-h h1{font-size:28px;line-height:1.15;margin:8px 0 4px;letter-spacing:-.01em}.pv-h p{margin:0;opacity:.85;font-size:14px}
.pv-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:-16px 14px 12px;position:relative}
.pv-kpi div{background:#fff;border-radius:16px;padding:10px 12px;box-shadow:0 6px 20px rgba(15,23,42,.08);display:flex;flex-direction:column}
.pv-kpi b{font-size:24px;line-height:1.1}.pv-kpi span{font-size:12px;color:#64748b}.pv-kpi .neg b{color:#e5484d}.pv-kpi .pos b{color:#0f766e}
.pv-3d{height:min(62vh,460px);margin:0 14px}
.pv-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:#475569;margin:10px 18px 4px}.pv-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}.pv-leg i.pl{border-radius:50%;background:#0d9488}
.pv section{margin:18px 14px 0}.pv h2{font-size:15px;margin:0 0 8px;color:#0f766e;text-transform:uppercase;letter-spacing:.04em}
.pv-t{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;border:1.5px solid #e2e8f0;background:#fff;border-radius:16px;padding:10px 12px;margin:0 0 8px;font:inherit;color:inherit;cursor:pointer}
.pv-t.on{border-color:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 18%,transparent)}
.pv-t>b{flex:none;min-width:34px;height:34px;border-radius:11px;background:var(--c);color:#fff;display:grid;place-items:center;font-size:14px}
.pv-t span{display:flex;flex-direction:column;font-size:13px;gap:1px;flex:1}.pv-t strong{font-size:14px}.pv-t i{font-style:normal;color:#64748b;font-size:12.5px}
.pv-t em{font-style:normal;font-size:11px;font-weight:700;color:#0d9488;background:#ccfbf1;border-radius:99px;padding:2px 8px;white-space:nowrap}
.pv-s{border:1px solid #e2e8f0;border-radius:16px;padding:10px 12px;margin:0 0 8px;background:#fff}.pv-sh{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.pv-sh span{width:22px;height:22px;border-radius:50%;background:#0d9488;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700}.pv-sh em{margin-left:auto;font-style:normal;font-weight:700}
.pv-i{display:flex;gap:10px;font-size:13px;padding:4px 0;border-top:1px solid #f1f5f9}.pv-i b{min-width:42px;color:#0f766e}.pv-i span{flex:1}.pv-i i{font-style:normal;color:#16a34a;font-size:12px}.pv-i.ok span{color:#64748b}
.pv-tot{display:flex;justify-content:space-between;align-items:baseline;background:#f0fdfa;border-radius:16px;padding:12px 14px}.pv-tot b{font-size:22px;color:#0f766e}.pv-note{font-size:12px;color:#64748b;margin:6px 4px}
.pv-cta{display:block;margin:20px 14px 0;text-align:center;background:#0d9488;color:#fff;text-decoration:none;font-weight:700;border-radius:16px;padding:15px}
.pv-f{margin:18px 18px 0;font-size:11.5px;color:#94a3b8;line-height:1.5}`
