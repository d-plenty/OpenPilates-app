import { beforeEach, describe, expect, it } from 'vitest';
import { cleanData, cleanMovement, cleanPlan, cleanSettings, cleanStudio, defaultSetup, emptyData, newStudio, slugify } from '../src/lib/clean';
import { backupText, bringIn, classText, fileNameFor, readIncoming, restoreBackup, studioText, FileProblem } from '../src/lib/files';
import { blockCount, canRedo, canUndo, changeClass, classTypesFor, findItem, makePlan, nudge, redoClass, undoClass } from '../src/lib/plan';
import { base32, fetchText, isSendCode, keyOf, offerText, open, seal, unbase32, type Lan } from '../src/lib/send';
import { _reset, analyse, classOf, duplicateClass, getData, lastTaught, library, logTaught, removeStudio, saveClass, saveMovement, saveStudio, setHidden, setSettings, studioOf, usualStudio } from '../src/lib/store';
import { BRANDS } from '../src/engine';
import { accentVars } from '../src/ui/theme';

const ALL = { classes: true, movements: true, studios: true, setup: true, series: true };
function studio(name = 'Harbour', brand = 'balanced_body') { const s = newStudio(name, brand); saveStudio(s); return studioOf(s.id); }
function drafted(st = studio(), draft = true) {
  const ct = classTypesFor(st)[0];
  const plan = makePlan({ classType: ct, lengthMin: 50, level: 'mixed', goal: 'full_body', focusText: '', studio: st, draft });
  saveClass(plan);
  return classOf(plan.id)!;
}
beforeEach(() => _reset());

describe('the library', () => {
  it('ships every movement and series, with unique names', () => {
    const lib = library();
    expect(lib.list.length).toBe(184);
    expect(lib.series.length).toBe(18);
    expect(new Set(lib.list.map((m) => m.slug)).size).toBe(184);
    for (const s of lib.series) for (const it of s.items) expect(lib.map[it.slug!], `${s.slug} → ${it.slug}`).toBeTruthy();
  });
  it('every shipped movement passes through cleaning unchanged, so a file means the same here and on the server', () => {
    for (const m of [...library().list, ...library().removed]) {
      const { source: _a, ...was } = JSON.parse(JSON.stringify(m)) as typeof m;
      if (was.load && was.load.lighterIsHarder === false) delete was.load.lighterIsHarder; // a plain "no" isn't kept
      if (Array.isArray(was.sources) && !was.sources.length) delete was.sources;
      const { source: _b, ...now } = cleanMovement(JSON.parse(JSON.stringify(m)))!;
      expect(now, m.slug).toEqual(was);
    }
  });
  it('a movement made from almost nothing gets safe values', () => {
    const m = cleanMovement({ name: 'Thing', apparatus: 'mat', cues: ['a', 'b'], load: { springs: ['medium'] } })!;
    expect(m.load).toBeNull();
    expect(m.cues).toBe('a\nb');
    expect(m.spine).toEqual(['neutral']);
    expect(m.purpose).toEqual({ strength: 0, stability: 0, flexibility: 0, mobility: 0 });
    expect(cleanMovement({ name: 'R', load: { springs: ['medium', 'nope'] } })!.load).toEqual({ springs: ['medium'] });
  });
  it('keeps your version of a movement, and hides without breaking classes', () => {
    const one = library().list[0];
    saveMovement({ ...one, summary: 'Mine now.' });
    expect(library().map[one.slug].summary).toBe('Mine now.');
    expect(library().list.length).toBe(184);
    setHidden(one.slug, true);
    expect(library().list.some((m) => m.slug === one.slug)).toBe(false);
    expect(library().map[one.slug]).toBeTruthy();
  });
});

