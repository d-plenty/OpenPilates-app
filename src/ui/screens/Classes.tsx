// The Classes tab: every class plan on this device, and starting a new one.
import { useState } from 'react';
import { CLASS_LEVELS, DEFAULT_CLASS_TYPES, FOCUSES, SEGMENT_ROLES, focusOf } from '../../engine';
import { blockCount, classTypesFor, levelName, makePlan, phased, startClass, usualLevel } from '../../lib/plan';
import { uid } from '../../lib/clean';
import { analyse, applySetup, changeStudio, lastTaught, studioOf, useData, usualStudio } from '../../lib/store';
import type { ClassPlan, ClassType, Phase, Studio } from '../../lib/types';
import { Chips, Empty, Field, Icon, Row, Screen, Stepper, Switch, Back, toast } from '../bits';
import { studioLine } from './Builder';
import { PropsOwned, addStudio } from './Studios';
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
      {!d.classes.length ? <Empty title="No classes yet" text={d.studios.length ? "Plan your first class: pick a class type and draft it, or start empty." : "Start by setting up where you teach. Then plan your first class."}><button type="button" className="btn p" onClick={() => nav.go({ name: 'new' })}>New class</button></Empty>
        : !list.length ? <Empty title="Nothing matches" text="Try another filter." />
        : <div className="stack cards-2">{list.map((c) => <ClassCard key={c.id} plan={c} />)}</div>}
      <button type="button" className="card dash" onClick={() => nav.go({ name: 'share' }, 'more')}>Got a class from another instructor? <span className="link">Import by QR code or file</span></button>
    </Screen>
  );
}

/**
 * The first class at a studio with no class types walks through making one: its name, length and
 * level, its parts, and the props the studio owns. Saved to the studio when it's done.
 */
