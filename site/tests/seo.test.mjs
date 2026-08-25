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
  "/zh-cn/blink-reminder/",
  "/zh-cn/20-20-20-rule/",
  "/zh-cn/digital-eye-strain/",
  "/zh-cn/dry-eyes-from-screen/",
  "/zh-cn/how-it-works/",
  "/zh-cn/privacy/",
  "/zh-cn/download/",
  "/zh-cn/tools/20-20-20-timer/",
];

const localizedPairs = [
  ["/", "/zh-cn/"],
  ["/blink-reminder/", "/zh-cn/blink-reminder/"],
  ["/20-20-20-rule/", "/zh-cn/20-20-20-rule/"],
  ["/digital-eye-strain/", "/zh-cn/digital-eye-strain/"],
  ["/dry-eyes-from-screen/", "/zh-cn/dry-eyes-from-screen/"],
  ["/how-it-works/", "/zh-cn/how-it-works/"],
  ["/privacy/", "/zh-cn/privacy/"],
  ["/download/", "/zh-cn/download/"],
  ["/tools/20-20-20-timer/", "/zh-cn/tools/20-20-20-timer/"],
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
    const minimumDescriptionLength = path.startsWith("/zh-cn/") ? 45 : 70;
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

test("localized pages have reciprocal language alternates", () => {
  for (const [englishPath, chinesePath] of localizedPairs) {
    const english = readPage(englishPath);
    const chinese = readPage(chinesePath);
    const escapedEnglish = `https://lookme.anme.cc${englishPath}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedChinese = `https://lookme.anme.cc${chinesePath}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const html of [english, chinese]) {
      assert.match(html, new RegExp(`hreflang="en" href="${escapedEnglish}"`));
      assert.match(html, new RegExp(`hreflang="zh-Hans" href="${escapedChinese}"`));
      assert.match(html, new RegExp(`hreflang="x-default" href="${escapedEnglish}"`));
    }
    assert.match(english, /<html lang="en">/);
    assert.match(chinese, /<html lang="zh-CN">/);
  }
});

test("home pages lead with blink detection and long-gap reminders", () => {
  const english = readPage("/");
  const chinese = readPage("/zh-cn/");
  const englishText = english.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const chineseText = chinese.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(english, /<title>[^<]*Blink Reminder[^<]*<\/title>/);
  assert.match(englishText, /Lumi notices long gaps between blinks/i);
  assert.match(chinese, /<title>[^<]*眨眼提醒[^<]*<\/title>/);
  assert.match(chineseText, /长时间没眨眼时， Lumi 会提醒你/);
});

test("sitemap and robots output agree", () => {
  const sitemapFiles = readdirSync(distPath).filter((name) => name.startsWith("sitemap") && name.endsWith(".xml"));
  assert.ok(sitemapFiles.includes("sitemap-index.xml"), "missing sitemap index");
  const robots = readFileSync(join(distPath, "robots.txt"), "utf8");
  assert.match(robots, /Sitemap: https:\/\/lookme\.anme\.cc\/sitemap-index\.xml/);
});

test("production pages retain Google Search Console verification", () => {
  assert.match(
    readPage("/"),
    /<meta name="google-site-verification" content="SVWkTpZ3X7QfIpQI_NUQf5P_fAJuYcNEkL4wBAymljk"/,
  );
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
  const chinese = readPage("/zh-cn/tools/20-20-20-timer/");
  assert.match(html, /data-timer-start/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /does not use your camera/i);
  assert.match(html, /session storage/i);
  assert.match(chinese, /开始 20 分钟计时/);
  assert.match(chinese, /网页计时器不会调用摄像头/);
});
