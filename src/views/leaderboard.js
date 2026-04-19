import { html } from 'htm/preact';
import { useMemo } from 'preact/hooks';
import {
  medianScoreAt, weeklyTrend, badgesFor, climbers, medianSeries,
  hasEnoughRaters, initialRaterCount, MIN_RATERS_FOR_SCORE,
} from '../compute.js';
import { Kicker, TrendArrow, Sparkline, Badges } from '../components.js';

export function Leaderboard({ state, me }) {
  const { people, ratings } = state;

  const rows = useMemo(() => people.map(p => {
    const raters = initialRaterCount(p.id, ratings);
    const enough = raters >= MIN_RATERS_FOR_SCORE;
    return {
      id: p.id,
      name: p.name,
      isMe: p.id === me,
      raters,
      enough,
      median: enough ? medianScoreAt(p.id, people, ratings) : null,
      trend:  enough ? weeklyTrend(p.id, people, ratings) : null,
      badges: enough ? badgesFor(p.id, people, ratings) : [],
    };
  }).sort((a, b) => {
    if (a.enough !== b.enough) return a.enough ? -1 : 1;
    if (a.enough) return (b.median ?? -Infinity) - (a.median ?? -Infinity);
    return a.name.localeCompare(b.name, 'ru');
  }), [people, ratings, me]);

  const climberList = useMemo(
    () => climbers(people, ratings).filter(c => hasEnoughRaters(c.id, ratings) && c.delta > 0).slice(0, 3),
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

  return html`
    <div class="cols">
      <main>
        <${Kicker}>СТОЛ РАНГОВ · ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase()}</${Kicker}>
        <h2 class="headline">Медианный приговор редакции</h2>
        <p class="deck">
          Каждая строка — человек, оценённый остальными. Медиана появляется после ${MIN_RATERS_FOR_SCORE} стартовых оценок.
          Щёлкните, чтобы развернуть карточку.
        </p>
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
              <tr class=${'clickable' + (r.enough ? '' : ' pending')} onClick=${() => { location.hash = '#/person/' + r.id; }}>
                <td class="rank">${r.enough ? (i + 1).toString().padStart(2, '0') : '—'}</td>
                <td class="name">${r.name}${r.isMe ? html` <span class="small-caps muted" style="font-size: 10px;">· ВЫ</span>` : ''}</td>
                <td class="num" style="text-align: right;">${r.median !== null ? r.median.toFixed(1) : '—'}</td>
                <td class="num" style="text-align: right;">${r.trend !== null ? html`<${TrendArrow} delta=${r.trend} />` : html`<span class="trend flat">—</span>`}</td>
                <td>${r.enough
                  ? html`<${Badges} list=${r.badges} />`
                  : html`<span class="small-caps muted" style="font-size: 10px;">${r.raters} ИЗ ${MIN_RATERS_FOR_SCORE} СТАРТОВЫХ</span>`}</td>
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
