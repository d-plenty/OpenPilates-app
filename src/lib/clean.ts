// Everything that comes in from outside the app (a file, a QR send, a backup) goes through here
// first, so a damaged or hand-edited file can't put nonsense into what the app keeps.
import { CATEGORIES, HEADREST, PATTERNS, PLANES, POSE_IDS, POSITIONS, PREGNANCY, ROLES as ROLES_OF_MOVEMENT, SECTIONS, SPINE, STRAPS, BRANDS, DEFAULT_CLASS_TYPES, DEFAULT_FOCUSES, DEFAULT_LENGTHS, DEFAULT_LEVELS, DEFAULT_TARGETS, DEFAULT_TIMING_ROWS, EQUIPMENT, LOAD_LEVELS, SEGMENT_ROLES, isBuiltinTiming, timingFromRows, timingRowsOf, withCoreLevels } from '../engine';
import type { ClassPlan, ClassType, Data, Item, Movement, Named, Segment, Series, Settings, Setup, Studio, Taught, TimingRow } from './types';

export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const nowIso = () => new Date().toISOString();
export const slugify = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const num = (v: unknown, min: number, max: number, dflt: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; };
const list = <T>(v: unknown, max: number): T[] => (Array.isArray(v) ? (v.slice(0, max) as T[]) : []);
const ID = /^[a-z0-9_-]{1,60}$/i;
const LOADS = new Set<string>(LOAD_LEVELS as string[]);
const ROLES = new Set<string>((SEGMENT_ROLES as { id: string }[]).map((r) => r.id));

function cleanItem(i: Record<string, unknown>): Item | null {
  if (!i || typeof i !== 'object') return null;
  const id = str(i.id, 40) || uid('i');
  if (i.pause) return { id, pause: true, label: str(i.label, 60) || 'Break', duration: Math.round(num(i.duration, 5, 3600, 60)), ...(str(i.note, 300) ? { note: str(i.note, 300) } : {}) };
  const slug = slugify(i.slug);
  if (!slug) return null;
  const layers = list<unknown>(i.layers, 8).map((l) => (typeof l === 'string' ? str(l, 20) : l && typeof l === 'object' && str((l as { text?: unknown }).text, 160) ? { text: str((l as { text?: unknown }).text, 160) } : '')).filter(Boolean) as Item['layers'];
  const options = list<Record<string, unknown>>(i.options, 6).filter((o) => o && typeof o === 'object' && str(o.title, 120)).map((o) => ({
    id: str(o.id, 40) || uid('o'), kind: str(o.kind, 20) || 'regression', title: str(o.title, 120),
    ...(Array.isArray(o.springs) ? { springs: (o.springs as unknown[]).map(String).filter((x) => LOADS.has(x)).slice(0, 5) } : {}),
    ...(slugify(o.slug) ? { slug: slugify(o.slug) } : {}), ...(str(o.note, 200) ? { note: str(o.note, 200) } : {}),
  }));
  const load = i.load as { springs?: unknown } | undefined;
  return {
    id, slug,
    ...(Number(i.duration) > 0 ? { duration: Math.round(num(i.duration, 10, 1800, 120)) } : {}),
    ...(str(i.reps, 60) ? { reps: str(i.reps, 60) } : {}),
    ...(str(i.variation, 120) ? { variation: str(i.variation, 120) } : {}),
    ...(layers && layers.length ? { layers } : {}),
    ...(options.length ? { options } : {}),
    ...(str(i.finisher, 160) ? { finisher: str(i.finisher, 160) } : {}),
    ...(str(i.note, 500) ? { note: str(i.note, 500) } : {}),
    ...(load && Array.isArray(load.springs) ? { load: { springs: (load.springs as unknown[]).map(String).filter((x) => LOADS.has(x)).slice(0, 5) } } : {}),
  };
}