describe('cleaning what comes in', () => {
  it('survives rubbish', () => {
    for (const junk of [null, 7, 'x', [], { classes: 'no', studios: [null, 3], settings: { theme: 'pink', textSize: 9 }, setup: { levels: 'x' } }]) {
      const d = cleanData(junk);
      expect(Array.isArray(d.classes)).toBe(true);
      expect(d.settings.theme).toBe('auto');
      expect(d.setup.levels.length).toBeGreaterThan(0);
    }
  });
  it('keeps a plan in shape', () => {
    const p = cleanPlan({ title: '  A  ', lengthMin: 9999, segments: [{ name: 'Warm', role: 'warmup', items: [{ slug: 'footwork' }, { pause: true, label: 'Water', duration: 60 }, { nothing: 1 }] }, 'bad'] });
    expect(p.id).toBeTruthy();
    expect(p.lengthMin).toBeLessThanOrEqual(240);
    expect(p.segments.length).toBe(1);
    expect(p.segments[0].items.length).toBe(2);
    expect(p.segments[0].items.every((i) => i.id)).toBe(true);
  });
  it('keeps settings and studios in range', () => {
    expect(cleanSettings({ accent: 'own', ownAccent: 'red' }).accent).toBe('teal');
    expect(cleanSettings({ accent: 'own', ownAccent: '#aa33cc' }).ownAccent).toBe('#aa33cc');
    const s = cleanStudio({ name: '', brand: 'nope', reformers: -4 });
    expect(s.name).toBeTruthy();
    expect(s.brand).toBe('balanced_body');
    expect(s.reformers).toBeGreaterThanOrEqual(0);
    expect(slugify('Hundred — on the Box!')).toBe('hundred-on-the-box');
  });
});

describe('studios', () => {
  it('the first studio becomes the usual one, and removing it moves on', () => {
    const a = studio('A'); const b = studio('B');
    expect(usualStudio().id).toBe(a.id);
    const plan = drafted(a);
    removeStudio(a.id);
    expect(usualStudio().id).toBe(b.id);
    expect(classOf(plan.id)).toBeTruthy();
  });
  it('a class shows the springs of the studio it is taught at', () => {
    const bb = studio('BB', 'balanced_body'); const other = studio('Other', Object.keys(BRANDS as Record<string, unknown>).find((k) => k !== 'balanced_body')!);
    const plan = drafted(bb);
    const a = analyse(plan, bb); const b = analyse(plan, other);
    expect(a.count).toBe(b.count);
    expect(a.count).toBeGreaterThan(0);
    expect(a.totalSec).toBe(b.totalSec);
    expect(a.hasReformer).toBe(true);
  });
});

describe('planning', () => {
  it('drafts a full class that fits its time', () => {
    const st = studio();
    const plan = drafted(st);
    expect(blockCount(plan)).toBeGreaterThan(5);
    const a = analyse(plan, st);
    expect(a.totalSec / 60).toBeGreaterThan(35);
    expect(a.totalSec / 60).toBeLessThan(60);
    for (const seg of plan.segments) for (const it of seg.items) if (!it.pause) expect(library().map[it.slug!]).toBeTruthy();
  });
  it('an empty class has its phases and no blocks', () => {
    const plan = drafted(studio(), false);
    expect(blockCount(plan)).toBe(0);
    expect(plan.segments.length).toBeGreaterThan(0);
  });
  it('undo and redo step through changes', () => {
    const plan = drafted();
    const before = plan.title;
    changeClass(plan.id, (p) => { p.title = 'One'; });
    changeClass(plan.id, (p) => { p.title = 'Two'; });
    expect(canUndo(plan.id)).toBe(true);
    undoClass(plan.id); expect(classOf(plan.id)!.title).toBe('One');
    undoClass(plan.id); expect(classOf(plan.id)!.title).toBe(before);
    expect(canRedo(plan.id)).toBe(true);
    redoClass(plan.id); expect(classOf(plan.id)!.title).toBe('One');
    changeClass(plan.id, (p) => { p.title = 'Three'; });
    expect(canRedo(plan.id)).toBe(false);
  });
  it('moves a block up and down, across phases', () => {
    const plan = drafted();
    const seg = plan.segments.find((s) => s.items.length > 1)!;
    const second = seg.items[1].id;
    changeClass(plan.id, (p) => nudge(p, second, -1));
    expect(findItem(classOf(plan.id)!, second)!.index).toBe(0);
    changeClass(plan.id, (p) => nudge(p, second, -1));
    const now = classOf(plan.id)!;
    expect(blockCount(now)).toBe(blockCount(plan));
    expect(findItem(now, second)).toBeTruthy();
  });
  it('a copy is its own class, and teaching is logged', () => {
    const st = studio(); const plan = drafted(st);
    const copy = duplicateClass(plan.id)!;
    expect(copy.id).not.toBe(plan.id);
    expect(copy.title).not.toBe(plan.title);
    logTaught(plan, st, 48);
    expect(lastTaught(plan.id)!.minutes).toBe(48);
    expect(getData().taught.length).toBe(1);
  });
});

