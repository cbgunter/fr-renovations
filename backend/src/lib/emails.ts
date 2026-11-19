/**
 * Plain, on-brand emails. Inline styles only (email clients ignore <style>).
 * Copy follows BRAND.md voice: plain, specific, no exclamation points.
 */
import { jobName, money, moneyRange, phone, sourceLabel, type Estimate, type Lead, type Settings } from '@frr/shared';
import type { Mail } from './mailer';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const C = { canvas: '#F4EFE6', paper: '#FBF8F3', line: '#DED5C6', ink: '#23201B', ink2: '#4A433B', muted: '#665D52', flannel: '#9B3A2A' };

function shell(title: string, inner: string, business: Settings['business']): string {
  const contact = [business.phone && phone(business.phone), business.email].filter(Boolean).join(' · ');
  return `<!doctype html><html><body style="margin:0;background:${C.canvas};font-family:Inter,Arial,sans-serif;color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.paper};border:1px solid ${C.line};border-radius:12px">
<tr><td style="height:8px;background:${C.flannel};border-radius:12px 12px 0 0"></td></tr>
<tr><td style="padding:28px 28px 8px"><div style="font-family:Georgia,serif;font-size:20px;font-weight:600">${esc(business.name)}</div></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:16px;line-height:1.6;color:${C.ink2}">
<h1 style="font-family:Georgia,serif;font-weight:500;font-size:26px;line-height:1.2;color:${C.ink};margin:8px 0 16px">${esc(title)}</h1>
${inner}
</td></tr>
${contact ? `<tr><td style="padding:16px 28px;border-top:1px solid ${C.line};font-size:13px;color:${C.muted}">${esc(contact)}</td></tr>` : ''}
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:${C.flannel};color:${C.paper};text-decoration:none;font-weight:600;padding:14px 22px;border-radius:8px">${esc(label)}</a></p>`;

export function estimateEmail(est: Estimate, link: string, s: Settings): Omit<Mail, 'to'> {
  const first = est.customer.name.split(/\s+/)[0] || 'there';
  const rows = est.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line}">${esc(l.label)}</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${C.line};font-family:monospace">${money(l.amount)}</td></tr>`,
    )
    .join('');
  const adj = est.adjustment
    ? `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line}">${esc(est.adjustmentLabel || 'Adjustment')}</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${C.line};font-family:monospace">${money(est.adjustment)}</td></tr>`
    : '';
  const inner = `<p style="margin:0 0 12px">Hi ${esc(first)},</p>
<p style="margin:0 0 12px">Thanks for having us out. Here is your written estimate for the ${esc(jobName(est.jobType).toLowerCase())} at ${esc(est.customer.address || 'your home')}.</p>
${est.note ? `<p style="margin:0 0 12px">${esc(est.note).replace(/\n/g, '<br>')}</p>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;margin:16px 0">${rows}${adj}
<tr><td style="padding:12px 0;font-weight:600">Total</td><td align="right" style="padding:12px 0;font-family:monospace;font-size:20px;font-weight:600">${money(est.total)}</td></tr></table>
${button(link, 'View and approve estimate')}
<p style="margin:0;font-size:14px;color:${C.muted}">The price holds unless the plan changes. Reply to this email or call with any questions.</p>`;
  const text = [
    `Hi ${first},`,
    '',
    `Here is your written estimate for the ${jobName(est.jobType).toLowerCase()}.`,
    est.note,
    '',
    ...est.lines.map((l) => `${l.label}: ${money(l.amount)}`),
    est.adjustment ? `${est.adjustmentLabel || 'Adjustment'}: ${money(est.adjustment)}` : '',
    `Total: ${money(est.total)}`,
    '',
    `View and approve: ${link}`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
  return {
    subject: `Your estimate from ${s.business.name} · ${money(est.total)}`,
    html: shell(`Estimate #${est.number}`, inner, s.business),
    text,
    replyTo: s.business.email || s.notifyEmail || undefined,
  };
}

export function newLeadEmail(lead: Lead, adminLink: string, s: Settings): Omit<Mail, 'to'> {
  const facts: [string, string][] = [
    ['Job', jobName(lead.jobType)],
    ['Phone', phone(lead.phone)],
    ['Email', lead.email],
    ['Address', lead.address],
    ['From', sourceLabel(lead.source)],
  ];
  const list = facts
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:${C.muted};font-size:14px">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join('');
  const inner = `<table role="presentation" cellpadding="0" cellspacing="0">${list}</table>
${lead.message ? `<p style="margin:16px 0 0;padding:12px 14px;background:${C.canvas};border-radius:8px">${esc(lead.message).replace(/\n/g, '<br>')}</p>` : ''}
${button(adminLink, 'Open in Leads')}`;
  return {
    subject: `New lead: ${lead.name} · ${jobName(lead.jobType)}`,
    html: shell(`New lead from ${lead.name}`, inner, s.business),
    text: `New lead from ${lead.name}\n${facts.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${lead.message}\n\n${adminLink}`,
    replyTo: lead.email || undefined,
  };
}

export function approvedEmail(est: Estimate, adminLink: string, s: Settings): Omit<Mail, 'to'> {
  const inner = `<p style="margin:0 0 12px">${esc(est.customer.name)} approved estimate #${est.number} for the ${esc(jobName(est.jobType).toLowerCase())}.</p>
<p style="margin:0 0 12px;font-family:monospace;font-size:20px;color:${C.ink}">${money(est.total)}</p>
<p style="margin:0 0 12px">The lead is marked Won. Next step: put the job on the calendar.</p>
${button(adminLink, 'Schedule the job')}`;
  return {
    subject: `Approved: ${est.customer.name} · ${money(est.total)}`,
    html: shell('Estimate approved', inner, s.business),
    text: `${est.customer.name} approved estimate #${est.number} (${moneyRange(est.low, est.high)} range, ${money(est.total)} total). ${adminLink}`,
  };
}
