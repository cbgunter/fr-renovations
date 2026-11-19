import { beforeEach, describe, expect, it } from 'vitest';
import type { CalendarEvent, Estimate, Lead, PublicEstimate, Settings } from '@frr/shared';
import { createApp } from '../src/app';
import type { Req } from '../src/lib/http';
import { toIcs } from '../src/lib/ics';
import { MemoryMailer } from '../src/lib/mailer';
import { MemoryPhotoStorage } from '../src/lib/photos';
import { MemoryStore } from '../src/lib/store';

let mailer: MemoryMailer;
let app: ReturnType<typeof createApp>;
let clock = new Date('2026-11-19T14:00:00Z');

const call = (method: string, path: string, body?: unknown, opts: Partial<Req> = {}) =>
  app({ method, path, query: {}, body, user: 'owner@example.com', ...opts });
const pub = (method: string, path: string, body?: unknown, query: Record<string, string> = {}) =>
  app({ method, path, query, body, user: undefined });

beforeEach(() => {
  mailer = new MemoryMailer();
  clock = new Date('2026-11-19T14:00:00Z');
  app = createApp({
    store: new MemoryStore(),
    mailer,
    photos: new MemoryPhotoStorage(),
    siteUrl: 'https://renovations.example',
    now: () => clock,
    log: () => {},
  });
});

async function setNotify() {
  await call('PUT', '/admin/settings', { notifyEmail: 'owner@example.com', business: { phone: '6305550142' } });
}

describe('contact form', () => {
  const form = { name: 'Dana Kowalski', phone: '630-555-0142', email: 'dana@example.com', jobType: 'deck', message: 'Deck is rotting', elapsedMs: 9000 };

  it('creates a web lead and alerts the owner', async () => {
    await setNotify();
    const r = await pub('POST', '/leads', form);
    expect(r.status).toBe(201);
    const leads = (await call('GET', '/admin/leads')).body as Lead[];
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ name: 'Dana Kowalski', source: 'web', status: 'new', jobType: 'deck', priority: 'normal' });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe('owner@example.com');
    expect(mailer.sent[0].subject).toContain('Dana Kowalski');
    expect(mailer.sent[0].replyTo).toBe('dana@example.com');
  });

  it('drops honeypot and too-fast submissions silently', async () => {
    expect((await pub('POST', '/leads', { ...form, company: 'spam inc' })).status).toBe(201);
    expect((await pub('POST', '/leads', { ...form, elapsedMs: 200 })).status).toBe(201);
    expect((await pub('POST', '/leads', { ...form, elapsedMs: undefined })).status).toBe(201);
    expect((await call('GET', '/admin/leads')).body).toHaveLength(0);
  });

  it('requires a name and a way to reach them', async () => {
    expect((await pub('POST', '/leads', { ...form, name: '' })).status).toBe(400);
    expect((await pub('POST', '/leads', { ...form, phone: '', email: '' })).status).toBe(400);
    expect((await pub('POST', '/leads', { ...form, email: 'not-an-email' })).status).toBe(400);
  });

  it('no alert when notify email is not set', async () => {
    await pub('POST', '/leads', form);
    expect(mailer.sent).toHaveLength(0);
  });
});

describe('auth', () => {
  it('admin routes require a signed-in user', async () => {
    expect((await pub('GET', '/admin/leads')).status).toBe(401);
    expect((await pub('GET', '/admin/settings')).status).toBe(401);
    expect((await pub('POST', '/admin/estimates', {})).status).toBe(401);
  });
  it('unknown routes 404, wrong method 405', async () => {
    expect((await pub('GET', '/nope')).status).toBe(404);
    expect((await pub('DELETE', '/leads')).status).toBe(405);
  });
});

