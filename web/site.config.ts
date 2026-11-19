/**
 * Business facts for the public page. EDIT THIS FILE to fill in the real details.
 *
 * Anything still in [square brackets] is a placeholder: it shows on the page as-is
 * (so it's obvious what's missing) and is left OUT of the Google structured data.
 * Name / address / phone must match the Google Business Profile exactly (BRAND.md section 9).
 */
export const site = {
  name: 'First Responders Renovations',
  url: 'https://renovations.caseyhunter.net',
  ownerName: '[Owner name]',
  phone: '[(630) XXX-XXXX]',
  email: '[email@example.com]',
  street: '[Street]',
  city: 'Downers Grove',
  state: 'IL',
  zip: '[ZIP]',
  license: '[Lic #]',
  /** Google Business Profile URL, for structured data `sameAs`. */
  googleProfile: '[Google Business Profile URL]',
  /** Opening hours, schema.org format. */
  hours: [{ days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '07:00', closes: '18:00' }],
  hoursText: 'Mon – Fri, 7:00a – 6:00p',
  /** Coverage area. The first town is highlighted as home base. */
  towns: [
    'Downers Grove',
    'Westmont',
    'Lisle',
    'Woodridge',
    'Darien',
    'Willowbrook',
    'Burr Ridge',
    'Hinsdale',
    'Clarendon Hills',
    'Oak Brook',
    'Lombard',
    'Glen Ellyn',
    'Wheaton',
    'Naperville',
  ],
  year: new Date().getFullYear(),
};

export const isPlaceholder = (v: string) => /^\[.*\]$/.test(v.trim());
