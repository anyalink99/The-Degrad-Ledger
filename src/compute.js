// Pure score computations. No side effects, no external state.
// Store raw user intent (±1/0/initial). Effective score is derived here via replay.

// Gojo-infinity dampening: asymptote at +100 only.
// Moving up from score S by delta d > 0: effective = d * min(1, (100 - S) / 100).
// Moving down is free (no lower wall).
export function applyDelta(score, delta) {
  const d = Number(delta);
  if (d > 0) {
    const distance = Math.max(0, 100 - score);
    return score + d * Math.min(1, distance / 100);
  }
  return score + d;
}

export function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function daysAgoStr(n) { return todayStr(-n); }

function latestPerDate(rows) {
  const m = new Map();
  for (const r of rows) {
    const prev = m.get(r.date);
    if (!prev || String(prev.ts) < String(r.ts)) m.set(r.date, r);
  }
  return m;
}

// Effective score rater→ratee at or before `cutoff` date (YYYY-MM-DD). Null if no initial.
export function scoreFor(raterId, rateeId, ratings, cutoff = null) {
  const cut = cutoff ?? todayStr();
  const events = ratings.filter(r =>
    r.rater_id === raterId &&
    r.ratee_id === rateeId &&
    r.date <= cut
  );
  if (!events.length) return null;
  const byDate = latestPerDate(events);
  const sortedDates = [...byDate.keys()].sort();
  let score = null;
  for (const d of sortedDates) {
    const e = byDate.get(d);
    if (e.kind === 'initial') score = Number(e.value);
    else if (e.kind === 'delta' && score !== null) score = applyDelta(score, Number(e.value));
  }
  return score;
}

export function median(nums) {
  const s = nums.filter(n => n !== null && !Number.isNaN(n)).slice().sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function medianScoreAt(rateeId, people, ratings, cutoff = null) {
  const scores = people
    .filter(p => p.id !== rateeId)
    .map(p => scoreFor(p.id, rateeId, ratings, cutoff))
    .filter(s => s !== null);
  return median(scores);
}

export function weeklyTrend(rateeId, people, ratings) {
  const now = medianScoreAt(rateeId, people, ratings, todayStr());
  const then = medianScoreAt(rateeId, people, ratings, daysAgoStr(7));
  if (now === null || then === null) return null;
  return now - then;
}

export function medianSeries(rateeId, people, ratings, days = 30) {
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = todayStr(-i);
    series.push({ date, value: medianScoreAt(rateeId, people, ratings, date) });
  }
  return series;
}

export function deltaAt(raterId, rateeId, date, ratings) {
  const rows = ratings
    .filter(r => r.rater_id === raterId && r.ratee_id === rateeId && r.date === date && r.kind === 'delta')
    .sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1));
  const r = rows[0];
  if (!r) return null;
  return Number(r.value);
}

export function noteAt(raterId, rateeId, date, ratings) {
  const rows = ratings
    .filter(r => r.rater_id === raterId && r.ratee_id === rateeId && r.date === date)
    .sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1));
  const r = rows[0];
  if (!r) return null;
  return r.note || null;
}

export function initialRating(raterId, rateeId, ratings) {
  const rows = ratings
    .filter(r => r.rater_id === raterId && r.ratee_id === rateeId && r.kind === 'initial')
    .sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1));
  const r = rows[0];
  if (!r) return null;
  return Number(r.value);
}

export function hasCompletedFirstRound(raterId, people, ratings) {
  const others = people.filter(p => p.id !== raterId);
  return others.every(p => initialRating(raterId, p.id, ratings) !== null);
}

export function peakLow(rateeId, people, ratings, days = 180) {
  const series = medianSeries(rateeId, people, ratings, days).filter(x => x.value !== null);
  if (!series.length) return { peak: null, low: null };
  let peak = series[0], low = series[0];
  for (const x of series) {
    if (x.value > peak.value) peak = x;
    if (x.value < low.value) low = x;
  }
  return { peak, low };
}

