/**
 * Estimator definitions for the six job types.
 *
 * Each job declares its inputs (steppers and segmented choices) and its rates.
 * The rates below are SAMPLE numbers so the tool works on day one; the owner
 * overrides any of them in Admin > Settings, and those overrides are passed in
 * as `overrides`. Pure functions only: the web app uses them for the live total
 * and the API re-runs them when an estimate is saved, so the two always agree.
 */
import type { InputValues, JobType, LineItem, Settings } from './types';

export interface NumberInput {
  kind: 'number';
  id: string;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  default: number;
  help?: string;
}

export interface ChoiceInput {
  kind: 'choice';
  id: string;
  label: string;
  options: { id: string; label: string }[];
  default: string;
}

export type EstimatorInput = NumberInput | ChoiceInput;

export interface Rate {
  label: string;
  /** e.g. "per sq ft", "each", "flat", "x" for multipliers */
  unit: string;
  value: number;
}

export interface JobDef {
  id: JobType;
  name: string;
  /** One line for the picker tile. */
  blurb: string;
  inputs: EstimatorInput[];
  rates: Record<string, Rate>;
  compute: (v: Values, r: (id: string) => number) => LineItem[];
}

/** Typed accessor over raw input values that falls back to each input's default. */
export interface Values {
  n: (id: string) => number;
  c: (id: string) => string;
}

const yesNo = [
  { id: 'no', label: 'No' },
  { id: 'yes', label: 'Yes' },
];