function FirstClassType({ studio, onDone }: { studio: Studio; onDone: (ct: ClassType) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [apparatus, setApparatus] = useState<'reformer' | 'mat'>(studio.hasReformers ? 'reformer' : 'mat');
  const [lengthMin, setLength] = useState(studio.setup.lengths[0] || 50);
  const [ownLength, setOwnLength] = useState('');
  const [level, setLevel] = useState('');
  const example = () => (DEFAULT_CLASS_TYPES as ClassType[]).find((c) => c.apparatus === apparatus) as ClassType;
  const [usePhases, setUsePhases] = useState(true);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [props, setProps] = useState<Studio>(structuredClone(studio));
  applySetup(studio.setup);
  const levels = CLASS_LEVELS as { id: string; label: string }[];
  const scale = (n: number) => { const ex = example(); const k = n / ex.lengthMin; return ex.phases.map((p) => ({ ...p, sections: [...(p.sections || [])], minutes: Math.max(1, Math.round(p.minutes * k)) })); };
  const total = phases.reduce((n, p) => n + p.minutes, 0);
  const needProps = apparatus === 'reformer' && !Object.keys(studio.props).length;
  const finish = () => {
    const id = uid('ct');
    const ct: ClassType = { id, name: name.trim() || 'My class', apparatus, lengthMin, springBudget: 0, ...(level ? { level } : {}), ...(usePhases ? {} : { noPhases: true }), phases: usePhases ? phases.filter((p) => p.name.trim()) : [] };
    changeStudio(studio.id, (s) => {
      s.setup.classTypes = [...s.setup.classTypes, ct];
      s.setup.lengths = [...new Set([...s.setup.lengths, lengthMin])].sort((x, y) => x - y);
      if (needProps) { s.props = props.props; s.setup.customProps = props.setup.customProps; }
    });
    toast(`${ct.name} saved to ${studio.name}. Change it any time in its class set-up.`);
    onDone(ct);
  };
  const steps = ['name', 'length', 'parts', ...(needProps ? ['props'] : [])];
  const at = steps[step];
  const next = () => { if (at === 'length' && !phases.length) setPhases(scale(lengthMin)); if (step < steps.length - 1) setStep(step + 1); else finish(); };
  return (
    <Screen narrow top={<><Back label="Back" /><div className="tiny">First class at {studio.name} · step {step + 1} of {steps.length}</div><h1>{at === 'name' ? 'What kind of class is it?' : at === 'length' ? 'How long, and for whom?' : at === 'parts' ? 'The parts of the class' : `Props ${studio.name} owns`}</h1></>}
      foot={<>{step ? <button type="button" className="btn grow" onClick={() => setStep(step - 1)}>Back</button> : null}<button type="button" className="btn p grow" disabled={at === 'name' && !name.trim()} onClick={next}>{step === steps.length - 1 ? 'Save and continue' : 'Next'}</button></>}>
      {at === 'name' ? <>
        <p className="m">A class type is a class on your timetable, like "Reformer Flow" or "Open Level Reformer". Every new class of that kind starts from what you set here. This is set up once.</p>
        <Field label="Name"><input type="text" maxLength={60} placeholder="e.g. Reformer Flow" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {studio.hasReformers ? <div><div className="lab">On</div><div style={{ marginTop: 8 }}><Chips options={[{ id: 'reformer', label: 'Reformer' }, { id: 'mat', label: 'Mat' }]} value={apparatus} onPick={(v) => { setApparatus(v as 'reformer' | 'mat'); setPhases([]); }} /></div></div> : null}
      </> : null}
      {at === 'length' ? <>
        <div><div className="lab">Length</div><div style={{ marginTop: 8 }}><Chips options={[...new Set([30, 45, 50, 55, 60, lengthMin])].sort((x, y) => x - y).map((n) => ({ id: String(n), label: `${n} min` }))} value={String(lengthMin)} onPick={(v) => { setLength(Number(v)); setPhases([]); }} /></div>
          <div className="row" style={{ marginTop: 8 }}><input type="number" inputMode="numeric" min={10} max={180} placeholder="Another length, in minutes" aria-label="Another length in minutes" value={ownLength} onChange={(e) => setOwnLength(e.target.value)} /><button type="button" className="btn sm" disabled={!(Number(ownLength) >= 10 && Number(ownLength) <= 180)} onClick={() => { setLength(Math.round(Number(ownLength))); setOwnLength(''); setPhases([]); }}>Use</button></div></div>
        <div><div className="lab">Usual level</div><div style={{ marginTop: 8 }}><Chips options={[{ id: '', label: 'Choose each time' }, ...levels.map((l) => ({ id: l.id, label: l.label }))]} value={level} onPick={setLevel} /></div>
          <p className="tiny" style={{ padding: '4px 4px 0' }}>Need a level like "Open level" or "Beginner + intermediate"? Add it later in {studio.name}'s class set-up → Class levels.</p></div>
      </> : null}
      {at === 'parts' ? <>
        <div className="card flush"><Row title="Plan it in parts" sub="Warm-up, footwork, core… Recommended: each part gets its own minutes." right={<Switch on={usePhases} onChange={setUsePhases} label="Plan it in parts" />} /></div>
        {usePhases ? <>
          <p className="m">Started from an example for a {lengthMin}-minute {apparatus} class. Rename, change the minutes, take parts out or add your own.</p>
          <div className="card flush">{phases.map((p, i) => <div className="set" key={i}>
            <input type="text" maxLength={60} aria-label={`Name of part ${i + 1}`} value={p.name} onChange={(e) => setPhases(phases.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={{ flex: '1 1 auto' }} />
            <Stepper value={p.minutes} min={1} max={60} label={`Minutes for ${p.name}`} onChange={(n) => setPhases(phases.map((x, j) => (j === i ? { ...x, minutes: n } : x)))} />
            <button type="button" className="btn icon ghost" aria-label={`Take out ${p.name}`} onClick={() => setPhases(phases.filter((_, j) => j !== i))}><Icon name="close" size={16} /></button></div>)}</div>
          <button type="button" className="btn" onClick={() => setPhases([...phases, { name: 'New part', role: 'build', minutes: 5, sections: [] }])}><Icon name="plus" size={18} />Add a part</button>
          <div className={`m${Math.abs(total - lengthMin) > 2 ? ' warn-text' : ''}`} style={{ padding: '0 4px' }}>The parts add up to {total} of {lengthMin} minutes.</div>
        </> : <p className="m">Your classes will be one list of blocks. You can switch parts on for any class later.</p>}
      </> : null}
      {at === 'props' ? <>
        <p className="m">Drafts only use movements with props you have. Set how many of each, or leave it at 0.</p>
        <PropsOwned s={props} edit={(fn) => { const x = structuredClone(props); fn(x); setProps(x); }} />
      </> : null}
    </Screen>
  );
}

export function NewClassScreen({ when: planned }: { when?: string }) {
  const d = useData();
  const [studioId, setStudioId] = useState(usualStudio().id);
  const studio = studioOf(studioId);
  applySetup(studio.setup);
  const types = classTypesFor(studio);
  const [typeId, setTypeId] = useState(types[0]?.id);
  const ct: ClassType | undefined = types.find((c) => c.id === typeId) || types[0];
  const [lengthMin, setLength] = useState(ct?.lengthMin || 50);
  const [level, setLevel] = useState(usualLevel(ct, studio));
  const focuses = FOCUSES as { id: string; label: string }[];
  const [goal, setGoal] = useState(focuses[0]?.id || 'full_body');
  const [own, setOwn] = useState(false);
  const [focusText, setFocusText] = useState('');
  const [date, setDate] = useState(planned || '');
  const pickType = (c?: ClassType) => { if (!c) return; setTypeId(c.id); setLength(c.lengthMin); setLevel(usualLevel(c, studioOf(studioId))); };
  const pickStudio = (id: string) => { setStudioId(id); const s = studioOf(id); pickType(classTypesFor(s)[0]); setGoal('full_body'); };
  if (!d.studios.length) return (
    <Screen narrow top={<><Back label="Back" /><h1>New class</h1></>}>
      <Empty title="First, where do you teach?" text="A class is planned for a studio: its reformers, springs, props and class set-up. Set yours up, then come back here."><button type="button" className="btn p" onClick={() => addStudio()}>Set up my studio</button></Empty>
    </Screen>
  );
  if (!ct) return <FirstClassType key={studio.id} studio={studio} onDone={(c) => { setTypeId(c.id); setLength(c.lengthMin); setLevel(usualLevel(c, studioOf(studioId))); }} />;
  const lengths = [...new Set([...studio.setup.lengths, ct.lengthMin, lengthMin])].sort((a, b) => a - b);
  const create = (draft: boolean) => {
    const plan = makePlan({ classType: ct, lengthMin, level, goal, focusText: own ? focusText : '', studio, when: date || undefined, draft });
    startClass(plan);
    nav.swap({ name: 'class', id: plan.id });
  };
  return (
    <Screen narrow top={<><Back label="Back" /><h1>New class</h1></>} foot={<>
      <button type="button" className="btn grow" onClick={() => create(false)}>{phased(ct) ? 'Start with empty parts' : 'Start empty'}</button>
      <button type="button" className="btn p grow" onClick={() => create(true)}><Icon name="spark" size={18} />Draft it for me</button>
    </>}>
      <div><div className="lab">Which studio is it for?</div><div style={{ marginTop: 8 }}><Chips options={d.studios.map((s) => ({ id: s.id, label: s.name }))} value={studio.id} onPick={pickStudio} /></div>
        <div className="m" style={{ marginTop: 6, padding: '0 4px' }}>{studioLine(studio)}. Its springs, props and class set-up are used.</div></div>
      <div><div className="lab">Class type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
          {types.map((c) => <button type="button" key={c.id} className={`card pick${c.id === ct.id ? ' on' : ''}`} style={{ padding: 12 }} aria-pressed={c.id === ct.id} onClick={() => pickType(c)}><b>{c.name}</b><div className="m">{c.lengthMin} min · {phased(c) ? `${c.phases.length} parts` : 'no parts'}</div></button>)}
          <button type="button" className="card dash" style={{ padding: 12 }} onClick={() => nav.go({ name: 'setup', studio: studio.id, part: 'types' })}>+ Another class type</button>
        </div></div>
      <div><div className="lab">Length</div><div style={{ marginTop: 8 }}><Chips options={lengths.map((n) => ({ id: String(n), label: `${n} min` }))} value={String(lengthMin)} onPick={(v) => setLength(Number(v))} /></div></div>
      <div><div className="lab">Level</div><div style={{ marginTop: 8 }}><Chips options={(CLASS_LEVELS as { id: string; label: string }[]).map((l) => ({ id: l.id, label: l.label }))} value={level} onPick={setLevel} /></div></div>
      <div><div className="lab">Focus</div><div style={{ marginTop: 8 }}><Chips options={[...focuses.map((f) => ({ id: f.id, label: f.label })), { id: '__own', label: 'Our own…' }]} value={own ? '__own' : goal} onPick={(v) => { if (v === '__own') setOwn(true); else { setOwn(false); setGoal(v); } }} /></div>
        {own ? <input type="text" maxLength={60} autoFocus placeholder="e.g. Runners' hips, wedding arms" aria-label="Your own focus for this class" value={focusText} onChange={(e) => setFocusText(e.target.value)} style={{ marginTop: 8 }} /> : null}
        <div className="m" style={{ marginTop: 6, padding: '0 4px' }}>{own ? 'Shown on the class. A draft for your own focus is a balanced class.' : 'Steers a draft towards those muscles.'} <button type="button" className="link" onClick={() => nav.go({ name: 'setup', studio: studio.id, part: 'focuses' })}>Add focuses for {studio.name}</button></div></div>
      {studio.hasReformers && ct.apparatus !== 'mat' && !Object.keys(studio.props).length ? <button type="button" className="card dash" onClick={() => nav.go({ name: 'studio', id: studio.id })}>{studio.name} has no props set up, so drafts leave out movements that need one. <span className="link">Add your props</span></button> : null}
      <Field label="Planned for (optional)" hint="Shows the class in your calendar."><input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="card"><b>{phased(ct) ? `How ${lengthMin} minutes is shared out` : `${lengthMin} minutes, one list of blocks`}</b>
        {phased(ct) ? <div className="row" style={{ gap: 4, marginTop: 10, alignItems: 'flex-start' }}>{ct.phases.map((p, i) => <div key={i} style={{ flex: `${p.minutes} 1 0`, minWidth: 0 }}><div style={{ height: 6, borderRadius: 3, background: roleColor(p.role) }} /><div className="tiny cut" style={{ marginTop: 4 }}>{p.name}</div></div>)}</div>
          : <p className="m" style={{ marginTop: 6 }}>{ct.name} isn't planned in parts. You can switch parts on for this class once it is open.</p>}
        <div className="m" style={{ marginTop: 8 }}>{ct.apparatus === 'mat' ? 'Mat class' : ct.springBudget > 0 ? `Up to ${ct.springBudget} spring change${ct.springBudget === 1 ? '' : 's'}` : 'No limit on spring changes'}</div></div>
      <p className="tiny center">Nothing is saved until you tap Save in the class.</p>
    </Screen>
  );
}
export const planStats = analyse;
