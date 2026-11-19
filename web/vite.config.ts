import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { isPlaceholder, site } from './site.config.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON-LD GeneralContractor. Placeholder values are omitted rather than published. */
function jsonLd(): string {
  const real = (v: string) => (isPlaceholder(v) ? undefined : v);
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'GeneralContractor',
    '@id': `${site.url}/#business`,
    name: site.name,
    url: site.url,
    image: `${site.url}/photos/hero.webp`,
    telephone: real(site.phone),
    email: real(site.email),
    description:
      'General contractor owned and run by a working Downers Grove firefighter/EMT. Decks and porches, kitchens, bathrooms, roofing, siding and windows, and basement finishing.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: real(site.street),
      addressLocality: site.city,
      addressRegion: site.state,
      postalCode: real(site.zip),
      addressCountry: 'US',
    },
    areaServed: site.towns.map((t) => ({ '@type': 'City', name: `${t}, IL` })),
    openingHoursSpecification: site.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    sameAs: real(site.googleProfile) ? [site.googleProfile] : undefined,
    knowsAbout: ['Deck building', 'Kitchen remodeling', 'Bathroom remodeling', 'Roofing', 'Siding', 'Window replacement', 'Basement finishing'],
  };
  return JSON.stringify(data, (_k, v) => (v === undefined ? undefined : v), 2).replace(/</g, '\\u003c');
}

/** Fills {{tokens}} in the static pages from site.config.ts at build time. */
function siteTokens(): Plugin {
  const digits = site.phone.replace(/\D/g, '');
  const tokens: Record<string, string> = {
    NAME: esc(site.name),
    URL: site.url,
    OWNER: esc(site.ownerName),
    PHONE: esc(site.phone),
    PHONE_HREF: isPlaceholder(site.phone) ? '#contact' : `tel:+1${digits.slice(-10)}`,
    EMAIL: esc(site.email),
    EMAIL_HREF: isPlaceholder(site.email) ? '#contact' : `mailto:${site.email}`,
    ADDRESS: esc(`${site.street}, ${site.city}, ${site.state} ${site.zip}`),
    LICENSE: esc(site.license),
    HOURS: esc(site.hoursText),
    YEAR: String(site.year),
    TOWN_CHIPS: site.towns
      .map((t, i) => `<li class="chip${i === 0 ? ' chip--home' : ''}">${esc(t)}</li>`)
      .join('\n          '),
    TOWNS_SENTENCE: esc(site.towns.slice(0, -1).join(', ') + ' and ' + site.towns[site.towns.length - 1]),
    JSON_LD: jsonLd(),
  };
  return {
    name: 'frr-site-tokens',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/\{\{([A-Z_]+)\}\}/g, (m, k: string) => tokens[k] ?? m),
    },
  };
}

/** In dev, serve the React app for /admin/* and /e/* like the CloudFront function does. */
function devAppRewrite(): Plugin {
  return {
    name: 'frr-dev-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const u = req.url ?? '';
        const path = u.split('?')[0];
        if ((path === '/admin' || path.startsWith('/admin/') || path.startsWith('/e/')) && !path.slice(path.lastIndexOf('/')).includes('.')) {
          req.url = '/app.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), siteTokens(), devAppRewrite()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app.html'),
        notfound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