describe('leads', () => {
  it('sorts high priority first, then newest', async () => {
    await call('POST', '/admin/leads', { name: 'A', priority: 'low' });
    clock = new Date('2026-11-19T15:00:00Z');
    await call('POST', '/admin/leads', { name: 'B', priority: 'normal' });
    clock = new Date('2026-11-19T16:00:00Z');
    await call('POST', '/admin/leads', { name: 'C', priority: 'high' });
    await call('POST', '/admin/leads', { name: 'D', priority: 'normal' });
    const names = ((await call('GET', '/admin/leads')).body as Lead[]).map((l) => l.name);
    expect(names).toEqual(['C', 'D', 'B', 'A']);
  });

  it('updates fields and ignores junk values', async () => {
    const lead = (await call('POST', '/admin/leads', { name: 'Gus', source: 'phone' })).body as Lead;
    const r = await call('PUT', `/admin/leads/${lead.id}`, { priority: 'urgent!!', status: 'lost', notes: 'Went with another bid' });
    expect(r.body).toMatchObject({ priority: 'normal', status: 'lost', notes: 'Went with another bid', source: 'phone' });
  });
});

describe('pipeline: visit -> estimate -> send -> approve -> job', () => {
  it('moves the lead through every status', async () => {
    await setNotify();
    const lead = (await call('POST', '/admin/leads', { name: 'Tom Brandt', phone: '6305550199', email: 'tom@example.com', address: '17 Hillcrest Rd', jobType: 'deck' })).body as Lead;

    // Book a visit
    const visit = (await call('POST', '/admin/events', { kind: 'visit', title: 'Tom Brandt', leadId: lead.id, start: '2026-11-20T08:00' })).body as CalendarEvent;
    expect(visit.end).toBe('2026-11-20T09:00');
    expect(((await call('GET', `/admin/leads/${lead.id}`)).body as Lead)).toMatchObject({ status: 'visit', visitAt: '2026-11-20T08:00' });

    // Estimate, priced on the server even if the client sends a bogus total
    const est = (await call('POST', '/admin/estimates', {
      leadId: lead.id,
      jobType: 'deck',
      inputs: { area: 200, material: 'composite', railing: 40, steps: 3, demo: 'yes' },
      total: 1,
      customer: { name: 'Tom Brandt', email: 'tom@example.com', phone: '', address: '17 Hillcrest Rd' },
    })).body as Estimate;
    expect(est.total).toBe(17330);
    expect(est.number).toBe(1001);
    expect(est.id.length).toBeGreaterThanOrEqual(20);

    // Drafts are not visible to the public
    expect((await pub('GET', `/estimates/${est.id}`)).status).toBe(404);

    // Send by email
    const sent = await call('POST', `/admin/estimates/${est.id}/send`, { email: true });
    expect(sent.status).toBe(200);
    const custMail = mailer.sent.find((m) => m.to === 'tom@example.com')!;
    expect(custMail.subject).toContain('$17,330');
    expect(custMail.html).toContain(`https://renovations.example/e/${est.id}`);
    expect(((await call('GET', `/admin/leads/${lead.id}`)).body as Lead).status).toBe('sent');

    // Customer views + approves
    const view = (await pub('GET', `/estimates/${est.id}`)).body as PublicEstimate;
    expect(view.total).toBe(17330);
    expect(view).not.toHaveProperty('leadId');
    expect(view).not.toHaveProperty('inputs');
    const appr = (await pub('POST', `/estimates/${est.id}/approve`)).body as PublicEstimate;
    expect(appr.status).toBe('approved');
    expect(((await call('GET', `/admin/leads/${lead.id}`)).body as Lead).status).toBe('won');
    expect(mailer.sent.some((m) => m.subject.startsWith('Approved: Tom Brandt'))).toBe(true);

    // Approving twice does not send a second alert
    const before = mailer.sent.length;
    await pub('POST', `/estimates/${est.id}/approve`);
    expect(mailer.sent.length).toBe(before);

    // Schedule the multi-day job
    const job = (await call('POST', '/admin/events', { kind: 'job', title: 'Brandt deck', leadId: lead.id, start: '2026-12-01', end: '2026-12-03' })).body as CalendarEvent;
    expect(job).toMatchObject({ allDay: true, start: '2026-12-01', end: '2026-12-03' });

    // Range query returns the job for a window that starts mid-job
    const evs = (await call('GET', '/admin/events', undefined, { query: { from: '2026-12-02', to: '2026-12-08' } })).body as CalendarEvent[];
    expect(evs.map((e) => e.id)).toEqual([job.id]);
  });

  it('send by text (no email) still marks the estimate out', async () => {
    const lead = (await call('POST', '/admin/leads', { name: 'Ray' })).body as Lead;
    const est = (await call('POST', '/admin/estimates', { leadId: lead.id, jobType: 'roof', customer: { name: 'Ray', phone: '6305550100' } })).body as Estimate;
    const r = await call('POST', `/admin/estimates/${est.id}/send`, { email: false });
    expect(r.body).toMatchObject({ emailed: false, link: `https://renovations.example/e/${est.id}` });
    expect(mailer.sent).toHaveLength(0);
    expect(((await call('GET', `/admin/leads/${lead.id}`)).body as Lead).status).toBe('sent');
  });

  it('emailing without a customer email is a friendly 400', async () => {
    const est = (await call('POST', '/admin/estimates', { jobType: 'bath', customer: { name: 'No Email' } })).body as Estimate;
    const r = await call('POST', `/admin/estimates/${est.id}/send`, { email: true });
    expect(r.status).toBe(400);
  });

  it('cancelling a visit puts the lead back to Needs a visit', async () => {
    const lead = (await call('POST', '/admin/leads', { name: 'Ann' })).body as Lead;
    const v = (await call('POST', '/admin/events', { kind: 'visit', title: 'Ann', leadId: lead.id, start: '2026-11-21T10:00' })).body as CalendarEvent;
    await call('DELETE', `/admin/events/${v.id}`);
    expect(((await call('GET', `/admin/leads/${lead.id}`)).body as Lead)).toMatchObject({ status: 'new' });
  });
});

