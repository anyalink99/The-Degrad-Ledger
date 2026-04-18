// Trust-based identity: stored locally, announced via all writes.
// The public audit log is the only enforcement of "one person, one profile".

const KEY = 'ledger.me';

export function getMe() {
  return localStorage.getItem(KEY);
}

export function setMe(personId) {
  localStorage.setItem(KEY, personId);
}

export function clearMe() {
  localStorage.removeItem(KEY);
}
