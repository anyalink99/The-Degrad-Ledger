import { html } from 'htm/preact';
import { useMemo, useState } from 'preact/hooks';
import { Kicker } from '../components.js';

export function NotesFeed({ state }) {
  const { people, ratings } = state;
  const [filter, setFilter] = useState('');

  const feed = useMemo(() => {
    const m = new Map();
    for (const r of ratings) {
      if (r.kind !== 'delta') continue;
      const k = r.rater_id + '|' + r.ratee_id + '|' + r.date;
      const prev = m.get(k);
      if (!prev || String(prev.ts) < String(r.ts)) m.set(k, r);
    }
    const all = [...m.values()]
      .filter(r => r.note && String(r.note).trim())
      .sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1))
      .map(r => ({
        ...r,
        raterName: people.find(p => p.id === r.rater_id)?.name || '?',
        rateeName: people.find(p => p.id === r.ratee_id)?.name || '?',
      }));
    if (!filter) return all;
    const f = filter.toLowerCase();
    return all.filter(x =>
      x.raterName.toLowerCase().includes(f) ||
      x.rateeName.toLowerCase().includes(f) ||
      String(x.note).toLowerCase().includes(f)
    );
  }, [ratings, people, filter]);

  return html`
    <div>
      <${Kicker}>NOTICES · КОЛОНКИ НЕДЕЛИ, МЕСЯЦА, ЭПОХИ</${Kicker}>
      <h2 class="headline">Редакционные колонки</h2>
      <p class="deck">Все заметки всех коллег в хронологическом порядке. Фильтр по имени, объекту или фрагменту текста.</p>
      <hr class="rule-single" />
      <div class="field" style="max-width: 460px;">
        <label>ПОИСК</label>
        <input type="text" placeholder="Имя или фрагмент…" value=${filter} onInput=${e => setFilter(e.target.value)} />
      </div>

      <div class="cols-2 mt-6">
        ${feed.length ? feed.map((n, i) => html`
          <article class="article">
            <div class="article-kicker">
              <span>${n.raterName} → ${n.rateeName}</span>
              <span>${n.date}</span>
              <span>${n.value > 0 ? '+1' : n.value < 0 ? '−1' : '0'}</span>
            </div>
            <p class=${'article-body' + (i < 2 ? ' dropcap' : '')}>${n.note}</p>
          </article>
        `) : html`<p class="muted"><em>Пока ни одной колонки не написано.</em></p>`}
      </div>
    </div>
  `;
}