export function cleanSegments(v: unknown): Segment[] {
  return list<Record<string, unknown>>(v, 30).filter((s) => s && typeof s === 'object').map((s) => ({
    id: str(s.id, 40) || uid('s'),
    name: str(s.name, 80) || 'Phase',
    role: ROLES.has(String(s.role)) ? String(s.role) : 'build',
    ...(Number(s.minutes) > 0 ? { minutes: Math.round(num(s.minutes, 1, 120, 5)) } : {}),
    ...(s.bothSides ? { bothSides: true } : {}),
    ...(str(s.song, 160) ? { song: str(s.song, 160) } : {}),
    items: list<Record<string, unknown>>(s.items, 60).map(cleanItem).filter(Boolean) as Item[],
  }));
}

/** A class plan from anywhere: this app, another instructor's, or a flow from OpenPilates Server. */
export function cleanPlan(input: unknown, keepId = false): ClassPlan {
  const f = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const segments = cleanSegments(f.segments);
  const when = str(f.when, 16);
  return {
    id: keepId && ID.test(String(f.id || '')) ? String(f.id) : uid('c'),
    title: str(f.title, 120) || 'Untitled class',
    apparatus: (['reformer', 'mat', 'mixed'] as const).find((a) => a === f.apparatus) || 'reformer',
    level: ID.test(String(f.level || '')) ? String(f.level) : 'intermediate',
    lengthMin: Math.round(num(f.lengthMin, 10, 180, 50)),
    ...(str(f.goal, 40) ? { goal: str(f.goal, 40) } : {}),
    ...(str(f.focusText, 60) ? { focusText: str(f.focusText, 60) } : {}),
    ...(f.noPhases ? { noPhases: true } : {}),
    target: str(f.target, 40) || 'general',
    ...(ID.test(String(f.classType || '')) ? { classType: String(f.classType) } : {}),
    springBudget: Math.round(num(f.springBudget, 0, 20, 0)),
    ...(ID.test(String(f.studioId || '')) ? { studioId: String(f.studioId) } : {}),
    ...(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(when) ? { when } : {}),
    ...(str(f.notes, 2000) ? { notes: str(f.notes, 2000) } : {}),
    segments: segments.length ? segments : [{ id: uid('s'), name: 'Class', role: 'build', items: [] }],
    createdAt: str(f.createdAt, 30) || nowIso(),
    updatedAt: str(f.updatedAt, 30) || nowIso(),
    ...(str(f.from, 80) ? { from: str(f.from, 80) } : {}),
  };
}

