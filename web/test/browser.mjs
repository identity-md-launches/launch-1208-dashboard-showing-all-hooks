// Bounded foreground validation: this process owns and closes the static server and browser.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const exportRoot = resolve(
  process.env.HOOKBOOK_EXPORT ||
    fileURLToPath(new URL("../../dist", import.meta.url)),
);
const evidenceRoot = resolve(
  process.env.HOOKBOOK_EVIDENCE ||
    fileURLToPath(new URL("../../artifacts", import.meta.url)),
);
await mkdir(evidenceRoot, { recursive: true });
const hooks = JSON.parse(
  await readFile(resolve(exportRoot, "data/hooks.json"), "utf8"),
);
const provenance = JSON.parse(
  await readFile(resolve(exportRoot, "data/provenance.json"), "utf8"),
);
const checks = [],
  consoleErrors = [],
  resourceFailures = [],
  expectedConsoleErrors = [];
const report = {
  browser: "",
  exportRoot,
  sourceCommit: provenance.commit,
  checks,
  consoleErrors,
  expectedConsoleErrors,
  resourceFailures,
  viewports: [],
  accessibility: [],
  contrast: [],
  limitations: [
    "No physical-device or screen-reader session.",
    "Native browser zoom and non-Chromium engines are not tested; 320px reflow and 200% text enlargement are tested.",
    "External source/audit links are checked for destinations, not audited for content.",
  ],
};
let failData = false;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!path.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(
      exportRoot,
      decodeURIComponent(path.slice("/preview/".length)) || "index.html",
    );
    if (!file.startsWith(exportRoot + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (failData && path.endsWith("/data/hooks.json")) {
      res.writeHead(503).end("Simulated temporary data failure");
      return;
    }
    const bytes = await readFile(file);
    const mime = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".woff2": "font/woff2",
    };
    res
      .writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      })
      .end(bytes);
  } catch {
    res.writeHead(404).end("Missing asset");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
let browser;
const check = async (name, run) => {
  await run();
  checks.push({ name, result: "passed" });
  console.log(`PASS ${name}`);
};
const screenshot = (page, name, fullPage = false) =>
  page.screenshot({
    path: resolve(evidenceRoot, `${name}.jpg`),
    type: "jpeg",
    quality: 82,
    fullPage,
  });
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: "/tmp/hookbook-browser-config",
      XDG_CACHE_HOME: "/tmp/hookbook-browser-cache",
    },
    args: process.env.CHROMIUM_EXECUTABLE ? ["--no-sandbox"] : [],
  });
  report.browser = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      (failData ? expectedConsoleErrors : consoleErrors).push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (!request.failure()?.errorText.includes("ERR_ABORTED"))
      resourceFailures.push(`${request.url()} ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !failData)
      resourceFailures.push(`${response.status()} ${response.url()}`);
  });
  const countIs = async (count) =>
    page.waitForFunction(
      (expected) =>
        document.querySelector(".result-count strong")?.textContent ===
        expected.toLocaleString("en-US"),
      count,
    );
  const goHome = async () => {
    await page.goto(url);
    await countIs(hooks.length);
  };
  const axe = async (name) => {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const results = await page.evaluate(async () =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
        },
      }),
    );
    report.accessibility.push({
      state: name,
      violations: results.violations.map(
        ({ id, impact, nodes, description }) => ({
          id,
          impact,
          description,
          targets: nodes.map((n) => n.target),
        }),
      ),
      passes: results.passes.length,
      incomplete: results.incomplete.map((r) => r.id),
    });
    assert.equal(
      results.violations.length,
      0,
      `${name}: ${JSON.stringify(report.accessibility.at(-1).violations)}`,
    );
  };

  await check(
    "Full snapshot loads from the production export at /preview/",
    async () => {
      await goHome();
      assert.equal(await page.locator(".hook-item").count(), 12);
      assert.equal(
        await page.locator(".stat strong").first().textContent(),
        hooks.length.toLocaleString("en-US"),
      );
      assert.ok(
        await page.evaluate(() => document.fonts.check('14px "DM Sans"')),
      );
      const externalLoads = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((r) => r.name)
          .filter((name) => !name.startsWith(location.origin)),
      );
      assert.deepEqual(externalLoads, []);
    },
  );
  await check("Desktop accessibility scan", () => axe("desktop directory"));
  await screenshot(page, "desktop");
  await check(
    "Keyboard skip link, search shortcut and visible focus",
    async () => {
      await page.reload();
      await countIs(hooks.length);
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement.className),
        "skip-link",
      );
      await page.keyboard.press("Enter");
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "main",
      );
      await page.keyboard.press("/");
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "hook-search",
      );
      const ring = await page
        .locator("#hook-search")
        .evaluate((el) => ({
          style: getComputedStyle(el).outlineStyle,
          width: getComputedStyle(el).outlineWidth,
        }));
      assert.deepEqual(ring, { style: "solid", width: "2px" });
      await screenshot(page, "keyboard-focus");
    },
  );
  await check("Network, property and collection filters compose", async () => {
    await page.getByLabel("Network", { exact: true }).selectOption("base");
    await countIs(hooks.filter((h) => h.hook.chain === "base").length);
    assert.ok(
      (await page.locator(".hook-network").allTextContents()).every((text) =>
        text.includes("Base"),
      ),
    );
    await page.getByLabel("Property", { exact: true }).selectOption("dynamic");
    await page.getByRole("button", { name: /^Vanilla swap / }).click();
    const expected = hooks.filter(
      (h) =>
        h.hook.chain === "base" &&
        h.properties.dynamicFee &&
        h.properties.vanillaSwap,
    ).length;
    await countIs(expected);
    await page.reload();
    await countIs(expected);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .first()
      .click();
    await countIs(hooks.length);
  });
  await check("Browser history restores filter state", async () => {
    await page.getByLabel("Network", { exact: true }).selectOption("base");
    await countIs(hooks.filter((h) => h.hook.chain === "base").length);
    await page.getByLabel("Network", { exact: true }).selectOption("ethereum");
    await countIs(hooks.filter((h) => h.hook.chain === "ethereum").length);
    await page.goBack();
    await countIs(hooks.filter((h) => h.hook.chain === "base").length);
    await page.goForward();
    await countIs(hooks.filter((h) => h.hook.chain === "ethereum").length);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .first()
      .click();
    await countIs(hooks.length);
  });
  await check(
    "Case-insensitive search, no-results recovery and exact address lookup",
    async () => {
      await page.getByLabel("Search hooks").fill("angstrom");
      await countIs(
        hooks.filter((h) =>
          `${h.hook.name} ${h.hook.description || ""}`
            .toLowerCase()
            .includes("angstrom"),
        ).length,
      );
      await page
        .getByLabel("Search hooks")
        .fill("nothing-matches-this-query-987");
      await countIs(0);
      assert.ok(
        await page.getByRole("heading", { name: "No hooks found" }).isVisible(),
      );
      assert.ok(
        await page.getByRole("button", { name: "Export JSON" }).isDisabled(),
      );
      await screenshot(page, "empty-state");
      await page
        .locator(".empty-state")
        .getByRole("button", { name: "Clear filters" })
        .click();
      await countIs(hooks.length);
      const sample = hooks.find((h) => h.hook.name === "Angstrom");
      await page
        .getByLabel("Search hooks")
        .fill(sample.hook.address.toUpperCase());
      assert.ok(
        (await page.locator(".hook-title").allTextContents()).includes(
          sample.hook.name,
        ),
      );
      await page
        .getByRole("button", { name: "Clear filters", exact: true })
        .first()
        .click();
      await countIs(hooks.length);
    },
  );
  await check("Sorting, pagination and grid view", async () => {
    const first = await page.locator(".hook-title").first().textContent();
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await page.waitForFunction(() => location.hash.includes("page=2"));
    assert.notEqual(
      await page.locator(".hook-title").first().textContent(),
      first,
    );
    assert.ok(
      (await page.locator(".pagination p").textContent()).includes("13–24"),
    );
    await page
      .getByRole("button", { name: "Previous page", exact: true })
      .click();
    assert.equal(
      await page.locator(".hook-title").first().textContent(),
      first,
    );
    await page.getByLabel("Sort:", { exact: true }).selectOption("name-desc");
    assert.notEqual(
      await page.locator(".hook-title").first().textContent(),
      first,
    );
    await page.getByLabel("Sort:", { exact: true }).selectOption("permissions");
    const most = Math.max(
      ...hooks.map((h) => Object.values(h.flags).filter(Boolean).length),
    );
    await page.locator(".hook-title").first().click();
    assert.equal(
      await page.locator("dialog[open] .permission-grid li.enabled").count(),
      most,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^With audit links / }).click();
    await page.getByLabel("Sort:", { exact: true }).selectOption("name");
    await page.getByRole("button", { name: "Grid view", exact: true }).click();
    assert.ok(await page.locator(".hooks-container.grid").isVisible());
    await screenshot(page, "grid");
    await axe("audit-link grid");
  });
  await check(
    "Export downloads all filtered results and provenance",
    async () => {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export JSON" }).click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const data = JSON.parse(Buffer.concat(chunks));
      assert.equal(
        data.hooks.length,
        hooks.filter((h) => !!h.hook.auditUrl).length,
      );
      assert.equal(data.source.commit, provenance.commit);
      assert.ok(data.hooks.every((h) => h.hook.auditUrl));
      await download.delete();
    },
  );
  await check(
    "Bookmarks persist and saved hooks have an actionable empty state",
    async () => {
      await goHome();
      const name = await page.locator(".hook-title").first().textContent();
      await page.locator(".save-button").first().click();
      await page.reload();
      await countIs(hooks.length);
      assert.equal(
        await page.locator(".save-button").first().getAttribute("aria-pressed"),
        "true",
      );
      await page.getByRole("link", { name: /^Saved hooks/ }).click();
      await countIs(1);
      assert.equal(await page.locator(".hook-title").textContent(), name);
      await page.locator(".save-button").click();
      await countIs(0);
      assert.ok(
        await page
          .getByRole("heading", { name: "Keep a few hooks close." })
          .isVisible(),
      );
      await page
        .getByRole("button", { name: "Explore hooks", exact: true })
        .click();
      await countIs(hooks.length);
    },
  );
  await check(
    "Details, clipboard, share links, dialog focus and source links",
    async () => {
      const opener = page.locator(".hook-title").first();
      await opener.focus();
      await page.keyboard.press("Enter");
      const dialog = page.locator("dialog[open]");
      await dialog.waitFor();
      assert.equal(await dialog.locator(".permission-grid li").count(), 14);
      assert.equal(
        await page.evaluate(() =>
          document.activeElement.getAttribute("aria-label"),
        ),
        "Close details",
      );
      await page.keyboard.press("Shift+Tab");
      assert.ok(
        await page.evaluate(
          () => !!document.activeElement.closest("dialog[open]"),
        ),
      );
      await page.keyboard.press("Tab");
      assert.ok(
        await page.evaluate(
          () => !!document.activeElement.closest("dialog[open]"),
        ),
      );
      const address = await dialog.locator(".address-panel code").textContent();
      await dialog
        .getByRole("button", { name: "Copy contract address", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        address,
      );
      assert.ok(
        await dialog
          .getByText("Copied to clipboard.", { exact: true })
          .isVisible(),
      );
      const href = await dialog
        .getByRole("link", { name: /^View source entry/ })
        .getAttribute("href");
      assert.ok(
        href.startsWith(
          `https://github.com/Uniswap/hooklist/blob/${provenance.commit}/hooks/`,
        ),
      );
      const link = page.url();
      await axe("hook detail dialog");
      await screenshot(page, "detail");
      await page.keyboard.press("Escape");
      assert.equal(
        await page.evaluate(() => document.activeElement.className),
        "hook-title",
      );
      await page.goto(link);
      await dialog.waitFor();
      assert.equal(
        await dialog.locator(".address-panel code").textContent(),
        address,
      );
      await page.keyboard.press("Escape");
    },
  );
  await check("Network overview and source explanation", async () => {
    await page.getByRole("link", { name: "Networks", exact: true }).click();
    await page.locator(".network-card").first().waitFor();
    assert.equal(
      await page.locator(".network-card").count(),
      new Set(hooks.map((h) => h.hook.chain)).size,
    );
    await page
      .locator(".network-card")
      .filter({
        has: page.locator(".network-card-name", { hasText: /^Base$/ }),
      })
      .click();
    await countIs(hooks.filter((h) => h.hook.chain === "base").length);
    await page
      .locator(".registry-note")
      .getByRole("button", { name: "About the data" })
      .click();
    assert.ok(
      await page
        .getByRole("heading", { name: "Routing approval is not reported" })
        .isVisible(),
    );
    await axe("about the data dialog");
    await page.keyboard.press("Escape");
  });
  await check(
    "Responsive reflow with long real names at 320, 390, 680, 850, 1024 and 1440 pixels",
    async () => {
      await goHome();
      for (const width of [320, 390, 680, 850, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 680 ? 844 : 1000 });
        const measured = await page.evaluate(() => ({
          width: innerWidth,
          pageWidth: document.documentElement.scrollWidth,
          mainWidth: document.querySelector("main").scrollWidth,
        }));
        report.viewports.push(measured);
        assert.ok(
          measured.pageWidth <= width,
          `Overflow at ${width}: ${measured.pageWidth}`,
        );
        await page.evaluate(() => window.scrollTo(0, 0));
        if (width === 320 || width === 390 || width === 850)
          await screenshot(page, width === 390 ? "mobile" : `width-${width}`);
        if (width === 320) {
          await axe("320px directory");
          await page.locator(".hook-title").first().click();
          await axe("320px detail");
          await screenshot(page, "mobile-detail");
          assert.ok(
            await page.evaluate(
              () =>
                document.querySelector("dialog[open]").scrollWidth <=
                document.querySelector("dialog[open]").clientWidth + 2,
            ),
          );
          await page.keyboard.press("Escape");
        }
        if (width === 390) {
          await page.locator(".filter-row").scrollIntoViewIfNeeded();
          await page.evaluate(() =>
            window.scrollTo(
              0,
              document.querySelector(".filter-row").getBoundingClientRect()
                .top +
                scrollY -
                20,
            ),
          );
          await screenshot(page, "mobile-results");
        }
      }
    },
  );
  await check(
    "Text enlargement, reduced motion and forced-color focus",
    async () => {
      await page.evaluate(
        () => (document.documentElement.style.fontSize = "200%"),
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.ok(await page.locator(".sidebar").evaluate(el => el.scrollWidth <= el.clientWidth), "Enlarged navigation must not clip inside the sidebar");
    await screenshot(page, "text-enlargement");
      await page.evaluate(() => (document.documentElement.style.fontSize = ""));
      const motion = await page
        .locator(".export-button")
        .evaluate((el) => getComputedStyle(el).transitionDuration);
      assert.equal(motion, "0s");
      await page.emulateMedia({ forcedColors: "active" });
      await page.getByLabel("Search hooks").focus();
      assert.equal(
        await page
          .getByLabel("Search hooks")
          .evaluate((el) => getComputedStyle(el).outlineStyle),
        "solid",
      );
      await screenshot(page, "forced-colors");
      await page.emulateMedia({ forcedColors: "none" });
    },
  );
  await check("Measured rendered contrast pairs", async () => {
    report.contrast = await page.evaluate(() => {
      const parse = (value) => value.match(/[\d.]+/g).map(Number);
      const luminance = (rgb) =>
        rgb
          .slice(0, 3)
          .map((c) => {
            c /= 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
      return [
        "h1",
        ".hero-copy>p",
        ".stat-label",
        ".stat>span",
        ".registry-note>p",
        ".registry-note>button",
        ".collection.selected",
        ".permission-badge",
        ".badge-purple",
        ".badge-neutral",
        ".hook-copy>p",
        ".hook-title",
        ".result-count",
        ".page-footer",
      ]
        .map((selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const style = getComputedStyle(el);
          let parent = el,
            background;
          while (parent) {
            const candidate = getComputedStyle(parent).backgroundColor;
            if (parse(candidate)[3] !== 0) {
              background = candidate;
              break;
            }
            parent = parent.parentElement;
          }
          background ||= "rgb(255,255,255)";
          const light = [
            luminance(parse(style.color)),
            luminance(parse(background)),
          ].sort((a, b) => b - a);
          return {
            selector,
            foreground: style.color,
            background,
            ratio: Number(((light[0] + 0.05) / (light[1] + 0.05)).toFixed(2)),
          };
        })
        .filter(Boolean);
    });
    assert.ok(
      report.contrast.every((pair) => pair.ratio >= 4.5),
      JSON.stringify(report.contrast),
    );
  });
  await check(
    "Unknown deployment links recover without a broken screen",
    async () => {
      await page.goto(`${url}#hook=invalid`);
      await page
        .getByRole("heading", { name: "Hook not in this snapshot" })
        .waitFor();
      await page.getByRole("button", { name: "Back to hooks" }).click();
      await countIs(hooks.length);
    },
  );
  await check(
    "Normal browsing has no console errors or failed resources",
    async () => {
      assert.deepEqual(consoleErrors, []);
      assert.deepEqual(resourceFailures, []);
    },
  );
  await check(
    "Data loading failure shows recovery and retry works",
    async () => {
      failData = true;
      await page.reload();
      await page
        .getByRole("heading", { name: "Couldn’t load the registry" })
        .waitFor();
      assert.ok(await page.locator(".snapshot-label").getByText("Snapshot unavailable", { exact: true }).isVisible());
      await screenshot(page, "load-error");
      failData = false;
      await page.getByRole("button", { name: "Try again" }).click();
      await countIs(hooks.length);
      report.expectedFailure =
        "One intentionally injected HTTP 503 for hooks.json; retry loaded all entries.";
    },
  );
  report.result = "passed";
} catch (error) {
  report.result = "failed";
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(
    resolve(evidenceRoot, "browser-results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
