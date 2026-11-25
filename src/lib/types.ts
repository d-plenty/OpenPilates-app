// The shapes of everything the app keeps. A class plan is called a "flow" in the engine and in the
// files OpenPilates Server exports; here it is a ClassPlan.

export type Level = 'xlight' | 'light' | 'medium' | 'heavy' | 'xheavy';

export interface Layer { tag?: string; title?: string; text?: string }
export interface Variation { name: string; kind?: string; springs?: string[]; note?: string; [k: string]: unknown }
export interface Caution { tag: string; severity?: string; note?: string; swap?: string }

export interface Movement {
  slug: string;
  name: string;
  aka?: string[];
  apparatus: 'reformer' | 'mat';
  section?: string;
  level?: string;
  levelTo?: string;
  pose?: string;
  position?: string;
  spine?: string[];
  muscles?: { primary?: string[]; secondary?: string[] };
  equipment?: string[];
  /** null on the mat. */
  load?: { springs?: string[]; advance?: string[]; flexible?: boolean; lighterIsHarder?: boolean; note?: string } | null;
  setup?: { headrest?: string; straps?: string };
  duration?: number;
  reps?: string;
  summary?: string;
  steps?: string[];
  /** One cue per line. */
  cues?: string;
  purpose?: Record<string, number>;
  perSide?: boolean;
  categories?: string[];
  layers?: Layer[];
  variations?: Variation[];
  cautions?: Caution[];
  uses?: string[];
  intensity?: number;
  retired?: boolean;
  /** Not offered anywhere, but a class that uses it still opens. */
  hidden?: boolean;
  /** 'library' ships with the app; 'mine' was made or changed on this device. */
  source?: 'library' | 'mine';
  check?: { status?: string };
  [k: string]: unknown;
}

export interface BlockOption { id: string; kind: string; title: string; springs?: string[]; slug?: string; note?: string }
export interface Item {
  id: string;
  slug?: string;
  /** A timed line: time in the plan that is not a movement. */
  pause?: boolean;
  label?: string;
  duration?: number;
  reps?: string;
  variation?: string;
  layers?: (string | { text: string })[];
  finisher?: string;
  options?: BlockOption[];
  note?: string;
  load?: { springs: string[] };
}
export interface Segment { id: string; name: string; role: string; minutes?: number; bothSides?: boolean; song?: string; items: Item[] }

export interface ClassPlan {
  id: string;
  title: string;
  apparatus: 'reformer' | 'mat' | 'mixed';
  level: string;
  lengthMin: number;
  goal?: string;
  focusText?: string;
  noPhases?: boolean;
  target?: string;
  classType?: string;
  springBudget?: number;
  /** The studio it was planned at. Teaching it somewhere else shows that studio's springs. */
  studioId?: string;
  /** When it is planned for: local date and time, "2026-11-30T09:30". */
  when?: string;
  notes?: string;
  segments: Segment[];
  createdAt: string;
  updatedAt: string;
  /** Came from another instructor or from OpenPilates Server. */
  from?: string;
}

export interface Studio {
  id: string;
  name: string;
  /** A studio with no reformers is a mat-only space. */
  hasReformers: boolean;
  brand: string;
  reformers: number;
  springs: Record<string, number>;
  springOverrides: Record<string, { name: string; short: string; color: string }>;
  /** Props it has, by id: a count, or 1 for "has it". */
  props: Record<string, number>;
  /** Class types taught here; empty means all of them. */
  classTypes: string[];
  updatedAt: string;
}

export interface Phase { name: string; role: string; minutes: number; sections?: string[]; positions?: string[] }
export interface ClassType { id: string; name: string; apparatus: 'reformer' | 'mat'; lengthMin: number; springBudget: number; note?: string; level?: string; target?: string; timing?: Record<string, number>; noPhases?: boolean; phases: Phase[] }
export interface ClassLevel { id: string; label: string; from: number; to: number }
export interface TimingRow { id: string; label: string; note?: string; seconds: number; off?: boolean }
export interface Focus { id: string; label: string; muscles: string[]; purpose?: string; maxIntensity?: number; avoid?: string[] }
export interface Named { id: string; label: string; group?: string }

/** How classes are set up: the same for every studio. (OpenPilates Server keeps these on its Studio page.) */
export interface Setup {
  levels: ClassLevel[];
  classTypes: ClassType[];
  lengths: number[];
  defaultLength: number;
  timingRows: TimingRow[];
  timing: Record<string, number>;
  focuses: Focus[];
  targets: Record<string, { label: string; [k: string]: unknown }>;
  customProps: Named[];
  removedProps: string[];
  customMuscles: Named[];
  removedMuscles: string[];
  customCautions: Named[];
  removedCautions: string[];
  customSections: Named[];
  removedSections: string[];
  sectionLabels: Record<string, string>;
  sectionMap: Record<string, string>;
}

export interface Taught { id: string; classId: string; title: string; at: string; studioId?: string; studioName?: string; minutes: number }
export interface Series { slug: string; name: string; apparatus: string; aka?: string[]; summary?: string; items: { slug: string; variation?: string; duration?: number; reps?: string }[]; source?: 'library' | 'mine' }

export interface Settings {
  theme: 'light' | 'dark' | 'auto';
  accent: string;
  /** A colour of the person's own, when accent is 'own'. */
  ownAccent?: string;
  trueBlack: boolean;
  playDark: boolean;
  keepAwake: boolean;
  textSize: 'normal' | 'large' | 'larger';
  usualStudio?: string;
  autoBackup: boolean;
  keepBackups: number;
  lastBackup?: string;
  welcomed: boolean;
  deviceName: string;
}

export interface Data {
  v: 1;
  settings: Settings;
  setup: Setup;
  studios: Studio[];
  classes: ClassPlan[];
  taught: Taught[];
  /** Movements made or changed on this device, by slug. */
  movements: Record<string, Movement>;
  /** Library movements taken out, and retired ones put back. */
  hidden: string[];
  shown: string[];
  series: Series[];
  hiddenSeries: string[];
}