const idsOf = (l: unknown) => new Set<string>((l as { id: string }[]).map((x) => x.id));
/** The same shape OpenPilates Server keeps, so a movement means the same thing in both. Never throws: what is missing gets a safe value. */
export function cleanMovement(input: unknown): Movement | null {
  const m = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const name = str(m.name, 100);
  const slug = slugify(m.slug || name);
  if (!name || !slug) return null;
  const strs = (v: unknown, n: number, max: number) => list<unknown>(v, n).map((x) => str(x, max)).filter(Boolean);
  const pick = (v: unknown, from: unknown, n: number) => { const ok = idsOf(from); return [...new Set(list<unknown>(v, 40).map(String).filter((x) => ok.has(x)))].slice(0, n); };
  const one = (v: unknown, from: unknown, dflt: string) => (idsOf(from).has(String(v)) ? String(v) : dflt);
  const loads = (v: unknown) => list<unknown>(v, 5).map(String).filter((x) => LOADS.has(x));
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const mu = obj(m.muscles); const ld = obj(m.load); const su = obj(m.setup); const pu = obj(m.purpose); const rv = obj(m.review);
  const apparatus = m.apparatus === 'mat' ? 'mat' : 'reformer';
  // Muscles and props can be the studio's own (Class set-up → lists), so any tidy id is kept.
  const ids = (v: unknown, n: number) => [...new Set(list<unknown>(v, 40).map(String).filter((x) => ID.test(x)))].slice(0, n);
  const primary = ids(mu.primary, 8);
  const lv = ['beginner', 'intermediate', 'advanced'];
  const level = lv.includes(String(m.level)) ? String(m.level) : 'beginner';
  const levelTo = lv.includes(String(m.levelTo)) && lv.indexOf(String(m.levelTo)) >= lv.indexOf(level) ? String(m.levelTo) : level === 'beginner' && !m.levelTo ? 'advanced' : level;
  const spine = pick(m.spine, SPINE, 4);
  const advance = loads(ld.advance);
  const uses = Array.isArray(m.uses) ? ['warmup', 'cooldown', 'peak'].filter((u) => (m.uses as unknown[]).includes(u)) : undefined;
  return {
    slug, name,
    aka: (Array.isArray(m.aka) ? m.aka : String(m.aka || '').split(/[,\n]/)).map((x) => str(x, 60)).filter(Boolean).slice(0, 10),
    apparatus,
    ...(idsOf(SECTIONS).has(String(m.section)) ? { section: String(m.section) } : {}),
    level, levelTo,
    ...(typeof m.pose === 'string' && (POSE_IDS as string[]).includes(m.pose) ? { pose: m.pose } : {}),
    position: one(m.position, POSITIONS, 'supine'),
    spine: spine.length ? spine : ['neutral'],
    plane: one(m.plane, PLANES, 'sagittal'),
    patterns: pick(m.patterns, PATTERNS, 6),
    muscles: { primary, secondary: ids(mu.secondary, 8).filter((x) => !primary.includes(x)) },
    equipment: ids(m.equipment, 6),
    load: apparatus === 'reformer' ? { springs: loads(ld.springs), ...(advance.length ? { advance } : {}), ...(ld.lighterIsHarder ? { lighterIsHarder: true } : {}), ...(ld.flexible ? { flexible: true } : {}), ...(str(ld.note, 300) ? { note: str(ld.note, 300) } : {}) } : null,
    ...(apparatus === 'reformer' ? { setup: { headrest: one(su.headrest, HEADREST, 'any'), straps: one(su.straps, STRAPS, 'none') } } : {}),
    perSide: !!m.perSide,
    ...(idsOf(ROLES_OF_MOVEMENT).has(String(m.role)) ? { role: String(m.role) } : {}),
    stable: str(m.stable, 160),
    mobile: str(m.mobile, 160),
    categories: pick(m.categories, CATEGORIES, 11),
    pregnancy: one(m.pregnancy, PREGNANCY, 'ok'),
    purpose: Object.fromEntries(['strength', 'stability', 'flexibility', 'mobility'].map((k) => [k, Math.round(num(pu[k], 0, 3, 0))])),
    multiJoint: m.multiJoint !== false,
    intensity: Math.round(num(m.intensity, 1, 10, 4)),
    duration: Math.round(num(m.duration, 15, 1800, 120)),
    reps: str(m.reps, 60),
    summary: str(m.summary, 600),
    steps: (Array.isArray(m.steps) ? m.steps : String(m.steps || '').split('\n')).map((x) => str(x, 300)).filter(Boolean).slice(0, 12),
    variations: list<Record<string, unknown>>(m.variations, 12).map((v) => (typeof v === 'string' ? { name: str(v, 120) } : v && typeof v === 'object' ? { name: str(v.name, 120), ...(str(v.kind, 20) ? { kind: str(v.kind, 20) } : {}), ...(Array.isArray(v.springs) ? { springs: loads(v.springs) } : {}), ...(str(v.note, 300) ? { note: str(v.note, 300) } : {}) } : { name: '' })).filter((v) => v.name),
    prep: list<unknown>(m.prep, 6).map(slugify).filter(Boolean),
    layers: list<Record<string, unknown>>(m.layers, 12).filter((l) => l && typeof l === 'object').map((l, i) => ({ tag: str(l.tag, 4) || `L${i + 1}`, title: str(l.title, 80), text: str(l.text, 300) })).filter((l) => l.title),
    cautions: list<Record<string, unknown>>(m.cautions, 16).filter((c) => c && typeof c === 'object' && str(c.tag, 40)).map((c) => ({ tag: str(c.tag, 40), severity: c.severity === 'modify' ? 'modify' : 'avoid', note: str(c.note, 300), ...(slugify(c.swap) ? { swap: slugify(c.swap) } : {}) })),
    cues: (Array.isArray(m.cues) ? strs(m.cues, 20, 200).join('\n') : str(m.cues, 2000)),
    labels: list<unknown>(m.labels, 12).map(slugify).filter(Boolean),
    ...(uses ? { uses } : {}),
    ...(m.retired ? { retired: true } : {}),
    ...(m.hidden ? { hidden: true } : {}),
    ...(Array.isArray(m.sources) && m.sources.length ? { sources: strs(m.sources, 20, 30) } : {}),
    review: { status: str(rv.status, 20) || 'draft', note: str(rv.note, 300), ...(str(rv.by, 80) ? { by: str(rv.by, 80) } : {}), ...(str(rv.date, 20) ? { date: str(rv.date, 20) } : {}) },
    source: 'mine',
  } as Movement;
}