export const JOBS: JobDef[] = [
  {
    id: 'deck',
    name: 'Decks & porches',
    blurb: 'New deck, rebuild or porch',
    inputs: [
      { kind: 'number', id: 'area', label: 'Deck area', unit: 'sq ft', step: 10, min: 40, max: 2000, default: 224 },
      {
        kind: 'choice', id: 'material', label: 'Decking material', default: 'pt',
        options: [
          { id: 'pt', label: 'Pressure-treated' },
          { id: 'cedar', label: 'Cedar' },
          { id: 'composite', label: 'Composite' },
        ],
      },
      { kind: 'number', id: 'railing', label: 'Railing', unit: 'ft', step: 2, min: 0, max: 400, default: 46 },
      { kind: 'number', id: 'steps', label: 'Stair steps', unit: 'steps', step: 1, min: 0, max: 40, default: 4 },
      { kind: 'choice', id: 'demo', label: 'Tear out the old deck?', default: 'no', options: yesNo },
    ],
    rates: {
      pt: { label: 'Pressure-treated decking', unit: 'per sq ft', value: 35 },
      cedar: { label: 'Cedar decking', unit: 'per sq ft', value: 48 },
      composite: { label: 'Composite decking', unit: 'per sq ft', value: 62 },
      railing: { label: 'Railing', unit: 'per ft', value: 70 },
      step: { label: 'Stairs', unit: 'per step', value: 160 },
      demo: { label: 'Old deck tear-out', unit: 'per sq ft', value: 6 },
      permit: { label: 'Permit & inspections', unit: 'flat', value: 450 },
    },
    compute: (v, r) => {
      const mat = v.c('material');
      const matLabel = { pt: 'Pressure-treated', cedar: 'Cedar', composite: 'Composite' }[mat] ?? mat;
      return [
        { label: `${matLabel} deck · ${fmtNum(v.n('area'))} sq ft`, amount: v.n('area') * r(mat) },
        { label: `Railing · ${v.n('railing')} ft`, amount: v.n('railing') * r('railing') },
        { label: `Stairs · ${v.n('steps')} steps`, amount: v.n('steps') * r('step') },
        { label: 'Tear out old deck', amount: v.c('demo') === 'yes' ? v.n('area') * r('demo') : 0 },
        { label: 'Permit & inspections', amount: r('permit') },
      ];
    },
  },
  {
    id: 'kitchen',
    name: 'Kitchen remodel',
    blurb: 'Cabinets, counters, full remodel',
    inputs: [
      { kind: 'number', id: 'cabinets', label: 'Cabinet run', unit: 'ft', step: 2, min: 0, max: 80, default: 20 },
      {
        kind: 'choice', id: 'grade', label: 'Cabinet grade', default: 'semi',
        options: [
          { id: 'stock', label: 'Stock' },
          { id: 'semi', label: 'Semi-custom' },
          { id: 'custom', label: 'Custom' },
        ],
      },
      { kind: 'number', id: 'counter', label: 'Countertop', unit: 'sq ft', step: 5, min: 0, max: 200, default: 40 },
      {
        kind: 'choice', id: 'top', label: 'Countertop material', default: 'quartz',
        options: [
          { id: 'laminate', label: 'Laminate' },
          { id: 'quartz', label: 'Quartz' },
          { id: 'granite', label: 'Granite' },
        ],
      },
      { kind: 'number', id: 'backsplash', label: 'Backsplash tile', unit: 'sq ft', step: 5, min: 0, max: 200, default: 30 },
      { kind: 'number', id: 'floor', label: 'New flooring', unit: 'sq ft', step: 10, min: 0, max: 800, default: 150 },
    ],
    rates: {
      stock: { label: 'Stock cabinets, installed', unit: 'per ft', value: 320 },
      semi: { label: 'Semi-custom cabinets, installed', unit: 'per ft', value: 550 },
      custom: { label: 'Custom cabinets, installed', unit: 'per ft', value: 900 },
      laminate: { label: 'Laminate countertop', unit: 'per sq ft', value: 40 },
      quartz: { label: 'Quartz countertop', unit: 'per sq ft', value: 85 },
      granite: { label: 'Granite countertop', unit: 'per sq ft', value: 80 },
      backsplash: { label: 'Backsplash tile', unit: 'per sq ft', value: 30 },
      floor: { label: 'Flooring', unit: 'per sq ft', value: 12 },
      demo: { label: 'Demo & haul-away', unit: 'flat', value: 2500 },
      trades: { label: 'Plumbing & electrical', unit: 'flat', value: 4500 },
    },
    compute: (v, r) => {
      const grade = v.c('grade');
      const top = v.c('top');
      const gradeLabel = { stock: 'Stock', semi: 'Semi-custom', custom: 'Custom' }[grade] ?? grade;
      const topLabel = { laminate: 'Laminate', quartz: 'Quartz', granite: 'Granite' }[top] ?? top;
      return [
        { label: 'Demo & haul-away', amount: r('demo') },
        { label: `${gradeLabel} cabinets · ${v.n('cabinets')} ft`, amount: v.n('cabinets') * r(grade) },
        { label: `${topLabel} countertop · ${v.n('counter')} sq ft`, amount: v.n('counter') * r(top) },
        { label: `Backsplash · ${v.n('backsplash')} sq ft`, amount: v.n('backsplash') * r('backsplash') },
        { label: `Flooring · ${v.n('floor')} sq ft`, amount: v.n('floor') * r('floor') },
        { label: 'Plumbing & electrical', amount: r('trades') },
      ];
    },
  },
  {
    id: 'bath',
    name: 'Bathroom remodel',
    blurb: 'Half bath to full primary bath',
    inputs: [
      {
        kind: 'choice', id: 'size', label: 'Bathroom', default: 'full',
        options: [
          { id: 'half', label: 'Half bath' },
          { id: 'full', label: 'Full bath' },
          { id: 'primary', label: 'Primary bath' },
        ],
      },
      {
        kind: 'choice', id: 'finish', label: 'Tile & fixtures', default: 'mid',
        options: [
          { id: 'basic', label: 'Basic' },
          { id: 'mid', label: 'Mid-range' },
          { id: 'high', label: 'High-end' },
        ],
      },
      { kind: 'choice', id: 'convert', label: 'Tub-to-shower conversion?', default: 'no', options: yesNo },
      {
        kind: 'choice', id: 'vanity', label: 'Vanity', default: 'single',
        options: [
          { id: 'single', label: 'Single sink' },
          { id: 'double', label: 'Double sink' },
        ],
      },
      { kind: 'choice', id: 'heat', label: 'Heated floor?', default: 'no', options: yesNo },
    ],
    rates: {
      half: { label: 'Half bath base', unit: 'flat', value: 9000 },
      full: { label: 'Full bath base', unit: 'flat', value: 16000 },
      primary: { label: 'Primary bath base', unit: 'flat', value: 26000 },
      basic: { label: 'Basic finish', unit: 'x', value: 1 },
      mid: { label: 'Mid-range finish', unit: 'x', value: 1.2 },
      high: { label: 'High-end finish', unit: 'x', value: 1.45 },
      convert: { label: 'Tub-to-shower conversion', unit: 'flat', value: 3500 },
      double: { label: 'Double vanity upgrade', unit: 'flat', value: 1400 },
      heat: { label: 'Heated floor', unit: 'flat', value: 1200 },
    },
    compute: (v, r) => {
      const size = v.c('size');
      const finish = v.c('finish');
      const sizeLabel = { half: 'Half bath', full: 'Full bath', primary: 'Primary bath' }[size] ?? size;
      const finishLabel = { basic: 'basic', mid: 'mid-range', high: 'high-end' }[finish] ?? finish;
      return [
        { label: `${sizeLabel} remodel, ${finishLabel} tile & fixtures`, amount: r(size) * r(finish) },
        { label: 'Tub-to-shower conversion', amount: v.c('convert') === 'yes' ? r('convert') : 0 },
        { label: 'Double vanity', amount: v.c('vanity') === 'double' ? r('double') : 0 },
        { label: 'Heated floor', amount: v.c('heat') === 'yes' ? r('heat') : 0 },
      ];
    },
  },
  {
    id: 'roof',
    name: 'Roofing',
    blurb: 'Tear-off and re-roof',
    inputs: [
      { kind: 'number', id: 'squares', label: 'Roof size', unit: 'squares', step: 1, min: 1, max: 120, default: 24, help: '1 square = 100 sq ft of roof' },
      {
        kind: 'choice', id: 'pitch', label: 'Pitch', default: 'medium',
        options: [
          { id: 'low', label: 'Walkable' },
          { id: 'medium', label: 'Medium' },
          { id: 'steep', label: 'Steep' },
        ],
      },
      {
        kind: 'choice', id: 'layers', label: 'Old layers to tear off', default: '1',
        options: [
          { id: '0', label: 'None' },
          { id: '1', label: '1 layer' },
          { id: '2', label: '2 layers' },
        ],
      },
      {
        kind: 'choice', id: 'shingle', label: 'Shingle', default: 'arch',
        options: [
          { id: 'arch', label: 'Architectural' },
          { id: 'designer', label: 'Designer' },
        ],
      },
      { kind: 'number', id: 'decking', label: 'Decking to replace', unit: 'sheets', step: 1, min: 0, max: 200, default: 0 },
    ],
    rates: {
      arch: { label: 'Architectural shingles, installed', unit: 'per square', value: 520 },
      designer: { label: 'Designer shingles, installed', unit: 'per square', value: 720 },
      low: { label: 'Walkable pitch', unit: 'x', value: 1 },
      medium: { label: 'Medium pitch', unit: 'x', value: 1.12 },
      steep: { label: 'Steep pitch', unit: 'x', value: 1.3 },
      tearoff: { label: 'Tear-off', unit: 'per square per layer', value: 90 },
      sheet: { label: 'Decking sheet replaced', unit: 'each', value: 95 },
      dumpster: { label: 'Dumpster & cleanup', unit: 'flat', value: 650 },
      permit: { label: 'Permit', unit: 'flat', value: 350 },
    },
    compute: (v, r) => {
      const sq = v.n('squares');
      const shingle = v.c('shingle');
      const layers = Number(v.c('layers')) || 0;
      const pitchLabel = { low: 'walkable', medium: 'medium', steep: 'steep' }[v.c('pitch')] ?? v.c('pitch');
      const shingleLabel = shingle === 'designer' ? 'Designer' : 'Architectural';
      return [
        { label: `Tear-off · ${layers} layer${layers === 1 ? '' : 's'}, ${sq} squares`, amount: sq * layers * r('tearoff') },
        { label: `${shingleLabel} shingles · ${sq} squares, ${pitchLabel} pitch`, amount: sq * r(shingle) * r(v.c('pitch')) },
        { label: `Decking replacement · ${v.n('decking')} sheets`, amount: v.n('decking') * r('sheet') },
        { label: 'Dumpster & cleanup', amount: r('dumpster') },
        { label: 'Permit', amount: r('permit') },
      ];
    },
  },
  {
    id: 'siding',
    name: 'Siding & windows',
    blurb: 'Re-side, replace windows, or both',
    inputs: [
      { kind: 'number', id: 'wall', label: 'Siding area', unit: 'sq ft', step: 50, min: 0, max: 8000, default: 1800, help: 'Set to 0 for windows only' },
      {
        kind: 'choice', id: 'material', label: 'Siding material', default: 'vinyl',
        options: [
          { id: 'vinyl', label: 'Vinyl' },
          { id: 'fiber', label: 'Fiber cement' },
          { id: 'wood', label: 'Wood' },
        ],
      },
      { kind: 'choice', id: 'tearoff', label: 'Remove old siding?', default: 'yes', options: yesNo },
      { kind: 'number', id: 'windows', label: 'Windows', unit: 'windows', step: 1, min: 0, max: 60, default: 0 },
    ],
    rates: {
      vinyl: { label: 'Vinyl siding, installed', unit: 'per sq ft', value: 7 },
      fiber: { label: 'Fiber cement siding, installed', unit: 'per sq ft', value: 12 },
      wood: { label: 'Wood siding, installed', unit: 'per sq ft', value: 14 },
      tearoff: { label: 'Old siding removal', unit: 'per sq ft', value: 1.5 },
      window: { label: 'Replacement window, installed', unit: 'each', value: 950 },
    },
    compute: (v, r) => {
      const mat = v.c('material');
      const matLabel = { vinyl: 'Vinyl', fiber: 'Fiber cement', wood: 'Wood' }[mat] ?? mat;
      const wall = v.n('wall');
      return [
        { label: `Remove old siding · ${fmtNum(wall)} sq ft`, amount: v.c('tearoff') === 'yes' ? wall * r('tearoff') : 0 },
        { label: `${matLabel} siding · ${fmtNum(wall)} sq ft`, amount: wall * r(mat) },
        { label: `Replacement windows · ${v.n('windows')}`, amount: v.n('windows') * r('window') },
      ];
    },
  },
  {
    id: 'basement',
    name: 'Basement finishing',
    blurb: 'Finish, add a bath or egress',
    inputs: [
      { kind: 'number', id: 'area', label: 'Area to finish', unit: 'sq ft', step: 50, min: 100, max: 4000, default: 800 },
      {
        kind: 'choice', id: 'bath', label: 'Add a bathroom', default: 'none',
        options: [
          { id: 'none', label: 'No' },
          { id: 'half', label: 'Half bath' },
          { id: 'full', label: 'Full bath' },
        ],
      },
      { kind: 'number', id: 'egress', label: 'Egress windows', unit: 'windows', step: 1, min: 0, max: 6, default: 0 },
      { kind: 'choice', id: 'bar', label: 'Wet bar?', default: 'no', options: yesNo },
    ],
    rates: {
      area: { label: 'Framing, drywall, electrical, flooring', unit: 'per sq ft', value: 45 },
      half: { label: 'Half bath', unit: 'flat', value: 9000 },
      full: { label: 'Full bath', unit: 'flat', value: 15000 },
      egress: { label: 'Egress window, dug & installed', unit: 'each', value: 4800 },
      bar: { label: 'Wet bar', unit: 'flat', value: 6000 },
      permit: { label: 'Permit & inspections', unit: 'flat', value: 600 },
    },
    compute: (v, r) => {
      const bath = v.c('bath');
      return [
        { label: `Finish basement · ${fmtNum(v.n('area'))} sq ft`, amount: v.n('area') * r('area') },
        { label: bath === 'full' ? 'Full bathroom' : 'Half bathroom', amount: bath === 'none' ? 0 : r(bath) },
        { label: `Egress windows · ${v.n('egress')}`, amount: v.n('egress') * r('egress') },
        { label: 'Wet bar', amount: v.c('bar') === 'yes' ? r('bar') : 0 },
        { label: 'Permit & inspections', amount: r('permit') },
      ];
    },
  },
];

