import { html } from 'htm/preact';
import { useMemo } from 'preact/hooks';
import {
  medianScoreAt, weeklyTrend, medianSeries, peakLow, badgesFor,
  hasEnoughRaters, initialRaterCount, MIN_RATERS_FOR_SCORE,
} from '../compute.js';
import { Kicker, Sparkline, Heatmap, Badges, TrendArrow } from '../components.js';

export function PersonView({ state, id, me }) {
  const { people, ratings } = state;
  const person = people.find(p => p.id === id);
  if (!person) return html`<p>Не найдено. <a href="#/">На главную</a></p>`;

  const raters = initialRaterCount(id, ratings);
  const enough = hasEnoughRaters(id, ratings);
  const median = enough ? medianScoreAt(id, people, ratings) : null;
  const trend = enough ? weeklyTrend(id, people, ratings) : null;
  const series = useMemo(
    () => enough ? medianSeries(id, people, ratings, 45) : [],
    [id, people, ratings, enough],
  );
  const { peak, low } = useMemo(
    () => enough ? peakLow(id, people, ratings) : { peak: null, low: null },
    [id, people, ratings, enough],
  );
  const badges = useMemo(
    () => enough ? badgesFor(id, people, ratings) : [],
    [id, people, ratings, enough],
  );

  const notes = useMemo(() => {
    const m = new Map();
    for (const r of ratings) {
      if (r.ratee_id !== id || r.kind !== 'delta') continue;
      const k = r.rater_id + '|' + r.date;
      const prev = m.get(k);
      if (!prev || String(prev.ts) < String(r.ts)) m.set(k, r);
    }
    return [...m.values()]
      .filter(r => r.note && String(r.note).trim())
      .sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1))
      .map(r => ({ ...r, raterName: people.find(p => p.id === r.rater_id)?.name || '?' }));
  }, [ratings, people, id]);

  return html`
    <div>
      <${Kicker}>ПРОФИЛЬ · ${id === me ? 'ВЫ В ЗЕРКАЛЕ · ЧИСТО ПРОСМОТР' : 'ОБОЗРЕВАЕМЫЙ'}</${Kicker}>
      <h2 class="headline">${person.name}</h2>
      <p class="deck">Полный разворот: история, коллективный приговор, колонки обозревателей.</p>
      <hr class="rule-single" />

      <div class="cols">
        <main>
          ${enough ? html`
            <div style="display:flex; gap: 48px; align-items: baseline; flex-wrap: wrap;">
              <div>
                <div class="display-num">${median !== null ? median.toFixed(1) : '—'}</div>
                <div class="display-num-sub">МЕДИАНА КОЛЛЕГ</div>
              </div>
              <div>
                <div class="display-num sm"><${TrendArrow} delta=${trend} /></div>
                <div class="display-num-sub">ЗА 7 ДНЕЙ</div>
              </div>
              <div>
                <div class="display-num xs">
                  ${peak?.value !== undefined && peak?.value !== null ? peak.value.toFixed(1) : '—'} /
                  ${low?.value !== undefined && low?.value !== null ? low.value.toFixed(1) : '—'}
                </div>
                <div class="display-num-sub">ПИК / ДНО (180Д)</div>
              </div>
            </div>

            <div class="mt-8">
              <${Kicker}>ДИНАМИКА · 45 ДНЕЙ</${Kicker}>
              <${Sparkline} series=${series} />
            </div>

            <div class="mt-6">
              <${Kicker}>ОТМЕТКИ</${Kicker}>
              ${badges.length ? html`<${Badges} list=${badges} />` : html`<p class="muted"><em>Пока тихо.</em></p>`}
            </div>
          ` : html`
            <div style="padding: 16px 0 8px;">
              <div class="display-num" style="color: var(--ink-faint);">—</div>
              <div class="display-num-sub">ПОКА НЕ ОТОБРАЖАЕТСЯ</div>
              <p class="muted mt-4" style="font-style: italic; max-width: 60ch;">
                ${`Набралось ${raters} из ${MIN_RATERS_FOR_SCORE} стартовых оценок. Медиана, тренд и история появятся, когда ${person.name} получит минимум ${MIN_RATERS_FOR_SCORE} первых оценок от коллег.`}
              </p>
            </div>
          `}

          <div class="mt-8">
            <${Kicker}>КОЛОНКИ ОБОЗРЕВАТЕЛЕЙ · ${notes.length}</${Kicker}>
            ${notes.length ? notes.map((n, i) => html`
              <article class="article">
                <div class="article-kicker">
                  <span>${n.raterName}</span>
                  <span>${n.date}</span>
                  <span>${n.value > 0 ? '+1' : n.value < 0 ? '−1' : '0'}</span>
                </div>
                <p class=${'article-body' + (i === 0 ? ' dropcap' : '')}>${n.note}</p>
              </article>
            `) : html`<p class="muted"><em>Ни одной строки. Ещё.</em></p>`}
          </div>
        </main>
        <aside>
          <${Kicker}>ТЕПЛОВАЯ КАРТА · 21 ДЕНЬ</${Kicker}>
          <${Heatmap} rateeId=${id} people=${people} ratings=${ratings} />
          <div class="muted" style="font-family: var(--font-sc); font-size: 10px; letter-spacing: 0.22em; margin-top: 14px; line-height: 1.6; display: flex; flex-wrap: wrap; gap: 14px;">
            <span style="display: inline-flex; align-items: center; gap: 6px;">
              <span style="display:inline-block; width:10px; height:10px; background: var(--ink);"></span> +1
            </span>
            <span style="display: inline-flex; align-items: center; gap: 6px;">
              <span style="display:inline-block; width:10px; height:10px; background: var(--oxblood);"></span> −1
            </span>
            <span style="display: inline-flex; align-items: center; gap: 6px;">
              <span style="display:inline-block; width:10px; height:10px; background: var(--paper-tint);"></span> 0
            </span>
            <span style="display: inline-flex; align-items: center; gap: 6px;">
              <span style="display:inline-block; width:10px; height:10px; border: 1px dashed var(--rule-soft);"></span> ПУСТО
            </span>
          </div>
        </aside>
      </div>
    </div>
  `;
}
