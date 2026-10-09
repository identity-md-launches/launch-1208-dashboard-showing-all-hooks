# Hookbook design system

## Overview

Hookbook is an independent directory for developers and researchers exploring Uniswap v4 hook deployments. It combines a quiet workspace layout with a pink accent, open spacing around the overview, and compact, addressable records below it. Every record represents one chain/address pair. Source distinctions take precedence over marketing: registry membership, swap behavior, audit links and routing approval are separate concepts.

The implementation is React + TypeScript with plain CSS. `web/src/styles.css` is the styling source of truth; `web/src/App.tsx` contains the component patterns. `web/src/data.ts` owns data interpretation. There is one light theme, no wallet flow and no animation on page entry.

## Colors

Primitive sRGB hex values and semantic aliases are declared in `web/src/styles.css:8`. Components use the semantic roles below; network emblems and generated hook initials have small local palettes because they identify categories rather than actions.

| Semantic token | Resolved value | Role |
| --- | --- | --- |
| `--color-page` | `#faf9fb` | Main canvas |
| `--color-surface` | `#ffffff` | Sidebar, cards, inputs, dialogs |
| `--color-subtle`, `--color-hover` | `#f5f4f6` | Header rows, neutral badges, hover surfaces |
| `--color-border` | `#e4e1e7` | Structural dividers and card edges |
| `--color-divider` | `#eeecf0` | Quiet row separators |
| `--color-control-border` | `#87818d` | Visible input/select boundaries |
| `--color-text` | `#211d26` | Headings, names, main content |
| `--color-text-secondary` | `#5e5865` | Supporting text and labels |
| `--color-text-muted` | `#706a77` | Metadata, captions and explanatory copy |
| `--color-accent`, `--color-focus` | `#bf1b6c` | Primary action, selected navigation, focus ring |
| `--color-accent-hover` | `#a70d5a` | Hover on the primary action and links |
| `--color-accent-soft` | `#fff2f8` | Selected navigation and source-information surface |
| `--color-accent-tint` | `#fce4f0` | Logo tile, selected count badges, text selection |
| `--color-success-bg` / `--color-success-text` | `#eaf6ef` / `#296244` | Vanilla-swap badges, enabled permissions, copy feedback |
| `--color-feature-bg` / `--color-feature-text` | `#f0eafb` / `#6c4295` | Dynamic-fee badges |

`--pink-200: #f6bed9` supplies decorative connection lines and card-hover outlines. Pink branding is decorative in the logo and hero, while pink control states also have an underline, fill, label or `aria-pressed` state. Green never represents a security approval: it appears with the explicit swap/property/permission label.

Hook initials use `.tone-0` through `.tone-5`, deterministically chosen from the name. The corrected text/background pairs are `#86518d/#f3e8f6`, `#4d6b9a/#e8f0fc`, `#4a6c51/#eaf1ea`, `#885a33/#f9ece3`, `#67518e/#eeebfa`, and `#984761/#fce7ee`. They are not project logos. `NetworkMark` always sits beside a written network name.

Rendered measurements include secondary text on white **6.86:1**, muted text on white **5.23:1**, muted text on the canvas **4.98:1**, and accent text on the pink information surface **5.38:1**. Exact measured pairs and automated-check limitations are in `artifacts/browser-results.json` and `artifacts/validation.md`. These samples are not a claim that every possible state has been measured.

## Typography

