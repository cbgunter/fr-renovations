import { describe, expect, it } from 'vitest';
import { JOBS, cleanInputs, defaultInputs, quote } from '../src/pricing';
import { addDays, dayLong, money, moneyRange, phone, recent, time, timeRange, weekStart } from '../src/format';

describe('pricing', () => {
  it('every job quotes a positive total from its defaults', () => {
    for (const j of JOBS) {
      const q = quote(j.id, defaultInputs(j.id));
      expect(q.total, j.id).toBeGreaterThan(0);
      expect(q.lines.length, j.id).toBeGreaterThan(0);
      expect(q.low).toBeLessThanOrEqual(q.total);
      expect(q.high).toBeGreaterThanOrEqual(q.total);
    }
  });

  it('every rate referenced by compute() exists', () => {
    // Exercise every option of every choice so each rate lookup path runs.
    for (const j of JOBS) {
      for (const input of j.inputs) {
        if (input.kind !== 'choice') continue;
        for (const o of input.options) {
          expect(() => quote(j.id, { ...defaultInputs(j.id), [input.id]: o.id }), `${j.id}.${input.id}=${o.id}`).not.toThrow();
        }
      }
    }
  });

  it('deck: lines sum to total and follow the inputs', () => {
    const q = quote('deck', { area: 200, material: 'composite', railing: 40, steps: 3, demo: 'yes' });
    // 200*62 + 40*70 + 3*160 + 200*6 + 450
    expect(q.total).toBe(12400 + 2800 + 480 + 1200 + 450);
    expect(q.lines.reduce((s, l) => s + l.amount, 0)).toBe(q.total);
    expect(q.lines[0].label).toBe('Composite deck · 200 sq ft');
  });

  it('settings overrides replace sample rates', () => {
    const base = quote('deck', { area: 100, material: 'pt', railing: 0, steps: 0, demo: 'no' });
    const over = quote('deck', { area: 100, material: 'pt', railing: 0, steps: 0, demo: 'no' }, { deck: { pt: 40, permit: 0 } });
    expect(base.total).toBe(3500 + 450);
    expect(over.total).toBe(4000);
  });

  it('adjustment is applied and total never goes negative', () => {
    const q = quote('bath', defaultInputs('bath'), undefined, -500);
    expect(q.total).toBe(quote('bath', defaultInputs('bath')).total - 500);
    expect(quote('bath', defaultInputs('bath'), undefined, -1e9).total).toBe(0);
  });

  it('roof multiplies pitch and tear-off layers', () => {
    const q = quote('roof', { squares: 20, pitch: 'steep', layers: '2', shingle: 'arch', decking: 0 });
    expect(q.lines.find((l) => l.label.startsWith('Tear-off'))?.amount).toBe(20 * 2 * 90);
    expect(q.lines.find((l) => l.label.startsWith('Architectural'))?.amount).toBe(Math.round(20 * 520 * 1.3));
  });

  it('cleanInputs clamps numbers and rejects unknown choices', () => {
    const c = cleanInputs('deck', { area: 99999, material: 'gold', railing: -5 });
    expect(c.area).toBe(2000);
    expect(c.material).toBe('pt');
    expect(c.railing).toBe(0);
    expect(c.steps).toBe(4);
  });
});

describe('format', () => {
  it('money', () => {
    expect(money(38500)).toBe('$38,500');
    expect(money(12.5)).toBe('$12.50');
    expect(moneyRange(13300, 16300)).toBe('$13,300 – $16,300');
  });
  it('phone', () => {
    expect(phone('6305550142')).toBe('(630) 555-0142');
    expect(phone('+1 630-555-0142')).toBe('(630) 555-0142');
    expect(phone('555')).toBe('555');
  });
  it('time', () => {
    expect(time('08:00')).toBe('8:00a');
    expect(time('15:30')).toBe('3:30p');
    expect(time('09:00', true)).toBe('9a');
    expect(time('12:00', true)).toBe('12p');
    expect(timeRange('08:00', '09:00')).toBe('8:00 – 9:00a');
    expect(timeRange('11:00', '13:00')).toBe('11:00a – 1:00p');
  });
  it('dates', () => {
    expect(dayLong('2026-11-19')).toBe('Thu, Nov 19');
    expect(addDays('2026-11-30', 2)).toBe('2026-12-02');
    expect(weekStart('2026-11-19')).toBe('2026-11-16');
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sunday belongs to the week before
  });
  it('recent', () => {
    const now = new Date('2026-11-19T18:00:00Z'); // noon in Chicago
    expect(recent('2026-11-19T13:12:00Z', now)).toBe('Today 7:12a');
    expect(recent('2026-11-11T15:00:00Z', now)).toBe('Nov 11');
  });
});