// Badges (per-person, stateless)
export function badgesFor(rateeId, people, ratings) {
  const out = [];
  const values = medianSeries(rateeId, people, ratings, 30).map(x => x.value).filter(v => v !== null);
  const s7 = values.slice(-7);
  const s14 = values.slice(-14);

  if (s7.length >= 5) {
    const nonDecreasing = s7.every((v, i) => i === 0 || v >= s7[i - 1] - 0.001);
    const diff = s7[s7.length - 1] - s7[0];
    if (nonDecreasing && diff >= 2) out.push({ label: 'В СТРИКЕ', tone: 'hot' });
  }
  if (s14.length >= 8) {
    const mean = s14.reduce((a, b) => a + b, 0) / s14.length;
    const variance = s14.reduce((a, b) => a + (b - mean) ** 2, 0) / s14.length;
    const stdev = Math.sqrt(variance);
    if (stdev <= 1.2 && mean >= 60) out.push({ label: 'СТАБИЛЕН', tone: 'cool' });
  }
  if (s14.length >= 8) {
    const trough = Math.min(...s14);
    const troughIdx = s14.indexOf(trough);
    const now = s14[s14.length - 1];
    if (now - trough >= 5 && troughIdx < s14.length - 3) {
      out.push({ label: 'ПОДЪЁМ', tone: 'hot' });
    }
  }
  return out;
}

// Rater's own score vs median of other raters — for "quiet divergence" nudge.
export function divergenceOf(raterId, rateeId, people, ratings) {
  const mine = scoreFor(raterId, rateeId, ratings);
  if (mine === null) return null;
  const others = people
    .filter(p => p.id !== rateeId && p.id !== raterId)
    .map(p => scoreFor(p.id, rateeId, ratings))
    .filter(s => s !== null);
  const theirs = median(others);
  if (theirs === null) return null;
  return mine - theirs;
}

// ===== Seasons =====
// Meteorological seasons: winter Dec 1, spring Mar 1, summer Jun 1, autumn Sep 1.

export function currentSeasonStart(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  let month, year = y;
  if (m === 11) { month = 11; }
  else if (m <= 1) { month = 11; year = y - 1; }
  else if (m <= 4) { month = 2; }
  else if (m <= 7) { month = 5; }
  else { month = 8; }
  const mm = String(month + 1).padStart(2, '0');
  return `${year}-${mm}-01`;
}

export function currentSeasonName(date = new Date()) {
  const m = date.getUTCMonth();
  if (m === 11 || m <= 1) return 'зима';
  if (m <= 4) return 'весна';
  if (m <= 7) return 'лето';
  return 'осень';
}

export function currentSeasonLatin(date = new Date()) {
  const m = date.getUTCMonth();
  if (m === 11 || m <= 1) return 'HIEMS';
  if (m <= 4) return 'VER';
  if (m <= 7) return 'AESTAS';
  return 'AUTUMNUS';
}

export function latestInitialRow(raterId, rateeId, ratings) {
  const rows = ratings
    .filter(r => r.rater_id === raterId && r.ratee_id === rateeId && r.kind === 'initial')
    .sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1));
  return rows[0] || null;
}

// Eligible for seasonal re-init iff: has initial AND that initial predates current season start.
export function canSeasonalRefresh(raterId, rateeId, ratings, date = new Date()) {
  if (raterId === rateeId) return false;
  const latest = latestInitialRow(raterId, rateeId, ratings);
  if (!latest) return false;
  return String(latest.date).slice(0, 10) < currentSeasonStart(date);
}

// Sorted climber list for "Lead Story" / "в прайме"
export function climbers(people, ratings) {
  return people
    .map(p => ({
      id: p.id,
      name: p.name,
      delta: weeklyTrend(p.id, people, ratings) ?? 0,
      median: medianScoreAt(p.id, people, ratings),
    }))
    .sort((a, b) => b.delta - a.delta);
}
