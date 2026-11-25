// My studios: each place you teach, with its own reformers, springs and props.
import { BRANDS, EQUIPMENT, LOAD_LEVELS, labelOf, springFor } from '../../engine';
import { newStudio } from '../../lib/clean';
import { studioText, fileNameFor } from '../../lib/files';
import { giveFile } from '../../lib/storage';
import { removeStudio, saveStudio, setSettings, useData } from '../../lib/store';
import type { Studio } from '../../lib/types';
import { Back, Chips, Empty, Field, Icon, Row, Screen, Springs, Stepper, Switch, confirmAsk, toast } from '../bits';
import { nav } from '../nav';
import { studioLine } from './Builder';

type L = { id: string; label: string }[];
const allSprings = (s: Studio) => Object.entries(s.springs).flatMap(([l, c]) => Array(Math.min(6, Number(c) || 0)).fill(l) as string[]);
const WORD: Record<string, string> = { xlight: 'extra light', light: 'light', medium: 'medium', heavy: 'heavy', xheavy: 'extra heavy' };

export function StudiosScreen() {
  const d = useData();
  const add = () => { const s = newStudio(d.studios.length ? `Studio ${d.studios.length + 1}` : 'My studio'); saveStudio(s); nav.go({ name: 'studio', id: s.id }); };
  return (
    <Screen narrow top={<><Back label="More" /><div className="row between"><h1>My studios</h1><button type="button" className="btn p sm" onClick={add}><Icon name="plus" size={18} />Add a studio</button></div>
      <div className="m" style={{ marginTop: 6 }}>Each studio has its own reformers, springs and props. A class shows the springs of the studio you teach it at.</div></>}>
      {!d.studios.length ? <Empty title="No studios yet" text="Add the place you teach, so springs show in its colours."><button type="button" className="btn p" onClick={add}>Add a studio</button></Empty> : null}
      {d.studios.map((s) => (
        <button type="button" className="card pick" key={s.id} onClick={() => nav.go({ name: 'studio', id: s.id })}>
          <div className="row between"><b style={{ fontSize: 'calc(17px * var(--scale))' }}>{s.name}</b>{s.id === d.settings.usualStudio && d.studios.length > 1 ? <span className="tag acc">Usual studio</span> : null}</div>
          <div className="m">{studioLine(s)}</div>
          {s.hasReformers ? <div style={{ marginTop: 8 }}><Springs loads={allSprings(s)} studio={s} /></div> : null}
          <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>{Object.keys(s.props).slice(0, 5).map((p) => <span className="tag" key={p}>{labelOf(EQUIPMENT as L, p) as string}</span>)}{Object.keys(s.props).length > 5 ? <span className="tag">+{Object.keys(s.props).length - 5}</span> : null}</div>
        </button>
      ))}
      <button type="button" className="card dash" onClick={() => nav.go({ name: 'share' })}>Does a studio already have its set-up in OpenPilates? <span className="link">Import it</span> by QR code or file.</button>
    </Screen>
  );
}

