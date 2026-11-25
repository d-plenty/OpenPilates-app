// The More tab, Settings, Look and colours, the guide and About.
import { APP_VERSION, hasAnything } from '../../lib/files';
import { emptyData } from '../../lib/clean';
import { replaceAll, setSettings, useData } from '../../lib/store';
import { Back, Chips, Field, Row, Screen, Switch, confirmAsk, toast } from '../bits';
import { nav } from '../nav';
import { ACCENT_HEX, ACCENT_NAME, accentOf } from '../theme';

const Soon = () => (
  <>
    <div className="lab">Coming soon</div>
    <div className="card flush">
      <Row soon icon="sync" title="Sync my devices over Wi-Fi" sub="iPhone, iPad and Android on the same network" />
      <Row soon icon="server" title="Studio server" sub="End-to-end encrypted, on a server the studio runs" />
      <Row soon icon="people" title="Clients" sub="Comes back with the studio server" />
      <Row soon icon="screen" title="Computer version" sub="The app in a web browser" />
      <Row soon icon="widget" title="Home screen widgets" />
      <Row soon icon="watch" title="Watch control" sub="Next and pause from an Apple Watch" />
    </div>
  </>
);

export function MoreScreen() {
  const d = useData();
  const last = d.settings.lastBackup ? `Last backup ${new Date(d.settings.lastBackup).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'No backup yet';
  return (
    <Screen narrow top={<h1>More</h1>}>
      <div className="card flush">
        <Row icon="home" title="My studios" sub={d.studios.length ? `${d.studios.length} studio${d.studios.length === 1 ? '' : 's'} · reformers, springs, props` : 'Add the places you teach'} onClick={() => nav.go({ name: 'studios' })} />
        <Row icon="list" title="Class set-up" sub="Class types, levels, focuses, timing" onClick={() => nav.go({ name: 'setup' })} />
      </div>
      <div className="card flush">
        <Row icon="share" title="Share and import" sub="QR code over Wi-Fi, or a file" onClick={() => nav.go({ name: 'share' })} />
        <Row icon="box" title="Backups" sub={last} onClick={() => nav.go({ name: 'backups' })} />
      </div>
      <div className="card flush">
        <Row icon="cog" title="Settings" onClick={() => nav.go({ name: 'settings' })} />
        <Row icon="book" title="Guide" sub="How the app works" onClick={() => nav.go({ name: 'guide' })} />
      </div>
      <Soon />
    </Screen>
  );
}

export function SettingsScreen() {
  const d = useData();
  const s = d.settings;
  return (
    <Screen narrow top={<><Back label="More" /><h1>Settings</h1></>}>
      <div className="card flush">
        <Row icon="palette" title="Look and colours" sub={`${s.theme === 'auto' ? 'Matches the device' : s.theme === 'dark' ? 'Dark' : 'Light'} · ${ACCENT_NAME[s.accent] || 'Teal'}`} onClick={() => nav.go({ name: 'look' })} />
        <Row title="Keep the screen on in Play" right={<Switch on={s.keepAwake} onChange={(on) => setSettings({ keepAwake: on })} label="Keep the screen on in Play" />} />
        <Row title="Play screen always dark" sub="Easier to read across the room" right={<Switch on={s.playDark} onChange={(on) => setSettings({ playDark: on })} label="Play screen always dark" />} />
      </div>
      <div><div className="lab">Text size</div><div style={{ marginTop: 8 }}><Chips options={[{ id: 'normal', label: 'Normal' }, { id: 'large', label: 'Large' }, { id: 'larger', label: 'Larger' }]} value={s.textSize} onPick={(v) => setSettings({ textSize: v })} /></div></div>
      <Field label="This device's name" hint="Shown to someone you share a class with."><input type="text" maxLength={40} value={s.deviceName} onChange={(e) => setSettings({ deviceName: e.target.value })} /></Field>
      <div className="card flush">
        <Row icon="box" title="Backups" sub={s.autoBackup ? `Automatic · keeps the last ${s.keepBackups}` : 'Automatic backups are off'} onClick={() => nav.go({ name: 'backups' })} />
        <Row icon="share" title="Export and import" sub="A class, a studio, or everything" onClick={() => nav.go({ name: 'share' })} />
        <Row icon="server" title="Bring in from OpenPilates Server" sub="Flow files and studio packs" onClick={() => nav.go({ name: 'share' })} />
      </div>
      <div className="card flush">
        <Row title="Privacy" sub="Everything stays on this device. No account, no ads, nothing sent anywhere." onClick={() => nav.go({ name: 'about' })} />
        <Row icon="book" title="Guide" onClick={() => nav.go({ name: 'guide' })} />
        <Row title="About" sub={`OpenPilates ${APP_VERSION} · free software, GPL-3.0`} onClick={() => nav.go({ name: 'about' })} />
      </div>
      <Soon />
      <div className="card flush">
        <Row danger icon="trash" title="Erase everything" sub="Removes every class, studio and setting from this device" onClick={async () => {
          if (!(await confirmAsk('Erase everything on this device?', hasAnything() ? 'Your classes, studios, your own movements and settings are all removed. Backups already saved in Files are not touched. This cannot be undone.' : 'The app goes back to how it was when first opened.', 'Erase', true))) return;
          replaceAll(emptyData()); nav.reset(); toast('Erased.');
        }} />
      </div>
    </Screen>
  );
}

export function LookScreen() {
  const d = useData();
  const s = d.settings;
  const cur = accentOf(s);
  return (
    <Screen narrow top={<><Back label="Settings" /><h1>Look and colours</h1></>}>
      <div className="lab">Mode</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {([['light', 'Light', '#F3F5F4'], ['dark', 'Dark', '#111715'], ['auto', 'Match device', 'linear-gradient(90deg, #F3F5F4 50%, #111715 50%)']] as const).map(([id, label, bg]) => (
          <button type="button" key={id} className={`card pick${s.theme === id ? ' on' : ''}`} style={{ padding: 10, textAlign: 'center' }} aria-pressed={s.theme === id} onClick={() => setSettings({ theme: id })}><div style={{ height: 46, borderRadius: 8, background: bg, border: '1px solid var(--line)' }} /><b style={{ fontSize: 'calc(13px * var(--scale))' }}>{label}</b></button>
        ))}
      </div>
      <div className="lab">Colour</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, textAlign: 'center', fontSize: 'calc(12px * var(--scale))', fontWeight: 600 }}>
        {Object.entries(ACCENT_HEX).map(([id, hexv]) => <div key={id}><button type="button" className={`swatch${s.accent === id ? ' on' : ''}`} style={{ background: hexv }} aria-label={ACCENT_NAME[id]} aria-pressed={s.accent === id} onClick={() => setSettings({ accent: id })} /><div style={{ marginTop: 8 }}>{ACCENT_NAME[id]}{s.accent === id ? ' ✓' : ''}</div></div>)}
        <div><label className={`swatch${s.accent === 'own' ? ' on' : ''}`} style={{ display: 'block', background: s.ownAccent || 'var(--tint)', border: s.ownAccent ? 0 : '2px dashed var(--input)', position: 'relative', overflow: 'hidden' }}><input type="color" aria-label="Your own colour" value={s.ownAccent || cur} onChange={(e) => setSettings({ accent: 'own', ownAccent: e.target.value })} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', minHeight: 0, padding: 0 }} /></label><div style={{ marginTop: 8 }}>Your own{s.accent === 'own' ? ' ✓' : ''}</div></div>
      </div>
      <div className="lab">How it looks</div>
      <div className="card"><div className="row between"><b>Full body · Reformer Flow</b><span className="chip on">50 min</span></div>
        <div className="bar"><span style={{ flex: 5, background: '#8FB9AE' }} /><span style={{ flex: 16, background: 'var(--accent)' }} /><span style={{ flex: 8, background: 'var(--warn-dot)' }} /><span style={{ flex: 5, background: '#A7B5AF' }} /></div>
        <button type="button" className="btn p wide" style={{ marginTop: 12 }}>Add a block</button><div style={{ marginTop: 10 }}><span className="link">A link looks like this</span></div></div>
      <div className="card flush">
        <Row title="True black in dark mode" right={<Switch on={s.trueBlack} onChange={(on) => setSettings({ trueBlack: on })} label="True black in dark mode" />} />
        <Row title="Play screen always dark" sub="Easier to read across the room" right={<Switch on={s.playDark} onChange={(on) => setSettings({ playDark: on })} label="Play screen always dark" />} />
        <Row soon title="App icon colour" sub="Follows your colour" />
      </div>
    </Screen>
  );
}

const G = ({ t, children }: { t: string; children: React.ReactNode }) => <div className="card stack-sm"><b>{t}</b>{children}</div>;
export function GuideScreen() {
  return (
    <Screen narrow top={<><Back /><h1>Guide</h1><div className="m">How the app works. It assumes you know your Pilates.</div></>}>
      <G t="Set up once"><p className="m">More → My studios: add each place you teach, with its reformer, springs and props. More → Class set-up: your class types, levels, focuses and timing, the same at every studio.</p></G>
      <G t="Plan a class"><p className="m">Classes → New class. Pick the class type, length, level and focus, then draft it or start empty. A class is made of blocks: one movement and what you build on it. Tap a block to plan it: the version, springs, layers, a finisher, what you offer anyone who needs less, and your note.</p></G>
      <G t="Watch the time and the checks"><p className="m">Each phase shows its time against its minutes. The four numbers at the top open the checks: time, spring changes, muscle balance and how the spine moves. The arrows beside "Saved" undo and redo.</p></G>
      <G t="Teach it"><p className="m">Press play. With more than one studio the app asks which one you are at, and shows that studio's springs. Finishing the class logs it in Calendar → Taught.</p></G>
      <G t="Words the app uses"><p className="m"><b>Block:</b> a movement in a class, with its layers and finisher. <b>Phase:</b> a stretch of the class, such as warm-up or footwork; optional. <b>Layer:</b> something built on the movement with the whole class. <b>Variation:</b> another version: a regression (▼) is easier, a progression (▲) harder. <b>Series:</b> a ready-built run of movements. <b>Timed line:</b> time that is not a movement, such as a water break.</p></G>
      <G t="Springs across studios"><p className="m">A class keeps springs as light, medium or heavy. Each studio shows them in its own colours, and a spring it doesn't have becomes the nearest one it does, marked ≈.</p></G>
      <G t="Share and back up"><p className="m">Share a class by QR code with someone on the same Wi-Fi, or as a file. Backups are made about once a day when you open the app; copy one off the device now and then from More → Backups.</p></G>
      <G t="The library is a draft"><p className="m">Every movement was written for OpenPilates and cross-checked for its name and springs. Set-up, cues and muscles still need an instructor's eye. Edit anything that is wrong: your version is kept through updates.</p></G>
    </Screen>
  );
}

export function AboutScreen() {
  return (
    <Screen narrow top={<><Back /><h1>About</h1></>}>
      <div className="card stack-sm"><b>OpenPilates {APP_VERSION}</b><p className="m">Class planning for mat and reformer Pilates instructors. Free and open source (GPL-3.0). The movement library is under CC BY-SA 4.0.</p><p className="m">Source and updates: github.com/d-plenty/OpenPilates-app</p></div>
      <div className="card stack-sm"><b>Privacy</b><p className="m">Everything you make stays on this device. There is no account, no ads and no tracking, and the app never contacts a server. A class leaves the device only when you share it or save a backup somewhere yourself.</p><p className="m">The camera is used only to scan a sharing code. The local network is used only while a sharing code is on screen or being scanned.</p></div>
      <div className="card stack-sm"><b>Take care</b><p className="m">The starter library is a draft written for this app. It is a planning aid for qualified instructors, not teaching or medical advice. Check anything before you teach from it.</p></div>
      <div className="card stack-sm"><b>Made with</b><p className="m">React, Capacitor, zxing (QR codes), fflate, noble ciphers and hashes, Inter and Space Grotesk.</p></div>
    </Screen>
  );
}
