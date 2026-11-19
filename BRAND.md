# First Responders Renovations — Brand & UI Guidelines

> **For Claude Code:** read this file before building or changing any UI in this project. The companion file `brand-reference.html` is the reference implementation: copy its `:root` tokens and component CSS rather than re-inventing them. If a request conflicts with these rules, follow the request and flag the conflict in your reply.

---

## 1. Who we are

**First Responders Renovations** is a general contractor in **Downers Grove, IL**, owned and run by a working firefighter/EMT. We do decks & porches, kitchens, bathrooms, roofing, siding & windows, and basement finishing across DuPage County and the nearby western suburbs.

**Brand idea:** *Built right by someone who's seen what happens when it isn't.*

**Feel:** minimal, warm and quiet — think a clean, modern tech brand, but for a Midwest contractor. Flannel shirts, work pants, a well-kept truck. Calm, competent, nothing flashy.

### Products in this project

| Surface | Who uses it | Where | Notes |
|---|---|---|---|
| Public site | Homeowners | Desktop + phone | Single page, SEO-first, static, fast |
| Today | Owner/crew lead | Phone | Home screen of the admin suite |
| Estimator | Owner on site | Phone, one hand, outdoors | Big targets, live total, send by text/email |
| Leads | Owner | Desktop + phone | Prioritize, book estimate visits, track estimates |
| Calendar | Owner | Desktop + phone | Estimate visits vs. confirmed jobs vs. holds |

The admin user is **not technical**. Every admin screen should be usable without training: one obvious primary action per screen, plain labels, no jargon.

---

## 2. Voice & copy

**Sound like:** a neighbor who happens to be very good at this. Plain, specific, honest.

- Use "we" for the company and "you" for the homeowner.
- Short sentences. Concrete nouns (deck, flashing, egress window), not abstractions ("solutions").
- State facts; don't hype. "Quotes are in writing, and the price holds unless you change the plan." beats "Unbeatable transparent pricing!"
- No exclamation points. No emoji. No ALL-CAPS sentences (mono labels are the exception — see Typography).
- Admin copy is instructions, not marketing: "Book an estimate visit", "Mark won", "Send by text".

**The firefighter angle — use it, don't costume it.**
- ✅ "Owned and run by a working Downers Grove firefighter/EMT." / "Built to code, inspected, and safe for the people who live there."
- ❌ Don't name or imply endorsement by the fire department. No department name, patches, Maltese cross, badges, helmets, flames, sirens or "911"-style graphics. No hero/rescue puns.

**Formats**

| Thing | Format | Example |
|---|---|---|
| Money | `$` + thousands commas, no cents unless needed | `$38,500` |
| Ranges | en dash with spaces | `$13,300 – $16,300`, `8:00 – 9:00a` |
| Times | lowercase a/p, no space, drop `:00` in compact views | `8:00a`, `3:30p`, `9a` (grid labels) |
| Dates | `Thu, Nov 19` (admin) · `Nov 19` (tables) · `Today 7:12a` (recent) | |
| Phone | `(630) 555-0142` | |
| Measurements | number + unit, sq ft spelled with space | `224 sq ft`, `24 squares`, `46 ft` |
| Placeholders | square brackets, never lorem ipsum | `[Owner name]`, `[Lic #]` |

---

## 3. Color

All pairs below were checked against WCAG 2.1 and pass AA for body text (4.5:1).

### Core tokens

| Token | Hex | Role |
|---|---|---|
| `--frr-canvas` | `#F4EFE6` | Page background (unbleached canvas) |
| `--frr-paper` | `#FBF8F3` | Cards, inputs, panels, bottom bars |
| `--frr-sand` | `#EFE8DC` | Admin sidebar, all-day lane, quiet fills |
| `--frr-line` | `#DED5C6` | Dividers, card borders |
| `--frr-line-strong` | `#CFC3AF` | Input + ghost-button borders |
| `--frr-ink` | `#23201B` | Primary text, selected states, dark footer |
| `--frr-ink-2` | `#4A433B` | Body copy, secondary text |
| `--frr-muted` | `#665D52` | Labels, meta, timestamps (min for text) |
| `--frr-flannel` | `#9B3A2A` | **The** accent: primary buttons, links, confirmed jobs, high priority |
| `--frr-flannel-dark` | `#7E2E21` | Hover/pressed for flannel |
| `--frr-flannel-tint` | `#F1DCD6` | Secondary text *on* flannel |
| `--frr-duck` | `#EBE1CD` | Tan "duck canvas" tint: estimate visits, info chips |
| `--frr-duck-line` | `#C8B48E` | Border on duck fills |
| `--frr-duck-ink` | `#4A3B22` | Text on duck fills |
| `--frr-photo` | `#E3D7C1` | Photo placeholder fill |
| `--frr-on-dark` | `#EDE6DA` | Text on ink (footer) |
| `--frr-on-dark-muted` | `#BDB3A4` | Meta text on ink |

