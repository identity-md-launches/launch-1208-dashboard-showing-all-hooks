# Hookbook

A responsive, searchable dashboard for the [Uniswap v4 hook registry](https://github.com/Uniswap/hooklist). The finished static website is in **`dist/`**. Source, dependencies and the lockfile are in **`web/`**.

**The supplied source is a registry, not an authoritative routing allowlist.** Uniswap's [routing policy](https://github.com/Uniswap/hooklist#uniswap-routing-allowlisting) says registry inclusion does not automatically approve a hook for routing. No routing-approval field exists in this source. The dashboard therefore shows all registered deployments, explains this distinction prominently, and never labels a deployment as routing-approved.

## Included

- All **4,955 deployments** across **21 networks** from commit [`a15ee379aebc9c4f580a3ac0eb795f8fc9388500`](https://github.com/Uniswap/hooklist/tree/a15ee379aebc9c4f580a3ac0eb795f8fc9388500), committed upstream on **8 October 2026**.
- Search by name, contract address, description, deployer, network name or chain ID. Multiple search terms compose.
- Combined network/property filters, vanilla-swap and audit-link collections, four sort orders, list/grid views and 12-item pagination.
- Deployment details with all 14 permission flags, properties, full address, copy actions, pinned source entries and available audit links.
- Local bookmarks, a network overview, shareable hash URLs and filtered JSON export containing **all matching results**, including source provenance.
- Local font and data files. Ordinary browsing makes no third-party network requests. No wallet, credentials, backend or analytics are required.
- Empty, loading, missing-deployment and retry states; keyboard navigation and native modal dialogs.

There are **713** records marked `vanillaSwap: true` and **54** records with audit links. Counts represent deployments, not distinct projects. Names can repeat on one or several networks. The registry supports 22 chain definitions; 21 contain deployments in this snapshot. Audit links and verified-source flags are reported from upstream, not independent security assessments.

## Install and develop

Use Node **22.12 or newer** and npm. Dependency versions are pinned in `web/package-lock.json`.

```sh
cd web
npm ci
npm run dev
```

Vite prints the local preview URL. Its development and preview servers bind to loopback by default. Dependencies are installed by the package manager; generated dependency directories are not part of the deliverable.

## Rebuild and preview

```sh
cd web
npm run typecheck
npm test
npm run build
npm run preview
```

`build` also runs TypeScript before writing the production export to repository-root `dist/`. The build uses the bundled snapshot and needs no network once dependencies are installed. An offline dependency install can use `npm ci --offline` when the exact lockfile packages are already in the npm cache; a fresh machine must populate that cache or install online first. There is no vendored package registry.

Serve the export over HTTP(S), not by opening `index.html` as a `file://` URL, because the dashboard fetches local JSON files. JavaScript-disabled browsers receive links to the complete raw dataset and the upstream source.

## Publish

Upload **the entire contents of `dist/`**, retaining `assets/`, `data/`, `fonts/`, `licenses/` and `favicon.svg`, to any static HTTP host. The publisher serves the prebuilt export and does not need to rebuild it. Include `dist/` alongside `web/`, its lockfile, and the documentation in the submission.

Vite uses `base: './'`; HTML, CSS font URLs and JSON requests are relative to the deployment directory. The browser suite serves the actual export at `/preview/` to verify gateway-subpath hosting. Navigation lives in URL fragments, so no server-side rewrite rules are needed. Serve a directory URL ending in `/` or `index.html`; normal static hosts redirect bare directories appropriately. Preserve correct JavaScript, JSON, CSS and WOFF2 MIME types. Enable compression on the host when available: the complete source dataset is approximately 5 MB before compression.

Only snapshot updates require network access. External source, documentation and audit links open new tabs when selected.

## Update the snapshot

```sh
cd web
npm run data:update
# Or reproduce a particular snapshot:
npm run data:update -- a15ee379aebc9c4f580a3ac0eb795f8fc9388500
npm run typecheck
npm test
npm run build
```

The updater resolves a single GitHub commit, downloads `hooklist.json`, `hooklist-vanilla-swap.json`, `chains.json` and `schema.json` at that commit, and validates the complete data before replacing local files. It checks deployment identities, required data types and permission flags, chain IDs, and exact vanilla-swap membership. Original raw-file SHA-256 hashes, source URLs, commit timestamp and retrieval timestamp are preserved in `web/public/data/provenance.json`. The main JSON is minified without changing records; the separate vanilla-swap list is represented losslessly by the matching boolean property rather than duplicated at runtime. `docs/upstream-schema.json` preserves the source schema.

Updates are explicit. The dashboard does **not** silently refresh against GitHub or claim to be live. If the upstream schema changes, review the parser and UI before accepting the new data. Do not infer routing approval from `vanillaSwap`, verified source, audit links, or `swapAccess: allowlist`; the last field describes the hook's own access restriction.

## Browser validation

```sh
cd web
npx playwright install chromium
npm run build
npm run test:browser
```

The script owns a temporary loopback HTTP server and closes it together with its browser before returning. It writes actual results and screenshots to `artifacts/`. Optional `CHROMIUM_EXECUTABLE` selects an installed Chromium, `HOOKBOOK_EXPORT` selects an export directory and `HOOKBOOK_EVIDENCE` selects an evidence directory. The tests inject a deliberate HTTP 503 once to verify retry; that error is recorded separately from normal browsing failures.

### Checks performed on this worker

The worker used a clean staging directory at `/tmp/hookbook-build` for dependency installation so no `node_modules/` or package cache was created inside the repository. Repository source, public files, configuration, tests and lockfile were copied there; `HOOKBOOK_OUTPUT` pointed the build at this repository's `dist/`.

- `npm ci --offline --no-audit --no-fund` against the populated temporary npm cache: passed.
- `npm run typecheck`: passed.
- `npm test`: **7 tests passed**, covering snapshot integrity, filter combinations, search, sorting, saved identities, URL state and invalid data/links.
- `npm run build`: passed with **Vite 8.3.4**, producing the relative-URL static export.
- `npm run test:browser`: production interactions, responsive measurements and accessibility scans; detailed results are in [`artifacts/browser-results.json`](artifacts/browser-results.json).
- The pinned data updater was executed successfully against the snapshot commit.

The supplied browser connector returned `Transport closed`; an installed local Chromium browser was used through Playwright instead. The six-domain Better Interface review, reproduced defects, fixes, measured contrast and coverage limits are recorded in [`artifacts/validation.md`](artifacts/validation.md). Native browser zoom, physical devices, screen-reader output, non-Chromium engines and audit-report contents were not verified. Automated accessibility checks are not a complete accessibility certification.

## Files and maintenance

| Path | Purpose |
| --- | --- |
| `dist/` | Complete production site for publishing |
| `web/src/App.tsx` | Directory, networks, bookmarks, dialogs and navigation |
| `web/src/data.ts` | Dataset validation, search/filter/sort logic, URL state |
| `web/src/styles.css` | Design tokens, component styles, responsive rules |
| `web/public/data/` | Complete dataset and provenance |
| `web/scripts/update-data.mjs` | Reproducible snapshot update |
| `web/test/` | Data tests and production browser validation |
| `DESIGN.md` | Implemented visual system and responsive behavior |
| `artifacts/` | Actual review results and screenshot evidence |

Bookmarks use the browser's local storage under `hookbook.saved.v1`, scoped to this site's origin. They do not sync between browsers. If storage is unavailable, the interface explains that saves last only for the session. Clipboard copying requires a secure context (HTTPS or localhost); if unavailable, it explains how to copy the selectable address manually.

Keep dependency directories, package caches, temporary downloads and test scratch data outside submissions. No ignore file was added or modified. Third-party attributions and licenses are described in [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md).