describe('files', () => {
  it('a backup comes back whole', () => {
    const st = studio(); const plan = drafted(st);
    saveMovement({ ...library().list[3], summary: 'Edited' });
    setSettings({ accent: 'plum' });
    const text = backupText();
    _reset();
    const inc = readIncoming(text);
    expect(inc.kind).toBe('backup');
    restoreBackup(inc, 'replace');
    expect(classOf(plan.id)!.segments.length).toBe(plan.segments.length);
    expect(getData().studios[0].name).toBe('Harbour');
    expect(getData().settings.accent).toBe('plum');
    expect(Object.keys(getData().movements).length).toBe(1);
  });
  it('adding a backup keeps what is here', () => {
    drafted(studio('Away'));
    const text = backupText();
    _reset();
    const mine = drafted(studio('Home'));
    restoreBackup(readIncoming(text), 'add');
    expect(getData().classes.length).toBe(2);
    expect(getData().studios.map((s) => s.name).sort()).toEqual(['Away', 'Home']);
    expect(classOf(mine.id)).toBeTruthy();
  });
  it('a shared class brings its own movements and can bring its studio', () => {
    const st = studio('Shared studio');
    const base = library().list.find((m) => m.apparatus === 'reformer')!;
    saveMovement({ ...base, slug: 'my-own-thing', name: 'My own thing' });
    const plan = drafted(st);
    changeClass(plan.id, (p) => { p.segments[0].items.push({ id: 'x1', slug: 'my-own-thing' }); });
    const text = classText(classOf(plan.id)!, st, { movements: true, studio: true });
    _reset();
    const inc = readIncoming(text);
    expect(inc.kind).toBe('class');
    const got = bringIn(inc, ALL);
    expect(got.classes).toBe(1);
    expect(got.movements).toBe(1);
    expect(got.studios).toBe(1);
    expect(library().map['my-own-thing'].name).toBe('My own thing');
    const mine = classOf(got.firstClass!)!;
    expect(mine.id).not.toBe(plan.id);
    expect(studioOf(mine.studioId).name).toBe('Shared studio');
  });
  it('bringing the same class in twice makes two classes, never overwrites', () => {
    const plan = drafted();
    const text = classText(plan, undefined, { movements: false, studio: false });
    bringIn(readIncoming(text), ALL);
    bringIn(readIncoming(text), ALL);
    expect(getData().classes.length).toBe(3);
  });
  it('reads an OpenPilates Server flow file and a pack', () => {
    const flow = JSON.stringify({ openpilates: 'flow', version: 1, flow: { title: 'From the server', apparatus: 'reformer', level: 'mixed', lengthMin: 45, roomId: 'r1', clientIds: ['c1'], segments: [{ name: 'Footwork', role: 'footwork', items: [{ slug: 'footwork-parallel-heels' }] }] }, movements: [] });
    const a = readIncoming(flow);
    expect(a.classes[0].title).toBe('From the server');
    expect((a.classes[0] as unknown as Record<string, unknown>).clientIds).toBeUndefined();
    const pack = JSON.stringify({ openpilates: 'pack', version: 1, flows: [{ title: 'P', segments: [] }], movements: [], series: [], studio: { name: 'Server studio', props: { long_box: 8 }, timing: {}, rooms: [{ id: 'r1', name: 'Room one', brand: 'balanced_body', reformers: 8 }, { id: 'r2', name: 'Room two', brand: 'balanced_body', reformers: 4 }] } });
    const b = readIncoming(pack);
    expect(b.kind).toBe('pack');
    expect(b.studios.map((s) => s.name)).toEqual(['Server studio · Room one', 'Server studio · Room two']);
    expect(b.classes.length).toBe(1);
  });
  it('a studio file round-trips, and nonsense is refused in plain words', () => {
    const st = studio('Loft');
    const inc = readIncoming(studioText(st));
    expect(inc.kind).toBe('studio');
    expect(inc.studios[0].name).toBe('Loft');
    for (const bad of ['', 'not json', '{"a":1}', '[]', JSON.stringify({ openpilates: 'backup', version: 99, data: {} })]) expect(() => readIncoming(bad), bad).toThrow(FileProblem);
    expect(fileNameFor('Full body / Flow?', 'class')).toMatch(/^[\w.-]+\.json$/);
  });
  it('the default set-up is complete', () => {
    const s = defaultSetup();
    expect(s.classTypes.length).toBeGreaterThan(0);
    expect(s.levels.length).toBe(6);
    expect(emptyData().settings.welcomed).toBe(false);
  });
});

