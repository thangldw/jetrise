import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const built = readFileSync(new URL("../dist/client/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the production page carries a restrictive Content-Security-Policy meta tag", () => {
  const meta = built.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(meta, "built index.html must include the CSP meta tag");
  const policy = meta[1];
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /script-src 'self'(;|$)/);
  assert.match(policy, /object-src 'none'/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
  assert.ok(built.indexOf("Content-Security-Policy") < built.indexOf("<script"), "the policy must precede every script");
});

test("the source page stays free of the meta tag so the dev server keeps working", () => {
  assert.doesNotMatch(source, /Content-Security-Policy/);
});
