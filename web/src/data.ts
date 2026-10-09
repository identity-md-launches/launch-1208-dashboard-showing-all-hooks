export const FLAG_NAMES = [
  "beforeInitialize",
  "afterInitialize",
  "beforeAddLiquidity",
  "afterAddLiquidity",
  "beforeRemoveLiquidity",
  "afterRemoveLiquidity",
  "beforeSwap",
  "afterSwap",
  "beforeDonate",
  "afterDonate",
  "beforeSwapReturnsDelta",
  "afterSwapReturnsDelta",
  "afterAddLiquidityReturnsDelta",
  "afterRemoveLiquidityReturnsDelta",
] as const;
export type Flag = (typeof FLAG_NAMES)[number];
export type Hook = {
  hook: {
    address: string;
    chain: string;
    chainId: number;
    name: string;
    description?: string;
    deployer?: string;
    verifiedSource: boolean;
    auditUrl?: string;
  };
  flags: Record<Flag, boolean>;
  properties: {
    dynamicFee: boolean;
    upgradeable: boolean;
    requiresCustomSwapData: boolean;
    vanillaSwap: boolean;
    swapAccess: "none" | "temporal" | "allowlist" | "governance" | "other";
  };
};
export type Provenance = {
  repository: string;
  commit: string;
  commitDate: string;
  retrievedAt: string;
  hookCount: number;
  vanillaSwapCount: number;
  files: Record<string, { url: string; sha256: string }>;
};
export type Registry = { hooks: Hook[]; provenance: Provenance };
export const chainNames: Record<string, string> = {
  ethereum: "Ethereum",
  unichain: "Unichain",
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  polygon: "Polygon",
  blast: "Blast",
  worldchain: "World Chain",
  avalanche: "Avalanche",
  bnb: "BNB Chain",
  celo: "Celo",
  zora: "Zora",
  ink: "Ink",
  soneium: "Soneium",
  linea: "Linea",
  monad: "Monad",
  robinhood: "Robinhood Chain",
  megaeth: "MegaETH",
  tempo: "Tempo",
  xlayer: "X Layer",
  zksync: "ZKsync",
  arc: "Arc",
};
export const chainName = (chain: string) => chainNames[chain] || chain;
export const hookId = (h: Hook) =>
  `${h.hook.chainId}:${h.hook.address.toLowerCase()}`;
export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
export const formatNumber = (value: number) => value.toLocaleString("en-US");
export const flagLabel = (flag: string) =>
  flag.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