export function StudioScreen({ id }: { id: string }) {
  const d = useData();
  const s = d.studios.find((x) => x.id === id);
  if (!s) return <Screen top={<><Back label="My studios" /><h1>Studio not found</h1></>}><Empty title="This studio is no longer here" /></Screen>;
  const edit = (patch: Partial<Studio>) => saveStudio({ ...s, ...patch });
  const brands = Object.entries(BRANDS as Record<string, { label: string; standard: Record<string, number>; springs: Record<string, unknown> }>);
  const levels = (LOAD_LEVELS as string[]).filter((l) => (BRANDS as Record<string, { springs: Record<string, unknown> }>)[s.brand].springs[l] || s.springOverrides[l] || s.springs[l]);
  const props = [...(EQUIPMENT as L)];
  const usedBy = d.classes.filter((c) => c.studioId === s.id).length;
  return (
    <Screen narrow top={<><div className="row between"><Back label="My studios" /><span className="m">Saved</span></div><h1>{s.name}</h1></>}>
      <Field label="Name"><input type="text" maxLength={60} value={s.name} onChange={(e) => edit({ name: e.target.value })} /></Field>
      <div className="card flush">
        <Row title="Has reformers" sub="Off for a mat-only space" right={<Switch on={s.hasReformers} onChange={(on) => edit({ hasReformers: on })} label="Has reformers" />} />
        {d.studios.length > 1 ? <Row title="My usual studio" sub="New classes start here" right={<Switch on={d.settings.usualStudio === s.id} onChange={(on) => setSettings({ usualStudio: on ? s.id : d.studios.find((x) => x.id !== s.id)?.id })} label="My usual studio" />} /> : null}
      </div>
      {s.hasReformers ? <>
        <div className="row"><Field label="Reformer"><select value={s.brand} onChange={(e) => edit({ brand: e.target.value, springs: { ...(BRANDS as Record<string, { standard: Record<string, number> }>)[e.target.value].standard }, springOverrides: {} })}>{brands.map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}</select></Field>
          <Field label="How many"><input type="number" inputMode="numeric" min={0} max={99} className="short" value={s.reformers} onChange={(e) => edit({ reformers: Math.max(0, Math.min(99, Math.round(Number(e.target.value)) || 0)) })} /></Field></div>
        <div className="lab">Springs on each reformer</div>
        <div className="card flush">
          {levels.map((l) => { const sp = springFor(s.brand, l, s.springOverrides) as { name: string; color: string }; return (
            <div className="set" key={l}><span className="dot" style={{ background: sp.color }} /><span className="grow"><b>{sp.name}</b> <span className="m">· {WORD[l]}</span></span><Stepper value={Number(s.springs[l]) || 0} max={8} label={sp.name} onChange={(n) => { const springs = { ...s.springs }; if (n > 0) springs[l] = n; else delete springs[l]; edit({ springs }); }} /></div>
          ); })}
          <Row title="Put the springs back to the usual set" sub={`What a ${labelOf(brands.map(([k, b]) => ({ id: k, label: b.label })), s.brand) as string} reformer ships with`} onClick={() => edit({ springs: { ...(BRANDS as Record<string, { standard: Record<string, number> }>)[s.brand].standard } })} />
        </div>
        <p className="m" style={{ padding: '0 4px' }}>A class keeps its springs as light, medium or heavy. Here they show as this studio's own colours, and a spring you don't have becomes the nearest one you do (marked ≈).</p>
      </> : null}
      <div className="lab">Props this studio has</div>
      <Chips options={props.map((p) => ({ id: p.id, label: p.label }))} value={Object.keys(s.props)} onPick={(pid) => { const next = { ...s.props }; if (next[pid]) delete next[pid]; else next[pid] = 1; edit({ props: next }); }} />
      <button type="button" className="link" onClick={() => nav.go({ name: 'setup', part: 'lists' })}>Add a prop that isn't listed</button>
      <div className="lab">Class types taught here</div>
      <Chips options={d.setup.classTypes.filter((c) => s.hasReformers || c.apparatus === 'mat').map((c) => ({ id: c.id, label: c.name }))} value={s.classTypes.length ? s.classTypes : d.setup.classTypes.map((c) => c.id)} onPick={(cid) => { const all = d.setup.classTypes.map((c) => c.id); const cur = s.classTypes.length ? s.classTypes : all; const next = cur.includes(cid) ? cur.filter((x) => x !== cid) : [...cur, cid]; edit({ classTypes: next.length === all.length ? [] : next }); }} />
      <div className="card flush">
        <Row icon="share" title="Share this studio's set-up" sub="So a co-worker doesn't type it in again" onClick={() => nav.go({ name: 'share', studioId: s.id })} />
        <Row icon="file" title="Save it as a file" onClick={() => void giveFile(fileNameFor(s.name, 'studio'), studioText(s)).catch(() => toast("Couldn't make the file."))} />
        <Row icon="trash" danger title="Delete this studio" sub={usedBy ? `${usedBy} class${usedBy === 1 ? ' was' : 'es were'} planned here. They stay, and follow your usual studio.` : undefined} onClick={async () => { if (await confirmAsk(`Delete ${s.name}?`, 'Its reformer, springs and props are removed from this device. Your classes stay.', 'Delete', true)) { nav.back(); removeStudio(s.id); } }} />
      </div>
    </Screen>
  );
}
