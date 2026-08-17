import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  parseZhihuCliAnswer,
  resolveZhihuCliBinary,
  runZhihuDirect,
} from "./zhihu-cli.mjs";

test("resolves the official macOS user installation path", () => {
  const expected = path.join(
    "/Users/tester",
    "Library",
    "Application Support",
    "zhihu-cli",
    "current",
    "zhihu-cli",
  );
  assert.equal(
    resolveZhihuCliBinary({
      env: {},
      platform: "darwin",
      home: "/Users/tester",
      exists: (candidate) => candidate === expected,
    }),
    expected,
  );
});

test("uses an explicit absolute binary without consulting PATH", () => {
  assert.equal(
    resolveZhihuCliBinary({
      env: { LOOK_ME_ZHIHU_CLI_PATH: "/opt/zhihu-cli" },
      exists: (candidate) => candidate === "/opt/zhihu-cli",
    }),
    "/opt/zhihu-cli",
  );
});

test("parses a non-streaming Zhihu Direct response", () => {
  assert.equal(
    parseZhihuCliAnswer(JSON.stringify({
      choices: [{ message: { content: "  直答结果  " } }],
    })),
    "直答结果",
  );
});

test("passes the question as an argument and requests the fast model", async () => {
  let invocation;
  const result = await runZhihuDirect("如何理解 Agent Memory？", {
    binaryPath: "/opt/zhihu-cli",
    execute: async (...args) => {
      invocation = args;
      return {
        stdout: JSON.stringify({
          choices: [{ message: { content: "可以从持久化与召回两层理解。" } }],
        }),
        stderr: "",
      };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    answer: "可以从持久化与召回两层理解。",
  });
  assert.equal(invocation[0], "/opt/zhihu-cli");
  assert.deepEqual(invocation[1], [
    "answer",
    "--query",
    "如何理解 Agent Memory？",
    "--model",
    "zhida-fast-1p5",
    "--output",
    "json",
    "--timeout",
    "120s",
  ]);
  assert.equal(invocation[2].shell, undefined);
});

test("returns the CLI stable error payload", async () => {
  const error = Object.assign(new Error("command failed"), {
    stdout: JSON.stringify({
      ok: false,
      error: { code: "AUTH_REQUIRED", message: "请先配置 Access Secret" },
    }),
    stderr: "",
  });
  const result = await runZhihuDirect("测试", {
    binaryPath: "/opt/zhihu-cli",
    execute: async () => {
      throw error;
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: { code: "AUTH_REQUIRED", message: "请先配置 Access Secret" },
  });
});

test("returns a friendly message for a raw API rate-limit error", async () => {
  const error = Object.assign(new Error("command failed"), {
    stdout: JSON.stringify({
      error: {
        code: "rate_limit_exceeded",
        message: "rate limit exceeded",
      },
    }),
    stderr: "",
  });
  const result = await runZhihuDirect("测试", {
    binaryPath: "/opt/zhihu-cli",
    execute: async () => {
      throw error;
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "rate_limit_exceeded",
      message: "知乎直答请求过于频繁，请稍后重试。",
    },
  });
});

test("rejects empty and overlong questions before invoking the CLI", async () => {
  assert.equal((await runZhihuDirect("   ")).error.code, "INVALID_QUERY");
  assert.equal((await runZhihuDirect("a".repeat(1_001))).error.code, "QUERY_TOO_LONG");
});

test("reports an unexpected response without exposing raw output", async () => {
  const result = await runZhihuDirect("测试", {
    binaryPath: "/opt/zhihu-cli",
    execute: async () => ({ stdout: "{}", stderr: "" }),
  });
  assert.deepEqual(result, {
    ok: false,
    error: { code: "CLI_FAILED", message: "知乎 CLI 调用失败，请检查登录配置后重试。" },
  });
});
