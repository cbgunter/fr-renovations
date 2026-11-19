import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JOBS, PHOTO_SLOTS, type JobType, type PhotoSlot, type Settings } from '@frr/shared';
import { api, useApi } from '../lib/api';
import { signOut, signedInEmail } from '../lib/auth';
import { copyText } from '../lib/links';
import { ErrorNote, Icon, Loading, TextField, useToast } from '../ui';

/** Shrink a phone photo to max 1600px wide and convert it to WebP before upload. */
async function toWebp(file: File, maxW = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, maxW / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.82));
  if (!blob || blob.type !== 'image/webp') throw new Error("This browser can't convert photos. Try Chrome or Safari on your phone.");
  return blob;
}

function PhotoRow({ slot, updated, onDone }: { slot: (typeof PHOTO_SLOTS)[number]; updated?: string; onDone: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const blob = await toWebp(file);
      const { uploadUrl } = await api<{ uploadUrl: string }>('POST', `/admin/photos/${slot.id}`);
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=300' },
      });
      if (!res.ok) throw new Error('The upload did not finish. Try again.');
      setPreview(URL.createObjectURL(blob));
      toast('Photo saved. It shows on the website within 5 minutes.');
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const src = preview ?? (updated ? `/photos/${slot.id}.webp?v=${encodeURIComponent(updated)}` : null);
  return (
    <li className="photo-row">
      <div className="photo-thumb">{src ? <img src={src} alt="" /> : <Icon name="photo" />}</div>
      <div className="stack" style={{ ['--gap' as string]: '2px', flex: 1, minWidth: 0 }}>
        <strong>{slot.label}</strong>
        <span className="meta">{src ? 'On the website' : slot.hint}</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Uploading…' : src ? 'Replace' : 'Add photo'}
      </button>
    </li>
  );
}

export function SettingsPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { data, error, reload, setData } = useApi<Settings>('/admin/settings');
  const photos = useApi<Record<PhotoSlot, string>>('/admin/photos');
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  useEffect(() => {
    if (s && location.hash) document.querySelector(location.hash)?.scrollIntoView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!s]);

  if (error) return <div className="page"><ErrorNote message={error} retry={reload} /></div>;
  if (!s) return <div className="page"><Loading /></div>;

  const dirty = JSON.stringify(s) !== JSON.stringify(data);
  const icsUrl = `${location.origin}/api/calendar.ics?token=${s.icsToken}`;
  const webcal = icsUrl.replace(/^https?:/, 'webcal:');

  const setRate = (job: JobType, id: string, v: string) => {
    const rates = { ...s.rates, [job]: { ...(s.rates[job] ?? {}) } };
    if (v.trim() === '') delete rates[job]![id];
    else rates[job]![id] = Number(v);
    setS({ ...s, rates });
  };

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setSaveError(null);
    try {
      const next = await api<Settings>('PUT', '/admin/settings', { ...s, ...extra });
      setData(next);
      setS(next);
      toast('Settings saved');
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page stack narrow">
      <h1 className="h-admin">Settings</h1>

      <section className="card stack" style={{ ['--gap' as string]: '16px' }}>
        <h2 className="section-title">Your business</h2>
        <p className="meta">Shown on estimates and emails to customers.</p>
        <TextField label="Business name" value={s.business.name} onChange={(v) => setS({ ...s, business: { ...s.business, name: v } })} />
        <div className="form-pair">
          <TextField label="Phone" type="tel" value={s.business.phone} onChange={(v) => setS({ ...s, business: { ...s.business, phone: v } })} />
          <TextField label="Email customers reply to" type="email" value={s.business.email} onChange={(v) => setS({ ...s, business: { ...s.business, email: v } })} />
        </div>
        <TextField label="License number" value={s.business.license} onChange={(v) => setS({ ...s, business: { ...s.business, license: v } })} />
      </section>

      <section className="card stack" style={{ ['--gap' as string]: '16px' }}>
        <h2 className="section-title">Alerts</h2>
        <TextField
          label="Email me new leads and approved estimates at"
          type="email"
          value={s.notifyEmail}
          onChange={(v) => setS({ ...s, notifyEmail: v })}
          placeholder="you@example.com"
        />
      </section>

      <div className="sticky-actions">
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <button className="btn btn-primary btn-lg" type="button" disabled={!dirty || busy} onClick={() => save()}>
          {busy ? 'Saving…' : dirty ? 'Save settings' : 'All changes saved'}
        </button>
      </div>

      <section className="card stack" style={{ ['--gap' as string]: '14px' }}>
        <h2 className="section-title">Put the calendar on your phone</h2>
        <p className="meta">
          Visits and jobs show up in your phone's own calendar app and update on their own. On iPhone, tap the button. On Android, copy the link and add it in Google Calendar under "From URL".
        </p>
        <div className="row">
          <a className="btn btn-ghost" href={webcal}>
            <Icon name="calendar" size={18} /> Add to my phone
          </a>
          <button className="btn btn-ghost" type="button" onClick={async () => toast((await copyText(icsUrl)) ? 'Link copied' : icsUrl)}>
            <Icon name="copy" size={18} /> Copy link
          </button>
        </div>
        <button
          type="button"
          className="link-btn"
          onClick={() => confirm('Make a new link? Calendars using the old link will stop updating.') && save({ resetIcsToken: true })}
        >
          Make a new private link
        </button>
      </section>

      <section className="card stack" style={{ ['--gap' as string]: '14px' }}>
        <h2 className="section-title">Website photos</h2>
        <p className="meta">Real job photos only. Take them in daylight with the finished work filling the frame. Photos are resized for the web automatically.</p>
        {photos.error && <ErrorNote message={photos.error} retry={photos.reload} />}
        <ul className="photo-list">
          {PHOTO_SLOTS.map((p) => (
            <PhotoRow key={p.id} slot={p} updated={photos.data?.[p.id]} onDone={photos.reload} />
          ))}
        </ul>
      </section>

      <section className="card stack" id="rates" style={{ ['--gap' as string]: '14px' }}>
        <h2 className="section-title">Estimator prices</h2>
        <p className="meta">
          These start as sample numbers. Change any of them to your real prices; leave a box empty to use the sample shown in grey. Then tap Save settings.
        </p>
        {JOBS.map((j) => (
          <details key={j.id} className="disclosure">
            <summary>
              {j.name}
              {Object.keys(s.rates[j.id] ?? {}).length ? <span className="tag" style={{ marginLeft: 10 }}>Your prices</span> : null}
            </summary>
            <div className="rate-grid">
              {Object.entries(j.rates).map(([id, r]) => (
                <div key={id} className="field">
                  <label htmlFor={`rate-${j.id}-${id}`}>
                    {r.label} <span className="meta">({r.unit === 'x' ? 'multiplier' : r.unit})</span>
                  </label>
                  <input
                    id={`rate-${j.id}-${id}`}
                    inputMode="decimal"
                    placeholder={String(r.value)}
                    value={s.rates[j.id]?.[id] ?? ''}
                    onChange={(e) => setRate(j.id, id, e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </div>
              ))}
            </div>
          </details>
        ))}
      </section>

      <section className="card row" style={{ justifyContent: 'space-between' }}>
        <span className="meta">Signed in as {signedInEmail()}</span>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={async () => {
            await signOut();
            nav('/admin/login', { replace: true });
          }}
        >
          <Icon name="out" size={18} /> Sign out
        </button>
      </section>
    </div>
  );
}
