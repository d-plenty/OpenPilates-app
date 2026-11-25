// Making and editing a class plan: new plans (drafted or empty), and the undo and redo steps kept
// for each plan while the app is open.
import { blankSegments, classLevel, defaultClassLevel, draftFlow, FOCUSES } from '../engine';
import { cleanSegments, nowIso, uid } from './clean';
import { classOf, getData, library, saveClass, timingFor } from './store';
import type { ClassPlan, ClassType, Item, Segment, Studio } from './types';

export const phased = (ct?: ClassType) => !!ct && !ct.noPhases && (ct.phases || []).some((p) => p && p.minutes > 0);
export const classTypesFor = (studio: Studio): ClassType[] => {
  const all = getData().setup.classTypes.filter((c) => studio.hasReformers || c.apparatus === 'mat' || !studio.id);
  const here = studio.classTypes.length ? all.filter((c) => studio.classTypes.includes(c.id)) : all;
  return here.length ? here : all;
};

export interface NewPlan { classType: ClassType; lengthMin: number; level: string; goal: string; focusText: string; studio: Studio; when?: string; draft: boolean }

export function makePlan(o: NewPlan): ClassPlan {
  const { setup } = getData();
  const own = o.focusText.trim().slice(0, 60);
  const goal = own ? (FOCUSES as { id: string }[])[0].id : o.goal;
  const focus = (FOCUSES as { id: string; label: string }[]).find((f) => f.id === goal);
  const stamp = { id: uid('c'), createdAt: nowIso(), updatedAt: nowIso(), ...(o.studio.id ? { studioId: o.studio.id } : {}), ...(o.when ? { when: o.when } : {}) };
  if (o.draft) {
    const flow = draftFlow({ movements: library().map, classType: o.classType, classTypes: setup.classTypes, goal, focusText: own, lengthMin: o.lengthMin, level: o.level, props: o.studio.props, timing: setup.timing, targets: setup.targets }) as Record<string, unknown>;
    return { ...stamp, title: String(flow.title), apparatus: flow.apparatus as ClassPlan['apparatus'], level: String(flow.level || o.level), lengthMin: Number(flow.lengthMin) || o.lengthMin, goal, ...(own ? { focusText: own } : {}), ...(flow.noPhases ? { noPhases: true } : {}), target: String(flow.target || 'general'), classType: o.classType.id, springBudget: Number(flow.springBudget) || 0, segments: cleanSegments(flow.segments) };
  }
  const segs = cleanSegments((blankSegments(o.classType, o.lengthMin, { props: o.studio.props }) as Segment[]).map((s) => ({ ...s, id: uid('s') })));
  return {
    ...stamp,
    title: `${own || (focus && goal !== 'full_body' ? focus.label : '') ? `${own || focus!.label} · ` : ''}${o.classType.name} ${o.lengthMin} min`,
    apparatus: o.classType.apparatus, level: o.level, lengthMin: o.lengthMin, goal, ...(own ? { focusText: own } : {}),
    ...(phased(o.classType) ? {} : { noPhases: true }),
    target: setup.targets[o.classType.target || ''] ? o.classType.target : 'general',
    classType: o.classType.id, springBudget: o.classType.apparatus === 'mat' ? 0 : o.classType.springBudget || 0,
    segments: segs.length ? segs : [{ id: uid('s'), name: 'Class', role: 'build', items: [] }],
  };
}
export const usualLevel = (ct?: ClassType) => (ct?.level && getData().setup.levels.some((l) => l.id === ct.level) ? ct.level : (defaultClassLevel() as string));
export const levelName = (id: string) => (classLevel(id) as { label: string }).label;

// ---- undo and redo, per class, for as long as the app is open
interface Hist { past: ClassPlan[]; future: ClassPlan[]; typedAt: number }
const hists = new Map<string, Hist>();
const histOf = (id: string) => { let h = hists.get(id); if (!h) { h = { past: [], future: [], typedAt: 0 }; hists.set(id, h); } return h; };

/** Change a class. `fn` gets a copy to edit. A run of typing counts as one step back. */
export function changeClass(id: string, fn: (p: ClassPlan) => void, typing = false): void {
  const before = classOf(id);
  if (!before) return;
  const next = structuredClone(before);
  fn(next);
  if (JSON.stringify(next) === JSON.stringify(before)) return;
  const h = histOf(id);
  const now = Date.now();
  if (!(typing && h.typedAt && now - h.typedAt < 1500 && h.past.length)) { h.past.push(before); if (h.past.length > 80) h.past.shift(); }
  h.typedAt = typing ? now : 0;
  h.future = [];
  saveClass(next);
}
export function undoClass(id: string): boolean {
  const h = histOf(id);
  const now = classOf(id);
  const prev = h.past.pop();
  if (!prev || !now) return false;
  h.future.push(now);
  h.typedAt = 0;
  saveClass(prev);
  return true;
}
export function redoClass(id: string): boolean {
  const h = histOf(id);
  const now = classOf(id);
  const next = h.future.pop();
  if (!next || !now) return false;
  h.past.push(now);
  h.typedAt = 0;
  saveClass(next);
  return true;
}
export const canUndo = (id: string) => histOf(id).past.length > 0;
export const canRedo = (id: string) => histOf(id).future.length > 0;

// ---- finding and moving blocks
export function findItem(plan: ClassPlan, itemId: string): { seg: Segment; index: number; item: Item } | undefined {
  for (const seg of plan.segments) { const index = seg.items.findIndex((i) => i.id === itemId); if (index >= 0) return { seg, index, item: seg.items[index] }; }
  return undefined;
}
/** Moves a block one place up or down, across a phase boundary when it is at the edge. */
export function nudge(plan: ClassPlan, itemId: string, dir: -1 | 1): void {
  const at = findItem(plan, itemId);
  if (!at) return;
  const si = plan.segments.indexOf(at.seg);
  const to = at.index + dir;
  if (to >= 0 && to < at.seg.items.length) { at.seg.items.splice(at.index, 1); at.seg.items.splice(to, 0, at.item); return; }
  const other = plan.segments[si + dir];
  if (!other) return;
  at.seg.items.splice(at.index, 1);
  if (dir < 0) other.items.push(at.item); else other.items.unshift(at.item);
}
export const blockCount = (plan: ClassPlan) => plan.segments.reduce((n, s) => n + s.items.filter((i) => !i.pause).length, 0);
export const planTiming = timingFor;
