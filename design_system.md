# Design System — UAE Real Estate Lead Scraper
> Version 1.0 — Binding reference for all UI development

---

## 1. Brand Identity

| Attribute | Value |
|-----------|-------|
| Product name | Brilliance |
| Tagline (EN) | Find the right buyer, faster |
| Tagline (AR) | اعثر على المشتري المناسب بشكل أسرع |
| Tone | Professional, precise, data-driven — never flashy |
| Target user | UAE real estate agents and sales managers |

---

## 2. Color Palette

### Primary
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#185FA5` | Buttons, links, active states |
| `--color-primary-hover` | `#0F4A82` | Button hover |
| `--color-primary-subtle` | `#E6F1FB` | Selected row, info backgrounds |

### Neutrals (Light mode)
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-base` | `#F7F8FA` | Page background |
| `--color-bg-card` | `#FFFFFF` | Cards, table rows |
| `--color-bg-surface` | `#F0F2F5` | Sidebar, input backgrounds |
| `--color-border` | `#E2E5EA` | All borders |
| `--color-text-primary` | `#111827` | Headings, values |
| `--color-text-secondary` | `#6B7280` | Labels, metadata |
| `--color-text-disabled` | `#B0B8C4` | Disabled states |

### Neutrals (Dark mode)
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-base` | `#0F1117` | Page background |
| `--color-bg-card` | `#1A1D24` | Cards, table rows |
| `--color-bg-surface` | `#22262F` | Sidebar, input backgrounds |
| `--color-border` | `#2E3340` | All borders |
| `--color-text-primary` | `#F3F4F6` | Headings, values |
| `--color-text-secondary` | `#9CA3AF` | Labels, metadata |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#1D9E75` | Score ≥ 90, positive states |
| `--color-warning` | `#BA7517` | Score 75–89, caution |
| `--color-danger` | `#A32D2D` | Score < 75, errors |
| `--color-info` | `#185FA5` | Info banners |

### Tier Colors
| Tier | Background | Text |
|------|-----------|------|
| T1 — Elite | `#EEEDFE` | `#3C3489` |
| T2 — Premium | `#E1F5EE` | `#085041` |
| T3 — Standard | `#F1EFE8` | `#444441` |

### Signal Colors
| Signal | Background | Text |
|--------|-----------|------|
| UHNW | `#FAEEDA` | `#633806` |
| High Net Worth | `#EEEDFE` | `#3C3489` |
| Investor | `#E1F5EE` | `#085041` |
| Private Client | `#E6F1FB` | `#0C447C` |
| Business Owner | `#FAECE7` | `#712B13` |
| Executive | `#FBEAF0` | `#72243E` |

---

## 3. Typography

| Token | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| `--font-sans` | `Inter, system-ui, sans-serif` | — | — | All EN text |
| `--font-arabic` | `Cairo, Tajawal, system-ui, sans-serif` | — | — | All AR text |
| `--text-xs` | — | 11px | 400 | Badges, labels |
| `--text-sm` | — | 13px | 400 | Table body, sidebar fields |
| `--text-base` | — | 15px | 400 | Body copy |
| `--text-lg` | — | 18px | 500 | Page titles |
| `--text-xl` | — | 22px | 500 | Stat numbers |
| `--text-heading` | — | 28px | 600 | Auth/onboarding screens |

### RTL Typography Rules
- Arabic font switches automatically when `dir="rtl"` is applied to `<html>`
- Line-height for Arabic: minimum `1.8` (Arabic script needs more breathing room)
- Never use `letter-spacing` on Arabic text
- Bold in Arabic: use `font-weight: 600` minimum (500 is too light for Arabic at small sizes)

---

## 4. Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Gap between inline elements |
| `--space-2` | `8px` | Badge padding, tight gaps |
| `--space-3` | `12px` | Table cell padding |
| `--space-4` | `16px` | Card padding, section gaps |
| `--space-5` | `24px` | Page section spacing |
| `--space-6` | `32px` | Layout gutter |
| `--space-8` | `48px` | Page top padding |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Badges, chips |
| `--radius-md` | `8px` | Inputs, buttons, cards |
| `--radius-lg` | `12px` | Panels, table containers |
| `--radius-xl` | `16px` | Modals, drawers |
| `--radius-full` | `9999px` | Score circles, avatars |

---

## 6. Components

### Buttons
```
Primary:   bg=--color-primary, text=white, radius=--radius-md, height=36px, px=16px
Secondary: bg=transparent, border=--color-border, text=--color-text-primary
Danger:    bg=--color-danger, text=white
Disabled:  opacity=0.4, cursor=not-allowed
```
- All buttons: `font-size: 13px`, `font-weight: 500`
- No uppercase text
- Active state: `transform: scale(0.98)`

### Inputs & Selects
```
height: 36px
padding: 0 12px
border: 1px solid --color-border
border-radius: --radius-md
background: --color-bg-surface
font-size: 13px
focus: border-color=--color-primary, outline=none, box-shadow=0 0 0 3px rgba(24,95,165,0.15)
```