### Verified contrast

| Text on background | Ratio |
|---|---|
| ink on canvas | 14.2 |
| ink-2 on canvas | 8.5 |
| muted on canvas / paper / sand | 5.6 / 6.1 / 5.3 |
| flannel on canvas | 6.0 |
| paper on flannel / flannel-dark | 6.5 / 8.6 |
| flannel-tint on flannel | 5.3 |
| duck-ink on duck | 8.3 |
| on-dark / on-dark-muted on ink | 13.1 / 7.8 |

### Rules
- **One accent.** Flannel red is the only saturated color. Use it for the single primary action on a screen, links, and things that need attention. If everything is red, nothing is.
- **Selected state = ink, not red.** Segmented choices, pressed filters and active tabs fill/underline with `--frr-ink` (tabs use a flannel underline). Red is for actions.
- **Never color alone.** Status and priority always carry a text label. Paired states differ in lightness (solid flannel vs. pale duck vs. dashed outline), not hue alone. No red/green pairs.
- No gradients, no glows, no drop shadows on cards. Depth comes from paper-on-canvas and 1px lines. The only "shadow" is a 2px ink ring for a selected calendar event.

---

## 4. Typography

Load from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Family | Token | Use |
|---|---|---|
| **Fraunces** (soft serif) | `--frr-font-display` | Headlines, card titles, the wordmark. Weight 500 (600 for wordmark). Never for body or UI labels. |
| **Inter** | `--frr-font-body` | Body copy, UI, buttons, form labels |
| **IBM Plex Mono** | `--frr-font-mono` | Numbers that matter (prices, totals, measurements, times, dates in grids), eyebrow labels, step numbers. The "stamped tag" voice. |

### Scale

| Role | Font | Size / line-height | Tracking |
|---|---|---|---|
| Hero H1 (public) | Fraunces 500 | `clamp(40px, 5.2vw, 68px)` / 1.04 | -0.02em |
| Section H2 (public) | Fraunces 500 | `clamp(32px, 3.6vw, 44px)` / 1.1 | -0.015em |
| Admin page title | Fraunces 500 | 38px / 1.1 (phone: 30–32px) | -0.015em |
| Card title | Fraunces 500 | 24px / 1.15 (phone tiles: 20px) | 0 |
| Lede | Inter 400 | 19px / 1.6 | 0 |
| Body (public) | Inter 400 | 17px / 1.7 | 0 |
| Body (admin) | Inter 400–600 | 15px / 1.5 | 0 |
| Small / meta | Inter 400 | 13–14px / 1.4 | 0 |
| Eyebrow | Plex Mono 400 | 12–13px, UPPERCASE | 0.08em |
| Big number | Plex Mono 500 | 22–26px | 0 |

Rules: one H1 per page. Max line length ~34em for body. Form inputs are **16px minimum** on phone (prevents iOS zoom).

---

## 5. Layout, spacing, shape

- **Spacing scale (px):** 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 56 · 64 · 96. Stacks use `gap`, not margins.
- **Public container:** `max-width: 1200px; margin: 0 auto; padding-inline: clamp(20px, 4vw, 48px)`. Section padding `clamp(56px, 7vw, 96px)` top/bottom.
- **Responsive grids:** `repeat(auto-fit, minmax(min(100%, 320px), 1fr))` — cards collapse to one column on phones with no breakpoints.
- **Admin shell:** sidebar (`--frr-sand`, 220px) + content in a wrapping flex row: sidebar `flex: 1 1 220px`, content `flex: 999 1 640px; min-width: 0`. On a phone the sidebar stacks on top; on the phone-specific screens it's replaced by a 4-item bottom tab bar (Today · Leads · Estimate · Calendar).
- **Wide tables / week grid:** inside an `overflow-x: auto` box with a `min-width` (640px table, 860px calendar). Never squash columns.
- **Radii:** 4px tags · 8px admin buttons & inputs · 10–12px phone controls · 12px admin cards · 14px public cards, images and phone cards · 999px status pills and town chips.
- **Borders:** 1px `--frr-line` for cards and dividers, 1px `--frr-line-strong` for controls.

