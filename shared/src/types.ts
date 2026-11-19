/**
 * Single source of truth for every record the API stores and the web app shows.
 * Backend and web both import from here - never re-declare these shapes.
 */

export type JobType = 'deck' | 'kitchen' | 'bath' | 'roof' | 'siding' | 'basement';

export const JOB_TYPES: { id: JobType; name: string }[] = [
  { id: 'deck', name: 'Decks & porches' },
  { id: 'kitchen', name: 'Kitchen remodel' },
  { id: 'bath', name: 'Bathroom remodel' },
  { id: 'roof', name: 'Roofing' },
  { id: 'siding', name: 'Siding & windows' },
  { id: 'basement', name: 'Basement finishing' },
];

export const jobName = (id: JobType | 'other' | undefined | null): string =>
  JOB_TYPES.find((j) => j.id === id)?.name ?? 'Other';

/** Lead pipeline. Labels come from BRAND.md section 6 "Status pills". */
export type LeadStatus = 'new' | 'visit' | 'sent' | 'won' | 'lost';
export const LEAD_STATUSES: { id: LeadStatus; label: string }[] = [
  { id: 'new', label: 'Needs a visit' },
  { id: 'visit', label: 'Visit set' },
  { id: 'sent', label: 'Estimate out' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];
export const statusLabel = (s: LeadStatus) => LEAD_STATUSES.find((x) => x.id === s)?.label ?? s;

export type Priority = 'high' | 'normal' | 'low';
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

export type LeadSource = 'web' | 'phone' | 'referral' | 'walkup';
export const LEAD_SOURCES: { id: LeadSource; label: string }[] = [
  { id: 'phone', label: 'Phone' },
  { id: 'web', label: 'Web form' },
  { id: 'referral', label: 'Referral' },
  { id: 'walkup', label: 'Walk-up' },
];
export const sourceLabel = (s: LeadSource) => LEAD_SOURCES.find((x) => x.id === s)?.label ?? s;

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  jobType: JobType | 'other';
  message: string;
  source: LeadSource;
  status: LeadStatus;
  priority: Priority;
  notes: string;
  /** Local Chicago time "YYYY-MM-DDTHH:mm" of the booked estimate visit, if any. */
  visitAt?: string;
  /** Latest estimate for this lead. */
  estimateId?: string;
  createdAt: string; // ISO UTC
  updatedAt: string; // ISO UTC
}

export type LeadInput = Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>> & { name: string };

export interface LineItem {
  label: string;
  amount: number;
}

export type InputValues = Record<string, number | string>;

export type EstimateStatus = 'draft' | 'sent' | 'approved';

export interface Estimate {
  id: string; // unguessable - it is the customer's link
  number: number; // human-friendly, e.g. 1042
  leadId?: string;
  jobType: JobType;
  inputs: InputValues;
  lines: LineItem[];
  adjustment: number;
  adjustmentLabel: string;
  total: number;
  low: number;
  high: number;
  note: string;
  customer: { name: string; email: string; phone: string; address: string };
  status: EstimateStatus;
  sentAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type EstimateInput = Omit<
  Estimate,
  'id' | 'number' | 'lines' | 'total' | 'low' | 'high' | 'status' | 'sentAt' | 'approvedAt' | 'createdAt' | 'updatedAt'
>;

/** What the customer-facing estimate page receives. No internal ids or notes. */
export interface PublicEstimate {
  id: string;
  number: number;
  jobName: string;
  lines: LineItem[];
  adjustment: number;
  adjustmentLabel: string;
  total: number;
  note: string;
  customer: { name: string; address: string };
  status: EstimateStatus;
  sentAt?: string;
  approvedAt?: string;
  createdAt: string;
  business: Pick<BusinessInfo, 'name' | 'phone' | 'email' | 'license'>;
}

export type EventKind = 'visit' | 'job' | 'hold';
export const EVENT_KINDS: { id: EventKind; label: string }[] = [
  { id: 'visit', label: 'Estimate visit' },
  { id: 'job', label: 'Confirmed job' },
  { id: 'hold', label: 'Pencilled in' },
];

export interface CalendarEvent {
  id: string;
  kind: EventKind;
  title: string;
  leadId?: string;
  /** Visits: "YYYY-MM-DDTHH:mm" local. Jobs/holds: "YYYY-MM-DD" (all day). */
  start: string;
  /** Visits: "YYYY-MM-DDTHH:mm". Jobs/holds: last day, inclusive "YYYY-MM-DD". */
  end: string;
  allDay: boolean;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type EventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;

export interface BusinessInfo {
  name: string;
  phone: string;
  email: string;
  license: string;
}

export interface Settings {
  business: BusinessInfo;
  /** Where new-lead and approval alerts go. Empty = no alerts. */
  notifyEmail: string;
  /** Per job type, per rate id, overrides of the sample rates in pricing.ts. */
  rates: Partial<Record<JobType, Record<string, number>>>;
  /** Secret for the read-only ICS calendar feed. */
  icsToken: string;
}

export const TIME_ZONE = 'America/Chicago';

/** Photo slots on the public page. Each maps 1:1 to /photos/<slot>.webp in the web bucket. */
export const PHOTO_SLOTS = [
  { id: 'hero', label: 'Top of the page', hint: 'A finished job you are proud of. A tall photo works best.' },
  { id: 'deck', label: 'Decks & porches', hint: 'Deck with stairs and railing' },
  { id: 'kitchen', label: 'Kitchens', hint: 'Finished kitchen, cabinets and counters' },
  { id: 'bath', label: 'Bathrooms', hint: 'Tiled shower or vanity' },
  { id: 'roof', label: 'Roofing', hint: 'Finished roof line or flashing detail' },
  { id: 'siding', label: 'Siding & windows', hint: 'House front after new siding or windows' },
  { id: 'basement', label: 'Basements', hint: 'Finished basement room' },
] as const;

export type PhotoSlot = (typeof PHOTO_SLOTS)[number]['id'];
export const isPhotoSlot = (s: string): s is PhotoSlot => PHOTO_SLOTS.some((p) => p.id === s);
