import { html } from 'htm/preact';
import { useMemo, useState } from 'preact/hooks';
import { Kicker } from '../components.js';

export function Audit({ state }) {
  const { people, ratings } = state;
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const named = ratings.map(r => ({
      ...r,
      raterName: people.find(p => p.id === r.rater_id)?.name || r.rater_id,
      rateeName: people.find(p => p.id === r.ratee_id)?.name || r.ratee_id,
    })).sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1));
    if (!q) return named.slice(0, 500);
    const f = q.toLowerCase();
    return named.filter(r =>
      r.raterName.toLowerCase().includes(f) ||
      r.rateeName.toLowerCase().includes(f) ||
      String(r.note || '').toLowerCase().includes(f)
    ).slice(0, 500);
  }, [ratings, people, q]);

  return html`
    <div>
      <${Kicker}>LEDGER · ОТКРЫТЫЙ ЖУРНАЛ ДЕЙСТВИЙ</${Kicker}>
      <h2 class="headline">Журнал операций</h2>
      <p class="deck">Все действия в редакции в обратном хронологическом порядке. Последние 500 записей.</p>
      <hr class="rule-single" />
      <div class="field" style="max-width: 460px;">
        <label>ПОИСК</label>
        <input type="text" placeholder="Имя, объект, фрагмент…" value=${q} onInput=${e => setQ(e.target.value)} />
      </div>
      <table class="ledger mt-6">
        <thead>
          <tr>
            <th>Время</th>
            <th>Кто</th>
            <th>Кому</th>
            <th>Операция</th>
            <th class="num" style="text-align: right;">Знач.</th>
            <th>Колонка</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => html`
            <tr>
              <td class="num" style="font-size: 12px; white-space: nowrap;">${String(r.ts).replace('T', ' ').slice(0, 16)}</td>
              <td>${r.raterName}</td>
              <td>${r.rateeName}</td>
              <td class="small-caps" style="font-size: 11px;">${r.kind === 'initial' ? 'СТАРТ' : 'ХОД'}</td>
              <td class="num" style="text-align: right;">${r.value}</td>
              <td style="font-size: 14px; max-width: 280px; font-style: italic;">${r.note || ''}</td>
            </tr>
          `)}
        </tbody>
      </table>
    </div>
  `;
}
