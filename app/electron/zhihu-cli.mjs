import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_QUERY_LENGTH = 1_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

function failure(code, message) {
  return { ok: false, error: { code, message } };
}

export function resolveZhihuCliBinary({
  env = process.env,
  platform = process.platform,
  home = homedir(),
  exists = existsSync,
} = {}) {
  const explicitBinary = env.LOOK_ME_ZHIHU_CLI_PATH;
  if (explicitBinary) {
    return path.isAbsolute(explicitBinary) && exists(explicitBinary)
      ? explicitBinary
      : null;
  }

  let cliHome = env.ZHIHU_CLI_HOME;
  if (cliHome && !path.isAbsolute(cliHome)) {
    return null;
  }
  if (!cliHome && platform === "darwin") {
    cliHome = path.join(home, "Library", "Application Support", "zhihu-cli");
  } else if (!cliHome && platform === "linux") {
    const dataHome = env.XDG_DATA_HOME || path.join(home, ".local", "share");
    if (!path.isAbsolute(dataHome)) {
      return null;
    }
    cliHome = path.join(dataHome, "zhihu-cli");
  } else if (!cliHome && platform === "win32") {
    if (!env.LOCALAPPDATA) {
      return null;
    }
    cliHome = path.join(env.LOCALAPPDATA, "ZhihuCLI");
  }

  if (!cliHome) {
    return null;
  }
  const binary = path.join(
    cliHome,
    "current",
    platform === "win32" ? "zhihu-cli.exe" : "zhihu-cli",
  );
  return exists(binary) ? binary : null;
}

export function parseZhihuCliAnswer(stdout) {
  const payload = JSON.parse(stdout);
  const answer = payload?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("INVALID_RESPONSE");
  }
  return answer.trim();
}

function parseCliError(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    const payload = JSON.parse(value);
    if (payload?.error) {
      const code = String(payload.error.code || "CLI_ERROR");
      return failure(
        code,
        code === "rate_limit_exceeded"
          ? "知乎直答请求过于频繁，请稍后重试。"
          : String(payload.error.message || "知乎 CLI 调用失败，请稍后重试。"),
      );
    }
  } catch {
    return null;
  }
  return null;
}

export async function runZhihuDirect(query, options = {}) {
  const question = typeof query === "string" ? query.trim() : "";
  if (!question) {
    return failure("INVALID_QUERY", "请输入问题后再发送。");
  }
  if (question.length > MAX_QUERY_LENGTH) {
    return failure("QUERY_TOO_LONG", `问题不能超过 ${MAX_QUERY_LENGTH} 个字符。`);
  }

  const binary = options.binaryPath ?? resolveZhihuCliBinary(options.resolveOptions);
  if (!binary) {
    return failure(
      "CLI_NOT_INSTALLED",
      "本机尚未安装知乎 CLI，请先完成官方 zhihu-cli 安装与登录配置。",
    );
  }

  const execute = options.execute ?? execFileAsync;
  try {
    const { stdout } = await execute(
      binary,
      [
        "answer",
        "--query",
        question,
        "--model",
        "zhida-fast-1p5",
        "--output",
        "json",
        "--timeout",
        "120s",
      ],
      {
        encoding: "utf8",
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: 125_000,
        windowsHide: true,
      },
    );
    return { ok: true, answer: parseZhihuCliAnswer(stdout) };
  } catch (error) {
    const cliError = parseCliError(error?.stdout) ?? parseCliError(error?.stderr);
    if (cliError) {
      return cliError;
    }
    if (error?.code === "ENOENT") {
      return failure(
        "CLI_NOT_INSTALLED",
        "本机尚未安装知乎 CLI，请先完成官方 zhihu-cli 安装与登录配置。",
      );
    }
    if (error?.killed || error?.code === "ETIMEDOUT") {
      return failure("CLI_TIMEOUT", "知乎直答响应超时，请稍后重试。");
    }
    return failure("CLI_FAILED", "知乎 CLI 调用失败，请检查登录配置后重试。");
  }
}