The body family is local **DM Sans**, falling back to `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. The Latin WOFF2 file is `web/public/fonts/dm-sans-latin.woff2`, declared with normal weight range **400–750**, `font-display: swap`, and preloaded by `web/index.html`. Body weight is 400, most controls use 500, headings and names use 600–650, and the wordmark uses 750. The interface does not request italic faces. Addresses and permission identifiers use `ui-monospace, SFMono-Regular, Consolas, monospace`.

The root is 16px with body line-height 1.5. Main reusable sizes are `--text-xs: .75rem` (12px), `--text-sm: .8125rem` (13px), `--text-body: .875rem` (14px) and `--text-title: 2.75rem` (44px). Headings use tighter tracking and body text remains normally spaced.

| Role | Implemented treatment |
| --- | --- |
| Main title | 44px, 650 weight, 1.14 line-height, −1.9px tracking; 39/42/39/35px breakpoint overrides |
| Section heading | 18px, 600 weight; dialog title 27px and about-dialog title 30px |
| Hook name | 14px/600 in list, 15px in grid; names wrap rather than ellipsize |
| Description | 11px in the dense list, 11–12px in grid, 14px/1.8 in the complete detail view |
| Inputs | Desktop 12–13px; **16px** with at least 46px height at 680px and below |
| Stats | 30px/600, 27px on narrow screens, tabular numerals |
| Metadata/badges | Compact 9–12px labels; paired with readable full definitions in details |
| Eyebrows | 9–10px, uppercase via CSS, 1.4px tracking |

The small metadata is an intentional density choice for this directory; do not use those sizes for long-form explanations. The list description is one-line ellipsis on desktop and a two-line clamp on mobile; grid descriptions use two lines. Every title and arrow opens the full, unclipped description and full selectable address. Paragraphs use `text-wrap: pretty`; headings generally use `text-wrap: balance`, except data-driven hook names where natural wrapping is preferable. Changing counts and pagination use tabular numerals.

## Layout

Spacing tokens in `:root` provide **4, 8, 12, 16, 20, 24, 32, 40 and 48px** steps. Component padding and gaps use these where appropriate; small optical gaps and local icon dimensions remain explicit. Shared rules use logical margin, padding and inset properties. The main content has a 1510px maximum width and 40px horizontal gutters by default. The sidebar is 14rem (224px at the default text size), reduced to 12.8125rem (205px) at 1230px; its matching content offset uses the same unit so enlarged text has room.

The directory page uses an overview header, four statistic cells, a source-context message, collection controls, labeled filters, results tools, a result list, pagination and a quiet footer. The network view reuses the overview and displays selectable network cards. Saved hooks reuse the same directory patterns.

| Breakpoint | Behavior in the final CSS |
| --- | --- |
| 1600px and above | Main gutters increase to 56px; the hero and row columns gain room |
| 1230px and below | Narrower sidebar/gutters; grid cards and networks use two columns |
| 1040px and below | List properties move into details; search spans the filter row; toolbar and collection controls can wrap |
| 850px and below | Sidebar becomes an in-flow top navigation; resource links leave the chrome, while source/about links remain in the content/footer; three network columns fit the wider content region |
| 680px and below | Two-by-two stats, full-width search, two selects, list rows become stacked cards, grid becomes one column, networks become two columns, two-column detail fields become one |
| 370px and below | 16px page gutters, smaller title and nav labels, compact select treatment without decorative leading icons |

`min-width: 0`, flexible grids, `overflow-wrap: anywhere`, and native page scrolling keep long names/addresses accessible. Desktop list rows are CSS grids of semantic `article` elements, not a fake interactive table. The cosmetic column labels are hidden from assistive technology; each article has its own heading, named actions and written values. Pagination shows 12 records and has explicit previous/next disabled states.

Browser measurements covered **320, 390, 680, 850, 1024 and 1440 CSS pixels**, with no document overflow. Screenshots also show mobile detail wrapping and visible keyboard focus. A desktop 200% root-font enlargement check passed horizontal reflow. Native browser zoom, translated interfaces, RTL mirroring, physical devices and widths outside the measured set were not fully verified. The supplied data and UI are displayed in English; there is no localization system.

## Elevation & Depth

Most surfaces are flat and separated by 1px structural borders. No chart-like or animated decoration implies live data. The hero uses a fading dot grid, static connection paths and three small SVG icon tiles. Its shadows are limited to `0 4px 12px #211d2605` and `0 8px 22px #bf1b6c0b`.

The native modal has `0 12px 50px #211d2626`, a `#211d2666` backdrop and 3px backdrop blur. It lives in the browser's top layer and traps focus natively. Dialog contents scroll with `overscroll-behavior: contain`; page scroll is locked while open. The toast uses `0 5px 24px #211d2626`, and its fixed position is inset from the viewport. Copy/save feedback inside a modal is rendered within that modal so the top layer cannot obscure it.

Normal stacking is sidebar 5, toast 10 and skip link 20; the dialog's native top layer supersedes them.

