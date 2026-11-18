import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const publicFile = (name) => new URL(`../public/${name}`, import.meta.url);

test("the web app manifest is valid and its icon ships with the build", () => {
  const manifest = JSON.parse(readFileSync(publicFile("manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.name && manifest.short_name && manifest.start_url);
  for (const icon of manifest.icons) assert.ok(existsSync(publicFile(icon.src)), `missing icon ${icon.src}`);
});

test("the service worker only handles same-origin GET requests", () => {
  const worker = readFileSync(publicFile("sw.js"), "utf8");
  assert.match(worker, /request\.method !== "GET"/);
  assert.match(worker, /self\.location\.origin/);
});