---

## 6. Components

All of these exist in `brand-reference.html`. Class names there are the source of truth.

### Buttons
| Variant | Class | Look | Use |
|---|---|---|---|
| Primary | `.btn .btn-primary` | flannel fill, paper text, hover flannel-dark | One per screen/section |
| Ghost | `.btn .btn-ghost` | transparent, line-strong border, hover `#EBE2D2` | Secondary actions |
| Outline accent | `.btn .btn-accent` | flannel border + text | Contextual "Estimate" action in a row of ghosts |

Min height **44px** everywhere, **48–52px** for phone primary actions and public CTAs. Icons are optional and sit left of the label.

### Form fields
`.field` wraps a `<label>` + control. Paper fill, 1px line-strong border, 8–10px radius, 12–14px padding, min-height 48px public / 44px admin, 16px text. Focus: `outline: 2px solid var(--frr-flannel); outline-offset: 1px`. Always a visible `<label>`; placeholder text is a hint, never the label.

### Segmented choice (estimator, priority, send-by)
Row of `.choice` buttons with `aria-pressed`. Unselected: paper + line-strong border. Selected: **ink fill, paper text**. Min height 44px.

### Stepper (estimator quantities)
`[−] value unit [+]` — 56px square buttons, value in Plex Mono 26px over a 2px ink underline, unit in muted 14px. Each field has a sensible step (10 sq ft, 2 ft of railing, 1 square).

### Cards
Paper fill, 1px line border, 12–14px radius, 16–22px padding. No shadows, no colored left borders.

### Eyebrow
Plex Mono, 12–13px, uppercase, 0.08em tracking. Flannel above section headings on the public site; muted for meta in admin.

### Status pills (Leads)
| Status | Label | Style |
|---|---|---|
| `new` | Needs a visit | paper fill, flannel text + border |
| `visit` | Visit set / the visit time | duck fill, duck-ink text |
| `sent` | Estimate out | paper fill, ink text + border |
| `won` | Won | ink fill, paper text |
| `lost` | Lost | sand fill, muted text |

### Priority
High = small solid flannel square + "High" in flannel. Normal = outlined square + "Normal" in ink-2. Low = outlined + "Low" in muted. Lists sort High → Low within each tab.

### Calendar events
| Kind | Style |
|---|---|
| Estimate visit | duck fill, duck-line border, ink text; past visits fade to `#F2ECE1` with "· done" |
| Confirmed job | solid flannel, paper text (multi-day = all-day bar spanning columns) |
| Pencilled in / hold | paper fill, **dashed** flannel border, flannel text |
| Now line | 2px flannel line with a 10px dot, today's column tinted `#FBF4EC`, today's date in a flannel circle |

### Plaid strip (the one flannel flourish)
`.plaid` — two crossed `repeating-linear-gradient`s over flannel red. Use it **sparingly**: a 10px band under the public hero and on top of the footer, and as the small square/round brand mark in admin. Never as a full background, never behind text.

### Photo placeholders
`.photo-ph` — `--frr-photo` with a faint 135° hatch and a small mono caption chip describing the shot needed. Replace with real job photos only.

