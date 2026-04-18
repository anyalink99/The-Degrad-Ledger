import { html } from 'htm/preact';
import { useMemo } from 'preact/hooks';
import { medianScoreAt, weeklyTrend, badgesFor, climbers, medianSeries } from '../compute.js';
import { Kicker, TrendArrow, Sparkline, Badges } from '../components.js';

export function Leaderboard({ state, me }) {
  const { people, ratings } = state;

  const rows = useMemo(() => people.map(p => ({
    id: p.id,
    name: p.name,
    isMe: p.id === me,
    median: medianScoreAt(p.id, people, ratings),
    trend: weeklyTrend(p.id, people, ratings),
    badges: badgesFor(p.id, people, ratings),
  }))
  .filter(r => r.median !== null)
  .sort((a, b) => (b.median ?? -Infinity) - (a.median ?? -Infinity)), [people, ratings, me]);

  const climberList = useMemo(
    () => climbers(people, ratings).filter(c => c.delta > 0).slice(0, 3),
    [people, ratings],
  );
  const topClimber = climberList[0];
  const topSeries = useMemo(
    () => (topClimber ? medianSeries(topClimber.id, people, ratings, 30) : []),
    [topClimber, people, ratings],
  );

  if (people.length < 2) {
    return html`
      <div class="center" style="padding: 100px 0;">
        <${Kicker}>СЕГОДНЯШНИЙ ВЫПУСК</${Kicker}>
        <h2 class="headline">Редакция ждёт наборщиков</h2>
        <p class="deck" style="margin: 0 auto;">
          Пока в составе меньше двух человек, оценивать некого. Загляните в EDITORIAL и добавьте коллег.
        </p>
      </div>
    `;
  }

  if (!rows.length) {
    return html`
      <div class="center" style="padding: 100px 0;">
        <${Kicker}>ТИХИЙ НОМЕР</${Kicker}>
        <h2 class="headline">Стартовые оценки ещё не выставлены</h2>
        <p class="deck" style="margin: 0 auto;">
          Все коллеги должны пройти первый круг — по 0–50 на каждого. Пока этого не случилось, медианы нет.
        </p>
      </div>
    `;
  }

  return html`
    <div class="cols">
      <main>
        <${Kicker}>СТОЛ РАНГОВ · ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase()}</${Kicker}>
        <h2 class="headline">Медианный приговор редакции</h2>
        <p class="deck">Каждая строка — человек, оценённый остальными. Щёлкните, чтобы развернуть карточку.</p>
        <table class="ledger">
          <thead>
            <tr>
              <th>№</th>
              <th>Имя</th>
              <th class="num" style="text-align: right;">Медиана</th>
              <th class="num" style="text-align: right;">7 дней</th>
              <th>Отметки</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => html`
              <tr class="clickable" onClick=${() => { location.hash = '#/person/' + r.id; }}>
                <td class="rank">${(i + 1).toString().padStart(2, '0')}</td>
                <td class="name">${r.name}${r.isMe ? html` <span class="small-caps muted" style="font-size: 10px;">· ВЫ</span>` : ''}</td>
                <td class="num" style="text-align: right;">${r.median.toFixed(1)}</td>
                <td class="num" style="text-align: right;"><${TrendArrow} delta=${r.trend} /></td>
                <td><${Badges} list=${r.badges} /></td>
              </tr>
            `)}
          </tbody>
        </table>
      </main>
      <aside>
        <${Kicker}>ГЛАВНАЯ ИСТОРИЯ · В ПРАЙМЕ</${Kicker}>
        ${topClimber ? html`
          <div class="article">
            <div class="display-num" style="color: var(--oxblood);">+${topClimber.delta.toFixed(1)}</div>
            <div class="display-num-sub">ЗА 7 ДНЕЙ</div>
            <h3 class="article-head mt-4">${topClimber.name}</h3>
            <p class="article-body">
              Самый заметный рост этой недели. Текущая медиана коллег —
              <strong>${topClimber.median?.toFixed(1) ?? '—'}</strong>.
            </p>
            <${Sparkline} series=${topSeries} />
            <div class="article-meta">
              <a href="#/person/${topClimber.id}">ПОДРОБНЕЕ →</a>
            </div>
          </div>
        ` : html`<p class="muted"><em>На неделе без движений.</em></p>`}

        ${climberList.length > 1 ? html`
          <${Kicker}>ОСТАЛЬНЫЕ КЛАЙМБЕРЫ</${Kicker}>
          <ul style="list-style:none; padding: 0; margin: 4px 0 0;">
            ${climberList.slice(1).map(c => html`
              <li style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid var(--rule-soft);">
                <a href="#/person/${c.id}" style="color:inherit; text-decoration:none;">${c.name}</a>
                <span class="num">+${c.delta.toFixed(1)}</span>
              </li>
            `)}
          </ul>
        ` : null}
      </aside>
    </div>
  `;
}