describe('sending over Wi-Fi', () => {
  // Two devices on a pretend network: the listener's handler is called by the dialler.
  function network(): { a: Lan; b: Lan } {
    const open: Record<number, (conn: string, frame: Uint8Array) => Promise<Uint8Array | null>> = {};
    const make = (ip: string): Lan => ({
      localIp: async () => ip,
      dial: async (_host, port) => { const h = open[port]; if (!h) throw new Error('nothing there'); return { ask: async (f) => { const r = await h('c1', f); if (!r) throw new Error('hung up'); return r; }, close: () => undefined }; },
      listen: async (onFrame: (conn: string, frame: Uint8Array) => Promise<Uint8Array | null>) => { const port = 40000 + Object.keys(open).length; open[port] = onFrame; return { port, stop: () => { delete open[port]; } }; },
    } as unknown as Lan);
    return { a: make('192.168.1.10'), b: make('192.168.1.11') };
  }
  it('seals and opens, and refuses a changed message or the wrong key', () => {
    const key = keyOf(new Uint8Array(16).fill(3));
    const box = seal(key, { op: 'hello', n: 1 });
    expect(open(key, box)).toEqual({ op: 'hello', n: 1 });
    const bent = box.slice(); bent[bent.length - 1] ^= 1;
    expect(() => open(key, bent)).toThrow();
    expect(() => open(keyOf(new Uint8Array(16).fill(4)), box)).toThrow();
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 9, 8, 7, 6]);
    expect([...unbase32(base32(bytes))]).toEqual([...bytes]);
  });
  it('sends a big class from one device to another, once', async () => {
    const { a, b } = network();
    const text = JSON.stringify({ openpilates: 'flow', pad: 'x'.repeat(700_000) + Math.random() });
    const offer = await offerText(a, text, { name: "Sarah's iPhone", what: 'a class' });
    expect(isSendCode(offer.code)).toBe(true);
    expect(isSendCode('https://example.com')).toBe(false);
    const got = await fetchText(b, offer.code);
    expect(got.text).toBe(text);
    expect(got.from).toBe("Sarah's iPhone");
    expect(await offer.done).toBe('sent');
    await expect(fetchText(b, offer.code)).rejects.toThrow();
  });
  it('a code that was stopped, or made up, gets a plain answer', async () => {
    const { a, b } = network();
    const offer = await offerText(a, 'hello', { name: 'A', what: 'a class' });
    offer.stop();
    expect(await offer.done).toBe('stopped');
    await expect(fetchText(b, offer.code)).rejects.toThrow();
    await expect(fetchText(b, 'OPENPILATES-SEND:1:AAAA:192.168.1.10:1')).rejects.toThrow();
  });
});

describe('colours', () => {
  const lum = (h: string) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  it('any colour stays readable in light and dark', () => {
    for (const c of ['#0F6E62', '#FFE600', '#FFFFFF', '#000000', '#FF69B4', '#2B2B2B', '#7FFFD4']) {
      const l = accentVars(c, false); const d = accentVars(c, true);
      expect(ratio(l['--accent'], '#FFFFFF'), `${c} light text`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(l['--on-accent'], l['--accent-fill']), `${c} light button`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(d['--accent'], '#1A2220'), `${c} dark text`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(d['--on-accent'], d['--accent-fill']), `${c} dark button`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