describe('settings + rates', () => {
  it('stores only real overrides and uses them for pricing', async () => {
    const s = (await call('PUT', '/admin/settings', { rates: { deck: { pt: 40, permit: 450, bogus: 5 }, roof: { arch: -1 } } })).body as Settings;
    expect(s.rates).toEqual({ deck: { pt: 40 } });
    const est = (await call('POST', '/admin/estimates', { jobType: 'deck', inputs: { area: 100, material: 'pt', railing: 0, steps: 0, demo: 'no' }, customer: { name: 'X' } })).body as Estimate;
    expect(est.total).toBe(4000 + 450);
  });

  it('ICS feed needs the token', async () => {
    const s = (await call('GET', '/admin/settings')).body as Settings;
    await call('POST', '/admin/events', { kind: 'visit', title: 'Ray Okafor, roof leak', start: '2026-11-20T08:00' });
    expect((await pub('GET', '/calendar.ics', undefined, { token: 'wrong' })).status).toBe(404);
    const r = await pub('GET', '/calendar.ics', undefined, { token: s.icsToken });
    expect(r.status).toBe(200);
    expect(r.raw).toContain('DTSTART;TZID=America/Chicago:20261120T080000');
    expect(r.raw).toContain('SUMMARY:Estimate visit: Ray Okafor\\, roof leak');
  });
});

describe('ics', () => {
  it('all-day events use an exclusive end date', () => {
    const ics = toIcs(
      [{ id: '1', kind: 'job', title: 'Roof', start: '2026-11-19', end: '2026-11-20', allDay: true, address: '', notes: '', createdAt: '', updatedAt: '' }],
      'Cal',
      '2026-11-19T00:00:00.000Z',
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261119');
    expect(ics).toContain('DTEND;VALUE=DATE:20261121');
  });
});
