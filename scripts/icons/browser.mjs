import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(root, "docs/universal-icons/evidence");
await fs.mkdir(output, { recursive: true });
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "meldiq-icons-"));
const bundled = await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{Icon,ICON_NAMES}from'./src/ui/icons/Icon';createRoot(document.getElementById('icons')).render(React.createElement(React.Fragment,null,...ICON_NAMES.map(name=>React.createElement('article',{key:name},React.createElement('label',null,name),...[16,18,20,24,32].map(size=>React.createElement(Icon,{name,size,key:size}))))));`,
    resolveDir: root,
    loader: "tsx",
  },
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  define: { "process.env.NODE_ENV": '"production"' },
});
const code = bundled.outputFiles[0].text;
const iconOnly = await build({ entryPoints: [path.join(root, "src/ui/icons/Icon.tsx")], bundle: true, write: false, minify: true, format: "esm", external: ["react"] });
const catalogue = JSON.parse(await fs.readFile(path.join(root, "shared/icons/catalogue.json"), "utf8"));
const sources = Object.fromEntries(await Promise.all(catalogue.icons.map(async (i) => [i.id, await fs.readFile(path.join(root, "shared/icons", i.svg), "utf8")])));
const results = [];
for (const [browserName, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await engine.launch();
  try {
    for (const width of [390, 1440])
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({ viewport: { width, height: 1100 }, offline: true, colorScheme: theme });
        const page = await context.newPage();
        const requests = [];
        const errors = [];
        page.on("request", (r) => requests.push(r.url()));
        page.on("pageerror", (e) => errors.push(e.message));
        await page.setContent(
          `<style>body{margin:24px;font:13px system-ui;background:${theme === "dark" ? "#17191e" : "#fafafa"};color:${theme === "dark" ? "#eee" : "#222"}}h1{font-size:24px}#icons{display:grid;grid-template-columns:repeat(auto-fit,minmax(265px,1fr));gap:14px}article{display:flex;align-items:center;gap:10px;border:1px solid #8885;border-radius:12px;padding:14px;min-height:48px}label{display:block;width:100%;font-size:11px}article{flex-wrap:wrap}</style><h1>Meldiq universal icons</h1><p>${browserName} · ${width}px · ${theme} · offline</p><div id=icons></div><script>${code}</script>`,
        );
        await page.locator("svg").last().waitFor();
        assert.equal(await page.locator("svg").count(), catalogue.icons.length * 5);
        await page.evaluate(
          ({ sources }) => {
            for (const svg of document.querySelectorAll("svg")) {
              const source = new DOMParser().parseFromString(sources[svg.dataset.icon], "image/svg+xml").documentElement;
              if (svg.children.length !== source.children.length) throw Error("Missing geometry");
              [...svg.children].forEach((child, index) => {
                const original = source.children[index];
                if (child.tagName !== original.tagName) throw Error("Wrong primitive");
                for (const attribute of original.attributes) if (child.getAttribute(attribute.name) !== attribute.value) throw Error("Geometry mismatch " + svg.dataset.icon);
              });
              const rect = svg.getBoundingClientRect();
              if (rect.width !== Number(svg.getAttribute("width")) || rect.height !== rect.width) throw Error("Incorrect optical bounds");
              if (getComputedStyle(svg).stroke === "none") throw Error("Invisible stroke");
            }
            if (document.documentElement.scrollWidth > innerWidth) throw Error("Horizontal overflow");
          },
          { sources },
        );
        assert.deepEqual(requests, []);
        assert.deepEqual(errors, []);
        const screenshot = `${browserName}-${width}-${theme}.png`;
        await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
        results.push({ browser: browserName, width, theme, icons: catalogue.icons.length, sizes: 5, offline: true, networkRequests: 0, pageErrors: 0, geometryMatchesSource: true, screenshot });
        await context.close();
      }
  } finally {
    await browser.close();
  }
}
const result = {
  status: "passed",
  testedAt: new Date().toISOString(),
  results,
  adapterBytes: iconOnly.outputFiles[0].contents.length,
  adapterGzipBytes: gzipSync(iconOnly.outputFiles[0].contents).length,
  dependenciesAdded: 0,
};
await fs.writeFile(path.join(output, "offline-browser.json"), JSON.stringify(result, null, 2) + "\n");
await fs.rm(tmp, { recursive: true, force: true });
console.log(JSON.stringify(result));
