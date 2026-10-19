import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validatePackageContents } from "./check-package.mjs";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));

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
      npm_config_fetch_timeout: "60000",
      npm_config_fetch_retries: "0",
      XDG_CACHE_HOME: cache,
    },
  };
}

export function sanitizeDiagnostics(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s<>"']+/gi, "[REDACTED_URL]")
    .replace(/([?&][\w.-]+=)[^&\s"'<>]+/g, "$1[REDACTED]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(
      /((?:[\w-]*(?:token|secret|password|credential|api[_-]?key)[\w-]*)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,
      "$1[REDACTED]",
    )
    .slice(-8192);
}

function runCommand(command, args, environment, cwd = sourceRoot) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    // Do not propagate the raw child error: it includes unredacted output and arguments.
    throw new Error(
      `${command === "openclaw" ? "OpenClaw" : command} ${args.slice(0, 2).join(" ")} failed ` +
        `(status=${error.status ?? "none"}, signal=${error.signal ?? "none"}, code=${error.code ?? "none"}).\n` +
        sanitizeDiagnostics(`${error.stdout ?? ""}\n${error.stderr ?? ""}`),
    );
  }
}

export function runOpenclaw(args, environment) {
  return runCommand("openclaw", args, environment);
}

const hashFile = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function payloadFiles(root, paths) {
  const files = [];
  for (const path of paths) {
    if (statSync(join(root, path)).isDirectory()) {
      files.push(
        ...payloadFiles(
          root,
          readdirSync(join(root, path)).map((name) => join(path, name)),
        ),
      );
    } else files.push(path);
  }
  return files.sort();
}

export function validatePreparedRuntime(runtime, sourceDirectory = sourceRoot) {
  const sourceManifest = readJson(join(sourceDirectory, "package.json"));
  const packedManifest = readJson(join(runtime, "package.json"));
  for (const field of ["name", "version", "dependencies", "peerDependencies", "openclaw"]) {
    if (JSON.stringify(sourceManifest[field]) !== JSON.stringify(packedManifest[field])) {
      throw new Error(`Packed manifest changed ${field}`);
    }
  }
  const sourceFiles = payloadFiles(sourceDirectory, sourceManifest.files);
  const runtimeFiles = payloadFiles(runtime, sourceManifest.files);
  validatePackageContents(
    ["package/package.json", ...runtimeFiles.map((file) => `package/${file}`)].join("\n"),
  );
  if (JSON.stringify(sourceFiles) !== JSON.stringify(runtimeFiles)) {
    throw new Error("Prepared runtime payload file set differs from current source/build");
  }
  for (const file of [...sourceFiles, "pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
    if (hashFile(join(runtime, file)) !== hashFile(join(sourceDirectory, file))) {
      throw new Error(`Prepared runtime differs from current source/build/policy: ${file}`);
    }
  }
  const modules = join(runtime, "node_modules");
  if (
    readdirSync(modules).includes("openclaw") ||
    readdirSync(join(modules, ".pnpm")).some((name) => name.startsWith("openclaw@"))
  ) {
    throw new Error("Production runtime must not contain the development OpenClaw host");
  }
  for (const [name, version] of Object.entries(sourceManifest.dependencies)) {
    if (readJson(join(modules, name, "package.json")).version !== version) {
      throw new Error(`Production dependency does not match its exact pin: ${name}`);
    }
  }
}

export function prepareLinkedRuntime(destination, sourceDirectory = sourceRoot) {
  const runtime = resolve(destination);
  // Refuse an existing path before taking ownership; never remove another install.
  mkdirSync(runtime);
  let preparation;
  try {
    preparation = isolatedEnvironment("weft-openclaw-preparation-");
    const { root, environment } = preparation;
    // pack runs the real prepack build, so the runtime cannot use stale dist files.
    runCommand("pnpm", ["pack", "--pack-destination", root], environment, sourceDirectory);
    const archive = join(root, "weft-labs-openclaw-plugin-0.1.0.tgz");
    const files = validatePackageContents(runCommand("tar", ["-tzf", archive], environment));
    for (const file of files) {
      if (!file.startsWith("package/") || file.split("/").some((part) => part === "..")) {
        throw new Error("Packed plugin contains an invalid path");
      }
    }
    runCommand("tar", ["-xzf", archive, "--strip-components=1", "-C", runtime], environment);
    const payloadHashes = new Map();
    for (const file of files) {
      const relative = file.slice("package/".length);
      const digest = hashFile(join(runtime, relative));
      payloadHashes.set(relative, digest);
      if (relative !== "package.json" && digest !== hashFile(join(sourceDirectory, relative))) {
        throw new Error(`Packed payload differs from current source/build: ${relative}`);
      }
    }
    const sourceManifest = readJson(join(sourceDirectory, "package.json"));
    const packedManifest = readJson(join(runtime, "package.json"));
    for (const field of ["name", "version", "dependencies", "peerDependencies", "openclaw"]) {
      if (JSON.stringify(sourceManifest[field]) !== JSON.stringify(packedManifest[field])) {
        throw new Error(`Packed manifest changed ${field}`);
      }
    }
    for (const name of ["pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
      copyFileSync(join(sourceDirectory, name), join(runtime, name));
    }
    runCommand(
      "pnpm",
      [
        "install",
        "--prod",
        "--frozen-lockfile",
        "--store-dir",
        join(root, "store"),
        "--fetch-timeout",
        "60000",
        "--fetch-retries",
        "0",
      ],
      environment,
      runtime,
    );
    for (const name of ["pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
      if (hashFile(join(runtime, name)) !== hashFile(join(sourceDirectory, name))) {
        throw new Error(`Production preparation changed ${name}`);
      }
    }
    for (const [relative, digest] of payloadHashes) {
      if (hashFile(join(runtime, relative)) !== digest) {
        throw new Error(`Production preparation changed packed payload: ${relative}`);
      }
    }
    validatePreparedRuntime(runtime, sourceDirectory);
    const sha256 = hashFile(archive);
    console.log(`Prepared local-link runtime ${runtime}; package SHA256: ${sha256}`);
    return runtime;
  } catch (error) {
    rmSync(runtime, { force: true, recursive: true });
    throw error;
  } finally {
    if (preparation) rmSync(preparation.root, { force: true, recursive: true });
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

export function checkPreparedRuntime(runtime) {
  validatePreparedRuntime(runtime);
  const nativeResult = installAndInspect(runtime, "weft-openclaw-native-", true);
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

  const bundleResult = installAndInspect(
    join(runtime, "agent-plugin"),
    "weft-openclaw-bundle-",
    true,
  );
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

export function checkOpenclaw() {
  const preparedRoot = mkdtempSync(join(tmpdir(), "weft-openclaw-runtime-"));
  try {
    const runtime = prepareLinkedRuntime(join(preparedRoot, "plugin"));
    checkPreparedRuntime(runtime);
  } finally {
    rmSync(preparedRoot, { force: true, recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === "--prepare" && process.argv.length === 4) {
    prepareLinkedRuntime(process.argv[3]);
  } else if (process.argv.length === 2) {
    checkOpenclaw();
  } else {
    throw new Error("Usage: check-openclaw.mjs [--prepare <new-runtime-directory>]");
  }
}
