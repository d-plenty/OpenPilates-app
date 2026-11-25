// Where the person is in the app: a tab, and the screens opened on top of it. Going back always
// returns to exactly the screen before, as it was left.
import { useSyncExternalStore } from 'react';

export type Tab = 'classes' | 'calendar' | 'library' | 'more';
export interface Route { name: string; id?: string; [k: string]: unknown }

interface NavState { tab: Tab; stacks: Record<Tab, Route[]>; play?: { classId: string; studioId: string } }
let state: NavState = { tab: 'classes', stacks: { classes: [], calendar: [], library: [], more: [] } };
const listeners = new Set<() => void>();
const set = (next: NavState) => { state = next; listeners.forEach((l) => l()); };

export const nav = {
  get: () => state,
  /** Open a screen on top of the current tab. */
  go(route: Route, tab: Tab = state.tab) { set({ ...state, tab, stacks: { ...state.stacks, [tab]: [...state.stacks[tab], route] } }); },
  /** Replace the screen on top (after making something new, so back doesn't return to the form). */
  swap(route: Route) { const s = state.stacks[state.tab]; set({ ...state, stacks: { ...state.stacks, [state.tab]: [...s.slice(0, -1), route] } }); },
  back() { const s = state.stacks[state.tab]; if (s.length) set({ ...state, stacks: { ...state.stacks, [state.tab]: s.slice(0, -1) } }); },
  /** Tapping the tab you are on goes back to its first screen. */
  tab(tab: Tab) { set(tab === state.tab ? { ...state, stacks: { ...state.stacks, [tab]: [] } } : { ...state, tab }); },
  home(tab: Tab) { set({ ...state, tab, stacks: { ...state.stacks, [tab]: [] } }); },
  play(classId: string, studioId: string) { set({ ...state, play: { classId, studioId } }); },
  stopPlay() { set({ ...state, play: undefined }); },
  reset() { set({ tab: 'classes', stacks: { classes: [], calendar: [], library: [], more: [] } }); },
};

export function useNav(): NavState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

// What a screen was showing (a search, a filter), kept while the app is open so coming back finds it.
const views = new Map<string, unknown>();
export function viewState<T extends object>(key: string, defaults: T): T {
  if (!views.has(key)) views.set(key, { ...defaults });
  return views.get(key) as T;
}
