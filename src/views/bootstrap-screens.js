import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { setEndpoint, clearEndpoint, createPerson } from '../api.js';
import { setMe } from '../identity.js';
import { refresh } from '../state.js';
import { Kicker } from '../components.js';

// ===== First-run: configure Apps Script endpoint =====
export function EndpointSetup({ onDone }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');

  function confirm() {
    const u = url.trim();
    if (!u.startsWith('https://')) { setErr('URL должен начинаться с https://'); return; }
    setEndpoint(u);
    onDone();
  }

  return html`
    <div class="identity-picker">
      <${Kicker}>НАСТРОЙКА ТИПОГРАФИИ</${Kicker}>
      <h2 class="headline">Подключите Apps Script</h2>
      <p class="deck" style="margin: 0 auto 24px;">
        Вставьте URL web-приложения Apps Script — это единственный бэкенд, который пишет и читает таблицу.
        Инструкция по развёртыванию — в <code>apps-script/Code.gs</code>.
      </p>
      <hr class="rule-single" />
      <div class="field" style="text-align: left; max-width: 520px; margin: 20px auto 0;">
        <label>ENDPOINT URL</label>
        <input
          type="text"
          value=${url}
          onInput=${e => { setUrl(e.target.value); setErr(''); }}
          placeholder="https://script.google.com/macros/s/…/exec"
        />
      </div>
      ${err ? html`<p class="muted" style="color: var(--oxblood); font-size: 14px;">${err}</p>` : null}
      <div class="mt-4">
        <button class="solid" onClick=${confirm} disabled=${!url.trim()}>ГОТОВО</button>
      </div>
    </div>
  `;
}

// ===== No-admin state: become founder =====
export function Founder({ onDone }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function confirm() {
    if (!name.trim()) return;
    try {
      setSaving(true);
      const res = await createPerson('', name.trim());
      if (res.person?.id) {
        setMe(res.person.id);
        await refresh();
        onDone();
      } else {
        setErr('Не удалось создать профиль');
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return html`
    <div class="identity-picker">
      <${Kicker}>FOUNDER'S PRESS · ПЕРВЫЙ ЗАПУСК</${Kicker}>
      <h2 class="headline">Редакция ещё не основана</h2>
      <p class="deck" style="margin: 0 auto 24px;">
        Введите своё имя — вы станете редактором и первым сотрудником.
        Дальше в EDITORIAL сможете добавить остальных.
      </p>
      <hr class="rule-single" />
      <div class="field" style="text-align: left; max-width: 420px; margin: 20px auto 0;">
        <label>ВАШЕ ИМЯ</label>
        <input
          type="text"
          value=${name}
          onInput=${e => { setName(e.target.value); setErr(''); }}
          onKeyDown=${e => e.key === 'Enter' && confirm()}
        />
      </div>
      ${err ? html`<p class="muted" style="color: var(--oxblood); font-size: 14px;">${err}</p>` : null}
      <div class="mt-4">
        <button class="solid" onClick=${confirm} disabled=${saving || !name.trim()}>ОСНОВАТЬ</button>
      </div>
    </div>
  `;
}

// ===== Identity picker =====
export function IdentityPicker({ state, onPicked }) {
  const { people } = state;

  return html`
    <div class="identity-picker">
      <${Kicker}>ОПОЗНАНИЕ</${Kicker}>
      <h2 class="headline">Кто вы сегодня?</h2>
      <p class="deck" style="margin: 0 auto 24px;">
        Выберите свой профиль. Правило редакции: один человек — один профиль.
        Всё, что вы делаете, попадает в открытый журнал.
      </p>
      <hr class="rule-single" />
      <div class="options">
        ${people.map(p => html`
          <button onClick=${() => { setMe(p.id); onPicked(); }}>${p.name}</button>
        `)}
      </div>
      ${!people.length ? html`<p class="muted"><em>Редакция пока пуста.</em></p>` : null}
      <p class="mt-6 small-caps muted" style="font-size: 10px;">
        <a href="javascript:void(0)" onClick=${() => { if (confirm('Сбросить настройку Apps Script?')) { clearEndpoint(); location.reload(); } }} style="color: inherit;">СМЕНИТЬ ТИПОГРАФИЮ</a>
      </p>
    </div>
  `;
}