export function safeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function validateHooks(data: unknown): Hook[] {
  if (!Array.isArray(data) || !data.length)
    throw new Error("The registry is empty or not an array.");
  const ids = new Set<string>();
  for (const item of data) {
    const h = item?.hook,
      p = item?.properties;
    if (
      !h ||
      !/^0x[0-9a-fA-F]{40}$/.test(h.address) ||
      !Number.isSafeInteger(h.chainId) ||
      h.chainId <= 0 ||
      typeof h.chain !== "string" ||
      typeof h.name !== "string" ||
      !h.name.trim() ||
      typeof h.verifiedSource !== "boolean" ||
      !p ||
      [
        "dynamicFee",
        "upgradeable",
        "requiresCustomSwapData",
        "vanillaSwap",
      ].some((k) => typeof p[k] !== "boolean") ||
      !["none", "temporal", "allowlist", "governance", "other"].includes(
        p.swapAccess,
      ) ||
      FLAG_NAMES.some((k) => typeof item.flags?.[k] !== "boolean")
    )
      throw new Error("A registry entry has an unsupported format.");
    for (const k of ["description", "deployer", "auditUrl"])
      if (h[k] !== undefined && typeof h[k] !== "string")
        throw new Error("Invalid hook metadata.");
    const id = hookId(item);
    if (ids.has(id)) throw new Error("Duplicate deployment in registry.");
    ids.add(id);
  }
  return data as Hook[];
}
export async function loadRegistry(signal: AbortSignal): Promise<Registry> {
  const base = import.meta.env.BASE_URL;
  const [hooksResponse, provenanceResponse] = await Promise.all([
    fetch(`${base}data/hooks.json`, { signal }),
    fetch(`${base}data/provenance.json`, { signal }),
  ]);
  if (!hooksResponse.ok || !provenanceResponse.ok)
    throw new Error("The local registry files could not be loaded.");
  const hooks = validateHooks(await hooksResponse.json());
  const provenance = (await provenanceResponse.json()) as Provenance;
  if (
    !/^[0-9a-f]{40}$/.test(provenance.commit) ||
    !Number.isFinite(Date.parse(provenance.commitDate)) ||
    provenance.hookCount !== hooks.length
  )
    throw new Error("The registry snapshot metadata does not match.");
  return { hooks, provenance };
}
export type Filters = {
  query: string;
  chain: string;
  collection: string;
  property: string;
  sort: string;
  savedOnly: boolean;
};
const nameCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});
export function filterHooks(
  hooks: Hook[],
  filters: Filters,
  saved: Set<string>,
): Hook[] {
  const query = filters.query.trim().toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);
  return hooks
    .filter((h) => {
      if (filters.savedOnly && !saved.has(hookId(h))) return false;
      if (filters.chain !== "all" && h.hook.chain !== filters.chain)
        return false;
      if (filters.collection === "vanilla" && !h.properties.vanillaSwap)
        return false;
      if (filters.collection === "audits" && !safeUrl(h.hook.auditUrl))
        return false;
      if (filters.property === "dynamic" && !h.properties.dynamicFee)
        return false;
      if (filters.property === "upgradeable" && !h.properties.upgradeable)
        return false;
      if (filters.property === "custom" && !h.properties.requiresCustomSwapData)
        return false;
      if (filters.property === "immutable" && h.properties.upgradeable)
        return false;
      const text =
        `${h.hook.name} ${h.hook.address} ${h.hook.description || ""} ${chainName(h.hook.chain)} ${h.hook.chainId} ${h.hook.deployer || ""}`.toLowerCase();
      return tokens.every((t) => text.includes(t));
    })
    .sort((a, b) => {
      const name = nameCollator.compare(a.hook.name, b.hook.name);
      const tie =
        a.hook.chainId - b.hook.chainId ||
        a.hook.address.localeCompare(b.hook.address);
      if (filters.sort === "name-desc") return -name || tie;
      if (filters.sort === "permissions")
        return (
          Object.values(b.flags).filter(Boolean).length -
            Object.values(a.flags).filter(Boolean).length ||
          name ||
          tie
        );
      if (filters.sort === "chain")
        return (
          chainName(a.hook.chain).localeCompare(chainName(b.hook.chain)) ||
          name ||
          tie
        );
      return name || tie;
    });
}
export function parseHash(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    query: params.get("q") || "",
    chain: params.get("chain") || "all",
    collection: ["vanilla", "audits"].includes(params.get("collection") || "")
      ? params.get("collection")!
      : "all",
    property: ["dynamic", "upgradeable", "custom", "immutable"].includes(
      params.get("property") || "",
    )
      ? params.get("property")!
      : "all",
    sort: ["name-desc", "permissions", "chain"].includes(
      params.get("sort") || "",
    )
      ? params.get("sort")!
      : "name",
    view: ["saved", "networks"].includes(params.get("view") || "")
      ? params.get("view")!
      : "directory",
    layout: params.get("layout") === "grid" ? "grid" : "list",
    page: Math.min(
      10000,
      Math.max(1, Number.parseInt(params.get("page") || "1") || 1),
    ),
    hook: params.get("hook") || "",
    about: params.get("about") === "1",
  };
}
export type Route = ReturnType<typeof parseHash>;
export function serializeRoute(route: Route): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(route)) {
    if (key === "about") {
      if (value) params.set("about", "1");
      continue;
    }
    if (
      (key === "view" && value === "directory") ||
      (key === "sort" && value === "name") ||
      (key === "layout" && value === "list") ||
      (key === "page" && value === 1) ||
      value === "all" ||
      value === ""
    )
      continue;
    params.set(key === "query" ? "q" : key, String(value));
  }
  return params.size ? `#${params}` : "#";
}
