// Updates all data from one immutable commit; never mixes revisions.
import { createHash } from "node:crypto";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateHooks, hookId } from "../src/data.ts";

const base = "https://api.github.com/repos/Uniswap/hooklist";
const revision = process.argv[2] || "main";
if (!/^(main|[a-f0-9]{40})$/.test(revision))
  throw new Error("Use main or a full 40-character commit SHA.");
async function fetchBytes(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { "User-Agent": "hookbook-snapshot" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
    }
  }
}
const commit = JSON.parse(await fetchBytes(`${base}/commits/${revision}`));
if (!/^[a-f0-9]{40}$/.test(commit.sha))
  throw new Error("GitHub returned an invalid commit.");
const names = [
  "hooklist.json",
  "hooklist-vanilla-swap.json",
  "chains.json",
  "schema.json",
];
const source = await Promise.all(
  names.map(async (name) => {
    const url = `https://raw.githubusercontent.com/Uniswap/hooklist/${commit.sha}/${name}`;
    const bytes = await fetchBytes(url);
    return {
      name,
      url,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      data: JSON.parse(bytes),
    };
  }),
);
const hooks = validateHooks(source[0].data);
const vanilla = validateHooks(source[1].data);
const expected = new Set(
  hooks.filter((h) => h.properties.vanillaSwap).map(hookId),
);
if (
  expected.size !== vanilla.length ||
  vanilla.some((h) => !expected.has(hookId(h)))
)
  throw new Error("The vanilla-swap file does not match the main registry.");
const chains = source[2].data;
if (hooks.some((h) => chains[h.hook.chain]?.chainId !== h.hook.chainId))
  throw new Error("Chain metadata does not match deployments.");
const provenance = {
  repository: "https://github.com/Uniswap/hooklist",
  commit: commit.sha,
  commitDate: commit.commit.committer.date,
  retrievedAt: new Date().toISOString(),
  files: Object.fromEntries(
    source.map(({ name, url, sha256 }) => [name, { url, sha256 }]),
  ),
  vanillaSwapCount: vanilla.length,
  hookCount: hooks.length,
};
const dataDir = new URL("../public/data/", import.meta.url);
await mkdir(dataDir, { recursive: true });
for (const [name, data] of [
  ["hooks.json", hooks],
  ["chains.json", chains],
  ["provenance.json", provenance],
]) {
  const destination = new URL(name, dataDir);
  const temporary = `${fileURLToPath(destination)}.tmp`;
  await writeFile(
    temporary,
    JSON.stringify(data, null, name === "provenance.json" ? 2 : 0) + "\n",
  );
  await rename(temporary, destination);
}
await writeFile(
  new URL("../../docs/upstream-schema.json", import.meta.url),
  JSON.stringify(source[3].data, null, 2) + "\n",
);
console.log(
  `Saved ${hooks.length} deployments (${vanilla.length} vanilla swap) at ${commit.sha}. Rebuild to publish this snapshot.`,
);
