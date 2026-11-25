// The Classes tab: every class plan on this device, and starting a new one.
import { useState } from 'react';
import { CLASS_LEVELS, FOCUSES, SEGMENT_ROLES, focusOf } from '../../engine';
import { blockCount, classTypesFor, levelName, makePlan, phased, usualLevel } from '../../lib/plan';
import { analyse, lastTaught, saveClass, studioOf, useData, usualStudio } from '../../lib/store';
import type { ClassPlan, ClassType } from '../../lib/types';
import { Chips, Empty, Field, Icon, Screen, Back } from '../bits';
import { nav, viewState } from '../nav';
import { startPlay } from './Play';

export const ROLE_COLOR: Record<string, string> = { warmup: '#8FB9AE', build: 'var(--accent)', peak: 'var(--warn-dot)', cooldown: '#A7B5AF', stretch: '#A7B5AF' };
export const roleColor = (role: string) => ROLE_COLOR[role] || 'var(--accent)';
export const roleLabel = (role: string) => (SEGMENT_ROLES as { id: string; label: string }[]).find((r) => r.id === role)?.label || role;

export function when(text?: string): string {
  if (!text) return '';
  const d = new Date(text.length === 10 ? `${text}T00:00` : text);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return text.length === 10 ? day : `${day}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export function ClassCard({ plan }: { plan: ClassPlan }) {
  const studio = studioOf(plan.studioId);
  const taught = lastTaught(plan.id);
  const total = plan.segments.reduce((n, s) => n + (s.minutes || Math.max(1, s.items.length)), 0) || 1;
  const sub = plan.when ? `Planned ${when(plan.when)}` : taught ? `Taught ${when(taught.at.slice(0, 10))}` : plan.from ? `From ${plan.from}` : `Edited ${when(plan.updatedAt.slice(0, 10))}`;
  return (
    <div className="card">
      <div className="row between">
        <button type="button" className="link grow" style={{ color: 'inherit', fontSize: 'calc(16px * var(--scale))', fontWeight: 700 }} onClick={() => nav.go({ name: 'class', id: plan.id }, 'classes')}>{plan.title}</button>
        <button type="button" className="btn icon round dark" aria-label={`Play ${plan.title}`} onClick={() => startPlay(plan)}><Icon name="play" size={16} fill /></button>
      </div>
      <div className="row wrap" style={{ marginTop: 6, gap: 6 }}>
        <span className="tag">{plan.lengthMin} min</span><span className="tag">{levelName(plan.level)}</span><span className="tag">{blockCount(plan)} blocks</span>
        {plan.focusText || (plan.goal && plan.goal !== 'full_body' && focusOf(plan)) ? <span className="tag acc">{focusOf(plan) as string}</span> : null}
      </div>
      {!plan.noPhases && plan.segments.length > 1 ? <div className="bar">{plan.segments.map((s) => <span key={s.id} title={s.name} style={{ flex: `${(s.minutes || Math.max(1, s.items.length)) / total} 1 0`, background: roleColor(s.role) }} />)}</div> : null}
      <div className="m" style={{ marginTop: 8 }}>{sub}{studio.id ? ` · ${studio.name}` : ''}</div>
    </div>
  );
}

export function ClassesScreen() {
  const d = useData();
  const vs = viewState('classes', { filter: 'all', q: '' });
  const [, redraw] = useState(0);
  const set = (patch: Partial<typeof vs>) => { Object.assign(vs, patch); redraw((n) => n + 1); };
  const taughtIds = new Set(d.taught.map((t) => t.classId));
  const q = vs.q.trim().toLowerCase();
  const list = d.classes.filter((c) => (vs.filter === 'all' ? true : vs.filter === 'taught' ? taughtIds.has(c.id) : vs.filter === 'planned' ? !!c.when : c.apparatus === vs.filter) && (!q || c.title.toLowerCase().includes(q)));
  return (
    <Screen top={<>
      <div className="row between"><h1>Classes</h1><button type="button" className="btn p sm" onClick={() => nav.go({ name: 'new' })}><Icon name="plus" size={18} />New class</button></div>
      {d.classes.length > 5 ? <input type="search" placeholder="Search your classes" aria-label="Search your classes" value={vs.q} onChange={(e) => set({ q: e.target.value })} style={{ marginTop: 10 }} /> : null}
      <div style={{ marginTop: 10 }}><Chips scroll options={[{ id: 'all', label: 'All' }, { id: 'reformer', label: 'Reformer' }, { id: 'mat', label: 'Mat' }, { id: 'planned', label: 'Planned' }, { id: 'taught', label: 'Taught' }]} value={vs.filter} onPick={(filter) => set({ filter })} /></div>
    </>}>
      {!d.classes.length ? <Empty title="No classes yet" text="Plan your first class: pick a class type and draft it, or start empty."><button type="button" className="btn p" onClick={() => nav.go({ name: 'new' })}>New class</button></Empty>
        : !list.length ? <Empty title="Nothing matches" text="Try another filter." />
        : <div className="stack cards-2">{list.map((c) => <ClassCard key={c.id} plan={c} />)}</div>}
      <button type="button" className="card dash" onClick={() => nav.go({ name: 'share' }, 'more')}>Got a class from another instructor? <span className="link">Import by QR code or file</span></button>
    </Screen>
  );
}

export function NewClassScreen({ when: planned }: { when?: string }) {
  const d = useData();
  const [studioId, setStudioId] = useState(usualStudio().id);
  const studio = studioOf(studioId);
  const types = classTypesFor(studio);
  const [typeId, setTypeId] = useState(types[0]?.id);
  const ct: ClassType = types.find((c) => c.id === typeId) || types[0];
  const [lengthMin, setLength] = useState(ct?.lengthMin || d.setup.defaultLength);
  const [level, setLevel] = useState(usualLevel(ct));
  const focuses = FOCUSES as { id: string; label: string }[];
  const [goal, setGoal] = useState(focuses[0].id);
  const [own, setOwn] = useState(false);
  const [focusText, setFocusText] = useState('');
  const [date, setDate] = useState(planned || '');
  const pickType = (id: string) => { const c = types.find((x) => x.id === id); if (!c) return; setTypeId(id); setLength(c.lengthMin); if (c.level) setLevel(usualLevel(c)); };
  const lengths = [...new Set([...d.setup.lengths, lengthMin])].sort((a, b) => a - b);
  const create = (draft: boolean) => {
    const plan = makePlan({ classType: ct, lengthMin, level, goal, focusText: own ? focusText : '', studio, when: date || undefined, draft });
    saveClass(plan);
    nav.swap({ name: 'class', id: plan.id });
  };
  if (!ct) return <Screen top={<><Back label="Classes" /><h1>New class</h1></>}><Empty title="No class types" text="Add a class type in More → Class set-up first." /></Screen>;
  return (
    <Screen narrow top={<><Back label="Back" /><h1>New class</h1></>} foot={<>
      <button type="button" className="btn grow" onClick={() => create(false)}>{phased(ct) ? 'Start with empty phases' : 'Start empty'}</button>
      <button type="button" className="btn p grow" onClick={() => create(true)}><Icon name="spark" size={18} />Draft it for me</button>
    </>}>
      {d.studios.length > 1 ? <div><div className="lab">Where</div><div style={{ marginTop: 8 }}><Chips options={d.studios.map((s) => ({ id: s.id, label: s.name }))} value={studio.id} onPick={(id) => { setStudioId(id); const t = classTypesFor(studioOf(id)); if (!t.some((c) => c.id === typeId) && t[0]) { setTypeId(t[0].id); setLength(t[0].lengthMin); } }} /></div><div className="m" style={{ marginTop: 6, padding: '0 4px' }}>Springs and props follow this studio. You can switch when you teach.</div></div> : null}
      <div><div className="lab">Class type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
          {types.map((c) => <button type="button" key={c.id} className={`card pick${c.id === ct.id ? ' on' : ''}`} style={{ padding: 12 }} aria-pressed={c.id === ct.id} onClick={() => pickType(c.id)}><b>{c.name}</b><div className="m">{c.lengthMin} min · {phased(c) ? `${c.phases.length} phases` : 'no phases'}</div></button>)}
        </div></div>
      <div><div className="lab">Length</div><div style={{ marginTop: 8 }}><Chips options={lengths.map((n) => ({ id: String(n), label: `${n} min` }))} value={String(lengthMin)} onPick={(v) => setLength(Number(v))} /></div></div>
      <div><div className="lab">Level</div><div style={{ marginTop: 8 }}><Chips options={(CLASS_LEVELS as { id: string; label: string }[]).map((l) => ({ id: l.id, label: l.label }))} value={level} onPick={setLevel} /></div></div>
      <div><div className="lab">Focus</div><div style={{ marginTop: 8 }}><Chips options={[...focuses.map((f) => ({ id: f.id, label: f.label })), { id: '__own', label: 'Our own…' }]} value={own ? '__own' : goal} onPick={(v) => { if (v === '__own') setOwn(true); else { setOwn(false); setGoal(v); } }} /></div>
        {own ? <input type="text" maxLength={60} autoFocus placeholder="e.g. Runners' hips, wedding arms" aria-label="Your own focus for this class" value={focusText} onChange={(e) => setFocusText(e.target.value)} style={{ marginTop: 8 }} /> : null}
        <div className="m" style={{ marginTop: 6, padding: '0 4px' }}>{own ? 'Shown on the class. A draft for your own focus is a balanced class.' : 'Steers a draft towards those muscles.'}</div></div>
      <Field label="Planned for (optional)" hint="Shows the class in your calendar."><input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="card"><b>{phased(ct) ? `How ${lengthMin} minutes is shared out` : `${lengthMin} minutes, one list of blocks`}</b>
        {phased(ct) ? <div className="row" style={{ gap: 4, marginTop: 10, alignItems: 'flex-start' }}>{ct.phases.map((p, i) => <div key={i} style={{ flex: `${p.minutes} 1 0`, minWidth: 0 }}><div style={{ height: 6, borderRadius: 3, background: roleColor(p.role) }} /><div className="tiny cut" style={{ marginTop: 4 }}>{p.name}</div></div>)}</div>
          : <p className="m" style={{ marginTop: 6 }}>{ct.name} isn't planned in phases. You can switch phases on for this class once it is open.</p>}
        <div className="m" style={{ marginTop: 8 }}>{ct.apparatus === 'mat' ? 'Mat class' : ct.springBudget > 0 ? `Up to ${ct.springBudget} spring change${ct.springBudget === 1 ? '' : 's'}` : 'No limit on spring changes'}</div></div>
    </Screen>
  );
}
export const planStats = analyse;
