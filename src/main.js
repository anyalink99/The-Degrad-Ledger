import { html } from 'htm/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Masthead, Nav, Colophon } from './components.js';
import { useStore, refresh } from './state.js';
import { getMe, clearMe } from './identity.js';
import { getEndpoint } from './api.js';

import { Leaderboard } from './views/leaderboard.js';
import { PersonView } from './views/person.js';
import { DailyRound } from './views/daily-round.js';
import { MyPanel } from './views/my-panel.js';
import { NotesFeed } from './views/notes-feed.js';
import { Audit } from './views/audit.js';
import { Editorial } from './views/editorial.js';
import { SeasonView } from './views/season.js';
import { EndpointSetup, Founder, IdentityPicker } from './views/bootstrap-screens.js';

function useRoute() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function App() {
  const state = useStore();
  const route = useRoute();
  const [hasEndpoint, setHasEndpoint] = useState(!!getEndpoint());
  const [meId, setMeIdLocal] = useState(getMe());

  useEffect(() => { if (hasEndpoint) refresh(); }, [hasEndpoint]);

  if (!hasEndpoint) {
    return html`<${EndpointSetup} onDone=${() => setHasEndpoint(true)} />`;
  }

  if (state.loading && !state.people.length) {
    return html`<div class="booting"><div class="booting-label">ПРЕСС НАГРЕВАЕТСЯ…</div></div>`;
  }

  if (state.error) {
    return html`
      <div class="booting">
        <div class="booting-label" style="color: var(--oxblood);">ТИПОГРАФИЯ НЕ ОТВЕЧАЕТ</div>
        <p class="muted" style="font-family: var(--font-body); font-style: italic; margin-top: 16px;">${state.error}</p>
        <div class="mt-6" style="display:flex; gap: 10px; justify-content: center;">
          <button class="solid" onClick=${() => refresh()}>ПОВТОРИТЬ</button>
          <button class="ghost" onClick=${() => { localStorage.removeItem('ledger.endpoint'); location.reload(); }}>СМЕНИТЬ URL</button>
        </div>
      </div>
    `;
  }

  // No admin registered on backend → founder flow
  if (!state.adminId) {
    return html`<${Founder} onDone=${() => setMeIdLocal(getMe())} />`;
  }

  // No local identity chosen
  if (!meId || !state.people.find(p => p.id === meId)) {
    return html`
      <${Masthead} issueNo=${state.ratings.length} />
      <${IdentityPicker} state=${state} onPicked=${() => setMeIdLocal(getMe())} />
      <${Colophon} />
    `;
  }

  const isAdmin = state.adminId === meId;
  const meName = state.people.find(p => p.id === meId)?.name || 'GUEST';
  const primary = '/' + (route.split('/')[1] || '');

  let body;
  if (route === '/') body = html`<${Leaderboard} state=${state} me=${meId} />`;
  else if (route === '/dispatch') body = html`<${DailyRound} state=${state} me=${meId} />`;
  else if (route === '/me') body = html`<${MyPanel} state=${state} me=${meId} />`;
  else if (route === '/notices') body = html`<${NotesFeed} state=${state} me=${meId} />`;
  else if (route === '/ledger') body = html`<${Audit} state=${state} me=${meId} />`;
  else if (route === '/season') body = html`<${SeasonView} state=${state} me=${meId} />`;
  else if (route === '/editorial') body = html`<${Editorial} state=${state} me=${meId} />`;
  else if (route.startsWith('/person/')) {
    const id = route.slice('/person/'.length);
    body = html`<${PersonView} state=${state} me=${meId} id=${id} />`;
  } else {
    body = html`<p class="center muted">Страница не найдена. <a href="#/">На главную</a></p>`;
  }

  return html`
    <${Masthead} issueNo=${state.ratings.length} />
    <${Nav} route=${primary} isAdmin=${isAdmin} />
    <p class="center small-caps muted" style="font-size: 10px; margin: 10px 0 22px;">
      ВХОД ОТ ЛИЦА · <strong style="color: var(--ink);">${meName}</strong>
      <span style="margin: 0 10px;">·</span>
      <a href="javascript:void(0)" onClick=${() => { clearMe(); setMeIdLocal(null); }} style="color: inherit;">ПЕРЕОПОЗНАТЬСЯ</a>
      <span style="margin: 0 10px;">·</span>
      <a href="javascript:void(0)" onClick=${() => refresh()} style="color: inherit;">ОБНОВИТЬ</a>
    </p>
    ${body}
    <${Colophon} />
  `;
}

render(html`<${App} />`, document.getElementById('app'));