export function cleanSeries(input: unknown): Series | null {
  const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const name = str(s.name, 80);
  const slug = slugify(s.slug || name);
  const items = list<Record<string, unknown>>(s.items, 30).filter((i) => i && slugify(i.slug)).map((i) => ({
    slug: slugify(i.slug), ...(str(i.variation, 120) ? { variation: str(i.variation, 120) } : {}),
    ...(Number(i.duration) > 0 ? { duration: Math.round(num(i.duration, 10, 1800, 60)) } : {}), ...(str(i.reps, 60) ? { reps: str(i.reps, 60) } : {}),
  }));
  if (!name || !slug || !items.length) return null;
  return { slug, name, apparatus: s.apparatus === 'mat' ? 'mat' : 'reformer', aka: list<unknown>(s.aka, 6).map((x) => str(x, 60)).filter(Boolean), summary: str(s.summary, 300), items, source: 'mine' };
}

export const DEFAULT_PROPS: Record<string, number> = { long_box: 1, short_box: 1, magic_circle: 1, hand_weights: 1, small_ball: 1, loop_band: 1 };

export function newStudio(name = 'My studio', brand = 'balanced_body'): Studio {
  const b = (BRANDS as Record<string, { standard: Record<string, number> }>)[brand] ? brand : 'balanced_body';
  return { id: uid('st'), name, hasReformers: true, brand: b, reformers: 8, springs: { ...(BRANDS as Record<string, { standard: Record<string, number> }>)[b].standard }, springOverrides: {}, props: { ...DEFAULT_PROPS }, classTypes: [], updatedAt: nowIso() };
}

