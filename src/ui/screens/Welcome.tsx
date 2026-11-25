// First open: a short welcome, then setting up the first studio (or skipping it, or restoring a backup).
import { useRef, useState } from 'react';
import { BRANDS, LOAD_LEVELS, springFor } from '../../engine';
import { newStudio } from '../../lib/clean';
import { FileProblem, readIncoming, restoreBackup } from '../../lib/files';
import { saveStudio, setSettings } from '../../lib/store';
import type { Studio } from '../../lib/types';
import { Field, Stepper, toast } from '../bits';
import { PropsOwned } from './Studios';

type BrandT = { label: string; standard: Record<string, number>; springs: Record<string, unknown> };

export function Welcome() {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<Studio>(() => newStudio());
  const edit = (fn: (x: Studio) => void) => { const x = structuredClone(s); fn(x); setS(x); };
  const file = useRef<HTMLInputElement>(null);
  const brand = (BRANDS as Record<string, BrandT>)[s.brand];
  const skip = () => { setSettings({ welcomed: true }); toast('You can set up a studio any time in More → My studios.'); };
  const finish = () => { const name = s.name.trim() || 'My studio'; saveStudio({ ...s, name }); setSettings({ welcomed: true, usualStudio: s.id }); toast(`${name} saved. Your first class will ask about its class type.`); };
  const steps = s.hasReformers ? 3 : 2;
  return (
    <div className="screen" style={{ background: 'var(--surface)' }}>
      <div className="body" style={{ paddingTop: 'calc(var(--safe-top) + 24px)' }}>
        <div className="stack narrow" style={{ maxWidth: 460, width: '100%', margin: '0 auto' }}>
          {step === 0 ? <>
            <img src="./icon.svg" width={72} height={72} alt="" style={{ borderRadius: 16 }} />
            <h1 style={{ fontSize: 'calc(34px * var(--scale))' }}>OpenPilates</h1>
            <p style={{ fontSize: 'calc(17px * var(--scale))' }}>Plan your mat and reformer classes, see what each class really does, and teach from your phone.</p>
            <p className="m">Free, no account, no ads. Everything stays on this device.</p>
            <button type="button" className="btn p" onClick={() => setStep(1)}>Set up my studio</button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const inc = readIncoming(await f.text()); if (inc.kind !== 'backup') throw new FileProblem("That file isn't a backup. Set up first, then bring it in from More → Share and import."); restoreBackup(inc, 'replace'); toast('Backup restored.'); } catch (err) { toast(err instanceof Error ? err.message : "That file couldn't be read."); } }} />
            <button type="button" className="btn" onClick={() => file.current?.click()}>Restore from a backup</button>
            <button type="button" className="btn ghost" onClick={skip}>Skip for now</button>
            <p className="tiny center">Skipping is fine, but most of the app needs a studio: classes, springs and drafts all follow it.</p>
          </> : null}
          {step === 1 ? <>
            <div className="tiny">Step 1 of {steps}</div>
            <h1>Where do you teach?</h1>
            <p className="m">Your first studio. Everything in the app follows it: springs show as its reformers, drafts use the props you own there. You can add more studios later.</p>
            <Field label="Studio name"><input type="text" maxLength={60} placeholder="e.g. Harbour Pilates" value={s.name} onChange={(e) => edit((x) => { x.name = e.target.value; })} /></Field>
            <Field label="Reformers"><select value={s.hasReformers ? s.brand : 'none'} onChange={(e) => edit((x) => { if (e.target.value === 'none') x.hasReformers = false; else { x.hasReformers = true; x.brand = e.target.value; x.springs = { ...(BRANDS as Record<string, BrandT>)[e.target.value].standard }; x.springOverrides = {}; } })}>{Object.entries(BRANDS as Record<string, BrandT>).map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}<option value="none">No reformers: mat only</option></select></Field>
            {s.hasReformers ? <Field label="How many reformers"><input type="number" inputMode="numeric" min={0} max={99} className="short" placeholder="0" value={s.reformers || ''} onChange={(e) => edit((x) => { x.reformers = Math.max(0, Math.min(99, Math.round(Number(e.target.value)) || 0)); })} /></Field> : null}
            <div className="row"><button type="button" className="btn grow" onClick={() => setStep(0)}>Back</button><button type="button" className="btn p grow" disabled={!s.name.trim()} onClick={() => setStep(2)}>Next</button></div>
          </> : null}
          {step === 2 && s.hasReformers ? <>
            <div className="tiny">Step 2 of {steps}</div>
            <h1>Springs on each reformer</h1>
            <p className="m">What a {brand.label} usually has. Change the numbers to match yours: every spring in the app follows them.</p>
            <div className="card flush">
              {(LOAD_LEVELS as string[]).filter((l) => brand.springs[l] || s.springs[l]).map((l) => { const sp = springFor(s.brand, l, s.springOverrides) as { name: string; color: string }; return (
                <div className="set" key={l}><span className="dot" style={{ background: sp.color }} /><span className="grow"><b>{sp.name}</b></span><Stepper value={Number(s.springs[l]) || 0} max={8} label={sp.name} onChange={(n) => edit((x) => { const sp2 = { ...x.springs }; if (n > 0) sp2[l] = n; else delete sp2[l]; x.springs = sp2; })} /></div>
              ); })}
            </div>
            <div className="row"><button type="button" className="btn grow" onClick={() => setStep(1)}>Back</button><button type="button" className="btn p grow" onClick={() => setStep(3)}>Next</button></div>
          </> : null}
          {(step === 3 || (step === 2 && !s.hasReformers)) ? <>
            <div className="tiny">Step {steps} of {steps}</div>
            <h1>Props you own</h1>
            <p className="m">How many of each at {s.name.trim() || 'your studio'}. Leave it at 0 for what you don't have. Drafts only use movements you have the props for.</p>
            <PropsOwned s={s} edit={edit} />
            <div className="row"><button type="button" className="btn grow" onClick={() => setStep(s.hasReformers ? 2 : 1)}>Back</button><button type="button" className="btn p grow" onClick={finish}>Save my studio</button></div>
          </> : null}
        </div>
      </div>
    </div>
  );
}
