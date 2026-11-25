// The files the app writes and reads: a backup of everything, one class to share, one studio's
// set-up to share, and the flow and pack files OpenPilates Server exports.
import { cleanData, cleanMovement, cleanPlan, cleanSeries, cleanSetup, cleanStudio, nowIso, slugify, uid } from './clean';
import { getData, isLibrary, library, replaceAll, update } from './store';
import { deleteBackup, listBackups, writeBackup } from './storage';
import type { ClassPlan, Data, Movement, Series, Setup, Studio } from './types';

declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

export class FileProblem extends Error {}

// ---- writing

export function backupText(d: Data = getData()): string {
  return JSON.stringify({ openpilates: 'backup', version: 1, app: APP_VERSION, exportedAt: nowIso(), device: d.settings.deviceName, data: d });
}

/** The movements a class uses that aren't in the built-in library as shipped (made or changed here). */
export function ownMovementsOf(plan: ClassPlan): Movement[] {
  const mine = getData().movements;
  const slugs = new Set(plan.segments.flatMap((s) => s.items.map((i) => i.slug)).filter(Boolean) as string[]);
  return [...slugs].map((s) => mine[s]).filter(Boolean);
}

export interface ClassShare { movements: boolean; studio: boolean }
export function classText(plan: ClassPlan, studio: Studio | undefined, take: ClassShare): string {
  const flow: Record<string, unknown> = { ...plan };
  delete flow.id; delete flow.when; delete flow.studioId; delete flow.from;
  return JSON.stringify({
    openpilates: 'flow', version: 1, app: APP_VERSION, exportedAt: nowIso(), from: getData().settings.deviceName,
    flow, movements: take.movements ? ownMovementsOf(plan) : [], ...(take.studio && studio && studio.id ? { studio } : {}),
  });
}
export const studioText = (studio: Studio) => JSON.stringify({ openpilates: 'studio', version: 1, app: APP_VERSION, exportedAt: nowIso(), studio });
export const fileNameFor = (title: string, kind: 'class' | 'studio' | 'backup') => {
  const stamp = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${stamp.getFullYear()}-${p(stamp.getMonth() + 1)}-${p(stamp.getDate())}`;
  if (kind === 'backup') return `openpilates-backup-${day}-${p(stamp.getHours())}${p(stamp.getMinutes())}.json`;
  return `${slugify(title) || kind}.openpilates${kind === 'studio' ? '-studio' : ''}.json`;
};

// ---- reading

export interface Incoming {
  kind: 'backup' | 'class' | 'studio' | 'pack';
  from: string;
  madeAt: string;
  classes: ClassPlan[];
  movements: Movement[];
  series: Series[];
  studios: Studio[];
  setup?: Setup;
  hidden: string[];
  shown: string[];
  backup?: Data;
}

export function readIncoming(text: string): Incoming {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new FileProblem("That file couldn't be read. It doesn't look like an OpenPilates file.");
  }
  if (!j || typeof j !== 'object') throw new FileProblem("That isn't an OpenPilates file.");
  const from = typeof j.from === 'string' ? j.from.slice(0, 60) : typeof j.device === 'string' ? j.device.slice(0, 60) : typeof j.studioName === 'string' ? j.studioName.slice(0, 60) : '';
  const madeAt = typeof j.exportedAt === 'string' ? j.exportedAt.slice(0, 30) : '';
  const mvs = (v: unknown) => (Array.isArray(v) ? v.slice(0, 2000).map(cleanMovement).filter(Boolean) : []) as Movement[];
  const base = { from, madeAt, classes: [], movements: [], series: [], studios: [], hidden: [], shown: [] };
  if (j.openpilates === 'backup' && j.data) {
    if (Number(j.version) > 1) throw new FileProblem('That backup was made by a newer OpenPilates. Update the app, then restore it.');
    const d = cleanData(j.data);
    return { ...base, kind: 'backup', backup: d, classes: d.classes, movements: Object.values(d.movements), series: d.series, studios: d.studios, setup: d.setup, hidden: d.hidden, shown: d.shown };
  }
  if (j.openpilates === 'flow' && j.flow) {
    const plan = cleanPlan(j.flow);
    return { ...base, kind: 'class', classes: [{ ...plan, ...(from ? { from } : {}) }], movements: mvs(j.movements), studios: j.studio ? [cleanStudio(j.studio)] : [] };
  }
  if (j.openpilates === 'studio' && j.studio) return { ...base, kind: 'studio', studios: [cleanStudio(j.studio)] };
  if (j.openpilates === 'pack') {
    // From OpenPilates Server: its Studio page becomes the class set-up, and each reformer room a studio.
    const st = (j.studio && typeof j.studio === 'object' ? j.studio : {}) as Record<string, unknown>;
    const rooms = (Array.isArray(st.rooms) ? st.rooms : []) as Record<string, unknown>[];
    const str60 = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');
    const packName = str60(st.name) || from || 'Studio';
    const reformerRooms = rooms.filter((r) => r && r.apparatus !== 'mat');
    const studios = (reformerRooms.length ? reformerRooms : rooms.slice(0, 1)).map((r) => cleanStudio({ ...r, id: undefined, name: reformerRooms.length > 1 ? `${packName} · ${String(r.name || 'room')}` : str60(st.name) || from || String(r.name || 'Studio') }, st.props as Record<string, unknown>));
    const vis = (j.visibility && typeof j.visibility === 'object' ? j.visibility : {}) as Record<string, unknown>;
    const sl = (v: unknown) => (Array.isArray(v) ? v.map(slugify).filter(Boolean).slice(0, 3000) : []);
    return {
      ...base, kind: 'pack', studios,
      setup: Object.keys(st).length ? cleanSetup(st) : undefined,
      movements: mvs(j.movements),
      series: (Array.isArray(j.series) ? j.series.map(cleanSeries).filter(Boolean) : []) as Series[],
      classes: (Array.isArray(j.flows) ? j.flows.slice(0, 2000).map((f) => ({ ...cleanPlan(f), ...(from ? { from } : {}) })) : []) as ClassPlan[],
      hidden: sl(vis.hide), shown: sl(vis.show),
    };
  }
  throw new FileProblem("That isn't an OpenPilates file. Classes end in .openpilates.json; backups start with openpilates-backup.");
}

export interface Take { classes: boolean; movements: boolean; studios: boolean; setup: boolean; series: boolean }
export interface Brought { classes: number; movements: number; studios: number; series: number; setup: boolean; skipped: number; firstClass?: string }

/** Adds what was ticked alongside what is already here. Nothing already on the device is changed, except the class set-up when it is ticked. */
export function bringIn(inc: Incoming, take: Take): Brought {
  const out: Brought = { classes: 0, movements: 0, studios: 0, series: 0, setup: false, skipped: 0 };
  update((d) => {
    if (take.movements && inc.movements.length) {
      const next = { ...d.movements };
      for (const m of inc.movements) {
        // A movement of the same name that is already here stays as it is.
        if (next[m.slug] || (isLibrary(m.slug) && inc.kind === 'class')) { out.skipped++; continue; }
        next[m.slug] = m;
        out.movements++;
      }
      d.movements = next;
    }
    const studioIds = new Map<string, string>();
    if (take.studios && inc.studios.length) {
      const next = [...d.studios];
      for (const s of inc.studios) {
        const same = next.find((x) => x.name.toLowerCase() === s.name.toLowerCase());
        if (same) { studioIds.set(s.id, same.id); out.skipped++; continue; }
        const mine = { ...s, id: uid('st'), updatedAt: nowIso() };
        studioIds.set(s.id, mine.id);
        next.push(mine);
        out.studios++;
      }
      d.studios = next;
      if (!d.settings.usualStudio && next[0]) d.settings = { ...d.settings, usualStudio: next[0].id };
    }
    if (take.series && inc.series.length) {
      const have = new Set(d.series.map((s) => s.slug));
      const add = inc.series.filter((s) => (have.has(s.slug) ? (out.skipped++, false) : true));
      out.series = add.length;
      d.series = [...d.series, ...add];
    }
    if (take.setup && inc.setup) { d.setup = inc.setup; out.setup = true; }
    if (take.classes && inc.classes.length) {
      const fresh = inc.classes.map((c) => ({ ...c, id: uid('c'), ...(c.studioId && studioIds.get(c.studioId) ? { studioId: studioIds.get(c.studioId) } : { studioId: undefined }) }));
      out.classes = fresh.length;
      out.firstClass = fresh[0]?.id;
      d.classes = [...fresh, ...d.classes];
    }
    if (inc.kind === 'pack' && take.movements) {
      d.hidden = [...new Set([...d.hidden, ...inc.hidden])];
      d.shown = [...new Set([...d.shown, ...inc.shown])];
    }
  });
  return out;
}

/** Puts a backup back: either everything here is replaced, or the backup's things are added alongside. */
export function restoreBackup(inc: Incoming, how: 'replace' | 'add'): Brought {
  if (!inc.backup) throw new FileProblem("That file isn't a backup.");
  if (how === 'replace') {
    const b = inc.backup;
    replaceAll({ ...b, settings: { ...b.settings, welcomed: true } });
    return { classes: b.classes.length, movements: Object.keys(b.movements).length, studios: b.studios.length, series: b.series.length, setup: true, skipped: 0 };
  }
  const have = new Set(getData().classes.map((c) => c.id));
  const haveTaught = new Set(getData().taught.map((t) => t.id));
  const out = bringIn({ ...inc, classes: [] }, { classes: false, movements: true, studios: true, setup: false, series: true });
  update((d) => {
    const add = inc.backup!.classes.filter((c) => !have.has(c.id));
    out.classes = add.length;
    out.skipped += inc.backup!.classes.length - add.length;
    d.classes = [...add, ...d.classes];
    d.taught = [...d.taught, ...inc.backup!.taught.filter((t) => !haveTaught.has(t.id))].sort((a, b) => b.at.localeCompare(a.at));
  });
  return out;
}

// ---- automatic backups

const DAY = 20 * 60 * 60 * 1000;
export const hasAnything = (d: Data = getData()) => d.classes.length > 0 || d.studios.length > 0 || Object.keys(d.movements).length > 0;

/** Makes a backup now and keeps only the newest few. */
export async function backupNow(): Promise<string> {
  const d = getData();
  const name = fileNameFor('', 'backup');
  await writeBackup(name, backupText(d));
  update((x) => { x.settings = { ...x.settings, lastBackup: nowIso() }; });
  const all = await listBackups();
  for (const old of all.slice(Math.max(1, d.settings.keepBackups))) await deleteBackup(old.name);
  return name;
}
/** Called when the app opens and when it comes back: a backup if the last one is most of a day old. */
export async function backupIfDue(now = Date.now()): Promise<boolean> {
  const d = getData();
  if (!d.settings.autoBackup || !hasAnything(d)) return false;
  const last = d.settings.lastBackup ? Date.parse(d.settings.lastBackup) : 0;
  if (now - last < DAY) return false;
  await backupNow();
  return true;
}

export const summarise = (inc: Incoming) => ({ classes: inc.classes.length, movements: inc.movements.length, studios: inc.studios.length, series: inc.series.length, setup: !!inc.setup, taught: inc.backup?.taught.length ?? 0 });
export const libraryCount = () => library().list.length;
