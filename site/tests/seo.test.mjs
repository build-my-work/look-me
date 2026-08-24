import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const dist = new URL("../dist/", import.meta.url);
const distPath = dist.pathname;
const requiredPages = [
  "/",
  "/zh-cn/",
  "/20-20-20-rule/",
  "/digital-eye-strain/",
  "/dry-eyes-from-screen/",
  "/blink-reminder/",
  "/eye-break-reminder/",
  "/mac-eye-break-reminder/",
  "/windows-eye-break-reminder/",
  "/linux-eye-break-reminder/",
  "/how-it-works/",
  "/privacy/",
  "/download/",
  "/tools/20-20-20-timer/",
];

function pageFile(path) {
  return path === "/" ? join(distPath, "index.html") : join(distPath, path.slice(1), "index.html");
}

function readPage(path) {
  return readFileSync(pageFile(path), "utf8");
}

function internalTarget(href) {
  const path = href.split(/[?#]/, 1)[0];
  if (path === "/") return join(distPath, "index.html");
  if (path.endsWith("/")) return join(distPath, path.slice(1), "index.html");
  return join(distPath, path.slice(1));
}

test("build contains every intentional landing page", () => {
  for (const path of requiredPages) {
    assert.ok(existsSync(pageFile(path)), `missing built page: ${path}`);
  }
});

test("every indexable page has unique metadata and one h1", () => {
  const titles = new Set();
  for (const path of requiredPages) {
    const html = readPage(path);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(title, `missing title: ${path}`);
    const minimumDescriptionLength = path === "/zh-cn/" ? 45 : 70;
    assert.ok(description && description.length >= minimumDescriptionLength && description.length <= 180, `description length is out of range: ${path}`);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `expected exactly one h1: ${path}`);
    assert.match(html, /<link rel="canonical" href="https:\/\/lookme\.anme\.cc\//, `missing canonical: ${path}`);
    assert.match(html, /<meta property="og:title"/, `missing Open Graph title: ${path}`);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"/, `missing Twitter card: ${path}`);
    assert.doesNotMatch(html, /<meta name="robots" content="noindex/, `indexable page is noindex: ${path}`);
    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    titles.add(title);
  }
});

test("structured data blocks contain valid JSON", () => {
  for (const path of requiredPages) {
    const html = readPage(path);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length > 0, `missing structured data: ${path}`);
    for (const block of blocks) assert.doesNotThrow(() => JSON.parse(block[1]), `invalid JSON-LD: ${path}`);
  }
});

test("internal root-relative links resolve in the production build", () => {
  for (const path of requiredPages) {
    const html = readPage(path);
    const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1]);
    for (const href of hrefs) {
      assert.ok(existsSync(internalTarget(href)), `broken internal link from ${path}: ${href}`);
    }
  }
});

test("home language alternates are reciprocal and explicit", () => {
  const english = readPage("/");
  const chinese = readPage("/zh-cn/");
  for (const html of [english, chinese]) {
    assert.match(html, /hreflang="en" href="https:\/\/lookme\.anme\.cc\/"/);
    assert.match(html, /hreflang="zh-Hans" href="https:\/\/lookme\.anme\.cc\/zh-cn\/"/);
    assert.match(html, /hreflang="x-default" href="https:\/\/lookme\.anme\.cc\/"/);
  }
  assert.match(english, /<html lang="en">/);
  assert.match(chinese, /<html lang="zh-CN">/);
});

test("sitemap and robots output agree", () => {
  const sitemapFiles = readdirSync(distPath).filter((name) => name.startsWith("sitemap") && name.endsWith(".xml"));
  assert.ok(sitemapFiles.includes("sitemap-index.xml"), "missing sitemap index");
  const robots = readFileSync(join(distPath, "robots.txt"), "utf8");
  assert.match(robots, /Sitemap: https:\/\/lookme\.anme\.cc\/sitemap-index\.xml/);
});

test("public copy stays inside the non-medical product boundary", () => {
  const forbiddenClaims = [
    /dry eye treatment app/i,
    /prevents? dry eye/i,
    /cures? dry eye/i,
    /干眼症的福音/,
    /赶在伤害累积之前/,
    /长年累月[，,]?便是干眼/,
  ];
  for (const path of requiredPages) {
    const html = readPage(path);
    for (const claim of forbiddenClaims) assert.doesNotMatch(html, claim, `unsupported medical claim on ${path}`);
  }
});

test("the free timer exposes accessible controls and privacy copy", () => {
  const html = readPage("/tools/20-20-20-timer/");
  assert.match(html, /data-timer-start/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /does not use your camera/i);
  assert.match(html, /session storage/i);
});
