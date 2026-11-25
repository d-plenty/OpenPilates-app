// Everything the app knows, in memory, with one way to change it. Each change is written to the
// device a moment later. Nothing here talks to a network.
import { useSyncExternalStore } from 'react';
import { analyze, applyStudioLists, flowTiming } from '../engine';
import { cleanData, emptyData, nowIso, uid } from './clean';
import { LIBRARY, LIBRARY_SERIES } from './library';
import { loadText, noteLoaded, saveText } from './storage';
import type { ClassPlan, Data, Movement, Series, Setup, Studio } from './types';

let data: Data = emptyData();
let version = 0;
let ready = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveProblem = '';
let appliedSetup: Setup | null = null;

const notify = () => { version++; listeners.forEach((l) => l()); };
const followSetup = () => { if (appliedSetup !== data.setup) { applyStudioLists(data.setup); appliedSetup = data.setup; cache = null; } };

export const getData = () => data;
export const isReady = () => ready;
export const saveError = () => saveProblem;

export async function boot(): Promise<void> {
  const { text, previous } = await loadText();
  let loaded: Data | null = null;
  for (const t of [text, previous]) {
    if (!t) continue;
    try { loaded = cleanData(JSON.parse(t)); break; } catch { /* try the copy from before */ }
  }
  data = loaded || emptyData();
  noteLoaded(text);
  followSetup();
  ready = true;
  notify();
}

export function flushSave(): Promise<void> {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  return saveText(JSON.stringify(data)).then(() => { saveProblem = ''; }, (e: unknown) => { saveProblem = e instanceof Error ? e.message : 'Could not save.'; notify(); });
}
const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => void flushSave(), 500); };

/** Change what the app keeps. `fn` gets a shallow copy: replace the parts that change, don't edit them in place. */
export function update(fn: (d: Data) => void): void {
  const next = { ...data };
  fn(next);
  data = next;
  followSetup();
  notify();
  scheduleSave();
}
/** Swap in a whole new set of data (a restore). */
export function replaceAll(next: Data): void {
  data = next;
  cache = null;
  followSetup();
  notify();
  scheduleSave();
}

export function useData(): Data {
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version);
  return data;
}

// ---- movements: the library with this device's own on top
interface Lib { map: Record<string, Movement>; list: Movement[]; removed: Movement[]; series: Series[]; key: unknown[] }
let cache: Lib | null = null;
export function library(): Lib {
  const key = [data.movements, data.hidden, data.shown, data.series, data.hiddenSeries];
  if (cache && cache.key.every((k, i) => k === key[i])) return cache;
  const map: Record<string, Movement> = {};
  for (const m of LIBRARY) map[m.slug] = m;
  for (const m of Object.values(data.movements)) map[m.slug] = { ...m, source: 'mine' };
  const hide = new Set(data.hidden);
  const show = new Set(data.shown);
  for (const slug of Object.keys(map)) {
    const m = map[slug];
    if (hide.has(slug) || (m.retired && !show.has(slug))) map[slug] = { ...m, hidden: true };
  }
  const all = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  const hs = new Set(data.hiddenSeries);
  const mine = new Set(data.series.map((s) => s.slug));
  const series = [...LIBRARY_SERIES.filter((s) => !mine.has(s.slug)), ...data.series].filter((s) => !hs.has(s.slug)).sort((a, b) => a.name.localeCompare(b.name));
  cache = { map, list: all.filter((m) => !m.hidden), removed: all.filter((m) => m.hidden), series, key };
  return cache;
}
export const isLibrary = (slug: string) => LIBRARY.some((m) => m.slug === slug);
export const libraryVersion = (slug: string) => LIBRARY.find((m) => m.slug === slug);

// ---- studios
export const NO_STUDIO: Studio = { id: '', name: 'No studio yet', hasReformers: true, brand: 'balanced_body', reformers: 0, springs: {}, springOverrides: {}, props: {}, classTypes: [], updatedAt: '' };
export function studioOf(id?: string): Studio {
  return data.studios.find((s) => s.id === id) || data.studios.find((s) => s.id === data.settings.usualStudio) || data.studios[0] || NO_STUDIO;
}
export const usualStudio = () => studioOf(data.settings.usualStudio);
/** What the engine calls a room: the springs a studio's reformers have. */
export const roomOf = (s: Studio) => ({ id: s.id, name: s.name, brand: s.brand, springs: s.springs, springOverrides: s.springOverrides });
/** The studio settings the engine's checks read: this studio's props, with the shared class set-up. */
export const engineStudio = (s: Studio) => ({ props: s.props, targets: data.setup.targets, timing: data.setup.timing, classTypes: data.setup.classTypes, timingRows: data.setup.timingRows });
export const timingFor = (plan: ClassPlan) => flowTiming({ timing: data.setup.timing, classTypes: data.setup.classTypes }, plan) as Record<string, number>;
export const analyse = (plan: ClassPlan, studio: Studio) => analyze({ flow: plan, movements: library().map, studio: engineStudio(studio), clients: [] });

