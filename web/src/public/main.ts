// The only script on the public page: submits the contact form to the Leads list.
import '../styles/brand.css';
import '../styles/public.css';

const loadedAt = Date.now();

function init() {
  const form = document.getElementById('contact-form') as HTMLFormElement | null;
  if (!form) return;
  const errorEl = document.getElementById('form-error') as HTMLParagraphElement;
  const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;

  const showError = (msg: string) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    if (!data.name?.trim()) {
      showError('Please add your name.');
      (form.elements.namedItem('name') as HTMLInputElement).focus();
      return;
    }
    if (!data.phone?.trim() && !data.email?.trim()) {
      showError('Please add a phone number or email so we can reach you.');
      (form.elements.namedItem('phone') as HTMLInputElement).focus();
      return;
    }
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, jobType: data.jobType || 'other', elapsedMs: Date.now() - loadedAt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'That did not go through. Please try again, or call us.');
      }
      const first = data.name.trim().split(/\s+/)[0];
      form.innerHTML = `<div class="form-done stack" style="--gap: 12px" tabindex="-1">
        <p class="eyebrow">Request sent</p>
        <h3 class="h-card">Thanks, ${first.replace(/[<>&"]/g, '')}.</h3>
        <p class="body">We have your request and will call you back to set up a visit.</p>
      </div>`;
      (form.querySelector('.form-done') as HTMLElement).focus();
    } catch (err) {
      showError((err as Error).message);
      button.disabled = false;
      button.textContent = 'Send request';
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
