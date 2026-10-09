import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Database,
  GitBranch,
  Github,
  Globe2,
  Grid2X2,
  Info,
  Layers3,
  List,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
  X,
} from "lucide-react";
import {
  chainName,
  filterHooks,
  FLAG_NAMES,
  flagLabel,
  formatNumber,
  hookId,
  loadRegistry,
  parseHash,
  safeUrl,
  serializeRoute,
  shortAddress,
  type Hook,
  type Provenance,
  type Registry,
  type Route,
} from "./data";

const REPOSITORY = "https://github.com/Uniswap/hooklist";
const PAGE_SIZE = 12;
const initialRoute = () => parseHash(window.location.hash);
const defaultRoute = parseHash("");
const savedKey = "hookbook.saved.v1";

function readSaved(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(savedKey) || "[]");
    return new Set(
      Array.isArray(value)
        ? value.filter(
            (id): id is string =>
              typeof id === "string" && /^\d+:0x[0-9a-f]{40}$/.test(id),
          )
        : [],
    );
  } catch {
    return new Set();
  }
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d="M12 10v14a7 7 0 0 0 14 0v-7m-4 3 4-4 4 4" />
        </svg>
      </span>
      {!compact && (
        <span>
          hookbook<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}

function External({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function NetworkMark({ chain }: { chain: string }) {
  return (
    <span className={`network-mark network-${chain}`} aria-hidden="true">
      {chain === "ethereum" ? (
        <svg viewBox="0 0 16 20">
          <path d="m8 0 7 10-7 4-7-4Zm0 16 7-4-7 8-7-8Z" fill="currentColor" />
        </svg>
      ) : chain === "base" ? (
        <span className="base-line" />
      ) : chain === "unichain" ? (
        "✦"
      ) : chain === "arbitrum" ? (
        "A"
      ) : chain === "optimism" ? (
        "O"
      ) : (
        chain.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function HookMark({ name, large = false }: { name: string; large?: boolean }) {
  const color =
    Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % 6;
  const initials =
    name
      .replace(/Hook(s)?$/i, "")
      .split(/\s+|(?=[A-Z][a-z])/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join("") || "H";
  return (
    <span
      className={`hook-mark tone-${color}${large ? " large" : ""}`}
      aria-hidden="true"
    >
      {initials.toUpperCase()}
    </span>
  );
}

function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-grid" />
      <svg viewBox="0 0 350 180" className="art-lines">
        <path d="M35 112H100Q120 112 120 92V77Q120 57 140 57H230Q250 57 250 37V25M178 58V112Q178 132 198 132H312" />
        <circle cx="35" cy="112" r="4" />
        <circle cx="250" cy="25" r="4" />
        <circle cx="312" cy="132" r="4" />
      </svg>
      <div className="art-node art-node-one">
        <Layers3 />
      </div>
      <div className="art-node art-node-main">
        <Logo compact />
      </div>
      <div className="art-node art-node-two">
        <Workflow />
      </div>
      <span className="art-label">A little code. A new possibility.</span>
    </div>
  );
}

function Modal({
  open,
  titleId,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
        if (dialog.open) dialog.close();
      };
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          onClose();
      }}
    >
      <button
        type="button"
        className="icon-button modal-close"
        aria-label="Close details"
        onClick={onClose}
        autoFocus
      >
        <X size={20} />
      </button>
      {children}
    </dialog>
  );
}

function AboutData({ provenance }: { provenance?: Provenance }) {
  return (
    <div className="about-content">
      <span className="section-eyebrow">Built on open data</span>
      <h2 id="about-title">Know what you’re exploring.</h2>
      <p>
        Hookbook is an independent directory of deployments in the public{" "}
        <a href={REPOSITORY} target="_blank" rel="noopener noreferrer">
          Uniswap/hooklist registry
        </a>
        .
      </p>
      <div className="data-explanation">
        <Info size={20} />
        <div>
          <h3>Routing approval is not reported</h3>
          <p>
            Uniswap explicitly states that submitting a hook to this registry
            does not automatically allowlist it for routing. The source does not
            provide a routing-approval field, so this dashboard cannot identify
            an authoritative routing allowlist.
          </p>
          <External href={`${REPOSITORY}#uniswap-routing-allowlisting`}>
            Read Uniswap’s routing policy
          </External>
        </div>
      </div>
      <h3>A few useful distinctions</h3>
      <dl className="definitions">
        <div>
          <dt>Registered hook</dt>
          <dd>
            A contract deployment listed in the source. A project can have
            multiple deployments, each with its own address and network.
          </dd>
        </div>
        <div>
          <dt>Vanilla swap</dt>
          <dd>
            A hook marked <code>vanillaSwap: true</code> by the source. This is
            a swap behavior classification, not routing approval.
          </dd>
        </div>
        <div>
          <dt>Audit link</dt>
          <dd>
            An audit URL supplied in the registry. Hookbook has not
            independently checked the report or its coverage.
          </dd>
        </div>
        <div>
          <dt>Verified source</dt>
          <dd>
            Source code marked verified in the registry. It is not a security
            assessment.
          </dd>
        </div>
      </dl>
      {provenance && (
        <div className="snapshot-info">
          <Database size={17} />
          <div>
            <strong>
              Snapshot from{" "}
              {new Date(provenance.commitDate).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </strong>
            <p>
              All {formatNumber(provenance.hookCount)} deployments are included.
              Data is bundled with this site and does not update automatically.
            </p>
            <External href={`${REPOSITORY}/tree/${provenance.commit}`}>
              View source commit {provenance.commit.slice(0, 7)}
            </External>
          </div>
        </div>
      )}
    </div>
  );
}

function HookDetails({
  hook,
  provenance,
  saved,
  onSave,
  onCopy,
  feedback,
}: {
  hook: Hook;
  provenance: Provenance;
  saved: boolean;
  onSave: () => void;
  onCopy: (text: string) => void;
  feedback: string;
}) {
  const h = hook.hook,
    p = hook.properties;
  const audit = safeUrl(h.auditUrl);
  const entry = `${REPOSITORY}/blob/${provenance.commit}/hooks/${h.chain}/${h.address.toLowerCase()}.json`;
  const yesNo = (value: boolean) => (value ? "Yes" : "No");
  return (
    <>
      <div className="detail-heading">
        <HookMark name={h.name} large />
        <span className="section-eyebrow">Hook deployment</span>
        <h2 id="detail-title">{h.name}</h2>
        <div className="detail-network">
          <NetworkMark chain={h.chain} />
          {chainName(h.chain)}
          <span className="muted">Chain ID {h.chainId}</span>
        </div>
      </div>
      <p className="detail-description">
        {h.description ||
          "The source does not provide a description for this hook."}
      </p>
      <div className="address-panel">
        <span className="field-label">Contract address</span>
        <div>
          <code>{h.address}</code>
          <button
            className="icon-button"
            aria-label="Copy contract address"
            onClick={() => onCopy(h.address)}
          >
            <Copy size={17} />
          </button>
        </div>
      </div>
      <div className="detail-actions">
        <External href={entry} className="button primary">
          View source entry
        </External>
        <button
          type="button"
          className="button"
          onClick={onSave}
          aria-pressed={saved}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
          {saved ? "Saved" : "Save hook"}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => onCopy(window.location.href)}
        >
          <Copy size={16} />
          Copy link
        </button>
      </div>
      <div role="status">
        {feedback && <p className="copy-feedback">{feedback}</p>}
      </div>
      <section className="detail-section">
        <div className="section-heading">
          <h3>Properties</h3>
          <span className="caption">As reported by the registry</span>
        </div>
        <dl className="properties">
          <div>
            <dt>Vanilla swap</dt>
            <dd>{yesNo(p.vanillaSwap)}</dd>
          </div>
          <div>
            <dt>Dynamic fees</dt>
            <dd>{yesNo(p.dynamicFee)}</dd>
          </div>
          <div>
            <dt>Upgradeable</dt>
            <dd>{yesNo(p.upgradeable)}</dd>
          </div>
          <div>
            <dt>Custom swap data</dt>
            <dd>{p.requiresCustomSwapData ? "Required" : "Not required"}</dd>
          </div>
          <div>
            <dt>Swap access restriction</dt>
            <dd>
              {p.swapAccess === "none"
                ? "None reported"
                : p.swapAccess.charAt(0).toUpperCase() + p.swapAccess.slice(1)}
            </dd>
          </div>
          <div>
            <dt>Verified source</dt>
            <dd>{yesNo(h.verifiedSource)}</dd>
          </div>
          <div>
            <dt>Audit report</dt>
            <dd>
              {audit ? (
                <External href={audit}>Open audit link</External>
              ) : (
                "No link provided"
              )}
            </dd>
          </div>
          <div>
            <dt>Routing approval</dt>
            <dd>Not reported</dd>
          </div>
        </dl>
      </section>
      <section className="detail-section">
        <div className="section-heading">
          <h3>
            Hook permissions{" "}
            <span className="count">
              {Object.values(hook.flags).filter(Boolean).length}
            </span>
          </h3>
          <span className="caption">14 permission flags</span>
        </div>
        <ul className="permission-grid">
          {FLAG_NAMES.map((flag) => (
            <li key={flag} className={hook.flags[flag] ? "enabled" : ""}>
              {hook.flags[flag] ? (
                <Check size={15} />
              ) : (
                <span className="permission-off">−</span>
              )}
              <span>{flagLabel(flag)}</span>
              <span className="sr-only">
                {hook.flags[flag] ? ": enabled" : ": disabled"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {h.deployer && (
        <div className="deployer">
          <span className="field-label">Deployer reported by source</span>
          <code>{h.deployer}</code>
        </div>
      )}
      <p className="detail-note">
        <Info size={16} />
        Registry inclusion does not confirm Uniswap routing approval.
      </p>
    </>
  );
}

function HookItem({
  hook,
  saved,
  onSave,
  onOpen,
}: {
  hook: Hook;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  const flags = FLAG_NAMES.filter((flag) => hook.flags[flag]);
  const preview: typeof flags = flags.filter(
    (flag) => flag === "beforeSwap" || flag === "afterSwap",
  );
  if (!preview.length) preview.push(...flags.slice(0, 1));
  const more = flags.length - preview.length;
  return (
    <article className="hook-item">
      <div className="hook-main">
        <HookMark name={hook.hook.name} />
        <div className="hook-copy">
          <h3>
            <button type="button" className="hook-title" onClick={onOpen}>
              {hook.hook.name}
            </button>
          </h3>
          <p title={hook.hook.description}>
            {hook.hook.description || "No description provided."}
          </p>
          <span className="hook-address" title={hook.hook.address}>
            {shortAddress(hook.hook.address)}
          </span>
        </div>
      </div>
      <div className="hook-network">
        <NetworkMark chain={hook.hook.chain} />
        <span>{chainName(hook.hook.chain)}</span>
      </div>
      <div className="hook-permissions">
        {preview.map((flag) => (
          <span className="permission-badge" key={flag}>
            {flag}
          </span>
        ))}
        {more > 0 && (
          <span
            className="extra-permissions"
            aria-label={`${more} more permissions`}
          >
            +{more}
          </span>
        )}
        {!flags.length && <span className="muted">No callbacks</span>}
      </div>
      <div className="hook-properties">
        {hook.properties.vanillaSwap && (
          <span className="badge badge-green">Vanilla swap</span>
        )}
        {hook.properties.dynamicFee && (
          <span className="badge badge-purple">Dynamic fees</span>
        )}
        {safeUrl(hook.hook.auditUrl) && (
          <span className="badge badge-neutral">
            <ShieldCheck size={12} />
            Audit link
          </span>
        )}
        {!hook.properties.vanillaSwap &&
          !hook.properties.dynamicFee &&
          !safeUrl(hook.hook.auditUrl) && (
            <span className="badge badge-neutral">
              {hook.properties.requiresCustomSwapData
                ? "Custom swap data"
                : "Static fee flag"}
            </span>
          )}
      </div>
      <div className="hook-actions">
        <button
          type="button"
          className={`icon-button save-button${saved ? " is-saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${hook.hook.name} on ${chainName(hook.hook.chain)} (${shortAddress(hook.hook.address)})`}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          className="icon-button open-hook"
          aria-label={`View ${hook.hook.name} on ${chainName(hook.hook.chain)} (${shortAddress(hook.hook.address)})`}
          onClick={onOpen}
        >
          <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="grid-card-footer">
        <code>{shortAddress(hook.hook.address)}</code>
        <button type="button" className="text-button" onClick={onOpen}>
          View details <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(readSaved);
  const [notice, setNotice] = useState("");
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setRoute(initialRoute());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    loadRegistry(controller.signal)
      .then((data) => {
        setRegistry(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "The registry could not be loaded.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !target.isContentEditable &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const update = (patch: Partial<Route>, replace = false) => {
    if ((patch.hook && patch.hook !== route.hook) || patch.about) setNotice("");
    // Read the current URL so rapid successive controls cannot overwrite a pending filter.
    const next = { ...parseHash(window.location.hash), ...patch };
    const hash = serializeRoute(next);
    if (replace) window.history.replaceState(null, "", hash);
    else if (window.location.hash !== hash)
      window.history.pushState(null, "", hash);
    setRoute(next);
  };
  const navigate = (view: string) => {
    update({ ...defaultRoute, layout: route.layout, view });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const hooks = registry?.hooks || [];
  const chains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of hooks)
      counts.set(h.hook.chain, (counts.get(h.hook.chain) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [hooks]);
  const stats = useMemo(
    () => ({
      vanilla: hooks.filter((h) => h.properties.vanillaSwap).length,
      audits: hooks.filter((h) => safeUrl(h.hook.auditUrl)).length,
    }),
    [hooks],
  );
  const filtered = useMemo(
    () =>
      filterHooks(
        hooks,
        { ...route, savedOnly: route.view === "saved" },
        saved,
      ),
    [hooks, route, saved],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(route.page, pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = route.hook
    ? hooks.find((h) => hookId(h) === route.hook)
    : undefined;
  const hasFilters =
    !!route.query ||
    route.chain !== "all" ||
    route.collection !== "all" ||
    route.property !== "all";
  const clearFilters = () =>
    update({
      query: "",
      chain: "all",
      collection: "all",
      property: "all",
      page: 1,
    });
  const toggleSave = (hook: Hook) => {
    const next = new Set(saved),
      id = hookId(hook);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSaved(next);
    try {
      localStorage.setItem(savedKey, JSON.stringify([...next]));
      setNotice(
        next.has(id)
          ? `${hook.hook.name} saved on this browser.`
          : `${hook.hook.name} removed from saved hooks.`,
      );
    } catch {
      setNotice(
        "Browser storage is unavailable. Saved hooks will last for this session only.",
      );
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard.");
    } catch {
      setNotice(
        "Clipboard is unavailable. Select and copy the address or URL directly.",
      );
    }
  };
  const download = () => {
    if (!registry || !filtered.length) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            source: registry.provenance,
            filters: {
              query: route.query,
              chain: route.chain,
              collection: route.collection,
              property: route.property,
              savedOnly: route.view === "saved",
            },
            hooks: filtered,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hookbook-${route.view === "saved" ? "saved-" : ""}${route.chain === "all" ? "all-networks" : route.chain}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      `Exported ${formatNumber(filtered.length)} hook deployments as JSON.`,
    );
  };
  const changePage = (next: number) => {
    update({ page: next });
    resultsRef.current?.focus();
    resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  const viewTitle =
    route.view === "networks"
      ? "Networks"
      : route.view === "saved"
        ? "Saved hooks"
        : "Hook directory";
  const snapshotDate = registry
    ? new Date(registry.provenance.commitDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : loading
      ? "Loading snapshot"
      : "Snapshot unavailable";
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          href="#"
          className="brand-link"
          onClick={(e) => {
            e.preventDefault();
            navigate("directory");
          }}
          aria-label="Hookbook home"
        >
          <Logo />
        </a>
        <div className="workspace-label">
          <span className="mini-spark">✦</span> Uniswap v4 ecosystem{" "}
          <span className="version">v4</span>
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Explore</p>
          <a
            href="#"
            className={`nav-item ${route.view === "directory" ? "active" : ""}`}
            aria-current={route.view === "directory" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate("directory");
            }}
          >
            <Grid2X2 size={18} />
            Hook directory
            <span className="nav-count">
              {registry ? formatNumber(hooks.length) : "—"}
            </span>
          </a>
          <a
            href="#view=networks"
            className={`nav-item ${route.view === "networks" ? "active" : ""}`}
            aria-current={route.view === "networks" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate("networks");
            }}
          >
            <Globe2 size={18} />
            Networks
          </a>
          <a
            href="#view=saved"
            className={`nav-item ${route.view === "saved" ? "active" : ""}`}
            aria-current={route.view === "saved" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate("saved");
            }}
          >
            <Bookmark size={18} />
            Saved hooks
            {saved.size > 0 && <span className="nav-count">{saved.size}</span>}
          </a>
        </nav>
        <nav className="resource-nav" aria-label="Resources">
          <p className="nav-label">Resources</p>
          <External className="nav-item" href={REPOSITORY}>
            <Github size={18} />
            Source repository
          </External>
          <External
            className="nav-item"
            href="https://docs.uniswap.org/contracts/v4/concepts/hooks"
          >
            <BookOpen size={18} />
            Understand hooks
          </External>
          <button
            type="button"
            className="nav-item"
            onClick={() => update({ about: true })}
          >
            <CircleHelp size={18} />
            About the data
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="builder-card">
            <span className="builder-icon">
              <Workflow size={20} />
            </span>
            <h3>Building something new?</h3>
            <p>Put your hook on the map.</p>
            <External
              href={`${REPOSITORY}/issues/new/choose`}
              className="button"
            >
              Submit a hook
            </External>
          </div>
          <div className="sidebar-foot">
            <span className="small-logo">✦</span>
            <span>Open source. Open possibilities.</span>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Explore</span>
            <ChevronRight size={14} />
            <span>{viewTitle}</span>
          </div>
          <div className="topbar-right">
            <span className="protocol-badge">
              <span>✦</span> Built around Uniswap v4
            </span>
            <External href={REPOSITORY} className="github-link">
              <Github size={18} />
              <span className="sr-only">Source repository</span>
            </External>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <section className="hero">
            <div className="hero-copy">
              <div className="section-eyebrow">
                <span className="pink-dash" />
                Discover what’s possible
              </div>
              <h1>
                {viewTitle}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {route.view === "saved"
                  ? "A closer look at the hooks on your radar. Saved locally in this browser."
                  : route.view === "networks"
                    ? "One ecosystem, many networks. Explore where hooks are being built."
                    : "Small contracts. New possibilities. Explore the hooks extending Uniswap v4."}
              </p>
              <div className="snapshot-label">
                <GitBranch size={14} />
                <span>Registry snapshot</span>
                <span className="separator-dot">·</span>
                <span>{snapshotDate}</span>
              </div>
            </div>
            <HeroArt />
          </section>
          <div className="stats" aria-label="Registry overview">
            <div className="stat">
              <div className="stat-label">
                Registered hooks
                <Workflow size={16} />
              </div>
              <strong>{registry ? formatNumber(hooks.length) : "—"}</strong>
              <span>Unique deployments</span>
            </div>
            <div className="stat">
              <div className="stat-label">
                Networks
                <Globe2 size={16} />
              </div>
              <strong>{registry ? chains.length : "—"}</strong>
              <span>Across the ecosystem</span>
            </div>
            <div className="stat">
              <div className="stat-label">
                Vanilla swap
                <Layers3 size={16} />
              </div>
              <strong>{registry ? formatNumber(stats.vanilla) : "—"}</strong>
              <span>Marked in the source</span>
            </div>
            <div className="stat">
              <div className="stat-label">
                With audit links
                <ShieldCheck size={16} />
              </div>
              <strong>{registry ? formatNumber(stats.audits) : "—"}</strong>
              <span>Reports to explore</span>
            </div>
          </div>
          <div className="registry-note">
            <Info size={17} />
            <p>
              <strong>A registry, with context.</strong> Inclusion does not
              confirm Uniswap routing approval.
            </p>
            <button type="button" onClick={() => update({ about: true })}>
              About the data <ArrowUpRight size={15} />
            </button>
          </div>
          {loading ? (
            <section
              className="loading-state"
              aria-live="polite"
              aria-busy="true"
            >
              <Database size={28} />
              <h2>Loading the registry</h2>
              <p>Preparing the bundled hook snapshot…</p>
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </section>
          ) : error ? (
            <section className="empty-state" role="alert">
              <Database size={30} />
              <h2>Couldn’t load the registry</h2>
              <p>{error} Try loading it again, or view the original source.</p>
              <div className="empty-actions">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  Try again
                </button>
                <External className="button" href={REPOSITORY}>
                  View source
                </External>
              </div>
            </section>
          ) : route.view === "networks" ? (
            <section className="networks-section">
              <div className="section-heading">
                <h2>
                  Explore by network{" "}
                  <span className="count">{chains.length}</span>
                </h2>
                <span className="caption">Sorted by deployment count</span>
              </div>
              <div className="network-grid">
                {chains.map(([chain, count]) => (
                  <button
                    type="button"
                    key={chain}
                    className="network-card"
                    onClick={() => update({ ...defaultRoute, chain })}
                  >
                    <NetworkMark chain={chain} />
                    <span className="network-card-name">
                      {chainName(chain)}
                    </span>
                    <ArrowUpRight size={18} />
                    <strong>{formatNumber(count)}</strong>
                    <span className="caption">registered hooks</span>
                    <span className="network-bar">
                      <span
                        style={{
                          width: `${Math.max(2, (count / hooks.length) * 100)}%`,
                        }}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="directory-section" aria-label="Browse hooks">
              <div className="directory-top">
                <div className="collections" aria-label="Hook collections">
                  {[
                    {
                      value: "all",
                      label:
                        route.view === "saved" ? "Saved hooks" : "All hooks",
                      count:
                        route.view === "saved"
                          ? hooks.filter((h) => saved.has(hookId(h))).length
                          : hooks.length,
                    },
                    {
                      value: "vanilla",
                      label: "Vanilla swap",
                      count:
                        route.view === "saved"
                          ? hooks.filter(
                              (h) =>
                                saved.has(hookId(h)) &&
                                h.properties.vanillaSwap,
                            ).length
                          : stats.vanilla,
                    },
                    {
                      value: "audits",
                      label: "With audit links",
                      count:
                        route.view === "saved"
                          ? hooks.filter(
                              (h) =>
                                saved.has(hookId(h)) &&
                                safeUrl(h.hook.auditUrl),
                            ).length
                          : stats.audits,
                    },
                  ].map((tab) => (
                    <button
                      type="button"
                      key={tab.value}
                      className={`collection ${route.collection === tab.value ? "selected" : ""}`}
                      aria-pressed={route.collection === tab.value}
                      onClick={() => update({ collection: tab.value, page: 1 })}
                    >
                      {tab.label}
                      <span>{formatNumber(tab.count)}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="button export-button"
                  onClick={download}
                  disabled={!filtered.length}
                >
                  <ArrowDownToLine size={16} />
                  Export JSON
                </button>
              </div>
              <div className="filter-row">
                <div className="search-field">
                  <label htmlFor="hook-search">Search hooks</label>
                  <div className="input-wrap">
                    <Search size={18} />
                    <input
                      id="hook-search"
                      ref={searchRef}
                      type="search"
                      name="search"
                      autoComplete="off"
                      placeholder="Name, address, or keyword…"
                      value={route.query}
                      onChange={(e) =>
                        update({ query: e.target.value, page: 1 }, true)
                      }
                    />
                    <kbd aria-hidden="true">/</kbd>
                  </div>
                </div>
                <div className="select-field">
                  <label htmlFor="chain-filter">Network</label>
                  <div className="select-wrap">
                    <Globe2 size={16} />
                    <select
                      id="chain-filter"
                      value={route.chain}
                      onChange={(e) =>
                        update({ chain: e.target.value, page: 1 })
                      }
                    >
                      <option value="all">All networks</option>
                      {route.chain !== "all" &&
                        !chains.some(([chain]) => chain === route.chain) && (
                          <option value={route.chain}>
                            {route.chain} (unknown)
                          </option>
                        )}
                      {[...chains]
                        .sort((a, b) =>
                          chainName(a[0]).localeCompare(chainName(b[0])),
                        )
                        .map(([chain, count]) => (
                          <option key={chain} value={chain}>
                            {chainName(chain)} ({formatNumber(count)})
                          </option>
                        ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </div>
                <div className="select-field">
                  <label htmlFor="property-filter">Property</label>
                  <div className="select-wrap">
                    <SlidersHorizontal size={16} />
                    <select
                      id="property-filter"
                      value={route.property}
                      onChange={(e) =>
                        update({ property: e.target.value, page: 1 })
                      }
                    >
                      <option value="all">All properties</option>
                      <option value="dynamic">Dynamic fees</option>
                      <option value="upgradeable">Upgradeable</option>
                      <option value="immutable">Not upgradeable</option>
                      <option value="custom">Custom swap data</option>
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
              <div className="results-toolbar">
                <h2
                  ref={resultsRef}
                  tabIndex={-1}
                  className="result-count"
                  aria-live="polite"
                >
                  <strong>{formatNumber(filtered.length)}</strong>{" "}
                  {filtered.length === 1 ? "hook" : "hooks"}
                  {route.chain !== "all"
                    ? ` on ${chainName(route.chain)}`
                    : " across all networks"}
                </h2>
                <div className="results-controls">
                  {hasFilters && (
                    <button
                      type="button"
                      className="text-button reset-button"
                      onClick={clearFilters}
                    >
                      Clear filters <X size={13} />
                    </button>
                  )}
                  <div className="sort-control">
                    <label htmlFor="sort-order">Sort:</label>
                    <select
                      id="sort-order"
                      value={route.sort}
                      onChange={(e) =>
                        update({ sort: e.target.value, page: 1 })
                      }
                    >
                      <option value="name">Name A–Z</option>
                      <option value="name-desc">Name Z–A</option>
                      <option value="chain">Network</option>
                      <option value="permissions">Most permissions</option>
                    </select>
                  </div>
                  <div className="view-switch" aria-label="Display style">
                    <button
                      type="button"
                      aria-label="List view"
                      aria-pressed={route.layout === "list"}
                      className={route.layout === "list" ? "selected" : ""}
                      onClick={() => update({ layout: "list" })}
                    >
                      <List size={17} />
                    </button>
                    <button
                      type="button"
                      aria-label="Grid view"
                      aria-pressed={route.layout === "grid"}
                      className={route.layout === "grid" ? "selected" : ""}
                      onClick={() => update({ layout: "grid" })}
                    >
                      <Grid2X2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
              {!filtered.length ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    {route.view === "saved" && !hasFilters ? (
                      <Bookmark size={26} />
                    ) : (
                      <Search size={26} />
                    )}
                  </span>
                  <h3>
                    {route.view === "saved" && !hasFilters
                      ? "Keep a few hooks close."
                      : "No hooks found"}
                  </h3>
                  <p>
                    {route.view === "saved" && !hasFilters
                      ? "Use the bookmark on any hook to save it here for later."
                      : `No deployments match${route.query ? ` “${route.query}”` : " these filters"}. Try another name or reset your filters.`}
                  </p>
                  <button
                    type="button"
                    className="button primary"
                    onClick={
                      route.view === "saved" && !hasFilters
                        ? () => navigate("directory")
                        : clearFilters
                    }
                  >
                    {route.view === "saved" && !hasFilters
                      ? "Explore hooks"
                      : "Clear filters"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className={`hooks-container ${route.layout}`}>
                    <div className="list-head" aria-hidden="true">
                      <span>
                        Hook <ChevronDown size={12} />
                      </span>
                      <span>Network</span>
                      <span>Permissions</span>
                      <span>Properties</span>
                      <span />
                    </div>
                    <div className="hooks-items">
                      {visible.map((hook) => (
                        <HookItem
                          key={hookId(hook)}
                          hook={hook}
                          saved={saved.has(hookId(hook))}
                          onSave={() => toggleSave(hook)}
                          onOpen={() => update({ hook: hookId(hook) })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="pagination">
                    <p>
                      Showing{" "}
                      <strong>
                        {formatNumber((page - 1) * PAGE_SIZE + 1)}–
                        {formatNumber(
                          Math.min(page * PAGE_SIZE, filtered.length),
                        )}
                      </strong>{" "}
                      of {formatNumber(filtered.length)} hooks
                    </p>
                    <div>
                      <button
                        type="button"
                        className="button page-step"
                        disabled={page === 1}
                        onClick={() => changePage(page - 1)}
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={17} />
                        <span>Previous</span>
                      </button>
                      <span className="page-count">
                        {page} <span>of</span> {pages}
                      </span>
                      <button
                        type="button"
                        className="button page-step"
                        disabled={page === pages}
                        onClick={() => changePage(page + 1)}
                        aria-label="Next page"
                      >
                        <span>Next</span>
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>Made for the curious. Built on open data.</span>
            <External
              href={
                registry
                  ? `${REPOSITORY}/tree/${registry.provenance.commit}`
                  : REPOSITORY
              }
            >
              <Github size={14} />
              Data from Uniswap/hooklist
            </External>
            <span className="independent-label">
              Independent community directory
            </span>
          </footer>
        </main>
      </div>
      <Modal
        open={route.about}
        titleId="about-title"
        onClose={() => update({ about: false })}
      >
        <AboutData provenance={registry?.provenance} />
      </Modal>
      <Modal
        open={!!route.hook && !route.about && !loading && !error}
        titleId="detail-title"
        onClose={() => update({ hook: "" })}
      >
        {selected && registry ? (
          <HookDetails
            hook={selected}
            provenance={registry.provenance}
            saved={saved.has(hookId(selected))}
            onSave={() => toggleSave(selected)}
            onCopy={copy}
            feedback={notice}
          />
        ) : (
          <div className="empty-state">
            <Search size={28} />
            <h2 id="detail-title">Hook not in this snapshot</h2>
            <p>
              This deployment link does not match the bundled registry. Check
              the address and chain, or return to the directory.
            </p>
            <button
              type="button"
              className="button"
              onClick={() => update({ hook: "" })}
            >
              <ArrowLeft size={16} />
              Back to hooks
            </button>
          </div>
        )}
      </Modal>
      <div className="sr-only" role="status">
        {!route.hook && !route.about ? notice : ""}
      </div>
      <div
        className={`toast ${notice && !route.hook && !route.about ? "visible" : ""}`}
      >
        <Check size={17} />
        <span>{notice}</span>
        {notice && (
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </>
  );
}