// ---- classes
export function saveClass(plan: ClassPlan): void {
  const next = { ...plan, updatedAt: nowIso() };
  update((d) => { d.classes = d.classes.some((c) => c.id === plan.id) ? d.classes.map((c) => (c.id === plan.id ? next : c)) : [next, ...d.classes]; });
}
export const classOf = (id: string) => data.classes.find((c) => c.id === id);
export function removeClass(id: string): void { update((d) => { d.classes = d.classes.filter((c) => c.id !== id); }); }
export function duplicateClass(id: string): ClassPlan | undefined {
  const c = classOf(id);
  if (!c) return undefined;
  const copy: ClassPlan = { ...structuredClone(c), id: uid('c'), title: `${c.title} (copy)`, createdAt: nowIso(), updatedAt: nowIso() };
  delete copy.when;
  delete copy.from;
  update((d) => { d.classes = [copy, ...d.classes]; });
  return copy;
}
export function logTaught(plan: ClassPlan, studio: Studio, minutes: number): void {
  update((d) => { d.taught = [{ id: uid('t'), classId: plan.id, title: plan.title, at: nowIso(), studioId: studio.id || undefined, studioName: studio.name, minutes }, ...d.taught]; });
}
export const lastTaught = (classId: string) => data.taught.find((t) => t.classId === classId);

export function saveStudio(s: Studio): void {
  const next = { ...s, updatedAt: nowIso() };
  update((d) => {
    d.studios = d.studios.some((x) => x.id === s.id) ? d.studios.map((x) => (x.id === s.id ? next : x)) : [...d.studios, next];
    if (!d.settings.usualStudio || !d.studios.some((x) => x.id === d.settings.usualStudio)) d.settings = { ...d.settings, usualStudio: d.studios[0]?.id };
  });
}
export function removeStudio(id: string): void {
  update((d) => {
    d.studios = d.studios.filter((x) => x.id !== id);
    if (d.settings.usualStudio === id) d.settings = { ...d.settings, usualStudio: d.studios[0]?.id };
  });
}
export const setSettings = (patch: Partial<Data['settings']>) => update((d) => { d.settings = { ...d.settings, ...patch }; });
export const setSetup = (fn: (s: Setup) => Setup) => update((d) => { d.setup = fn(d.setup); });

export function saveMovement(mv: Movement): void { update((d) => { d.movements = { ...d.movements, [mv.slug]: { ...mv, source: 'mine' } }; }); }
/** Puts a changed built-in movement back to how it ships, or deletes one made on this device. */
export function dropMovement(slug: string): void { update((d) => { const m = { ...d.movements }; delete m[slug]; d.movements = m; }); }
export function setHidden(slug: string, hidden: boolean): void {
  const retired = !!libraryVersion(slug)?.retired;
  update((d) => {
    d.hidden = hidden && !retired ? [...new Set([...d.hidden, slug])] : d.hidden.filter((x) => x !== slug);
    d.shown = !hidden && retired ? [...new Set([...d.shown, slug])] : d.shown.filter((x) => x !== slug);
  });
}
export function saveSeries(s: Series): void { update((d) => { d.series = [...d.series.filter((x) => x.slug !== s.slug), { ...s, source: 'mine' }]; d.hiddenSeries = d.hiddenSeries.filter((x) => x !== s.slug); }); }
export function removeSeries(slug: string): void {
  update((d) => {
    d.series = d.series.filter((x) => x.slug !== slug);
    if (LIBRARY_SERIES.some((x) => x.slug === slug)) d.hiddenSeries = [...new Set([...d.hiddenSeries, slug])];
  });
}

/** For the tests: start again from nothing, without touching the device. */
export function _reset(next: Data = emptyData()): void { data = next; cache = null; appliedSetup = null; followSetup(); ready = true; version++; }
