import { addDays, EVENT_KINDS, TIME_ZONE, type CalendarEvent } from '@frr/shared';

const escText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
const day = (d: string) => d.slice(0, 10).replace(/-/g, '');
const local = (dt: string) => `${day(dt)}T${dt.slice(11, 13)}${dt.slice(14, 16)}00`;

/** Fold lines at 75 octets as RFC 5545 requires (approximate by chars; content is mostly ASCII). */
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ');

/**
 * Read-only iCalendar feed so the owner can subscribe from the phone's own calendar.
 * Times are wall-clock Downers Grove time (TZID=America/Chicago).
 */
export function toIcs(events: CalendarEvent[], calName: string, nowIso: string): string {
  const stamp = nowIso.replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//First Responder Renovations//Admin//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escText(calName)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  for (const e of events) {
    const kind = EVENT_KINDS.find((k) => k.id === e.kind)?.label ?? e.kind;
    lines.push('BEGIN:VEVENT', `UID:${e.id}@frr`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${day(e.start)}`, `DTEND;VALUE=DATE:${day(addDays(e.end, 1))}`);
    } else {
      lines.push(`DTSTART;TZID=${TIME_ZONE}:${local(e.start)}`, `DTEND;TZID=${TIME_ZONE}:${local(e.end)}`);
    }
    lines.push(`SUMMARY:${escText(`${kind}: ${e.title}`)}`);
    if (e.address) lines.push(`LOCATION:${escText(e.address)}`);
    if (e.notes) lines.push(`DESCRIPTION:${escText(e.notes)}`);
    if (e.kind === 'hold') lines.push('STATUS:TENTATIVE');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
