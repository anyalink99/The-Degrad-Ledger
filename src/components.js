import { html } from 'htm/preact';

// ===== Latin/Roman helpers =====
const MONTHS_LATIN = [
  'IANUARII', 'FEBRUARII', 'MARTII', 'APRILIS', 'MAII', 'IUNII',
  'IULII', 'AUGUSTI', 'SEPTEMBRIS', 'OCTOBRIS', 'NOVEMBRIS', 'DECEMBRIS',
];

export function romanize(n) {
  const lookup = [
    ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
    ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
    ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
  ];
  let out = '';
  for (const [sym, val] of lookup) while (n >= val) { out += sym; n -= val; }
  return out;
}

export function datelineLatin(d = new Date()) {
  return `${d.getDate()} ${MONTHS_LATIN[d.getMonth()]} ${romanize(d.getFullYear())}`;
}

// ===== Chrome =====
export function Masthead({ issueNo = 1 }) {
  return html`
    <header class="masthead">
      <div class="masthead-motto">EDITIO COTIDIANA · VERITAS IN NUMERIS</div>
      <h1 class="masthead-title">The Degrad Ledger</h1>
      <div class="masthead-dateline">
        <span>NO. ${romanize(Math.max(1, issueNo))}</span>
        <span>${datelineLatin()}</span>
        <span>PRETIUM · GRATIS</span>
      </div>
      <hr class="rule-double" />
    </header>
  `;
}

export function Nav({ route, isAdmin }) {
  const items = [
    ['/', 'FRONT PAGE'],
    ['/dispatch', 'DISPATCH'],
    ['/me', 'MY COLUMN'],
    ['/notices', 'NOTICES'],
    ['/season', 'РЕВИЗИЯ'],
    ['/ledger', 'LEDGER'],
  ];
  if (isAdmin) items.push(['/editorial', 'EDITORIAL']);
  return html`
    <nav class="nav">
      ${items.map(([p, l]) => html`
        <a href=${'#' + p} class=${route === p ? 'active' : ''}>${l}</a>
      `)}
    </nav>
    <hr class="rule-single" />
  `;
}

export function Colophon() {
  return html`
    <footer class="colophon">
      ПЕЧАТАЕТСЯ ЕЖЕДНЕВНО · НАБОРОМ: PLAYFAIR DISPLAY · EB GARAMOND · IBM PLEX MONO · FOUNDED AN. MMXXVI
    </footer>
  `;
}

// ===== Atoms =====
export function Kicker({ children }) { return html`<div class="kicker">${children}</div>`; }

export function TrendArrow({ delta }) {
  if (delta === null || delta === undefined) return html`<span class="trend flat">—</span>`;
  const d = Number(delta);
  if (Math.abs(d) < 0.25) return html`<span class="trend flat">·</span>`;
  if (d > 0) return html`<span class="trend up">▲ ${d.toFixed(1)}</span>`;
  return html`<span class="trend down">▼ ${Math.abs(d).toFixed(1)}</span>`;
}

export function Badges({ list }) {
  if (!list?.length) return null;
  return html`<div>${list.map(b => html`<span class="chip ${b.tone || ''}">${b.label}</span>`)}</div>`;
}

// ===== Sparkline (SVG) =====
export function Sparkline({ series }) {
  const W = 320, H = 70, pad = 6;
  const values = series.map(x => x.value).filter(v => v !== null);
  if (!values.length) {
    return html`<svg class="sparkline" viewBox="0 0 ${W} ${H}"></svg>`;
  }
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const n = series.length;
  const pts = series.map((x, i) => {
    if (x.value === null) return null;
    const px = pad + (i * (W - 2 * pad)) / Math.max(1, n - 1);
    const py = H - pad - ((x.value - min) / range) * (H - 2 * pad);
    return [px, py];
  }).filter(Boolean);
  if (!pts.length) return html`<svg class="sparkline" viewBox="0 0 ${W} ${H}"></svg>`;
  const pathD = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaD = pathD + ` L ${last[0].toFixed(1)},${H - pad} L ${first[0].toFixed(1)},${H - pad} Z`;
  return html`
    <svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line class="base" x1="0" x2=${W} y1=${H - pad} y2=${H - pad} />
      <path class="area" d=${areaD} />
      <path class="line" d=${pathD} />
      <circle class="dot" cx=${last[0]} cy=${last[1]} r="2.4" />
    </svg>
  `;
}

// ===== Heatmap (days × raters) =====
export function Heatmap({ rateeId, people, ratings, days = 21 }) {
  const today = new Date();
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const raters = people.filter(p => p.id !== rateeId);

  function cellClass(raterId, date) {
    const rows = ratings
      .filter(r => r.rater_id === raterId && r.ratee_id === rateeId && r.date === date && r.kind === 'delta')
      .sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1));
    const r = rows[0];
    if (!r) return 'x';
    const v = Number(r.value);
    if (v > 0) return 'p';
    if (v < 0) return 'n';
    return 'z';
  }

  if (!raters.length) return html`<p class="muted small-caps">ДАННЫХ НЕТ</p>`;

  return html`
    <table class="heatmap">
      <tbody>
        ${raters.map(r => html`
          <tr>
            <th>${r.name}</th>
            ${dates.map(d => html`<td class=${cellClass(r.id, d)} title="${r.name} · ${d}"></td>`)}
          </tr>
        `)}
      </tbody>
    </table>
  `;
}
