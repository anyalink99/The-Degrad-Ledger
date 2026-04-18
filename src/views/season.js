import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import {
  canSeasonalRefresh, currentSeasonName, currentSeasonStart, currentSeasonLatin,
  medianScoreAt, scoreFor, latestInitialRow, hasCompletedFirstRound,
} from '../compute.js';
import { setInitial } from '../api.js';
import { refresh } from '../state.js';
import { Kicker, romanize } from '../components.js';

const SEASON_CAPS = { 'зима': 'ЗИМА', 'весна': 'ВЕСНА', 'лето': 'ЛЕТО', 'осень': 'ОСЕНЬ' };

export function SeasonView({ state, me }) {
  const { people, ratings } = state;

  if (!hasCompletedFirstRound(me, people, ratings)) {
    return html`
      <div class="center" style="padding: 80px 0;">
        <${Kicker}>РЕВИЗИЯ</${Kicker}>
        <h2 class="headline">Сначала первый круг</h2>
        <p class="deck" style="margin: 0 auto;">
          Сезонная ревизия открывается после того, как завершите первый круг стартовых оценок.
        </p>
      </div>
    `;
  }

  const seasonStart = currentSeasonStart();
  const seasonName = currentSeasonName();
  const seasonLatin = currentSeasonLatin();
  const year = new Date().getUTCFullYear();

  const others = people.filter(p => p.id !== me);
  const eligible = others.filter(p => canSeasonalRefresh(me, p.id, ratings));
  const alreadyDone = others.filter(p =>
    latestInitialRow(me, p.id, ratings) && !canSeasonalRefresh(me, p.id, ratings)
  );

  return html`
    <div>
      <${Kicker}>СЕЗОН · ${SEASON_CAPS[seasonName] || seasonName.toUpperCase()} · ${seasonLatin} · MMXXVI · ОТКРЫТ С ${seasonStart}</${Kicker}>
      <h2 class="headline">Сезонная ревизия</h2>
      <p class="deck">
        Раз в сезон — зимой, весной, летом, осенью — можно переоценить каждого коллегу заново
        по шкале 0—50. Новая стартовая оценка сбрасывает прежнюю историю: счёт начинает жить с этой отметки.
      </p>
      <hr class="rule-single" />

      ${others.length === 0 ? html`
        <p class="muted mt-6"><em>В редакции пока только вы.</em></p>
      ` : eligible.length ? html`
        <${Kicker}>ОТКРЫТЫ ДЛЯ РЕВИЗИИ · ${eligible.length}</${Kicker}>
        <div class="stack mt-2">
          ${eligible.map(p => html`<${SeasonCard} key=${p.id} state=${state} me=${me} person=${p} />`)}
        </div>
      ` : html`
        <p class="muted mt-6" style="font-style: italic;">
          Все коллеги уже переоценены в этом сезоне. Следующая возможность — с началом следующего.
        </p>
      `}

      ${alreadyDone.length ? html`
        <div class="mt-8">
          <${Kicker}>УЖЕ ПЕРЕОЦЕНЕНО В ЭТОМ СЕЗОНЕ · ${alreadyDone.length}</${Kicker}>
          <ul style="list-style: none; padding: 0; margin: 8px 0 0;">
            ${alreadyDone.map(p => {
              const last = latestInitialRow(me, p.id, ratings);
              return html`
                <li style="padding: 10px 0; border-bottom: 1px solid var(--rule-soft); display:flex; justify-content:space-between; align-items: baseline;">
                  <span style="font-family: var(--font-display); font-weight: 600;">${p.name}</span>
                  <span class="small-caps muted" style="font-size: 10px;">${last.date} · НОВЫЙ СТАРТ · ${last.value}</span>
                </li>
              `;
            })}
          </ul>
        </div>
      ` : null}
    </div>
  `;
}

function SeasonCard({ state, me, person }) {
  const { people, ratings } = state;
  const current = scoreFor(me, person.id, ratings);
  const groupMedian = medianScoreAt(person.id, people, ratings);
  const suggested = current !== null ? Math.round(Math.max(0, Math.min(50, current))) : 25;
  const [val, setVal] = useState(suggested);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function confirm() {
    try {
      setSaving(true);
      await setInitial(me, person.id, val);
      await refresh();
      setDone(true);
    } catch (e) {
      alert('Ошибка: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (done) return null;

  return html`
    <article style="padding: 20px; border: 1px solid var(--ink); background: var(--paper);">
      <div class="article-kicker">
        <span>ВАША ТЕКУЩАЯ · ${current !== null ? current.toFixed(1) : '—'}</span>
        <span>МЕДИАНА КОЛЛЕГ · ${groupMedian !== null ? groupMedian.toFixed(1) : '—'}</span>
      </div>
      <h3 class="article-head">${person.name}</h3>
      <div class="field mt-4">
        <label>НОВАЯ СТАРТОВАЯ ОЦЕНКА · 0—50</label>
        <input type="range" min="0" max="50" value=${val} onInput=${e => setVal(Number(e.target.value))} />
        <div class="num" style="font-size: 28px; text-align: center; margin-top: 8px;">${val}</div>
      </div>
      <button class="solid" onClick=${confirm} disabled=${saving}>ЗАКРЕПИТЬ НОВУЮ ОЦЕНКУ</button>
      <p class="muted small-caps" style="font-size: 10px; margin: 10px 0 0;">
        ПОСЛЕ ЗАКРЕПЛЕНИЯ ИЗМЕНИТЬ МОЖНО БУДЕТ ТОЛЬКО В СЛЕДУЮЩЕМ СЕЗОНЕ
      </p>
    </article>
  `;
}
