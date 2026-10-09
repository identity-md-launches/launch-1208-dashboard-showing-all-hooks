import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/data.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const {
  validateHooks,
  filterHooks,
  hookId,
  parseHash,
  serializeRoute,
  safeUrl,
  chainName,
} = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const hooks = JSON.parse(
  readFileSync(new URL("../public/data/hooks.json", import.meta.url), "utf8"),
);
const provenance = JSON.parse(
  readFileSync(
    new URL("../public/data/provenance.json", import.meta.url),
    "utf8",
  ),
);
const chains = JSON.parse(
  readFileSync(new URL("../public/data/chains.json", import.meta.url), "utf8"),
);
const defaults = {
  query: "",
  chain: "all",
  collection: "all",
  property: "all",
  sort: "name",
  savedOnly: false,
};
const run = (filters = {}, saved = new Set()) =>
  filterHooks(hooks, { ...defaults, ...filters }, saved);

test("the complete snapshot is valid, unique and consistent with provenance and chains", () => {
  assert.equal(validateHooks(hooks).length, provenance.hookCount);
  assert.equal(new Set(hooks.map(hookId)).size, hooks.length);
  assert.equal(
    hooks.filter((h) => h.properties.vanillaSwap).length,
    provenance.vanillaSwapCount,
  );
  assert.ok(
    hooks.every((h) => chains[h.hook.chain].chainId === h.hook.chainId),
  );
  assert.ok(hooks.every((h) => chainName(h.hook.chain) !== h.hook.chain));
});
test("filters compose and never return an entry outside the requested set", () => {
  for (const chain of Object.keys(chains)) {
    for (const collection of ["all", "vanilla", "audits"]) {
      for (const property of [
        "all",
        "dynamic",
        "custom",
        "upgradeable",
        "immutable",
      ]) {
        const results = run({ chain, collection, property });
        assert.ok(results.every((h) => h.hook.chain === chain));
        if (collection === "vanilla")
          assert.ok(results.every((h) => h.properties.vanillaSwap));
        if (collection === "audits")
          assert.ok(results.every((h) => safeUrl(h.hook.auditUrl)));
        if (property === "dynamic")
          assert.ok(results.every((h) => h.properties.dynamicFee));
        if (property === "custom")
          assert.ok(results.every((h) => h.properties.requiresCustomSwapData));
        if (property === "upgradeable")
          assert.ok(results.every((h) => h.properties.upgradeable));
        if (property === "immutable")
          assert.ok(results.every((h) => !h.properties.upgradeable));
      }
    }
  }
});
test("search supports complete addresses, names, descriptions, chain IDs and multiple terms", () => {
  const entry = hooks.find((h) => h.hook.name === "Angstrom");
  assert.ok(entry);
  assert.ok(
    run({ query: entry.hook.address.toUpperCase() }).some(
      (h) => hookId(h) === hookId(entry),
    ),
  );
  assert.ok(
    run({
      query: `  ${entry.hook.name}   ${chainName(entry.hook.chain)} `,
    }).some((h) => hookId(h) === hookId(entry)),
  );
  assert.ok(
    run({ query: String(entry.hook.chainId) }).some(
      (h) => hookId(h) === hookId(entry),
    ),
  );
  assert.equal(run({ query: "definitely-no-hook-with-this-phrase" }).length, 0);
  assert.equal(run({ query: "   " }).length, hooks.length);
});
test("all sort modes are deterministic and preserve the complete result set", () => {
  const ids = new Set(hooks.map(hookId));
  for (const sort of ["name", "name-desc", "permissions", "chain"]) {
    const result = run({ sort });
    assert.deepEqual(new Set(result.map(hookId)), ids);
    assert.deepEqual(result, run({ sort }));
  }
  const ascending = run().map((h) => h.hook.name.toLowerCase());
  const descending = run({ sort: "name-desc" }).map((h) =>
    h.hook.name.toLowerCase(),
  );
  assert.deepEqual(ascending, descending.reverse());
});
test("saved deployments are identified by both address and chain", () => {
  const selected = hooks[17];
  const saved = new Set([hookId(selected)]);
  assert.deepEqual(run({ savedOnly: true }, saved).map(hookId), [
    hookId(selected),
  ]);
  assert.equal(run({ savedOnly: true }, new Set()).length, 0);
  assert.equal(run({ savedOnly: true, chain: "nonexistent" }, saved).length, 0);
});
test("hash state round-trips including special characters and rejects unsupported options", () => {
  const state = {
    ...parseHash(""),
    query: "hook & fee / Δ",
    chain: "base",
    collection: "vanilla",
    property: "dynamic",
    sort: "permissions",
    view: "saved",
    layout: "grid",
    page: 3,
    hook: hookId(hooks[0]),
    about: true,
  };
  assert.deepEqual(parseHash(serializeRoute(state)), state);
  const bad = parseHash(
    "#sort=bad&collection=allowlisted&property=bad&view=bad&page=-9",
  );
  assert.equal(bad.sort, "name");
  assert.equal(bad.collection, "all");
  assert.equal(bad.property, "all");
  assert.equal(bad.view, "directory");
  assert.equal(bad.page, 1);
});
test("unsafe links and malformed records are rejected without guessing missing values", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,x",
    "http://example.com",
    "//example.com",
    "https://user:pass@example.com",
    "",
  ])
    assert.equal(safeUrl(url), undefined);
  assert.equal(
    safeUrl("https://example.com/audit.pdf"),
    "https://example.com/audit.pdf",
  );
  for (const value of [null, {}, [], [{ hook: {} }], [...hooks, hooks[0]]])
    assert.throws(() => validateHooks(value));
  const damaged = structuredClone(hooks[0]);
  delete damaged.flags.beforeSwap;
  assert.throws(() => validateHooks([damaged]));
});
