// The Library tab: every movement and series, a movement's own page, and making or changing one.
import { useState } from 'react';
import { CAUTIONS, EQUIPMENT, LOAD_LEVELS, MUSCLES, OPTION_KINDS, POSE_IDS, POSES, POSITIONS, PURPOSES, SECTIONS, SPINE, USES, kindOf, labelOf, levelLabel, namesOf, sectionOf, usesOf, variationsOf } from '../../engine';
import { cleanMovement, slugify } from '../../lib/clean';
import { dropMovement, isLibrary, library, libraryVersion, removeSeries, saveMovement, saveSeries, setHidden, useData, usualStudio } from '../../lib/store';
import type { Movement, Series } from '../../lib/types';
import { Back, Chips, ClockInput, Empty, Field, Frames, Icon, Row, Screen, Springs, Stepper, Switch, Thumb, confirmAsk, fmtClock, toast } from '../bits';
import { nav, viewState } from '../nav';

type L = { id: string; label: string }[];
const lbl = (list: unknown, id?: string) => (id ? (labelOf(list as L, id) as string) : '');

export function LibraryScreen() {
  useData();
  const vs = viewState('library', { q: '', tab: 'movements', app: '', section: '', removed: false });
  const [, redraw] = useState(0);
  const set = (patch: Partial<typeof vs>) => { Object.assign(vs, patch); redraw((n) => n + 1); };
  const lib = library();
  const studio = usualStudio();
  const q = vs.q.trim().toLowerCase();
  const base = (vs.removed ? lib.removed : lib.list).filter((m) => (!vs.app || m.apparatus === vs.app)
    && (!q || (namesOf(m) as string[]).some((n) => n.toLowerCase().includes(q)) || [...(m.muscles?.primary || []), ...(m.muscles?.secondary || [])].some((x) => lbl(MUSCLES, x).toLowerCase().includes(q))));
  const counts = new Map<string, number>();
  for (const m of base) counts.set(sectionOf(m), (counts.get(sectionOf(m)) || 0) + 1);
  const list = base.filter((m) => !vs.section || sectionOf(m) === vs.section);
  const series = lib.series.filter((s) => (!vs.app || s.apparatus === vs.app) && (!q || s.name.toLowerCase().includes(q)));
  return (
    <Screen top={<>
      <div className="row between"><h1>Library</h1><button type="button" className="btn sm" onClick={() => nav.go({ name: 'movement-edit' })}><Icon name="plus" size={18} />New</button></div>
      <input type="search" placeholder="Search any name or muscle" aria-label="Search the library" value={vs.q} onChange={(e) => set({ q: e.target.value })} style={{ marginTop: 10 }} />
      <div style={{ marginTop: 10 }}><Chips scroll options={[{ id: 'movements', label: 'Movements' }, { id: 'series', label: 'Series' }, { id: 'reformer', label: 'Reformer' }, { id: 'mat', label: 'Mat' }]} value={[vs.tab, vs.app].filter(Boolean)} onPick={(id) => (id === 'movements' || id === 'series' ? set({ tab: id }) : set({ app: vs.app === id ? '' : id }))} /></div>
    </>}>
      {vs.tab === 'movements' ? <>
        <Chips scroll options={[{ id: '', label: `All ${base.length}` }, ...(SECTIONS as L).filter((s) => counts.get(s.id)).map((s) => ({ id: s.id, label: `${s.label} ${counts.get(s.id)}` }))]} value={vs.section} onPick={(section) => set({ section })} />
        {vs.removed ? <div className="card" style={{ background: 'var(--info-bg)', borderColor: 'var(--info-line)', color: 'var(--info)' }}>Movements taken out of your library. Open one to put it back.</div> : null}
        <div className="card flush">
          {list.map((m) => (
            <button type="button" className="set" key={m.slug} onClick={() => nav.go({ name: 'movement', id: m.slug })}>
              <Thumb mv={m} />
              <span className="grow"><b>{m.name}</b>{m.source === 'mine' ? <span className="tag acc" style={{ marginLeft: 6 }}>{isLibrary(m.slug) ? 'Changed' : 'Yours'}</span> : null}<div className="m">{[lbl(POSITIONS, m.position), (m.muscles?.primary || []).slice(0, 2).map((x) => lbl(MUSCLES, x)).join(', ')].filter(Boolean).join(' · ')}</div></span>
              {m.apparatus === 'reformer' ? <Springs loads={m.load?.springs} studio={studio} label={false} /> : <span className="tag">Mat</span>}
              <span style={{ color: 'var(--dim)', display: 'flex' }}><Icon name="next" size={18} /></span>
            </button>
          ))}
          {!list.length ? <div className="set"><span className="m">Nothing matches.</span></div> : null}
        </div>
        <button type="button" className="link center" style={{ textAlign: 'center' }} onClick={() => set({ removed: !vs.removed, section: '' })}>{vs.removed ? 'Back to the library' : `Removed movements (${lib.removed.length})`}</button>
      </> : <>
        <div className="card flush">
          {series.map((s) => <button type="button" className="set" key={s.slug} onClick={() => nav.go({ name: 'series', id: s.slug })}><span className="grow"><b>{s.name}</b>{s.source === 'mine' ? <span className="tag acc" style={{ marginLeft: 6 }}>Yours</span> : null}<div className="m">{s.items.length} movements{s.summary ? ` · ${s.summary}` : ''}</div></span><span style={{ color: 'var(--dim)', display: 'flex' }}><Icon name="next" size={18} /></span></button>)}
          {!series.length ? <div className="set"><span className="m">No series match.</span></div> : null}
        </div>
        <p className="m center">Save any phase of a class as a series from its phase menu.</p>
      </>}
    </Screen>
  );
}