## Shapes

Radius tokens are `--radius-sm: 6px`, `--radius-md: 9px`, `--radius-lg: 12px`, and `--radius-xl: 18px`. Buttons/inputs use 9px, list/card surfaces use 12px, and the empty-state mark uses 18px. Badge and segmented-control inner radii remain compact at 4–5px. The modal uses 20px, reduced to 16px on mobile. Hook monogram tiles use 11px by default and 16px in the large detail variant; network marks are circular. These are component-specific forms, not a universal rule to round every container equally.

## Components

All component patterns currently live in `web/src/App.tsx`; they are private application components, not an exported design-system library.

| Pattern | Purpose and behavior |
| --- | --- |
| `Logo({compact})`, `HeroArt` | Original Hookbook symbol and static decorative network illustration; decorative SVG is excluded from accessibility names |
| `External({href, children, className})` | External link with arrow, `noopener noreferrer`, and an accessible new-tab cue |
| `HookMark({name, large})`, `NetworkMark({chain})` | Reusable identification marks; text labels carry the meaning independently of color |
| `HookItem({hook, saved, onSave, onOpen})` | Same record in list/grid; full-name button, abbreviated address, network, permission preview and property badges; bookmark has `aria-pressed` and a deployment-specific name |
| `Modal({open, titleId, onClose, children})` | Native `dialog.showModal()`, labeled heading, close button autofocus, Escape/backdrop close and native focus restoration |
| `HookDetails` | Full description, selectable address, source/audit links, reported properties, all 14 enabled/disabled flags and inline copy feedback |
| `AboutData` | Registry/routing distinction, metric definitions, timestamp and immutable commit link |
| `.button`, `.button.primary`, `.icon-button`, `.text-button` | Neutral action, primary action, icon action and inline secondary action; explicit disabled and hover styles |
| `.input-wrap`, `.select-wrap` | Real labeled search input and native selects; decorative icons never intercept clicks |
| `.collections`, `.view-switch` | Native buttons with `aria-pressed`, independent visual selection, no custom tab keyboard protocol |
| `.empty-state`, `.loading-state`, `.toast` | Actionable reset/retry states; static loading skeleton; persistent dismissible result notice |

Focus uses a **2px** accent perimeter with **3px** offset. The first keyboard target is a skip link. `/` focuses search only outside form fields and dialogs. Search/filter/result counts announce through a polite region. Toast announcements have a persistent region; details have their own feedback region. No automatic announcement dismiss timer is used.

Main input controls are at least 43px tall on desktop and 46px on mobile. Small icon buttons are 32×34px on desktop and typically 40×40px on mobile; separated targets satisfy the 24px minimum. Native disabled controls prevent impossible pagination/export actions. The full address remains available if clipboard permissions fail.

Hover styles are gated by `@media (hover: hover)`. The only transitions are 150ms changes to background, border, text color and scale under `prefers-reduced-motion: no-preference`, using `cubic-bezier(.2,0,0,1)`. Press feedback scales buttons to .96. Reduced motion is otherwise static. Forced colors uses system `Highlight` for focus and explicit selected-state outlines.

## Do's and Don'ts

- Start another view inside the existing `app-content` / `main` shell; reuse the overview spacing, section headings and existing button styles.
- Use semantic color roles for text, surfaces, state and focus. Keep identification colors separate from security or approval claims.
- Keep source facts and interpretations distinct. Preserve the full chain/address identity and link to the snapshot commit.
- Keep new controls native, labeled and keyboard operable. Add a persistent announcement region for asynchronous feedback where needed.
- Route new local views through the existing hash-state helpers in `data.ts`; preserve back/forward behavior and relative runtime asset paths.
- Do not imply audits, source verification, vanilla swaps or hook-local access allowlists establish Uniswap routing approval.
- Do not truncate the only copy of a name, address, error or instruction. Compact previews must retain a complete detail path.
- Do not add page-entry motion, a dark theme, remote fonts or wallet infrastructure without a product need and matching validation.

For a new view: add its parsed/serialized state, render a section in the shared main region, compose the existing cards/controls, check it at the documented breakpoints, then update this file and the consolidated evidence record with observed behavior.
