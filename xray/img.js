/* Рентген-снимки для демо и страницы пациента (/rx): рисуем SVG по типу исследования и числу-зерну.
   Один и тот же модуль у CRM (раздел «Результати», 99zu-xray.js) и у /rx.html — пациент видит тот же снимок, что врач. */
const R = s => { let x = s % 2147483647 || 7; return () => ((x = x * 16807 % 2147483647) - 1) / 2147483646 }

function chest(r, small, path) {
  const ribs = [], tilt = (r() - .5) * 6
  for (let i = 0; i < 9; i++) {
    const y = 120 + i * 30
    ribs.push(`<path d="M240 ${y - 6}C200 ${y - 26} 130 ${y - 14} ${96 + i * 3} ${y + 30}" stroke="#d9dfe2" stroke-width="${7 - i * .35}" fill="none" opacity=".32"/>`,
      `<path d="M240 ${y - 6}C280 ${y - 26} 350 ${y - 14} ${384 - i * 3} ${y + 30}" stroke="#d9dfe2" stroke-width="${7 - i * .35}" fill="none" opacity=".32"/>`)
  }
  const inf = path === 'pn' ? `<ellipse cx="${300 + r() * 30}" cy="${330 + r() * 20}" rx="46" ry="34" fill="#c5ccd0" opacity=".55"/>`
    : path === 'br' ? `<path d="M190 200Q150 260 140 330M290 200Q330 260 340 330M200 220Q170 250 160 300M280 220Q310 250 320 300" stroke="#b9c1c5" stroke-width="5" fill="none" opacity=".5"/>`
    : path === 'fb' ? `<path d="M150 110l40 20M160 130l30 10" stroke="#e6eaec" stroke-width="4" opacity=".6"/>` : ''
  return `<g transform="rotate(${tilt} 240 240)">
    <path d="M40 470C40 300 60 120 150 70C190 50 290 50 330 70C420 120 440 300 440 470Z" fill="#596266"/>
    <path d="M150 110C110 150 95 260 105 400C150 420 205 410 225 380L225 130C210 100 175 95 150 110Z" fill="#1b2022"/>
    <path d="M330 110C370 150 385 260 375 400C330 420 275 410 255 380L255 130C270 100 305 95 330 110Z" fill="#1b2022"/>
    ${ribs.join('')}
    <rect x="226" y="40" width="28" height="430" rx="10" fill="#cdd4d7" opacity=".85"/>
    <path d="M225 250C190 270 180 330 205 380C240 410 300 400 320 370C335 330 300 270 255 250Z" fill="#aeb6ba" opacity=".9"/>
    <path d="M90 92Q160 70 228 96M390 92Q320 70 252 96" stroke="#e8ecee" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M100 410Q160 360 225 400M380 410Q320 360 255 400" stroke="#8b9498" stroke-width="18" fill="none"/>
    ${inf}</g>${small ? '<rect width="100%" height="100%" fill="#0a3d2a" opacity=".12"/>' : ''}`
}
function spine(r) {
  let v = ''
  for (let i = 0; i < 7; i++) { const y = 40 + i * 62, x = 205 + Math.sin(i / 2) * 6 + (r() - .5) * 4, h = 44 - (i > 4 ? 6 : 0)
    v += `<rect x="${x}" y="${y}" width="${70 + i * 2}" height="${h}" rx="8" fill="#d2d9dc" opacity=".9"/><rect x="${x + 70 + i * 2}" y="${y + 8}" width="46" height="18" rx="6" fill="#aeb6ba" opacity=".7"/>` }
  return `<rect x="120" y="0" width="240" height="480" fill="#454d51"/>${v}`
}
function limb(r, path) {
  const gap = path === 'oa' ? 6 : 14, cx = 240 + (r() - .5) * 10
  return `<path d="M150 0L330 0L320 480L160 480Z" fill="#454d51"/>
    <path d="M${cx - 50} 0L${cx + 50} 0L${cx + 46} 190C${cx + 70} 210 ${cx + 66} 236 ${cx + 40} 240L${cx - 40} 240C${cx - 66} 236 ${cx - 70} 210 ${cx - 46} 190Z" fill="#d5dbde"/>
    <path d="M${cx - 52} ${240 + gap}L${cx + 52} ${240 + gap}C${cx + 58} ${262 + gap} ${cx + 44} ${272 + gap} ${cx + 38} ${282 + gap}L${cx + 34} 480L${cx - 34} 480L${cx - 38} ${282 + gap}C${cx - 44} ${272 + gap} ${cx - 58} ${262 + gap} ${cx - 52} ${240 + gap}Z" fill="#cfd6d9"/>
    <ellipse cx="${cx}" cy="205" rx="26" ry="20" fill="#e3e8ea" opacity=".6"/>
    ${path === 'fx' ? `<path d="M${cx - 34} 380L${cx + 10} 372L${cx + 34} 386" stroke="#20262a" stroke-width="4" fill="none"/>` : ''}`
}
function sinus(r, path) {
  const d = path === 'sin' ? '#7f888c' : '#1d2224'
  return `<ellipse cx="240" cy="230" rx="190" ry="220" fill="#59636a"/><ellipse cx="240" cy="230" rx="170" ry="200" fill="#808a8f"/>
    <ellipse cx="180" cy="150" rx="36" ry="26" fill="#1d2224"/><ellipse cx="300" cy="150" rx="36" ry="26" fill="#1d2224"/>
    <path d="M150 230C140 280 170 320 215 320L220 240Z" fill="${d}"/><path d="M330 230C340 280 310 320 265 320L260 240Z" fill="#1d2224"/>
    <rect x="228" y="190" width="24" height="140" rx="8" fill="#c6cdd1"/>
    <path d="M120 360Q240 420 360 360" stroke="#e6eaec" stroke-width="14" fill="none" opacity=".7"/>`
}

/* z: chest | flg | spine | knee | limb | sinus; p: находка (pn — пневмония, br — бронхит, fb — фиброз, oa — артроз, fx — перелом, sin — гайморит) */
export function xrSvg(z, seed, p) {
  const r = R(seed | 0), W = 480, H = 480
  const body = z === 'spine' ? spine(r) : z === 'knee' || z === 'limb' ? limb(r, p) : z === 'sinus' ? sinus(r, p) : chest(r, z === 'flg', p)
  const tag = { chest: 'ОГК · пряма', flg: 'ФЛГ', spine: 'Хребет · бічна', knee: 'Колінний суглоб', limb: 'Кінцівка', sinus: 'Пазухи' }[z] || ''
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><filter id="b"><feGaussianBlur stdDeviation="${z === 'flg' ? 3.2 : 2.2}"/></filter><radialGradient id="v" cx="50%" cy="50%" r="70%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".7"/></radialGradient></defs><rect width="100%" height="100%" fill="#07090a"/><g filter="url(#b)">${body}</g><rect width="100%" height="100%" fill="url(#v)"/><text x="14" y="24" fill="#e2e8eb" font-family="Arial" font-size="13" opacity=".75">R</text><text x="${W - 12}" y="${H - 12}" fill="#cfd6da" font-family="Arial" font-size="12" text-anchor="end" opacity=".7">${tag}</text></svg>`)
}

/* ссылка пациенту: JSON → base64url после #, на сервер не уходит */
export const encode = d => btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const decode = h => { const s = String(h || '').replace(/^#/, ''); if (!s) return null; return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))) }
