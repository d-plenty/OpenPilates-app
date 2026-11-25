// The More tab, Settings, Look and colours, Accessibility, the guide and About.
// Settings are edited as an unsaved copy until Save. Colours and dark mode show straight away
// and go back if the screen is left without saving.
import type { ReactNode } from 'react';
import { draftOf, editDraft, markSaved, openDraft } from '../../lib/drafts';
import { APP_VERSION, hasAnything } from '../../lib/files';
import { emptyData } from '../../lib/clean';
import { getData, replaceAll, setSettings, useData, usualStudio } from '../../lib/store';
import type { Settings } from '../../lib/types';
import { closeAllDrafts } from '../../lib/drafts';
import { Back, Chips, Field, Row, SaveButton, Screen, Switch, confirmAsk, toast, useEditing } from '../bits';
import { nav, type Route } from '../nav';
import { ACCENT_HEX, ACCENT_NAME, accentOf } from '../theme';
import { addStudio } from './Studios';

export const SETTINGS_KEY = 'settings';
/** The settings being edited, with Save. Used by Settings, Look and colours, Accessibility and Backups. */
export function useSettingsDraft() {
  const d = useData();
  const s = draftOf<Settings>(SETTINGS_KEY) || openDraft(SETTINGS_KEY, d.settings);
  const save = () => { const x = draftOf<Settings>(SETTINGS_KEY); if (x) { setSettings(x); markSaved(SETTINGS_KEY); } return true; };
  const dirty = useEditing(SETTINGS_KEY, 'your settings', save);
  const edit = (patch: Partial<Settings>) => editDraft<Settings>(SETTINGS_KEY, (x) => Object.assign(x, patch));
  const top = (title: string, back = 'Settings', sub?: ReactNode) => <><div className="row between"><Back label={back} /><SaveButton dirty={dirty} onSave={() => { save(); toast('Settings saved.'); }} /></div><h1>{title}</h1>{sub ? <div className="m" style={{ marginTop: 4 }}>{sub}</div> : null}</>;
  return { s, edit, dirty, save, top };
}

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
  const usual = usualStudio();
  const last = d.settings.lastBackup ? `Last backup ${new Date(d.settings.lastBackup).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'No backup yet';
  return (
    <Screen narrow top={<h1>More</h1>}>
      <div className="card flush">
        <Row icon="home" title="My studios" sub={d.studios.length ? `${d.studios.map((s) => s.name).join(', ')} · reformers, springs, props, class set-up` : 'Set up where you teach'} onClick={() => nav.go({ name: 'studios' })} />
        <Row icon="list" title="Class set-up" sub={usual.id ? `At ${usual.name}: class types, levels, focuses, timing` : 'Set up a studio first'} onClick={() => (usual.id ? nav.go({ name: 'setup', studio: usual.id }) : addStudio())} />
      </div>
      <div className="card flush">
        <Row icon="share" title="Share and import" sub="QR code over Wi-Fi, a file, or a pack" onClick={() => nav.go({ name: 'share' })} />
        <Row icon="box" title="Backups" sub={last} onClick={() => nav.go({ name: 'backups' })} />
      </div>
      <div className="card flush">
        <Row icon="cog" title="Settings" sub="Look and colours, accessibility, Play" onClick={() => nav.go({ name: 'settings' })} />
        <Row icon="book" title="Guide" sub="How the app works" onClick={() => nav.go({ name: 'guide' })} />
      </div>
      <Soon />
    </Screen>
  );
}

export function SettingsScreen() {
  const { s, edit, top } = useSettingsDraft();
  return (
    <Screen narrow top={top('Settings', 'More')}>
      <div className="card flush">
        <Row icon="palette" title="Look and colours" sub={`${s.theme === 'auto' ? 'Matches the device' : s.theme === 'dark' ? 'Dark' : 'Light'} · ${ACCENT_NAME[s.accent] || 'Teal'}`} onClick={() => nav.go({ name: 'look' })} />
        <Row icon="people" title="Accessibility" sub="Text size, bold text, contrast, bigger buttons, less motion" onClick={() => nav.go({ name: 'a11y' })} />
      </div>
      <div className="lab">Play</div>
      <div className="card flush">
        <Row title="Keep the screen on in Play" right={<Switch on={s.keepAwake} onChange={(on) => edit({ keepAwake: on })} label="Keep the screen on in Play" />} />
        <Row title="Play screen always dark" sub="Easier to read across the room" right={<Switch on={s.playDark} onChange={(on) => edit({ playDark: on })} label="Play screen always dark" />} />
      </div>
      <Field label="This device's name" hint="Shown to someone you share a class with."><input type="text" maxLength={40} value={s.deviceName} onChange={(e) => edit({ deviceName: e.target.value })} /></Field>
      <div className="card flush">
        <Row icon="box" title="Backups" sub={s.autoBackup ? `Automatic · keeps the last ${s.keepBackups}` : 'Automatic backups are off'} onClick={() => nav.go({ name: 'backups' })} />
        <Row icon="share" title="Export and import" sub="A class, a studio, a pack, or everything" onClick={() => nav.go({ name: 'share' })} />
        <Row icon="server" title="Bring in from OpenPilates Server" sub="Flow files and packs" onClick={() => nav.go({ name: 'share' })} />
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
          closeAllDrafts(); replaceAll(emptyData()); nav.reset(); toast('Erased.');
        }} />
      </div>
    </Screen>
  );
}

export function LookScreen() {
  const { s, edit, top } = useSettingsDraft();
  const cur = accentOf(s);
  return (
    <Screen narrow top={top('Look and colours', 'Back', 'Shown straight away. Save to keep it; leave without saving and it goes back.')}>
      <div className="lab">Mode</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {([['light', 'Light', '#F3F5F4'], ['dark', 'Dark', '#111715'], ['auto', 'Match device', 'linear-gradient(90deg, #F3F5F4 50%, #111715 50%)']] as const).map(([id, label, bg]) => (
          <button type="button" key={id} className={`card pick${s.theme === id ? ' on' : ''}`} style={{ padding: 10, textAlign: 'center' }} aria-pressed={s.theme === id} onClick={() => edit({ theme: id })}><div style={{ height: 46, borderRadius: 8, background: bg, border: '1px solid var(--line)' }} /><b style={{ fontSize: 'calc(13px * var(--scale))' }}>{label}</b></button>
        ))}
      </div>
      <div className="lab">Colour</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, textAlign: 'center', fontSize: 'calc(12px * var(--scale))', fontWeight: 600 }}>
        {Object.entries(ACCENT_HEX).map(([id, hexv]) => <div key={id}><button type="button" className={`swatch${s.accent === id ? ' on' : ''}`} style={{ background: hexv }} aria-label={ACCENT_NAME[id]} aria-pressed={s.accent === id} onClick={() => edit({ accent: id })} /><div style={{ marginTop: 8 }}>{ACCENT_NAME[id]}{s.accent === id ? ' ✓' : ''}</div></div>)}
        <div><label className={`swatch${s.accent === 'own' ? ' on' : ''}`} style={{ display: 'block', background: s.ownAccent || 'var(--tint)', border: s.ownAccent ? 0 : '2px dashed var(--input)', position: 'relative', overflow: 'hidden' }}><input type="color" aria-label="Your own colour" value={s.ownAccent || cur} onChange={(e) => edit({ accent: 'own', ownAccent: e.target.value })} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', minHeight: 0, padding: 0 }} /></label><div style={{ marginTop: 8 }}>Your own{s.accent === 'own' ? ' ✓' : ''}</div></div>
      </div>
      <div className="lab">How it looks</div>
      <div className="card"><div className="row between"><b>Full body · Reformer Flow</b><span className="chip on">50 min</span></div>
        <div className="bar"><span style={{ flex: 5, background: '#8FB9AE' }} /><span style={{ flex: 16, background: 'var(--accent)' }} /><span style={{ flex: 8, background: 'var(--warn-dot)' }} /><span style={{ flex: 5, background: '#A7B5AF' }} /></div>
        <button type="button" className="btn p wide" style={{ marginTop: 12 }}>Add a block</button><div style={{ marginTop: 10 }}><span className="link">A link looks like this</span></div></div>
      <div className="card flush">
        <Row title="True black in dark mode" sub="Easier on the battery of OLED screens" right={<Switch on={s.trueBlack} onChange={(on) => edit({ trueBlack: on })} label="True black in dark mode" />} />
        <Row title="Play screen always dark" sub="Easier to read across the room" right={<Switch on={s.playDark} onChange={(on) => edit({ playDark: on })} label="Play screen always dark" />} />
        <Row soon title="App icon colour" sub="Follows your colour" />
      </div>
    </Screen>
  );
}

/** Accessibility, as in Restock (WCAG 2.2: text size, contrast, spacing, target size, motion, timing). */
export function A11yScreen() {
  const { s, edit, top } = useSettingsDraft();
  const a = s.a11y;
  const t = (key: keyof Settings['a11y'], title: string, sub: string) => <Row title={title} sub={sub} right={<Switch on={a[key]} onChange={(on) => edit({ a11y: { ...a, [key]: on } })} label={title} />} />;
  return (
    <Screen narrow top={top('Accessibility')}>
      <div className="lab">Seeing</div>
      <div className="card flush">
        <div className="set" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}><b>Text size in OpenPilates</b>
          <Chips options={[{ id: 'normal', label: 'Normal' }, { id: 'large', label: 'Large' }, { id: 'larger', label: 'Larger' }]} value={s.textSize} onPick={(v) => edit({ textSize: v })} />
          <span className="tiny">On top of your phone's own text size. Everything grows together, so nothing gets cut off.</span></div>
        {t('bold', 'Bold text', 'Heavier letters everywhere, easier to read.')}
        {t('contrast', 'High contrast', 'Darker grey text and stronger outlines on cards, buttons and boxes.')}
        {t('spacing', 'Easier reading spacing', 'More space between letters, words and lines. Can help with dyslexia.')}
        {t('links', 'Underline links', 'Links are underlined, not just coloured.')}
      </div>
      <div className="lab">Moving and touching</div>
      <div className="card flush">
        {t('big', 'Bigger buttons', 'Every button and chip at least finger-sized.')}
        {t('motion', 'Less motion', 'No sliding or popping animations. Also done when your phone asks for less motion.')}
        {t('slowMessages', 'Messages stay longer', 'Messages at the bottom of the screen, and their Undo, stay three times as long.')}
      </div>
      <p className="tiny" style={{ padding: '0 4px' }}>OpenPilates works with VoiceOver and with your iPhone's own text size and display settings. Every button says what it does.</p>
    </Screen>
  );
}

// ---- the guide, with links to each part of the app
function G({ t, children, go }: { t: string; children: ReactNode; go?: { label: string; route: Route | (() => void) }[] }) {
  return <div className="card stack-sm"><b>{t}</b>{children}{go?.length ? <div className="row wrap" style={{ gap: 10 }}>{go.map((g) => <button type="button" key={g.label} className="link" onClick={() => (typeof g.route === 'function' ? g.route() : nav.go(g.route))}>{g.label} →</button>)}</div> : null}</div>;
}
export function GuideScreen() {
  const st = usualStudio();
  const setup = (part?: string) => () => (st.id ? nav.go({ name: 'setup', studio: st.id, ...(part ? { part } : {}) }) : addStudio());
  return (
    <Screen narrow top={<><Back /><h1>Guide</h1><div className="m">How the app works. It assumes you know your Pilates.</div></>}>
      <G t="Set up as you go" go={[{ label: 'My studios', route: { name: 'studios' } }, { label: 'Add a studio', route: addStudio }]}><p className="m">Everything belongs to a studio: its reformers and springs, the props you own there, and how classes are set up there (class types, levels, focuses, timing, parts of the class). Start with one studio; the app asks for the rest when it needs it. Your movement library is yours, the same at every studio.</p></G>
      <G t="Class set-up" go={[{ label: 'Class types', route: setup('types') }, { label: 'Levels', route: setup('levels') }, { label: 'Focuses', route: setup('focuses') }, { label: 'Lengths and timing', route: setup('timing') }]}><p className="m">Your first class at a studio walks you through its first class type. Add more, and your own levels and focuses, in the studio's class set-up.</p></G>
      <G t="Plan a class" go={[{ label: 'New class', route: () => nav.home('classes').then(() => nav.go({ name: 'new' }, 'classes')) }]}><p className="m">Pick the studio it's for, the class type, length, level and focus, then draft it or start empty. A class is made of blocks: one movement and what you build on it. Tap a block to plan its version, springs, props, layers, a finisher, easier and harder options, and your note.</p></G>
      <G t="Save, undo and redo"><p className="m">Nothing is saved until you tap Save, top right. Back asks whether to save or leave your changes. In a class, the arrows beside Save undo and redo. Play and Share use the saved class, so they ask you to save first.</p></G>
      <G t="Watch the time and the checks"><p className="m">Each part of the class shows its time against its minutes. The numbers at the top open the checks: time, spring changes, muscle balance and how the spine moves. The props bar shows every prop the class uses, and which ones the studio doesn't have.</p></G>
      <G t="Springs across studios" go={[{ label: 'My studios', route: { name: 'studios' } }]}><p className="m">A class keeps springs as light, medium or heavy, and every screen shows them as the studio's own reformer springs. A spring the studio doesn't have becomes the nearest one it does, marked ≈. A class is built for one studio; change it with "Built for" at the top of the class.</p></G>
      <G t="Teach it"><p className="m">Press play. With more than one studio the app asks which one you are at, shows that studio's springs and says if a prop is missing there. Finishing the class logs it in Calendar → Taught.</p></G>
      <G t="Words the app uses"><p className="m"><b>Block:</b> a movement in a class, with its layers and finisher. <b>Part (phase):</b> a stretch of the class, such as warm-up or footwork; optional. <b>Layer:</b> something built on the movement with the whole class. <b>Variation:</b> another version: a regression (▼) is easier, a progression (▲) harder. <b>Series:</b> a ready-built run of movements. <b>Timed line:</b> time that is not a movement, such as a water break.</p></G>
      <G t="Share and back up" go={[{ label: 'Share and import', route: { name: 'share' } }, { label: 'Backups', route: { name: 'backups' } }, { label: 'Make a pack', route: { name: 'pack' } }]}><p className="m">Share a class by QR code with someone on the same Wi-Fi, or as a file. Backups are made about once a day when you open the app; copy one off the device now and then.</p></G>
      <G t="Make it easier to use" go={[{ label: 'Look and colours', route: { name: 'look' } }, { label: 'Accessibility', route: { name: 'a11y' } }]}><p className="m">Light or dark, your own colour, bigger text, bold text, high contrast, bigger buttons and less motion.</p></G>
      <G t="The library is a draft" go={[{ label: 'Library', route: () => void nav.tab('library') }]}><p className="m">Every movement was written for OpenPilates and cross-checked for its name and springs. Set-up, cues and muscles still need an instructor's eye. Edit anything that is wrong, and keep your own notes on any movement: your version is kept through updates.</p></G>
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
export const settingsNow = () => draftOf<Settings>(SETTINGS_KEY) || getData().settings;