### Icons
Inline SVG, 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-width` 1.8 (2–2.2 at ≤16px), round-ish simple shapes. Decorative icons get `aria-hidden="true"`; icon-only buttons need `aria-label`. No emoji, no icon fonts.

---

## 7. Photography

- **Real jobs only.** The owner's own before/after shots beat stock every time.
- Natural light, warm late-afternoon if possible, level horizons, the finished work as the subject.
- Show craft details (stair stringers, flashing, tile corners) as well as wide shots.
- No stock "smiling contractor with clipboard", no thumbs-up, no hard-hat glamour shots, no fire/emergency imagery.
- Web: WebP, descriptive filenames (`downers-grove-composite-deck-stairs.webp`), meaningful `alt` text, `loading="lazy"` below the fold, 4:3 for job cards, 4:5 for the hero.

---

## 8. Accessibility (non-negotiable)

- Text contrast ≥ 4.5:1 (use the token pairs above; `--frr-muted` is the lightest text color allowed on light grounds).
- Touch targets ≥ 44×44px.
- Real elements: `<button>` for actions, `<a href>` for navigation, `<label for>` on every input, `<fieldset>/<legend>` for radio groups.
- Visible focus: 2px flannel outline, 2px offset.
- `aria-pressed` on toggles/segmented buttons, `aria-current="page"` on the active nav item.
- Respect `prefers-reduced-motion`; transitions are limited to 150ms color changes anyway.

---

## 9. Public-site SEO requirements

- `<title>`: `First Responders Renovations | Decks, Kitchens, Baths & Roofing in Downers Grove, IL`
- Meta description (~150 chars): firefighter-owned + services + Downers Grove.
- One H1 (hero). H2 per section: About, Our work, Where we work, Contact.
- JSON-LD `GeneralContractor` with name, address, phone, hours, `areaServed` listing every town in the coverage list, `sameAs` → Google Business Profile.
- Town names as real text (chips), never baked into an image.
- Name / address / phone identical to the Google Business Profile.
- Static HTML, minimal JS, aim for green Core Web Vitals on mobile.
- Contact form posts into the Leads list (source = "Web form").

---

## 10. Do / Don't quick list

| Do | Don't |
|---|---|
| One flannel primary action per screen | Red buttons everywhere |
| Ink fill for selected states | Color-only status |
| Mono for prices, times, measurements | Serif in buttons or form labels |
| Paper cards on canvas, 1px lines | Shadows, gradients, glassmorphism, colored left-border cards |
| Plaid as a thin band or small mark | Plaid backgrounds or plaid behind text |
| `[Placeholder]` for unknown facts | Invented stats, reviews, years in business |
| "A Downers Grove firefighter/EMT" | Department name, patches, badges, flames, sirens |

---

## 11. Tokens (copy-paste)

```css
:root {
  /* color */
  --frr-canvas: #F4EFE6;
  --frr-paper: #FBF8F3;
  --frr-sand: #EFE8DC;
  --frr-line: #DED5C6;
  --frr-line-strong: #CFC3AF;
  --frr-ink: #23201B;
  --frr-ink-2: #4A433B;
  --frr-muted: #665D52;
  --frr-flannel: #9B3A2A;
  --frr-flannel-dark: #7E2E21;
  --frr-flannel-tint: #F1DCD6;
  --frr-duck: #EBE1CD;
  --frr-duck-line: #C8B48E;
  --frr-duck-ink: #4A3B22;
  --frr-photo: #E3D7C1;
  --frr-on-dark: #EDE6DA;
  --frr-on-dark-muted: #BDB3A4;
  --frr-hover: #EBE2D2;

  /* type */
  --frr-font-display: "Fraunces", Georgia, serif;
  --frr-font-body: "Inter", system-ui, sans-serif;
  --frr-font-mono: "IBM Plex Mono", ui-monospace, monospace;

  /* shape */
  --frr-radius-tag: 4px;
  --frr-radius-control: 8px;
  --frr-radius-card: 12px;
  --frr-radius-lg: 14px;
  --frr-radius-pill: 999px;
  --frr-tap: 44px;
}
```

If the project uses Tailwind, map these in `theme.extend`:

```js
colors: {
  canvas: '#F4EFE6', paper: '#FBF8F3', sand: '#EFE8DC',
  line: { DEFAULT: '#DED5C6', strong: '#CFC3AF' },
  ink: { DEFAULT: '#23201B', 2: '#4A433B', muted: '#665D52' },
  flannel: { DEFAULT: '#9B3A2A', dark: '#7E2E21', tint: '#F1DCD6' },
  duck: { DEFAULT: '#EBE1CD', line: '#C8B48E', ink: '#4A3B22' },
},
fontFamily: {
  display: ['Fraunces', 'Georgia', 'serif'],
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
},
borderRadius: { tag: '4px', control: '8px', card: '12px', lg: '14px' },
```
