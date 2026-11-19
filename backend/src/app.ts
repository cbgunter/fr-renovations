/**
 * The whole API. `createApp(deps)` returns a function from a normalized request
 * to a response; index.ts adapts it to API Gateway, tests call it directly.
 *
 * Auth: API Gateway's JWT authorizer (Cognito) guards every /api/admin/* route
 * before the Lambda runs; `req.user` is set from its claims. We re-check here so
 * a misconfigured route can never expose admin data.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import {
  EVENT_KINDS,
  JOB_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PRIORITY_RANK,
  cleanInputs,
  getJob,
  isPhotoSlot,
  jobName,
  quote,
  type CalendarEvent,
  type Estimate,
  type EventKind,
  type JobType,
  type Lead,
  type LeadStatus,
  type PublicEstimate,
  type Settings,
} from '@frr/shared';
import { approvedEmail, estimateEmail, newLeadEmail } from './lib/emails';
import { DAY_RE, EMAIL_RE, HttpError, LOCAL_DT_RE, bad, notFound, ok, oneOf, str, type Req, type Res } from './lib/http';
import { toIcs } from './lib/ics';
import type { Mailer } from './lib/mailer';
import type { PhotoStorage } from './lib/photos';
import type { Store } from './lib/store';

export interface Deps {
  store: Store;
  mailer: Mailer;
  photos: PhotoStorage;
  /** Public site origin, e.g. https://renovations.caseyhunter.net */
  siteUrl: string;
  now?: () => Date;
  log?: (msg: string, extra?: unknown) => void;
}

const JOB_IDS = [...JOB_TYPES.map((j) => j.id), 'other'] as const;
const STATUS_IDS = LEAD_STATUSES.map((s) => s.id);
const SOURCE_IDS = LEAD_SOURCES.map((s) => s.id);
const PRIORITIES = ['high', 'normal', 'low'] as const;
const KIND_IDS = EVENT_KINDS.map((k) => k.id);

/** Leads submitted faster than this after the page loaded are bots. */
export const MIN_FORM_MS = 2500;

const DEFAULT_SETTINGS = (): Settings => ({
  business: { name: 'First Responder Renovations', phone: '', email: '', license: '' },
  notifyEmail: '',
  rates: {},
  icsToken: randomBytes(18).toString('base64url'),
});

