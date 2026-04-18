// Apps Script web-app client. One endpoint, POST with text/plain body (avoids CORS preflight).

const ENDPOINT_KEY = 'ledger.endpoint';

export function getEndpoint() {
  return localStorage.getItem(ENDPOINT_KEY) || '';
}

export function setEndpoint(url) {
  localStorage.setItem(ENDPOINT_KEY, url.trim());
}

export function clearEndpoint() {
  localStorage.removeItem(ENDPOINT_KEY);
}

async function call(action, payload = {}) {
  const endpoint = getEndpoint();
  if (!endpoint) throw new Error('Endpoint не задан');
  const res = await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Не JSON: ' + text.slice(0, 120)); }
  if (!data.ok) throw new Error(data.error || 'Неизвестная ошибка');
  return data;
}

export const bootstrap       = ()                                    => call('bootstrap');
export const createPerson    = (rater_id, name)                      => call('create_person',  { rater_id, name });
export const setInitial      = (rater_id, ratee_id, value)           => call('set_initial',    { rater_id, ratee_id, value });
export const setDelta        = (rater_id, ratee_id, delta, note)     => call('set_delta',      { rater_id, ratee_id, delta, note: note || '' });
export const editNote        = (rater_id, ratee_id, date, note)      => call('edit_note',      { rater_id, ratee_id, date, note });
export const deleteNote      = (rater_id, ratee_id, date)            => call('delete_note',    { rater_id, ratee_id, date });