/** A studio from anywhere, including a "room" from OpenPilates Server (with the server's prop counts). */
export function cleanStudio(input: unknown, serverProps?: Record<string, unknown>): Studio {
  const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const brand = (BRANDS as Record<string, unknown>)[String(s.brand)] ? String(s.brand) : 'balanced_body';
  const springs: Record<string, number> = {};
  for (const l of LOAD_LEVELS as string[]) { const n = Math.round(num(((s.springs || {}) as Record<string, unknown>)[l], 0, 8, 0)); if (n > 0) springs[l] = n; }
  const overrides: Studio['springOverrides'] = {};
  for (const [k, v] of Object.entries((s.springOverrides || {}) as Record<string, Record<string, unknown>>)) {
    if (LOADS.has(k) && v && typeof v === 'object' && str(v.name, 30)) overrides[k] = { name: str(v.name, 30), short: str(v.short, 3) || str(v.name, 1).toUpperCase(), color: /^#[0-9a-f]{6}$/i.test(String(v.color)) ? String(v.color) : '#9AA39F' };
  }
  const props: Record<string, number> = {};
  for (const [k, v] of Object.entries((serverProps || s.props || {}) as Record<string, unknown>)) if (ID.test(k) && Number(v) > 0) props[k] = Math.round(num(v, 1, 99, 1));
  const mat = s.apparatus === 'mat' || s.hasReformers === false;
  return {
    id: ID.test(String(s.id || '')) ? String(s.id) : uid('st'),
    name: str(s.name, 60) || 'Studio',
    hasReformers: !mat,
    brand,
    reformers: Math.round(num(s.reformers ?? s.count, 0, 99, 8)),
    springs: Object.keys(springs).length || mat ? springs : { ...(BRANDS as Record<string, { standard: Record<string, number> }>)[brand].standard },
    springOverrides: overrides,
    props,
    classTypes: list<unknown>(s.classTypes, 40).map(String).filter((x) => ID.test(x)),
    updatedAt: str(s.updatedAt, 30) || nowIso(),
  };
}

const named = (v: unknown, prefix: string, max = 40): Named[] => {
  const seen = new Set<string>();
  const out: Named[] = [];
  for (const x of list<Record<string, unknown>>(v, max)) {
    const label = str(x && x.label, 40);
    if (!label) continue;
    let id = ID.test(String(x.id || '')) ? String(x.id) : prefix + slugify(label).replace(/-/g, '_');
    while (seen.has(id)) id += '_2';
    seen.add(id);
    out.push({ id, label, ...(['lower', 'upper', 'core', 'stretch'].includes(String(x.group)) ? { group: String(x.group) } : {}) });
  }
  return out;
};
const ids = (v: unknown, max = 60) => list<unknown>(v, max).map(String).filter((x) => ID.test(x));

export function defaultSetup(): Setup {
  const timingRows = (DEFAULT_TIMING_ROWS as TimingRow[]).map((r) => ({ ...r }));
  return {
    levels: (DEFAULT_LEVELS as Setup['levels']).map((l) => ({ ...l })),
    classTypes: structuredClone(DEFAULT_CLASS_TYPES) as ClassType[],
    lengths: [...(DEFAULT_LENGTHS as number[])],
    defaultLength: 50,
    timingRows,
    timing: timingFromRows(timingRows) as Record<string, number>,
    focuses: structuredClone(DEFAULT_FOCUSES) as Setup['focuses'],
    targets: structuredClone(DEFAULT_TARGETS) as Setup['targets'],
    customProps: [], removedProps: [], customMuscles: [], removedMuscles: [], customCautions: [], removedCautions: [],
    customSections: [], removedSections: [], sectionLabels: {}, sectionMap: {},
  };
}

/** Class set-up from anywhere, including the Studio page of OpenPilates Server (a pack's "studio"). */
export function cleanSetup(input: unknown): Setup {
  const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const d = defaultSetup();
  const levels = (withCoreLevels(list<Record<string, unknown>>(s.levels, 12).filter((l) => l && str(l.label, 40)).map((l) => ({
    id: ID.test(String(l.id || '')) ? String(l.id) : slugify(l.label).replace(/-/g, '_'), label: str(l.label, 40),
    from: Math.round(num(l.from, 1, 3, 1)), to: Math.round(num(l.to, 1, 3, 3)),
  })).map((l) => (l.to < l.from ? { ...l, to: l.from } : l))) as Setup['levels']);
  const customSections = named(s.customSections, 's_', 12).map((x) => ({ ...x, group: x.group || 'core' }));
  const timingRows: TimingRow[] = (timingRowsOf({ timingRows: Array.isArray(s.timingRows) ? s.timingRows : undefined, timing: s.timing }) as TimingRow[]).slice(0, 30).map((r) => ({
    id: isBuiltinTiming(r.id) ? r.id : ID.test(String(r.id || '')) ? String(r.id) : 't_' + slugify(r.label).replace(/-/g, '_'),
    label: str(r.label, 60) || 'Timing', ...(str(r.note, 200) ? { note: str(r.note, 200) } : {}),
    seconds: Math.round(num(r.seconds, 0, 3600, 0)), ...(r.off ? { off: true } : {}),
  }));
  const targets = (s.targets && typeof s.targets === 'object' && Object.keys(s.targets as object).length ? JSON.parse(JSON.stringify(s.targets)) : d.targets) as Setup['targets'];
  const levelIds = new Set(levels.map((l) => l.id));
  const classTypes: ClassType[] = list<Record<string, unknown>>(s.classTypes, 40).filter((c) => c && str(c.name, 60)).map((c) => {
    const timing: Record<string, number> = {};
    for (const [k, v] of Object.entries((c.timing || {}) as Record<string, unknown>)) if (isBuiltinTiming(k) && v !== '' && v != null && Number.isFinite(Number(v))) timing[k] = Math.round(num(v, 0, 600, 0));
    return {
      id: ID.test(String(c.id || '')) ? String(c.id) : uid('ct'),
      name: str(c.name, 60),
      apparatus: c.apparatus === 'mat' ? 'mat' as const : 'reformer' as const,
      lengthMin: Math.round(num(c.lengthMin, 10, 180, 50)),
      springBudget: Math.round(num(c.springBudget, 0, 20, 0)),
      ...(str(c.note, 200) ? { note: str(c.note, 200) } : {}),
      ...(levelIds.has(String(c.level)) ? { level: String(c.level) } : {}),
      ...(targets[String(c.target)] ? { target: String(c.target) } : {}),
      ...(Object.keys(timing).length ? { timing } : {}),
      ...(c.noPhases ? { noPhases: true } : {}),
      phases: list<Record<string, unknown>>(c.phases, 20).filter((p) => p && str(p.name, 60)).map((p) => ({
        name: str(p.name, 60), role: ROLES.has(String(p.role)) ? String(p.role) : 'build', minutes: Math.round(num(p.minutes, 1, 60, 5)),
        sections: ids(p.sections, 12), ...(Array.isArray(p.positions) && p.positions.length ? { positions: ids(p.positions, 10) } : {}),
      })),
    };
  });
  const lengths = [...new Set(list<unknown>(s.lengths, 12).map(Number).filter((n) => Number.isFinite(n) && n >= 10 && n <= 180).map(Math.round))].sort((a, b) => a - b);
  const focuses = list<Record<string, unknown>>(s.focuses, 30).filter((f) => f && str(f.label, 40)).map((f) => ({
    ...(JSON.parse(JSON.stringify(f)) as Record<string, unknown>),
    id: ID.test(String(f.id || '')) ? String(f.id) : slugify(f.label).replace(/-/g, '_'), label: str(f.label, 40), muscles: ids(f.muscles, 20),
  })) as Setup['focuses'];
  const sectionLabels: Record<string, string> = {};
  for (const [k, v] of Object.entries((s.sectionLabels || {}) as Record<string, unknown>)) if (ID.test(k) && str(v, 40)) sectionLabels[k] = str(v, 40);
  const sectionMap: Record<string, string> = {};
  for (const [k, v] of Object.entries((s.sectionMap || {}) as Record<string, unknown>)) if (ID.test(k) && ID.test(String(v))) sectionMap[k] = String(v);
  return {
    levels,
    classTypes: classTypes.length ? classTypes : d.classTypes,
    lengths: lengths.length ? lengths : d.lengths,
    defaultLength: Math.round(num(s.defaultLength, 10, 180, 50)),
    timingRows,
    timing: timingFromRows(timingRows) as Record<string, number>,
    focuses: focuses.length ? focuses : d.focuses,
    targets,
    customProps: named(s.customProps, 'p_'), removedProps: ids(s.removedProps).filter((x) => (EQUIPMENT as { id: string }[]).some((e) => e.id === x) || true),
    customMuscles: named(s.customMuscles, 'm_'), removedMuscles: ids(s.removedMuscles),
    customCautions: named(s.customCautions, 'c_'), removedCautions: ids(s.removedCautions),
    customSections, removedSections: ids(s.removedSections), sectionLabels, sectionMap,
  };
}

export const ACCENTS = ['teal', 'navy', 'clay', 'plum', 'berry', 'olive', 'charcoal', 'own'] as const;
export function defaultSettings(): Settings {
  return { theme: 'auto', accent: 'teal', trueBlack: false, playDark: true, keepAwake: true, textSize: 'normal', autoBackup: true, keepBackups: 5, welcomed: false, deviceName: 'This device' };
}
export function cleanSettings(input: unknown): Settings {
  const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const d = defaultSettings();
  const own = /^#[0-9a-f]{6}$/i.test(String(s.ownAccent));
  return {
    theme: (['light', 'dark', 'auto'] as const).find((x) => x === s.theme) || d.theme,
    accent: (ACCENTS as readonly string[]).includes(String(s.accent)) && (s.accent !== 'own' || own) ? String(s.accent) : d.accent,
    ...(own ? { ownAccent: String(s.ownAccent) } : {}),
    trueBlack: !!s.trueBlack,
    playDark: s.playDark === undefined ? d.playDark : !!s.playDark,
    keepAwake: s.keepAwake === undefined ? d.keepAwake : !!s.keepAwake,
    textSize: (['normal', 'large', 'larger'] as const).find((x) => x === s.textSize) || d.textSize,
    ...(ID.test(String(s.usualStudio || '')) ? { usualStudio: String(s.usualStudio) } : {}),
    autoBackup: s.autoBackup === undefined ? true : !!s.autoBackup,
    keepBackups: Math.round(num(s.keepBackups, 1, 30, 5)),
    ...(str(s.lastBackup, 30) ? { lastBackup: str(s.lastBackup, 30) } : {}),
    welcomed: !!s.welcomed,
    deviceName: str(s.deviceName, 40) || d.deviceName,
  };
}

export function cleanTaught(v: unknown): Taught[] {
  return list<Record<string, unknown>>(v, 5000).filter((t) => t && str(t.at, 30) && str(t.title, 120)).map((t) => ({
    id: ID.test(String(t.id || '')) ? String(t.id) : uid('t'), classId: str(t.classId, 60), title: str(t.title, 120), at: str(t.at, 30),
    ...(ID.test(String(t.studioId || '')) ? { studioId: String(t.studioId) } : {}), ...(str(t.studioName, 60) ? { studioName: str(t.studioName, 60) } : {}),
    minutes: Math.round(num(t.minutes, 0, 600, 0)),
  }));
}

export function emptyData(): Data {
  return { v: 1, settings: defaultSettings(), setup: defaultSetup(), studios: [], classes: [], taught: [], movements: {}, hidden: [], shown: [], series: [], hiddenSeries: [] };
}

/** Everything the app keeps, read back from its own file or from a backup. */
export function cleanData(input: unknown): Data {
  const d = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const movements: Record<string, Movement> = {};
  for (const m of Object.values((d.movements || {}) as Record<string, unknown>).slice(0, 3000)) { const mv = cleanMovement(m); if (mv) movements[mv.slug] = mv; }
  const seenClass = new Set<string>();
  const classes = list<unknown>(d.classes, 5000).map((c) => cleanPlan(c, true)).filter((c) => (seenClass.has(c.id) ? false : (seenClass.add(c.id), true)));
  const seenStudio = new Set<string>();
  const studios = list<unknown>(d.studios, 50).map((s) => cleanStudio(s)).filter((s) => (seenStudio.has(s.id) ? false : (seenStudio.add(s.id), true)));
  return {
    v: 1,
    settings: cleanSettings(d.settings),
    setup: cleanSetup(d.setup),
    studios, classes,
    taught: cleanTaught(d.taught),
    movements,
    hidden: list<unknown>(d.hidden, 3000).map(slugify).filter(Boolean),
    shown: list<unknown>(d.shown, 3000).map(slugify).filter(Boolean),
    series: list<unknown>(d.series, 500).map(cleanSeries).filter(Boolean) as Series[],
    hiddenSeries: list<unknown>(d.hiddenSeries, 500).map(slugify).filter(Boolean),
  };
}
