// First open: a short welcome, then the first studio.
import { useRef, useState } from 'react';
import { BRANDS } from '../../engine';
import { newStudio } from '../../lib/clean';
import { FileProblem, readIncoming, restoreBackup } from '../../lib/files';
import { saveStudio, setSettings } from '../../lib/store';
import { Field, toast } from '../bits';

export function Welcome() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('balanced_body');
  const [reformers, setReformers] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  const finish = () => { const s = newStudio(name.trim() || 'My studio', brand); saveStudio({ ...s, hasReformers: reformers }); setSettings({ welcomed: true, usualStudio: s.id }); };
  return (
    <div className="screen" style={{ background: 'var(--surface)' }}>
      <div className="body" style={{ justifyContent: 'center', paddingTop: 'calc(var(--safe-top) + 24px)' }}>
        <div className="stack narrow" style={{ maxWidth: 460, width: '100%', margin: '0 auto' }}>
          {step === 0 ? <>
            <img src="./icon.svg" width={72} height={72} alt="" style={{ borderRadius: 16 }} />
            <h1 style={{ fontSize: 'calc(34px * var(--scale))' }}>OpenPilates</h1>
            <p style={{ fontSize: 'calc(17px * var(--scale))' }}>Plan your mat and reformer classes, see what each class really does, and teach from your phone.</p>
            <p className="m">Free, no account, no ads. Everything stays on this device.</p>
            <button type="button" className="btn p" onClick={() => setStep(1)}>Get started</button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const inc = readIncoming(await f.text()); if (inc.kind !== 'backup') throw new FileProblem("That file isn't a backup. Get started first, then bring it in from More → Share and import."); restoreBackup(inc, 'replace'); toast('Backup restored.'); } catch (err) { toast(err instanceof Error ? err.message : "That file couldn't be read."); } }} />
            <button type="button" className="btn" onClick={() => file.current?.click()}>Restore from a backup</button>
          </> : <>
            <h1>Where do you teach?</h1>
            <p className="m">Your first studio. Springs show in its colours. You can add more studios, and change any of this, in More → My studios.</p>
            <Field label="Studio name"><input type="text" maxLength={60} placeholder="My studio" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Reformers"><select value={reformers ? brand : 'none'} onChange={(e) => { if (e.target.value === 'none') setReformers(false); else { setReformers(true); setBrand(e.target.value); } }}>{Object.entries(BRANDS as Record<string, { label: string }>).map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}<option value="none">No reformers: mat only</option></select></Field>
            <button type="button" className="btn p" onClick={finish}>Done</button>
            <button type="button" className="btn ghost" onClick={() => setStep(0)}>Back</button>
          </>}
        </div>
      </div>
    </div>
  );
}