### Table
```
Header: bg=--color-bg-surface, font-size=12px, font-weight=500, color=--color-text-secondary
Row height: 52px min
Row hover: bg=--color-primary-subtle
Selected row: bg=--color-primary-subtle, border-left=3px solid --color-primary
No visible column separators
Alternating row tint: very subtle (2% opacity difference)
```

### Cards / Stat Tiles
```
bg: --color-bg-card
border: 1px solid --color-border
border-radius: --radius-lg
padding: 16px
```

### Sidebar
```
width: 340px (desktop), full-width sheet (mobile)
position: fixed
bg: --color-bg-card
border: 1px solid --color-border (inline side only)
transition: transform 0.2s ease
z-index: 200
```

### Score Badge
```
size: 40px circle
border: 2px solid semantic color
font-size: 13px, font-weight: 600
≥90 → --color-success
75–89 → --color-warning
<75 → --color-danger
```

### Badges / Chips
```
font-size: 11px
padding: 3px 8px
border-radius: --radius-sm
font-weight: 500
no border (background only)
```

---

## 7. Layout

### Breakpoints
| Name | Min-width | Layout |
|------|-----------|--------|
| `sm` | 0px | Single column, stacked filters |
| `md` | 768px | 2-col filter row, sidebar as sheet |
| `lg` | 1024px | Full table + fixed sidebar |
| `xl` | 1280px | Wider stat grid, map expanded |

### Page Structure
```
<html dir="ltr|rtl">
  <body>
    <Sidebar navigation />        ← 240px fixed left (EN) / right (AR)
    <main>
      <TopBar />                  ← 56px fixed top
      <PageContent />             ← scrollable, padding 24px
    </main>
    <DetailSidebar />             ← 340px fixed right (EN) / left (AR)
  </body>
```

### RTL Rules (Non-negotiable)
- `dir` is set on `<html>` only — never hardcoded on individual elements
- All `margin-left/right` and `padding-left/right` must use logical properties: `margin-inline-start`, `padding-inline-end`, etc.
- `flex-direction` reverses automatically in RTL — do not force it manually
- Icons that imply direction (arrows, chevrons) must mirror in RTL using `transform: scaleX(-1)`
- Sidebar anchors: EN → right edge, AR → left edge
- Navigation: EN → left edge, AR → right edge
- Never hardcode `text-align: left` — use `text-align: start`

---

## 8. Navigation Structure

```
/ (Dashboard)
  /leads          ← Lead table + filters (main screen)
  /map            ← UAE map view
  /search         ← Advanced qualification search
  /campaigns      ← Bitrix24 campaign manager
  /settings
    /profile
    /scraper       ← Source config, schedule
    /integrations  ← Bitrix24, WhatsApp, CRM
    /notifications
  /login
  /onboarding
```

---

## 9. Iconography

- Library: **Lucide React** (already in stack)
- Size: 16px inline, 20px standalone actions, 24px nav
- Stroke width: 1.5px
- Color: inherits from parent text color
- RTL directional icons: `ChevronRight → scaleX(-1)`, `ArrowRight → scaleX(-1)`

---

## 10. Motion & Animation

| Element | Animation | Duration |
|---------|-----------|----------|
| Sidebar open/close | `translateX` | 200ms ease |
| Row hover | background-color | 100ms |
| Modal appear | `opacity + scale(0.97→1)` | 150ms ease-out |
| Scan progress bar | width 0→100% | scrape duration |
| Score badge | none (static) | — |
| Page transitions | `opacity` fade | 120ms |

No bounce, no spring, no complex sequences — this is a productivity tool.

---

## 11. PWA & App Shell

- Manifest: `name: LeadPulse UAE`, `short_name: LeadPulse`, `theme_color: #185FA5`, `background_color: #F7F8FA`
- Icons: 192×192 and 512×512 PNG (Arabic + EN wordmark variants)
- Display mode: `standalone`
- APK via **PWABuilder** (wraps PWA in Android APK — no Play Store required)
- iOS: Add to Home Screen via Safari share sheet (no App Store required)
- Offline: Cache static shell + last lead dataset via Service Worker

---

## 12. Dark Mode

- Detect via `prefers-color-scheme` media query
- Manual override stored in user settings (MySQL `users.theme`)
- All colors swap via CSS variable reassignment on `<html data-theme="dark">`
- No component-level dark mode logic — only token swaps

---

## 13. Do / Don't

| ✅ Do | ❌ Don't |
|-------|---------|
| Use CSS variable tokens everywhere | Hardcode hex values in components |
| Use logical CSS properties | Use `margin-left`, `padding-right` directly |
| Keep table rows scannable and minimal | Add decorative borders between columns |
| Show tier + score together | Show score alone without context |
| Use Inter for EN, Cairo/Tajawal for AR | Use a single font for both languages |
| Lazy-load heavy views (map, campaign) | Import everything upfront |
| Keep sidebar content scrollable | Let it overflow |
| Animate only transform and opacity | Animate layout properties (width, height) |
