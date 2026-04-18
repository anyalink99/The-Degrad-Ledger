import { useState, useEffect } from 'preact/hooks';
import { bootstrap } from './api.js';

class Store {
  constructor(initial) {
    this.state = initial;
    this.subs = new Set();
  }
  set(patch) {
    this.state = { ...this.state, ...(typeof patch === 'function' ? patch(this.state) : patch) };
    for (const s of this.subs) s(this.state);
  }
  subscribe(fn) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }
}

export const store = new Store({
  loading: true,
  error: null,
  people: [],
  ratings: [],
  adminId: null,
});

export async function refresh() {
  try {
    if (!store.state.people.length) store.set({ loading: true, error: null });
    const data = await bootstrap();
    store.set({
      loading: false,
      error: null,
      people: data.people || [],
      ratings: data.ratings || [],
      adminId: data.adminId || null,
    });
  } catch (e) {
    store.set({ loading: false, error: String(e.message || e) });
  }
}

export function useStore() {
  const [s, setS] = useState(store.state);
  useEffect(() => store.subscribe(setS), []);
  return s;
}
