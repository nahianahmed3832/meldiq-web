# Meldiq Web design system

One token file, three colour plates, light and dark from the same definitions. Every colour in the interface comes from
`src/styles/tokens.css`; the stylesheets only reference tokens. The one exception is the avatar tones, which are data
shared with the phone (`src/ui/components/Avatar.tsx`).

## Logo

- **Source:** `brand/meldiq-logo.webp`, 2000×2000: the ribbon "M" with its chat bubble on its own navy ground. It's the
  only logo file. Don't redraw it.
- **Derivatives:** `scripts/render-brand-assets.ts` crops and scales it. Nothing is drawn by hand. The crops are:

  | Crop | What it is | Files |
  |---|---|---|
  | Tight | The mark framed with 14% padding | `public/meldiq-mark-128/256.png` (in the app), `favicon-32.png`, `meldiq-180.png` (Apple), `meldiq-192/512.png` (manifest) |
  | Full | The whole logo, with the mark inside the maskable safe zone | `meldiq-maskable-512.png` |
  | Share image | The logo on its own ground colour, with the name | `meldiq-og.png` (1200×630) |

- **In the app:** `BrandMark` (`src/ui/components/BrandMark.tsx`) shows the tight crop with rounded corners. It's used
  in the rail, sign-in, linking and status screens, and the phone top bar.
- **Replacing the logo:** replace `brand/meldiq-logo.webp`, then run `npx tsx scripts/render-brand-assets.ts`.

## Colour

### Structure

1. **Neutrals:** surfaces, text, borders and states, shared by every palette and tuned cool.
2. **Palettes:** these change only brand hues:
   - the frame (`--rail`, `--rail-2` and its text and states)
   - the sidebar tint (`--sidebar`, `--sidebar-hover`, `--sidebar-selected`, `--sidebar-text`)
   - the accent (`--accent`, `--accent-hover`, `--accent-soft`, `--accent-text`, `--on-accent`, `--accent-2`)
   - mentions, badges (`--badge`, `--rail-badge`) and the browser chrome colour (`--theme-color`)
3. **Modes:** each colour is written as `light-dark(light, dark)`. `color-scheme` decides which one applies: the
   system's setting, or `data-theme="light|dark"`. A palette is written once for both modes.

`data-palette` and `data-theme` on `<html>` come from the per-browser preferences (`src/app/prefs.ts`, Appearance ›
Theme and Colour). Stored values are checked against the allowed lists before use.

### Plates

| Plate | Frame | Sidebar | Accent | Badges on the frame |
|---|---|---|---|---|
| **Indigo** (default, from the logo) | deep indigo `#231d62` | lavender mist `#f4f3fd` | indigo `#4f46e5` | logo cyan `#5ee0f5` |
| Plum | plum `#4a1340` | blush `#fcf2f7` | magenta-plum `#b0236e` | pink `#ff9ccc` |
| Amber | brown `#3d2610` | cream `#fcf6ec` | amber `#a85a06` | gold `#fcc65a` |

The dark-mode values are in the token file. Contrast was computed for every text-on-colour pair below, and all meet
WCAG AA (4.5:1):

- **Accent text on white:** 6.6–7.9.
- **White on the accent (buttons):** 5.1–6.3.
- **Dark-mode accent text:** 9.2–11.4.
- **Selected sidebar text on its tint:** 5.1–6.1.
- **Rail text on the frame:** 8.6–9.7.
- **Muted text:** 5.3 on white and 4.8 on the indigo sidebar (the lowest pair).

### Hierarchy rules

- **Frame:** the rail and top bar carry the brand colour. The sidebar and main column sit on a rounded panel inside the
  frame.
- **Sidebar:** a soft tint of the plate.
- **Conversation:** stays neutral white (or near-black in dark mode).
- **Accent:** only for selection, focus, primary actions, unread counts, mentions, links and the composer's send button.
  Whole panels never take it.
- **Selection:** shown by more than colour. The selected sidebar row has a tint, the accent's text colour and a bar.
- **Failed and paused messages:** carry words and an action ("Not sent · Retry").
- **Fixed-dark surfaces:** the call stage and media viewers stay dark in every theme. They use their own tokens
  (`--call-*`, `--media-*`), with a trace of the plate's frame.
- **Sign-in hero:** uses the logo's own navy ground and glow (`--brand-*`) in every plate.

## Scale

| | Tokens |
|---|---|
| Type | `--fs-xs` 12 · `sm` 13 · `md` 14 (body) · `lg` 15 · `xl` 17 · `2xl` 20 · `3xl` 26; Plus Jakarta Sans |
| Radii | `--r-xs` 6 · `sm` 8 (controls) · `md` 10 (rows, inputs, buttons) · `lg` 14 (cards, composer, panel) · `xl` 18 (dialogs) · `pill` |
| Spacing | `--s-1` 4 · `s-2` 8 · `s-3` 12 · `s-4` 16 · `s-5` 20 · `s-6` 24 · `s-8` 32 |
| Icons | `--icon-sm` 16 · `md` 18 · `lg` 20 |
| Layout | `--rail-w` 68 · `--topbar-h` 52 · `--sidebar-w` 280 · `--frame-gap` 8 |
| Elevation | `--shadow-sm` (controls) · `md` (floating toolbars, the panel) · `lg` (menus, dialogs, toasts) |
| Focus | `--focus` (a 2px ring in the accent, offset from the surface) and `--focus-on-frame` on the rail and top bar |
| Motion | `--t-fast` 120ms · `--t-std` 200ms · `--ease`. Everything respects `prefers-reduced-motion` |

## Messaging

- **Grouping:** a flat timeline. A sender's run sits under one avatar and name; follow-ups are 26px rows that show the
  time on hover.
- **Date separators:** centred label chips.
- **Mentions:** mentions of you get a tinted row with an accent bar.
- **Replies and links:** quotes and link previews have an accent edge.
- **Reactions and threads:** reactions are pills, and threads are a pill link.
- **Composer:** one focus ring, with the send button in the accent colour.
- **Typing:** shown as animated dots plus words.
- **Clearing the composer:** it empties the moment a message is sent, so typing straight on starts the next message. If
  sending fails, the text comes back unless something new has been typed. A browser test covers this
  (`e2e/cross-device.spec.ts`).

## Browsers

`light-dark()` needs Chrome 123, Firefox 120 or Safari 17.5. The app already requires Ed25519 and X25519 in Web Crypto
(Chrome 137+, Firefox 130+, Safari 17+). Safari 17.0–17.4 lacks `light-dark()`, so the capability check
(`src/app/boot.ts`) now lists it, and those browsers get the unsupported screen in readable static colours.
