import { html } from 'htm/preact';
import { useMemo, useState } from 'preact/hooks';
import {
  medianSeries, scoreFor, weeklyTrend, peakLow,
  hasEnoughRaters, initialRaterCount, MIN_RATERS_FOR_SCORE,
} from '../compute.js';
import { Kicker, Sparkline, TrendArrow } from '../components.js';
import { editNote, deleteNote } from '../api.js';
import { refresh } from '../state.js';

export function MyPanel({ state, me }) {
  const { people, ratings } = state;
  const meP = people.find(p => p.id === me);
  const raters = initialRaterCount(me, ratings);
  const enough = hasEnoughRaters(me, ratings);

  const mySeries = useMemo(
    () => enough ? medianSeries(me, people, ratings, 45) : [],
    [me, people, ratings, enough],
  );
  const myNow = mySeries[mySeries.length - 1]?.value ?? null;
  const myTrend = useMemo(
    () => enough ? weeklyTrend(me, people, ratings) : null,
    [me, people, ratings, enough],
  );
  const { peak, low } = useMemo(
    () => enough ? peakLow(me, people, ratings) : { peak: null, low: null },
    [me, people, ratings, enough],
  );

  const incoming = useMemo(() => {
    const m = new Map();
    for (const r of ratings) {
      if (r.ratee_id !== me || r.kind !== 'delta') continue;
      const k = r.rater_id + '|' + r.date;
      const prev = m.get(k);
      if (!prev || String(prev.ts) < String(r.ts)) m.set(k, r);
    }
    return [...m.values()]
      .filter(r => r.note && String(r.note).trim())
      .sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1))
      .map(r => ({ ...r, raterName: people.find(p => p.id === r.rater_id)?.name || '?' }));
  }, [ratings, me, people]);

  const outgoing = useMemo(() => people
    .filter(p => p.id !== me)
    .map(p => ({ id: p.id, name: p.name, score: scoreFor(me, p.id, ratings) }))
    .filter(x => x.score !== null)
    .sort((a, b) => b.score - a.score), [me, people, ratings]);

  const myNotes = useMemo(() => {
    const m = new Map();
    for (const r of ratings) {
      if (r.rater_id !== me || r.kind !== 'delta') continue;
      const k = r.ratee_id + '|' + r.date;
      const prev = m.get(k);
      if (!prev || String(prev.ts) < String(r.ts)) m.set(k, r);
    }
    return [...m.values()]
      .filter(r => r.note && String(r.note).trim())
      .sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1))
      .map(r => ({ ...r, rateeName: people.find(p => p.id === r.ratee_id)?.name || '?' }));
  }, [ratings, me, people]);

  return html`
    <div>
      <${Kicker}>MY COLUMN · ВАШ ЛИЧНЫЙ ВЫПУСК</${Kicker}>
      <h2 class="headline">${meP?.name || 'Гость'}</h2>
      <p class="deck">Что редакция думает о вас, и что вы говорите о других.</p>
      <hr class="rule-single" />

      <div class="cols">
        <main>
          ${enough ? html`
            <div style="display:flex; gap: 48px; align-items: baseline; flex-wrap: wrap;">
              <div>
                <div class="display-num">${myNow !== null ? myNow.toFixed(1) : '—'}</div>
                <div class="display-num-sub">ТЕКУЩАЯ МЕДИАНА</div>
              </div>
              <div>
                <div class="display-num sm"><${TrendArrow} delta=${myTrend} /></div>
                <div class="display-num-sub">ЗА 7 ДНЕЙ</div>
              </div>
              <div>
                <div class="display-num xs">
                  ${peak?.value !== undefined && peak?.value !== null ? peak.value.toFixed(1) : '—'} /
                  ${low?.value !== undefined && low?.value !== null ? low.value.toFixed(1) : '—'}
                </div>
                <div class="display-num-sub">ПИК / ДНО</div>
              </div>
            </div>

            <div class="mt-8">
              <${Kicker}>ДИНАМИКА · 45 ДНЕЙ</${Kicker}>
              <${Sparkline} series=${mySeries} />
            </div>
          ` : html`
            <div style="padding: 16px 0 8px;">
              <div class="display-num" style="color: var(--ink-faint);">—</div>
              <div class="display-num-sub">ВАША МЕДИАНА ПОКА СКРЫТА</div>
              <p class="muted mt-4" style="font-style: italic; max-width: 60ch;">
                ${`Пока ${raters} из ${MIN_RATERS_FOR_SCORE} коллег выставили вам стартовую оценку. Когда наберётся три — медиана и тренд отобразятся на всех экранах.`}
              </p>
            </div>
          `}

          <div class="mt-8">
            <${Kicker}>ВХОДЯЩИЕ КОЛОНКИ О ВАС · ${incoming.length}</${Kicker}>
            ${incoming.length ? incoming.slice(0, 20).map((n, i) => html`
              <article class="article">
                <div class="article-kicker">
                  <span>${n.raterName}</span>
                  <span>${n.date}</span>
                  <span>${n.value > 0 ? '+1' : n.value < 0 ? '−1' : '0'}</span>
                </div>
                <p class=${'article-body' + (i === 0 ? ' dropcap' : '')}>${n.note}</p>
              </article>
            `) : html`<p class="muted"><em>О вас пока никто не писал.</em></p>`}
          </div>

          <div class="mt-8">
            <${Kicker}>ВАШИ ЗАМЕТКИ · ${myNotes.length}</${Kicker}>
            ${myNotes.length
              ? myNotes.slice(0, 30).map(n => html`<${EditableNote} me=${me} n=${n} />`)
              : html`<p class="muted"><em>Пока ни одной строки не написали.</em></p>`}
          </div>
        </main>

        <aside>
          <${Kicker}>ВАШИ ТЕКУЩИЕ ОЦЕНКИ</${Kicker}>
          <table class="ledger" style="font-size: 14px;">
            <tbody>
              ${outgoing.map(x => html`
                <tr class="clickable" onClick=${() => { location.hash = '#/person/' + x.id; }}>
                  <td style="font-family: var(--font-display); font-weight: 600;">${x.name}</td>
                  <td class="num" style="text-align: right;">${x.score.toFixed(1)}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </aside>
      </div>
    </div>
  `;
}

function EditableNote({ me, n }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(n.note);
  const [saving, setSaving] = useState(false);

  async function save() {
    try {
      setSaving(true);
      if (text.trim() === '') await deleteNote(me, n.ratee_id, n.date);
      else await editNote(me, n.ratee_id, n.date, text);
      await refresh();
      setEditing(false);
    } catch (e) {
      alert('Ошибка: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Удалить колонку? Оценка ±1 останется.')) return;
    try {
      setSaving(true);
      await deleteNote(me, n.ratee_id, n.date);
      await refresh();
    } catch (e) {
      alert('Ошибка: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return html`
    <article class="article">
      <div class="article-kicker">
        <span>${n.rateeName}</span>
        <span>${n.date}</span>
        <span>${n.value > 0 ? '+1' : n.value < 0 ? '−1' : '0'}</span>
      </div>
      ${editing ? html`
        <textarea value=${text} onInput=${e => setText(e.target.value)} disabled=${saving} />
        <div class="mt-4" style="display:flex; gap: 8px;">
          <button class="solid" onClick=${save} disabled=${saving}>СОХРАНИТЬ</button>
          <button class="ghost" onClick=${() => { setText(n.note); setEditing(false); }} disabled=${saving}>ОТМЕНА</button>
        </div>
      ` : html`
        <p class="article-body">${n.note}</p>
        <div class="article-meta">
          <a href="javascript:void(0)" onClick=${() => setEditing(true)}>ПРАВИТЬ</a>
          <a href="javascript:void(0)" onClick=${remove}>УДАЛИТЬ</a>
        </div>
      `}
    </article>
  `;
}
