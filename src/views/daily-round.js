import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import {
  medianScoreAt, scoreFor, deltaAt, noteAt, divergenceOf, todayStr,
  hasCompletedFirstRound, initialRating,
} from '../compute.js';
import { setDelta, setInitial } from '../api.js';
import { refresh } from '../state.js';
import { Kicker } from '../components.js';

export function DailyRound({ state, me }) {
  const { people, ratings } = state;

  if (!hasCompletedFirstRound(me, people, ratings)) {
    return html`<${FirstRound} state=${state} me=${me} />`;
  }

  const others = people.filter(p => p.id !== me);

  if (!others.length) {
    return html`
      <div class="center" style="padding: 80px 0;">
        <${Kicker}>DISPATCH</${Kicker}>
        <h2 class="headline">Пока некого оценивать</h2>
        <p class="deck" style="margin: 0 auto;">Попросите редактора добавить коллег в EDITORIAL.</p>
      </div>
    `;
  }

  return html`
    <div>
      <${Kicker}>DISPATCH · ${todayStr()}</${Kicker}>
      <h2 class="headline">Сегодняшний обход</h2>
      <p class="deck">
        По каждому коллеге — минус, ноль или плюс. По желанию — колонка в пару строк.
        До полуночи вашего часового пояса можно переписать.
      </p>
      <hr class="rule-single" />
      <div class="stack">
        ${others.map(p => html`<${DispatchCard} key=${p.id} state=${state} me=${me} person=${p} />`)}
      </div>
    </div>
  `;
}

function DispatchCard({ state, me, person }) {
  const { people, ratings } = state;
  const today = todayStr();

  const myScore = scoreFor(me, person.id, ratings);
  const groupMedian = medianScoreAt(person.id, people, ratings);
  const divergence = divergenceOf(me, person.id, people, ratings);

  const existingDelta = deltaAt(me, person.id, today, ratings);
  const existingNote = noteAt(me, person.id, today, ratings);

  const [delta, setDeltaL] = useState(existingDelta);
  const [note, setNote] = useState(existingNote || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(existingDelta !== null ? 'ЗАПИСАНО' : '');

  async function commit(dValue, noteValue) {
    try {
      setSaving(true);
      await setDelta(me, person.id, dValue, noteValue);
      await refresh();
      setStatus('ЗАПИСАНО');
      setTimeout(() => setStatus(''), 1600);
    } catch (e) {
      alert('Ошибка: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function pickDelta(v) {
    setDeltaL(v);
    commit(v, note);
  }

  async function commitNote() {
    if (delta === null) return;
    if (note === (existingNote || '')) return;
    await commit(delta, note);
  }

  return html`
    <article style="padding: 20px; border: 1px solid var(--ink); background: var(--paper);">
      <div class="article-kicker">
        <span>ОБЪЕКТ</span>
        <span>МОЯ ОЦЕНКА · ${myScore !== null ? myScore.toFixed(1) : '—'}</span>
        <span>МЕДИАНА · ${groupMedian !== null ? groupMedian.toFixed(1) : '—'}</span>
      </div>
      <h3 class="article-head">${person.name}</h3>

      ${divergence !== null && Math.abs(divergence) >= 8 ? html`
        <p class="muted" style="font-style: italic; font-size: 15px; margin: 6px 0 0; max-width: 60ch;">
          ${`${divergence > 0 ? '↑' : '↓'} Ваша оценка отличается от общей медианы на ${Math.abs(divergence).toFixed(1)} ${divergence > 0 ? 'в плюс' : 'в минус'}.`}
        </p>
      ` : null}

      <div class="verdict-row mt-4">
        <button class=${'verdict' + (delta === -1 ? ' active' : '')} onClick=${() => pickDelta(-1)} disabled=${saving}>
          −1<span class="caption">КРИТИКА</span>
        </button>
        <button class=${'verdict' + (delta === 0 ? ' active' : '')} onClick=${() => pickDelta(0)} disabled=${saving}>
          ·<span class="caption">БЕЗ ХОДА</span>
        </button>
        <button class=${'verdict' + (delta === 1 ? ' active' : '')} onClick=${() => pickDelta(1)} disabled=${saving}>
          +1<span class="caption">ПОХВАЛА</span>
        </button>
      </div>

      <div class="field mt-4" style="margin-bottom: 0;">
        <label>КОЛОНКА · ОПЦИОНАЛЬНО</label>
        <textarea
          placeholder=${delta === null ? 'Сначала поставьте отметку слева.' : 'Пара строк — почему именно так.'}
          value=${note}
          onInput=${e => setNote(e.target.value)}
          onBlur=${commitNote}
          disabled=${delta === null}
        />
      </div>
      ${status ? html`<p class="small-caps muted" style="font-size: 10px; margin: 8px 0 0;">${status}</p>` : null}
    </article>
  `;
}

function FirstRound({ state, me }) {
  const { people, ratings } = state;
  const others = people.filter(p => p.id !== me);
  const needed = others.filter(p => initialRating(me, p.id, ratings) === null);

  if (!others.length) {
    return html`
      <div class="center" style="padding: 80px 0;">
        <${Kicker}>ПЕРВЫЙ КРУГ</${Kicker}>
        <h2 class="headline">В редакции ещё нет коллег</h2>
      </div>
    `;
  }

  if (!needed.length) return null;

  return html`
    <div>
      <${Kicker}>ОСОБЫЙ ВЫПУСК · ПЕРВЫЙ КРУГ</${Kicker}>
      <h2 class="headline">Стартовые оценки</h2>
      <p class="deck">
        Перед первым дневным обходом выставьте начальные баллы всем коллегам (0–50).
        Это делается один раз. Можно менять ползунок, пока не зафиксируете.
      </p>
      <hr class="rule-single" />
      <div class="stack">
        ${needed.map(p => html`<${FirstRoundCard} key=${p.id} me=${me} person=${p} />`)}
      </div>
    </div>
  `;
}

function FirstRoundCard({ me, person }) {
  const [val, setVal] = useState(25);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function confirm() {
    try {
      setSaving(true);
      await setInitial(me, person.id, val);
      await refresh();
      setSaved(true);
    } catch (e) {
      alert('Ошибка: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (saved) return null;

  return html`
    <article style="padding: 20px; border: 1px solid var(--ink);">
      <h3 class="article-head">${person.name}</h3>
      <div class="field">
        <label>НАЧАЛЬНАЯ ОЦЕНКА · 0—50</label>
        <input type="range" min="0" max="50" value=${val} onInput=${e => setVal(Number(e.target.value))} />
        <div class="num" style="font-size: 28px; text-align: center; margin-top: 8px;">${val}</div>
      </div>
      <button class="solid" onClick=${confirm} disabled=${saving}>ЗАКРЕПИТЬ</button>
    </article>
  `;
}
