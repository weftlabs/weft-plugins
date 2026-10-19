import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function isolatedEnvironment(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const state = join(root, "state");
  const cache = join(root, "cache");
  mkdirSync(state);
  mkdirSync(cache);
  return {
    root,
    environment: {
      PATH: process.env.PATH,
      HOME: root,
      XDG_CONFIG_HOME: join(root, "config"),
      OPENCLAW_CONFIG_PATH: join(root, "config.json"),
      OPENCLAW_STATE_DIR: state,
      XDG_CACHE_HOME: cache,
    },
  };
}

export function sanitizeDiagnostics(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s<>"']+/gi, "[REDACTED_URL]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(
      /((?:[\w-]*(?:token|secret|password|credential|api[_-]?key)[\w-]*)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,
      "$1[REDACTED]",
    )
    .slice(-8192);
}

export function runOpenclaw(args, environment) {
  try {
    return execFileSync("openclaw", args, {
      encoding: "utf8",
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
      killSignal: "SIGKILL",
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    // Do not propagate the raw child error: it includes unredacted output and arguments.
    throw new Error(
      `OpenClaw ${args.slice(0, 2).join(" ")} failed ` +
        `(status=${error.status ?? "none"}, signal=${error.signal ?? "none"}, code=${error.code ?? "none"}).\n` +
        sanitizeDiagnostics(`${error.stdout ?? ""}\n${error.stderr ?? ""}`),
    );
  }
}

function installAndInspect(path, prefix, configureOauth = false) {
  const isolated = isolatedEnvironment(prefix);
  try {
    runOpenclaw(
      [
        "plugins",
        "install",
        "--link",
        path,
        "--force",
        "--accept-capabilities",
        "--acknowledge-install-policy-warning",
      ],
      isolated.environment,
    );
    if (configureOauth) {
      runOpenclaw(
        [
          "mcp",
          "set",
          "weft",
          JSON.stringify({
            url: "https://weft.network/mcp",
            transport: "streamable-http",
            auth: "oauth",
            toolFilter: {
              include: ["weft_search", "weft_fetch", "weft_balance", "weft_connection_status"],
            },
          }),
        ],
        isolated.environment,
      );
    }
    const inspection = JSON.parse(
      runOpenclaw(["plugins", "inspect", "weft", "--json"], isolated.environment),
    );
    runOpenclaw(["plugins", "doctor"], isolated.environment);
    const mcpStatus = JSON.parse(runOpenclaw(["mcp", "status", "--json"], isolated.environment));
    return { inspection, mcpStatus };
  } finally {
    rmSync(isolated.root, { force: true, recursive: true });
  }
}

function checkOpenclaw() {
  const nativeResult = installAndInspect(".", "weft-openclaw-native-", true);
  const native = nativeResult.inspection;
  const nativeServer = nativeResult.mcpStatus.servers?.find((server) => server.name === "weft");
  const nativeAuth = nativeServer?.auth;
  if (
    native.plugin?.status !== "loaded" ||
    native.plugin?.format !== "openclaw" ||
    !native.plugin?.webSearchProviderIds?.includes("weft") ||
    !native.mcpServers?.some((server) => server.name === "weft") ||
    (nativeAuth !== "oauth" && nativeAuth?.type !== "oauth") ||
    native.plugin?.diagnostics?.length > 0 ||
    native.diagnostics?.length > 0
  ) {
    throw new Error(
      `OpenClaw did not load the full Weft plugin with saved OAuth: ${sanitizeDiagnostics(JSON.stringify(nativeResult))}`,
    );
  }

  const bundleResult = installAndInspect("./agent-plugin", "weft-openclaw-bundle-", true);
  const bundle = bundleResult.inspection;
  const bundleServer = bundleResult.mcpStatus.servers?.find((server) => server.name === "weft");
  const bundleAuth = bundleServer?.auth;
  if (
    bundle.plugin?.status !== "loaded" ||
    bundle.plugin?.format !== "bundle" ||
    bundle.plugin?.bundleFormat !== "agent" ||
    !bundle.plugin?.bundleCapabilities?.includes("skills") ||
    !bundle.plugin?.bundleCapabilities?.includes("mcpServers") ||
    !bundle.mcpServers?.some((server) => server.name === "weft") ||
    (bundleAuth !== "oauth" && bundleAuth?.type !== "oauth") ||
    bundle.plugin?.diagnostics?.length > 0 ||
    bundle.diagnostics?.length > 0
  ) {
    throw new Error(
      `OpenClaw did not load the portable Weft bundle with OAuth: ${sanitizeDiagnostics(JSON.stringify(bundleResult))}`,
    );
  }

  console.log(
    "OpenClaw loaded the generic Weft skill and MCP bundle, requester-capable native plugin, and optional web-search provider without diagnostics.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkOpenclaw();
}