/** How wide the "Range" shown next to the total is, either side. */
export const RANGE_PCT = 0.1;

export const getJob = (id: JobType): JobDef => {
  const j = JOBS.find((x) => x.id === id);
  if (!j) throw new Error(`Unknown job type: ${id}`);
  return j;
};

export function defaultInputs(id: JobType): InputValues {
  const out: InputValues = {};
  for (const i of getJob(id).inputs) out[i.id] = i.default;
  return out;
}

/** Clamp/validate raw values against the job's input definitions. */
export function cleanInputs(id: JobType, raw: InputValues | undefined): InputValues {
  const job = getJob(id);
  const out: InputValues = {};
  for (const i of job.inputs) {
    const v = raw?.[i.id];
    if (i.kind === 'number') {
      const n = typeof v === 'number' ? v : Number(v);
      out[i.id] = Number.isFinite(n) ? Math.min(i.max, Math.max(i.min, n)) : i.default;
    } else {
      out[i.id] = i.options.some((o) => o.id === v) ? (v as string) : i.default;
    }
  }
  return out;
}

export function rateFor(id: JobType, overrides: Settings['rates'] | undefined) {
  const job = getJob(id);
  return (rateId: string): number => {
    const o = overrides?.[id]?.[rateId];
    if (typeof o === 'number' && Number.isFinite(o)) return o;
    const base = job.rates[rateId];
    if (!base) throw new Error(`Unknown rate ${id}.${rateId}`);
    return base.value;
  };
}

export interface Quote {
  lines: LineItem[];
  subtotal: number;
  total: number;
  low: number;
  high: number;
}

/** Round to whole dollars. Line items keep their own rounding so they sum exactly. */
const dollars = (n: number) => Math.round(n);
const round100 = (n: number) => Math.round(n / 100) * 100;

export function quote(
  id: JobType,
  raw: InputValues | undefined,
  overrides?: Settings['rates'],
  adjustment = 0,
): Quote {
  const job = getJob(id);
  const values = cleanInputs(id, raw);
  const v: Values = {
    n: (k) => Number(values[k]),
    c: (k) => String(values[k]),
  };
  const lines = job
    .compute(v, rateFor(id, overrides))
    .map((l) => ({ label: l.label, amount: dollars(l.amount) }))
    .filter((l) => l.amount !== 0);
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const total = Math.max(0, subtotal + dollars(adjustment || 0));
  return { lines, subtotal, total, low: round100(total * (1 - RANGE_PCT)), high: round100(total * (1 + RANGE_PCT)) };
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}
