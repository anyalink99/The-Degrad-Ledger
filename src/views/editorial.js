import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { createPerson } from '../api.js';
import { refresh } from '../state.js';
import { Kicker } from '../components.js';

export function Editorial({ state, me }) {
  const { people, adminId } = state;
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  if (adminId && me !== adminId) {
    return html`
      <div class="center" style="padding: 100px 0;">
        <${Kicker}>EDITORIAL</${Kicker}>
        <h2 class="headline">Редакция закрыта для посторонних</h2>
        <p class="deck" style="margin: 0 auto;">Раздел EDITORIAL доступен только редактору.</p>
      </div>
    `;
  }

  async function add() {
    if (!name.trim()) return;
    try {
      setSaving(true);
      await createPerson(me, name.trim());
      await refresh();
      setName('');
    } catch (e) {
      alert('Ошибка: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return html`
    <div>
      <${Kicker}>EDITORIAL · РЕДАКЦИОННАЯ ЛОЖА</${Kicker}>
      <h2 class="headline">Редакторские функции</h2>
      <p class="deck">
        Добавляйте сотрудников. После появления в списке они смогут зайти как свой профиль и пройти первый круг.
      </p>
      <hr class="rule-single" />

      <div class="cols">
        <main>
          <div class="field" style="max-width: 520px;">
            <label>ИМЯ НОВОГО СОТРУДНИКА</label>
            <input
              type="text"
              value=${name}
              onInput=${e => setName(e.target.value)}
              onKeyDown=${e => e.key === 'Enter' && add()}
              placeholder="Как его зовут в компашке…"
            />
          </div>
          <button class="solid" onClick=${add} disabled=${saving || !name.trim()}>ВКЛЮЧИТЬ В СОСТАВ</button>
        </main>

        <aside>
          <${Kicker}>СОСТАВ РЕДАКЦИИ · ${people.length}</${Kicker}>
          <ul style="list-style:none; padding: 0; margin: 0;">
            ${people.map(p => html`
              <li style="padding: 10px 0; border-bottom: 1px solid var(--rule-soft); display:flex; justify-content:space-between; align-items: baseline;">
                <span style="font-family: var(--font-display); font-weight: 600;">${p.name}</span>
                <span class="small-caps muted" style="font-size: 10px;">${p.id === adminId ? 'РЕДАКТОР' : ''}</span>
              </li>
            `)}
          </ul>
        </aside>
      </div>
    </div>
  `;
}
