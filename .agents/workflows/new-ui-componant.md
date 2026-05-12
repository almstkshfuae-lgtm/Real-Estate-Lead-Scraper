---
description: Read design system first
---

9.1 Read design system first
Before writing component code, open design_system.md:

Section 2: which color tokens to use
Section 6: does a spec exist for this component type?
Section 7: RTL rules

9.2 Client vs Server

useState, useEffect, useTranslation, event handlers → "use client" at top
Pure render, no state, no browser APIs → Server Component, no directive
Heavy browser-only lib (Leaflet, TensorFlow, ExcelJS) → dynamic(() => import(...), { ssr: false }) in the parent page, not in the component file itself

9.3 CSS rules
Colors — CSS variable tokens only:
tsx// Correct:
className="bg-[var(--color-bg-card)] text-[var(--color-text-primary)] border-[var(--color-border)]"
// Wrong:
className="bg-white text-gray-900"
style={{ background: '#185FA5' }}
Spacing — logical Tailwind only:
tsx// Correct: ps- pe- ms- me- start- end- text-start text-end
// Wrong:   pl- pr- ml- mr- left- right- text-left text-right
Dark mode — never dark: classes:
tsx// Correct: className="bg-[var(--color-bg-card)]"
// Wrong:   className="bg-white dark:bg-gray-900"
Directional icons:
tsx<ChevronRight className="w-4 h-4 rtl-mirror" />
9.4 Every string through t()
tsx// Correct:
{t('leads.emptyState', 'No leads found')}
// Wrong:
{"No leads found"}
Add to both locale files immediately. Run i18n script from Section 5.2.
9.5 Verify before committing

 EN layout correct in browser
 AR layout correct — mirrors, Arabic text, icons flipped
 No missing translation key warnings in console
 DevTools computed styles show var(--color-...) not hex values
 Dark mode correct