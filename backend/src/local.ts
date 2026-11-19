/**
 * Local dev server on :3001 with an in-memory store. No AWS needed.
 * Every request is treated as signed in. Emails are printed, not sent.
 *   npm run dev -w backend   (the web dev server proxies /api here)
 */
import { createServer } from 'node:http';
import { createApp } from './app';
import { MemoryMailer } from './lib/mailer';
import { MemoryPhotoStorage } from './lib/photos';
import { MemoryStore } from './lib/store';

const mailer = new MemoryMailer();
const origSend = mailer.send.bind(mailer);
mailer.send = async (m) => {
  console.log(`\n[mail] to=${m.to} subject="${m.subject}"\n${m.text}\n`);
  return origSend(m);
};

const app = createApp({
  store: new MemoryStore(),
  mailer,
  photos: new MemoryPhotoStorage(),
  siteUrl: 'http://localhost:5173',
});

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  const r = await app({
    method: req.method ?? 'GET',
    path: url.pathname.replace(/^\/api/, ''),
    query: Object.fromEntries(url.searchParams),
    body: raw ? JSON.parse(raw) : undefined,
    user: 'local-dev',
  });
  res.writeHead(r.status, { 'Content-Type': 'application/json', ...r.headers });
  res.end(r.raw ?? (r.body === undefined ? '' : JSON.stringify(r.body)));
}).listen(3001, () => console.log('API on http://localhost:3001'));