export function createApp(deps: Deps) {
  const { store, mailer, photos, siteUrl } = deps;
  const now = () => (deps.now ? deps.now() : new Date());
  const log = deps.log ?? ((m: string, e?: unknown) => console.log(m, e ?? ''));
  const iso = () => now().toISOString();

  // ---------- settings ----------
  async function getSettings(): Promise<Settings> {
    const s = await store.get<Settings>('SETTINGS');
    if (s) return { ...DEFAULT_SETTINGS(), ...s, business: { ...DEFAULT_SETTINGS().business, ...s.business } };
    const fresh = DEFAULT_SETTINGS();
    await store.put('SETTINGS', fresh);
    return fresh;
  }

  async function notify(build: (s: Settings) => { subject: string; text: string; html: string; replyTo?: string }) {
    const s = await getSettings();
    if (!s.notifyEmail) return;
    try {
      await mailer.send({ to: s.notifyEmail, ...build(s) });
    } catch (e) {
      // An alert failing must never fail the customer's request.
      log('notify failed', e);
    }
  }

  // ---------- leads ----------
  const putLead = (l: Lead) => store.put(`LEAD#${l.id}`, l, { type: 'lead', sk: l.createdAt });
  const getLead = async (id: string) => (await store.get<Lead>(`LEAD#${id}`)) ?? notFound('Lead not found');

  function leadFields(body: unknown, base: Partial<Lead>): Partial<Lead> {
    const b = (body ?? {}) as Record<string, unknown>;
    const out: Partial<Lead> = {};
    if ('name' in b) out.name = str(b, 'name', 120);
    if ('phone' in b) out.phone = str(b, 'phone', 40);
    if ('email' in b) out.email = str(b, 'email', 200);
    if ('address' in b) out.address = str(b, 'address', 300);
    if ('message' in b) out.message = str(b, 'message', 4000);
    if ('notes' in b) out.notes = str(b, 'notes', 8000);
    if ('jobType' in b) out.jobType = oneOf(b.jobType, JOB_IDS, 'other');
    if ('source' in b) out.source = oneOf(b.source, SOURCE_IDS, base.source ?? 'phone');
    if ('status' in b) out.status = oneOf(b.status, STATUS_IDS, base.status ?? 'new');
    if ('priority' in b) out.priority = oneOf(b.priority, PRIORITIES, base.priority ?? 'normal');
    if ('visitAt' in b) {
      const v = str(b, 'visitAt', 16);
      out.visitAt = LOCAL_DT_RE.test(v) ? v : undefined;
    }
    if (out.email && !EMAIL_RE.test(out.email)) bad('That email address does not look right.');
    return out;
  }

  function newLead(fields: Partial<Lead>): Lead {
    const t = iso();
    return {
      id: randomUUID(),
      name: '',
      phone: '',
      email: '',
      address: '',
      jobType: 'other',
      message: '',
      source: 'phone',
      status: 'new',
      priority: 'normal',
      notes: '',
      ...fields,
      createdAt: t,
      updatedAt: t,
    };
  }

  /** Public contact form. */
  async function submitContactForm(body: unknown): Promise<Res> {
    const b = (body ?? {}) as Record<string, unknown>;
    // Honeypot + fill-time check. Bots get a normal-looking success and nothing is stored.
    const elapsed = Number(b.elapsedMs);
    if (str(b, 'company') || !Number.isFinite(elapsed) || elapsed < MIN_FORM_MS) {
      log('contact form rejected as spam', { company: !!str(b, 'company'), elapsed });
      return ok({ ok: true }, 201);
    }
    const f = leadFields(b, {});
    if (!f.name) bad('Please add your name.');
    if (!f.phone && !f.email) bad('Please add a phone number or email so we can reach you.');
    const lead = newLead({
      name: f.name,
      phone: f.phone ?? '',
      email: f.email ?? '',
      address: f.address ?? '',
      jobType: f.jobType ?? 'other',
      message: f.message ?? '',
      source: 'web',
      status: 'new',
      priority: 'normal',
    });
    await putLead(lead);
    await notify((s) => newLeadEmail(lead, `${siteUrl}/admin/leads/${lead.id}`, s));
    return ok({ ok: true }, 201);
  }

  async function listLeads(): Promise<Lead[]> {
    const leads = await store.list<Lead>('lead');
    return leads.sort(
      (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.createdAt < b.createdAt ? 1 : -1),
    );
  }

  // ---------- estimates ----------
  const putEstimate = (e: Estimate) => store.put(`EST#${e.id}`, e, { type: 'estimate', sk: e.createdAt });
  const getEstimate = async (id: string) =>
    (await store.get<Estimate>(`EST#${id}`)) ?? notFound('Estimate not found');

  /** Validate an estimate body and (re)price it on the server with the saved rates. */
  async function priced(body: unknown, base?: Estimate): Promise<Omit<Estimate, 'id' | 'number' | 'createdAt' | 'status'>> {
    const b = (body ?? {}) as Record<string, unknown>;
    const jobType = oneOf(b.jobType ?? base?.jobType, JOB_TYPES.map((j) => j.id), 'deck') as JobType;
    getJob(jobType);
    const inputs = cleanInputs(jobType, (b.inputs as Estimate['inputs']) ?? base?.inputs);
    const adjustment = Math.round(Number(b.adjustment ?? base?.adjustment ?? 0)) || 0;
    const settings = await getSettings();
    const q = quote(jobType, inputs, settings.rates, adjustment);
    const c = (b.customer ?? base?.customer ?? {}) as Record<string, unknown>;
    const customer = {
      name: str(c, 'name', 120),
      email: str(c, 'email', 200),
      phone: str(c, 'phone', 40),
      address: str(c, 'address', 300),
    };
    if (customer.email && !EMAIL_RE.test(customer.email)) bad('That email address does not look right.');
    const leadId = str(b, 'leadId', 64) || base?.leadId || undefined;
    return {
      leadId,
      jobType,
      inputs,
      lines: q.lines,
      adjustment,
      adjustmentLabel: 'adjustmentLabel' in b ? str(b, 'adjustmentLabel', 120) : (base?.adjustmentLabel ?? ''),
      total: q.total,
      low: q.low,
      high: q.high,
      note: 'note' in b ? str(b, 'note', 4000) : (base?.note ?? ''),
      customer,
      sentAt: base?.sentAt,
      approvedAt: base?.approvedAt,
      updatedAt: iso(),
    };
  }

  async function linkLead(leadId: string | undefined, patch: (l: Lead) => Partial<Lead> | null) {
    if (!leadId) return;
    const lead = await store.get<Lead>(`LEAD#${leadId}`);
    if (!lead) return;
    const p = patch(lead);
    if (!p) return;
    await putLead({ ...lead, ...p, updatedAt: iso() });
  }

  const estimateLink = (e: Estimate) => `${siteUrl}/e/${e.id}`;

  async function sendEstimate(id: string, body: unknown): Promise<Res> {
    const est = await getEstimate(id);
    const byEmail = Boolean((body as Record<string, unknown> | null)?.email);
    if (byEmail) {
      if (!est.customer.email) bad('Add the customer email first.');
      const s = await getSettings();
      await mailer.send({ to: est.customer.email, ...estimateEmail(est, estimateLink(est), s) });
    }
    const t = iso();
    const updated: Estimate = { ...est, status: est.status === 'approved' ? 'approved' : 'sent', sentAt: t, updatedAt: t };
    await putEstimate(updated);
    await linkLead(est.leadId, (l) => ({
      estimateId: est.id,
      status: l.status === 'won' || l.status === 'lost' ? l.status : 'sent',
    }));
    return ok({ estimate: updated, link: estimateLink(updated), emailed: byEmail });
  }

  function toPublic(e: Estimate, s: Settings): PublicEstimate {
    return {
      id: e.id,
      number: e.number,
      jobName: jobName(e.jobType),
      lines: e.lines,
      adjustment: e.adjustment,
      adjustmentLabel: e.adjustmentLabel,
      total: e.total,
      note: e.note,
      customer: { name: e.customer.name, address: e.customer.address },
      status: e.status,
      sentAt: e.sentAt,
      approvedAt: e.approvedAt,
      createdAt: e.createdAt,
      business: { name: s.business.name, phone: s.business.phone, email: s.business.email, license: s.business.license },
    };
  }

  async function approve(id: string): Promise<Res> {
    const est = await getEstimate(id);
    if (est.status === 'draft') notFound('Estimate not found');
    if (est.status !== 'approved') {
      const t = iso();
      const updated: Estimate = { ...est, status: 'approved', approvedAt: t, updatedAt: t };
      await putEstimate(updated);
      await linkLead(est.leadId, () => ({ status: 'won', estimateId: est.id }));
      await notify((s) => approvedEmail(updated, `${siteUrl}/admin/leads/${est.leadId ?? ''}`, s));
      return ok(toPublic(updated, await getSettings()));
    }
    return ok(toPublic(est, await getSettings()));
  }

  // ---------- events ----------
  const putEvent = (e: CalendarEvent) => store.put(`EVT#${e.id}`, e, { type: 'event', sk: e.start });

  function eventFields(body: unknown, base?: CalendarEvent): Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> {
    const b = (body ?? {}) as Record<string, unknown>;
    const kind = oneOf(b.kind ?? base?.kind, KIND_IDS, 'visit') as EventKind;
    const allDay = kind !== 'visit';
    const start = str(b, 'start', 16) || base?.start || '';
    let end = str(b, 'end', 16) || base?.end || '';
    if (allDay) {
      if (!DAY_RE.test(start.slice(0, 10))) bad('Pick a start day.');
      end = DAY_RE.test(end.slice(0, 10)) ? end.slice(0, 10) : start.slice(0, 10);
      if (end < start.slice(0, 10)) bad('The last day is before the first day.');
    } else {
      if (!LOCAL_DT_RE.test(start)) bad('Pick a day and time.');
      if (!LOCAL_DT_RE.test(end) || end <= start) {
        // Default visits to one hour.
        const h = Number(start.slice(11, 13)) + 1;
        end = h < 24 ? `${start.slice(0, 11)}${String(h).padStart(2, '0')}${start.slice(13)}` : `${start.slice(0, 11)}23:59`;
      }
    }
    const title = str(b, 'title', 160) || base?.title || '';
    if (!title) bad('Add a title, like the customer name.');
    return {
      kind,
      title,
      leadId: ('leadId' in b ? str(b, 'leadId', 64) : base?.leadId) || undefined,
      start: allDay ? start.slice(0, 10) : start,
      end,
      allDay,
      address: 'address' in b ? str(b, 'address', 300) : (base?.address ?? ''),
      notes: 'notes' in b ? str(b, 'notes', 4000) : (base?.notes ?? ''),
    };
  }

  /** Booking a visit or a job moves the linked lead along the pipeline. */
  async function syncLeadFromEvent(e: CalendarEvent) {
    if (e.kind === 'visit') {
      await linkLead(e.leadId, (l) => ({
        visitAt: e.start,
        status: l.status === 'new' ? 'visit' : l.status,
      }));
    } else if (e.kind === 'job') {
      await linkLead(e.leadId, (l) => (l.status === 'won' ? null : { status: 'won' as LeadStatus }));
    }
  }

  // ---------- router ----------
  type Handler = (req: Req, params: string[]) => Promise<Res>;
  const routes: [string, RegExp, Handler, boolean][] = [];
  const route = (method: string, pattern: string, h: Handler, admin = false) => {
    const re = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, '([^/]+)') + '/?$');
    routes.push([method, re, h, admin]);
  };

  // Public
  route('GET', '/health', async () => ok({ ok: true }));
  route('POST', '/leads', async (r) => submitContactForm(r.body));
  route('GET', '/estimates/:id', async (_r, [id]) => {
    const est = await getEstimate(id);
    if (est.status === 'draft') notFound('Estimate not found');
    return ok(toPublic(est, await getSettings()));
  });
  route('POST', '/estimates/:id/approve', async (_r, [id]) => approve(id));
  route('GET', '/calendar.ics', async (r) => {
    const s = await getSettings();
    if (!r.query.token || r.query.token !== s.icsToken) throw new HttpError(404, 'Not found');
    const events = await store.list<CalendarEvent>('event');
    return {
      status: 200,
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache' },
      raw: toIcs(events, s.business.name, iso()),
    };
  });

  // Admin: leads
  route('GET', '/admin/leads', async () => ok(await listLeads()), true);
  route(
    'POST',
    '/admin/leads',
    async (r) => {
      const f = leadFields(r.body, {});
      if (!f.name) bad('Add a name.');
      const lead = newLead(f);
      await putLead(lead);
      return ok(lead, 201);
    },
    true,
  );
  route('GET', '/admin/leads/:id', async (_r, [id]) => ok(await getLead(id)), true);
  route(
    'PUT',
    '/admin/leads/:id',
    async (r, [id]) => {
      const lead = await getLead(id);
      const updated: Lead = { ...lead, ...leadFields(r.body, lead), id, createdAt: lead.createdAt, updatedAt: iso() };
      if (!updated.name) bad('Add a name.');
      await putLead(updated);
      return ok(updated);
    },
    true,
  );
  route(
    'DELETE',
    '/admin/leads/:id',
    async (_r, [id]) => {
      await getLead(id);
      await store.delete(`LEAD#${id}`);
      return ok({ ok: true });
    },
    true,
  );

  // Admin: estimates
  route(
    'GET',
    '/admin/estimates',
    async (r) => {
      const all = await store.list<Estimate>('estimate');
      const list = r.query.leadId ? all.filter((e) => e.leadId === r.query.leadId) : all;
      return ok(list.reverse());
    },
    true,
  );
  route(
    'POST',
    '/admin/estimates',
    async (r) => {
      const p = await priced(r.body);
      const t = iso();
      const est: Estimate = {
        ...p,
        id: randomBytes(16).toString('base64url'),
        number: await store.next('estimate', 1001),
        status: 'draft',
        createdAt: t,
        updatedAt: t,
      };
      await putEstimate(est);
      await linkLead(est.leadId, () => ({ estimateId: est.id }));
      return ok(est, 201);
    },
    true,
  );
  route('GET', '/admin/estimates/:id', async (_r, [id]) => ok(await getEstimate(id)), true);
  route(
    'PUT',
    '/admin/estimates/:id',
    async (r, [id]) => {
      const est = await getEstimate(id);
      const p = await priced(r.body, est);
      const updated: Estimate = { ...est, ...p };
      await putEstimate(updated);
      return ok(updated);
    },
    true,
  );
  route('POST', '/admin/estimates/:id/send', async (r, [id]) => sendEstimate(id, r.body), true);

  // Admin: calendar
  route(
    'GET',
    '/admin/events',
    async (r) => {
      const { from, to } = r.query;
      if (from && to) {
        // Multi-day jobs that started before `from` can still overlap the window,
        // so fetch everything that starts before `to` and filter by end.
        const evs = await store.list<CalendarEvent>('event', { from: '0000', to: `${to}~` });
        return ok(evs.filter((e) => e.end.slice(0, 10) >= from));
      }
      return ok(await store.list<CalendarEvent>('event'));
    },
    true,
  );
  route(
    'POST',
    '/admin/events',
    async (r) => {
      const t = iso();
      const ev: CalendarEvent = { ...eventFields(r.body), id: randomUUID(), createdAt: t, updatedAt: t };
      await putEvent(ev);
      await syncLeadFromEvent(ev);
      return ok(ev, 201);
    },
    true,
  );
  route(
    'PUT',
    '/admin/events/:id',
    async (r, [id]) => {
      const base = (await store.get<CalendarEvent>(`EVT#${id}`)) ?? notFound('Event not found');
      const ev: CalendarEvent = { ...base, ...eventFields(r.body, base), updatedAt: iso() };
      await putEvent(ev);
      await syncLeadFromEvent(ev);
      return ok(ev);
    },
    true,
  );
  route(
    'DELETE',
    '/admin/events/:id',
    async (_r, [id]) => {
      const ev = (await store.get<CalendarEvent>(`EVT#${id}`)) ?? notFound('Event not found');
      await store.delete(`EVT#${id}`);
      // Cancelling the only visit for a lead puts it back in "Needs a visit".
      if (ev.kind === 'visit') {
        await linkLead(ev.leadId, (l) => (l.status === 'visit' && l.visitAt === ev.start ? { status: 'new', visitAt: undefined } : null));
      }
      return ok({ ok: true });
    },
    true,
  );

  // Admin: settings
  route('GET', '/admin/settings', async () => ok(await getSettings()), true);
  route(
    'PUT',
    '/admin/settings',
    async (r) => {
      const cur = await getSettings();
      const b = (r.body ?? {}) as Record<string, unknown>;
      const biz = (b.business ?? {}) as Record<string, unknown>;
      const notifyEmail = 'notifyEmail' in b ? str(b, 'notifyEmail', 200) : cur.notifyEmail;
      if (notifyEmail && !EMAIL_RE.test(notifyEmail)) bad('That alert email does not look right.');
      const rates: Settings['rates'] = {};
      const rawRates = (b.rates ?? cur.rates) as Record<string, Record<string, unknown>>;
      for (const j of JOB_TYPES) {
        const job = getJob(j.id);
        for (const [rid, v] of Object.entries(rawRates?.[j.id] ?? {})) {
          const n = Number(v);
          if (job.rates[rid] && Number.isFinite(n) && n >= 0 && n !== job.rates[rid].value) {
            (rates[j.id] ??= {})[rid] = n;
          }
        }
      }
      const next: Settings = {
        business: {
          name: 'name' in biz ? str(biz, 'name', 120) || cur.business.name : cur.business.name,
          phone: 'phone' in biz ? str(biz, 'phone', 40) : cur.business.phone,
          email: 'email' in biz ? str(biz, 'email', 200) : cur.business.email,
          license: 'license' in biz ? str(biz, 'license', 80) : cur.business.license,
        },
        notifyEmail,
        rates,
        icsToken: b.resetIcsToken ? randomBytes(18).toString('base64url') : cur.icsToken,
      };
      await store.put('SETTINGS', next);
      return ok(next);
    },
    true,
  );

  // Admin: website photos
  route('GET', '/admin/photos', async () => ok(await photos.list()), true);
  route(
    'POST',
    '/admin/photos/:slot',
    async (_r, [slot]) => {
      if (!isPhotoSlot(slot)) notFound('Unknown photo');
      return ok({ uploadUrl: await photos.uploadUrl(slot as never) });
    },
    true,
  );

  return async function handle(req: Req): Promise<Res> {
    try {
      let methodMatched = false;
      for (const [method, re, h, admin] of routes) {
        const m = re.exec(req.path);
        if (!m) continue;
        if (method !== req.method) {
          methodMatched = true;
          continue;
        }
        if (admin && !req.user) return { status: 401, body: { error: 'Please sign in again.' } };
        return await h(req, m.slice(1).map(decodeURIComponent));
      }
      return methodMatched
        ? { status: 405, body: { error: 'Method not allowed' } }
        : { status: 404, body: { error: 'Not found' } };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
      log('unhandled error', e);
      return { status: 500, body: { error: 'Something went wrong on our end. Please try again.' } };
    }
  };
}