export function MovementScreen({ slug }: { slug: string }) {
  useData();
  const mv = library().map[slug];
  const studio = usualStudio();
  if (!mv) return <Screen top={<><Back /><h1>Movement not found</h1></>}><Empty title="This movement isn't here" /></Screen>;
  const vars = variationsOf(mv) as { name: string; kind?: string; note?: string; springs?: string[] }[];
  const mark = (k?: string) => (OPTION_KINDS as { id: string; mark: string; label: string }[]).find((o) => o.id === kindOf(k));
  const changed = mv.source === 'mine' && isLibrary(slug);
  const own = mv.source === 'mine' && !isLibrary(slug);
  return (
    <Screen narrow top={<>
      <div className="row between"><Back /><button type="button" className="btn sm" onClick={() => nav.go({ name: 'movement-edit', id: slug })}><Icon name="edit" size={16} />Edit</button></div>
      <h1>{mv.name}</h1>
      {(mv.aka || []).length ? <div className="m">Also called: {(mv.aka || []).join(', ')}</div> : null}
    </>}>
      {mv.hidden ? <div className="card" style={{ background: 'var(--info-bg)', borderColor: 'var(--info-line)', color: 'var(--info)' }}><b>Not in your library.</b> {mv.retired ? 'It was retired because no published reference names it.' : 'You took it out.'} <button type="button" className="link" onClick={() => { setHidden(slug, false); toast('Back in your library.'); }}>Put it back</button></div> : null}
      <Frames mv={mv} width={170} />
      {mv.summary ? <p>{mv.summary}</p> : null}
      <div className="card flush">
        {mv.apparatus === 'reformer' ? <Row title="Springs" sub={studio.id ? `${studio.name} · usual` : 'Usual'} right={<Springs loads={mv.load?.springs} studio={studio} />} /> : <Row title="Apparatus" right={<span>Mat</span>} />}
        {mv.load?.advance?.length ? <Row title="To progress" right={<Springs loads={mv.load.advance} studio={studio} />} /> : null}
        <Row title="Level" right={<span>{levelLabel(mv) as string}</span>} />
        <Row title="Position" right={<span>{lbl(POSITIONS, mv.position)}</span>} />
        <Row title="Part of the class" right={<span>{lbl(SECTIONS, sectionOf(mv))}</span>} />
        <Row title="Works" right={<span style={{ textAlign: 'right' }}>{(mv.muscles?.primary || []).map((x) => lbl(MUSCLES, x)).join(', ') || '–'}</span>} />
        {(mv.muscles?.secondary || []).length ? <Row title="Also" right={<span style={{ textAlign: 'right' }}>{(mv.muscles?.secondary || []).map((x) => lbl(MUSCLES, x)).join(', ')}</span>} /> : null}
        {(mv.equipment || []).length ? <Row title="Needs" right={<span>{(mv.equipment || []).map((x) => lbl(EQUIPMENT, x)).join(', ')}</span>} /> : null}
        <Row title="Usual time" right={<span>{fmtClock(mv.duration || 120)}{mv.reps ? ` · ${mv.reps}` : ''}</span>} />
        {(usesOf(mv) as string[]).length ? <Row title="Belongs in" right={<span>{(usesOf(mv) as string[]).map((u) => lbl(USES, u)).join(', ')}</span>} /> : null}
      </div>
      {(mv.steps || []).length ? <div><div className="lab">How it goes</div><div className="card" style={{ marginTop: 8 }}><ol style={{ margin: 0, paddingLeft: 20 }}>{(mv.steps || []).map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}</ol></div></div> : null}
      {cueLines(mv.cues).length ? <div><div className="lab">Cues</div><div className="card" style={{ marginTop: 8 }}>{cueLines(mv.cues).map((c, i) => <div key={i}>· {c}</div>)}</div></div> : null}
      {(mv.layers || []).length || vars.length ? <div><div className="lab">Layers and variations</div>
        <div className="card flush" style={{ marginTop: 8 }}>
          {(mv.layers || []).map((l, i) => <div className="set" key={`l${i}`}><span className="grow">{l.title}{l.text ? <div className="m">{l.text}</div> : null}</span><span className="tiny">Layer</span></div>)}
          {vars.map((v, i) => <div className="set" key={`v${i}`}><span className="grow">{mark(v.kind)?.mark} {v.name}{v.note ? <div className="m">{v.note}</div> : null}</span>{v.springs?.length ? <Springs loads={v.springs} studio={studio} label={false} /> : null}<span className="tiny">{mark(v.kind)?.label}</span></div>)}
        </div></div> : null}
      {(mv.cautions || []).length ? <div><div className="lab">Take care with</div>
        <div className="card flush" style={{ marginTop: 8 }}>{(mv.cautions || []).map((c, i) => <div className="set" key={i}><span className="grow"><b>{lbl(CAUTIONS, c.tag)}</b> <span className={`tag${c.severity === 'avoid' ? ' warn' : ''}`}>{c.severity === 'avoid' ? 'Avoid' : 'Adjust'}</span>{c.note ? <div className="m">{c.note}</div> : null}</span></div>)}</div></div> : null}
      {mv.source === 'library' ? <div className="card" style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-line)', color: 'var(--warn)', fontSize: 'calc(13px * var(--scale))' }}><b>Not checked yet.</b> Written for OpenPilates and cross-checked for its name and springs. Set-up, cues and muscles still need an instructor's eye: edit anything that's wrong.</div> : null}
      <div className="card flush">
        {changed ? <Row icon="undo" title="Put back to how it shipped" sub="Drops your changes to this movement" onClick={async () => { if (await confirmAsk('Put this movement back?', 'Your changes to it are dropped and the built-in version returns.', 'Put it back')) { dropMovement(slug); toast('Back to the built-in version.'); } }} /> : null}
        {own ? <Row icon="trash" danger title="Delete this movement" onClick={async () => { if (await confirmAsk('Delete this movement?', 'Classes that use it keep the block, marked as missing.', 'Delete', true)) { dropMovement(slug); nav.back(); } }} />
          : !mv.hidden ? <Row icon="close" title="Take out of my library" sub="It stops being offered. Classes that use it still open." onClick={() => { setHidden(slug, true); nav.back(); toast(`${mv.name} taken out.`, { label: 'Undo', run: () => setHidden(slug, false) }); }} /> : null}
      </div>
    </Screen>
  );
}

/** Cues are kept one per line (as OpenPilates Server keeps them). */
const cueLines = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : String(v || '').split('\n')).map((x) => x.trim()).filter(Boolean);
const blank = (): Movement => ({ slug: '', name: '', aka: [], apparatus: 'reformer', section: (SECTIONS as L)[0].id, level: 'beginner', levelTo: 'advanced', pose: 'supine-footbar', position: 'supine', muscles: { primary: [], secondary: [] }, equipment: [], load: { springs: ['medium', 'medium'] }, duration: 120, reps: '', summary: '', steps: [], cues: '', layers: [], variations: [], uses: [], spine: ['neutral'], purpose: { strength: 0, stability: 0, flexibility: 0, mobility: 0 }, perSide: false, source: 'mine' });
const LV = [{ id: 'beginner', label: 'Beginner' }, { id: 'intermediate', label: 'Intermediate' }, { id: 'advanced', label: 'Advanced' }];

export function MovementEditScreen({ slug }: { slug?: string }) {
  useData();
  const existing = slug ? library().map[slug] : undefined;
  const [mv, setMv] = useState<Movement>(() => (existing ? structuredClone(existing) : blank()));
  const [past, setPast] = useState<Movement[]>([]);
  const [future, setFuture] = useState<Movement[]>([]);
  const studio = usualStudio();
  const edit = (fn: (m: Movement) => void) => { const next = structuredClone(mv); fn(next); setPast([...past.slice(-60), mv]); setFuture([]); setMv(next); };
  const undo = () => { const p = past[past.length - 1]; if (!p) return; setPast(past.slice(0, -1)); setFuture([...future, mv]); setMv(p); };
  const redo = () => { const f = future[future.length - 1]; if (!f) return; setFuture(future.slice(0, -1)); setPast([...past, mv]); setMv(f); };
  const lines = (v?: string[]) => (v || []).join('\n');
  const toLines = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);
  const toggle = (list: string[] | undefined, id: string) => ((list || []).includes(id) ? (list || []).filter((x) => x !== id) : [...(list || []), id]);
  const save = () => {
    const name = mv.name.trim();
    if (!name) { toast('Give the movement a name first.'); return; }
    let s = existing ? existing.slug : slugify(name);
    if (!existing) while (library().map[s]) s += '-2';
    const clean = cleanMovement({ ...mv, name, slug: s });
    if (!clean) { toast('Give the movement a name first.'); return; }
    saveMovement(clean);
    toast(existing && isLibrary(s) ? 'Saved as your version. The built-in one can be put back.' : 'Saved.');
    if (existing) nav.back(); else nav.swap({ name: 'movement', id: s });
  };
  const poses = (POSE_IDS as string[]).filter((p) => ((POSES as Record<string, { ctx: string }>)[p].ctx === 'reformer') === (mv.apparatus === 'reformer'));
  return (
    <Screen narrow top={<>
      <div className="row between"><Back label="Cancel" /><div className="row" style={{ gap: 6 }}><span className="m">{past.length ? 'Not saved yet' : 'No changes yet'}</span>
        <button type="button" className="btn icon" aria-label="Undo" disabled={!past.length} onClick={undo}><Icon name="undo" size={18} /></button>
        <button type="button" className="btn icon" aria-label="Redo" disabled={!future.length} onClick={redo}><Icon name="redo" size={18} /></button></div></div>
      <h1>{existing ? `Edit ${existing.name}` : 'New movement'}</h1>
    </>} foot={<button type="button" className="btn p grow" onClick={save}>Save</button>}>
      <Field label="Name"><input type="text" maxLength={100} value={mv.name} onChange={(e) => edit((m) => { m.name = e.target.value; })} /></Field>
      <Field label="Also called" hint="Other names, separated by commas. Search finds all of them."><input type="text" value={(mv.aka || []).join(', ')} onChange={(e) => edit((m) => { m.aka = e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8); })} /></Field>
      <div><div className="lab">Apparatus</div><div style={{ marginTop: 8 }}><Chips options={[{ id: 'reformer', label: 'Reformer' }, { id: 'mat', label: 'Mat' }]} value={mv.apparatus} onPick={(v) => edit((m) => { m.apparatus = v as Movement['apparatus']; const ok = (POSES as Record<string, { ctx: string }>)[m.pose || '']; if (!ok || (ok.ctx === 'reformer') !== (v === 'reformer')) m.pose = v === 'reformer' ? 'supine-footbar' : 'mat-supine'; })} /></div></div>
      <div className="row"><Field label="Position"><select value={mv.position || ''} onChange={(e) => edit((m) => { m.position = e.target.value; })}>{(POSITIONS as L).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
        <Field label="Part of the class"><select value={sectionOf(mv)} onChange={(e) => edit((m) => { m.section = e.target.value; })}>{(SECTIONS as L).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field></div>
      <div className="row"><Field label="Difficulty from"><select value={mv.level || 'beginner'} onChange={(e) => edit((m) => { m.level = e.target.value; if (LV.findIndex((l) => l.id === m.levelTo) < LV.findIndex((l) => l.id === m.level)) m.levelTo = m.level; })}>{LV.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></Field>
        <Field label="Up to"><select value={mv.levelTo || mv.level || 'advanced'} onChange={(e) => edit((m) => { m.levelTo = e.target.value; if (LV.findIndex((l) => l.id === m.levelTo) < LV.findIndex((l) => l.id === m.level)) m.level = m.levelTo; })}>{LV.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></Field></div>
      <div><div className="lab">Picture</div>
        <div className="card" style={{ marginTop: 8 }}><Frames mv={mv} width={150} /><select style={{ marginTop: 10 }} aria-label="Which picture to draw" value={mv.pose || ''} onChange={(e) => edit((m) => { m.pose = e.target.value; })}>{poses.map((p) => <option key={p} value={p}>{(POSES as Record<string, { label: string }>)[p].label}</option>)}</select><div className="tiny" style={{ marginTop: 6 }}>Pick the drawing closest to this movement.</div></div></div>
      {mv.apparatus === 'reformer' ? <div><div className="lab">Usual springs</div>
        <div className="card" style={{ marginTop: 8 }}><Springs loads={mv.load?.springs} studio={studio} />
          <div className="chips" style={{ marginTop: 10 }}>{(LOAD_LEVELS as string[]).filter((l) => !studio.id || Number(studio.springs[l]) > 0).map((l) => <button type="button" key={l} className="chip" onClick={() => edit((m) => { m.load = { ...(m.load || {}), springs: [...(m.load?.springs || []), l].slice(0, 5) }; })}>+ <Springs loads={[l]} studio={studio} /></button>)}
            <button type="button" className="chip" disabled={!mv.load?.springs?.length} onClick={() => edit((m) => { m.load = { ...(m.load || {}), springs: (m.load?.springs || []).slice(0, -1) }; })}>Take one off</button></div></div></div> : null}
      <div className="card flush">
        <Row title="Usual time" sub="Minutes:seconds, before layers" right={<ClockInput seconds={mv.duration || 120} onChange={(s) => edit((m) => { m.duration = s; })} label="Usual time" />} />
        <div className="set"><Field label="Reps or counts"><input type="text" maxLength={80} value={mv.reps || ''} onChange={(e) => edit((m) => { m.reps = e.target.value; })} /></Field></div>
      </div>
      <div><div className="lab">Works mainly</div><div style={{ marginTop: 8 }}><Chips options={(MUSCLES as L).map((x) => ({ id: x.id, label: x.label }))} value={mv.muscles?.primary || []} onPick={(id) => edit((m) => { m.muscles = { ...(m.muscles || {}), primary: toggle(m.muscles?.primary, id).slice(0, 8) }; })} /></div></div>
      <div><div className="lab">Also works</div><div style={{ marginTop: 8 }}><Chips options={(MUSCLES as L).filter((x) => !(mv.muscles?.primary || []).includes(x.id)).map((x) => ({ id: x.id, label: x.label }))} value={mv.muscles?.secondary || []} onPick={(id) => edit((m) => { m.muscles = { ...(m.muscles || {}), secondary: toggle(m.muscles?.secondary, id).slice(0, 8) }; })} /></div></div>
      <div><div className="lab">How the spine moves</div><div style={{ marginTop: 8 }}><Chips options={(SPINE as L).map((x) => ({ id: x.id, label: x.label }))} value={mv.spine || []} onPick={(id) => edit((m) => { m.spine = toggle(m.spine, id).slice(0, 4); })} /></div><div className="tiny" style={{ marginTop: 6, padding: '0 4px' }}>The spine check in a class counts these.</div></div>
      <div><div className="lab">What it is for</div><div className="card flush" style={{ marginTop: 8 }}>{(PURPOSES as L).map((x) => <Row key={x.id} title={x.label} sub="0 not at all · 3 mainly" right={<Stepper value={Number(mv.purpose?.[x.id]) || 0} min={0} max={3} label={x.label} onChange={(n) => edit((m) => { m.purpose = { ...(m.purpose || {}), [x.id]: n }; })} />} />)}
        <Row title="Done on each side" sub="Time is counted for both sides" right={<Switch on={!!mv.perSide} onChange={(on) => edit((m) => { m.perSide = on; })} label="Done on each side" />} /></div></div>
      <div><div className="lab">Needs</div><div style={{ marginTop: 8 }}><Chips options={(EQUIPMENT as L).map((x) => ({ id: x.id, label: x.label }))} value={mv.equipment || []} onPick={(id) => edit((m) => { m.equipment = toggle(m.equipment, id); })} /></div></div>
      <div><div className="lab">Where it belongs in a class</div><div style={{ marginTop: 8 }}><Chips options={(USES as L).map((x) => ({ id: x.id, label: x.label }))} value={(usesOf(mv) as string[])} onPick={(id) => edit((m) => { m.uses = toggle(usesOf(m) as string[], id); })} /></div><div className="tiny" style={{ marginTop: 6, padding: '0 4px' }}>Drafts only use marked movements for warm-ups and cool-downs.</div></div>
      <Field label="In a sentence"><textarea maxLength={600} value={mv.summary || ''} onChange={(e) => edit((m) => { m.summary = e.target.value; })} /></Field>
      <Field label="How it goes" hint="One step per line."><textarea value={lines(mv.steps)} onChange={(e) => edit((m) => { m.steps = toLines(e.target.value).slice(0, 12); })} /></Field>
      <Field label="Cues" hint="One per line."><textarea maxLength={2000} value={cueLines(mv.cues).length || !mv.cues ? (typeof mv.cues === 'string' ? mv.cues : cueLines(mv.cues).join('\n')) : ''} onChange={(e) => edit((m) => { m.cues = e.target.value; })} /></Field>
      <Field label="Layers" hint="One per line: what you build on top, in order."><textarea value={(mv.layers || []).map((l) => l.title || l.text || '').join('\n')} onChange={(e) => edit((m) => { const old = m.layers || []; m.layers = toLines(e.target.value).slice(0, 8).map((t, i) => (old[i] && (old[i].title || old[i].text) === t ? old[i] : { tag: `L${i + 1}`, title: t, text: '' })); })} /></Field>
      <Field label="Variations" hint="One per line. Start a line with - for a regression (easier) or + for a progression (harder)."><textarea value={(variationsOf(mv) as { name: string; kind?: string }[]).map((v) => `${kindOf(v.kind) === 'regression' ? '- ' : kindOf(v.kind) === 'progression' ? '+ ' : ''}${v.name}`).join('\n')} onChange={(e) => edit((m) => { const old = (m.variations || []) as { name: string }[]; m.variations = toLines(e.target.value).slice(0, 12).map((t) => { const kind = t.startsWith('-') ? 'regression' : t.startsWith('+') ? 'progression' : 'variation'; const name = t.replace(/^[-+]\s*/, ''); return { ...(old.find((o) => o.name === name) || {}), name, kind }; }); })} /></Field>
      {existing && isLibrary(existing.slug) ? <p className="m">Saving makes your own version of this built-in movement. It survives updates and can be put back to how it shipped.</p> : null}
      {existing && libraryVersion(existing.slug) && mv.cautions?.length ? <p className="tiny">Its "take care with" notes are kept as they are.</p> : null}
      <div className="card flush"><Row title="Peak movement" sub="Hard work that drafts save for the peak of the class" right={<Switch on={(usesOf(mv) as string[]).includes('peak')} onChange={() => edit((m) => { m.uses = toggle(usesOf(m) as string[], 'peak'); })} label="Peak movement" />} /></div>
    </Screen>
  );
}

export function SeriesScreen({ slug }: { slug: string }) {
  useData();
  const lib = library();
  const s = lib.series.find((x) => x.slug === slug);
  const [name, setName] = useState(s?.name || '');
  if (!s) return <Screen top={<><Back /><h1>Series not found</h1></>}><Empty title="This series isn't here" /></Screen>;
  const mine = s.source === 'mine';
  const keep = (next: Series) => saveSeries({ ...next, slug: mine ? next.slug : `mine-${next.slug}` });
  const move = (i: number, dir: -1 | 1) => { const items = [...s.items]; const j = i + dir; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; keep({ ...s, items }); if (!mine) nav.swap({ name: 'series', id: `mine-${s.slug}` }); };
  return (
    <Screen narrow top={<><Back label="Library" /><h1>{s.name}</h1><div className="m">{s.items.length} movements · {s.apparatus === 'mat' ? 'Mat' : 'Reformer'}{s.summary ? ` · ${s.summary}` : ''}</div></>}>
      {mine ? <div className="row"><input type="text" aria-label="Series name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /><button type="button" className="btn sm" disabled={!name.trim() || name === s.name} onClick={() => { keep({ ...s, name: name.trim() }); toast('Renamed.'); }}>Rename</button></div> : <p className="m">A built-in series. Changing its order makes your own copy.</p>}
      <div className="card flush">
        {s.items.map((it, i) => { const mv = lib.map[it.slug]; return (
          <div className="set" key={i}><Thumb mv={mv} /><span className="grow"><b>{mv ? mv.name : it.slug}</b>{it.variation ? <div className="m">{it.variation}</div> : null}</span>
            <button type="button" className="btn icon ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={16} /></button>
            <button type="button" className="btn icon ghost" aria-label="Move down" disabled={i === s.items.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={16} /></button></div>
        ); })}
      </div>
      <p className="m">Add a series to a class from "Add a block" → Series.</p>
      <div className="card flush"><Row icon="trash" danger title={mine ? 'Delete this series' : 'Take out of my library'} onClick={async () => { if (await confirmAsk(mine ? 'Delete this series?' : 'Take this series out?', 'Classes already built from it are not changed.', mine ? 'Delete' : 'Take out', true)) { removeSeries(s.slug); nav.back(); } }} /></div>
    </Screen>
  );
}
