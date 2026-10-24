import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";

import {
  isolatedEnvironment,
  prepareLinkedRuntime,
  runOpenclaw,
  sanitizeDiagnostics,
  validatePreparedRuntime,
} from "../scripts/check-openclaw.mjs";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

describe("check-openclaw diagnostics", () => {
  test("reports bounded safe failure context without raw child errors", () => {
    const failure = Object.assign(new Error("raw-secret"), {
      status: 1,
      stdout: "install refused",
      stderr:
        "https://user:password@example.test/oauth?code=oauth-code&state=oauth-state Bearer bearer-value api_key=key-value token=token-value",
    });
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw failure;
    });
    let message;
    try {
      runOpenclaw(["plugins", "install", "sensitive-argument"], {});
    } catch (error) {
      message = error.message;
      expect(error.cause).toBeUndefined();
    }
    expect(message).toContain("OpenClaw plugins install failed (status=1");
    expect(message).toContain("install refused");
    for (const secret of [
      "password",
      "oauth-code",
      "oauth-state",
      "bearer-value",
      "key-value",
      "token-value",
      "raw-secret",
      "sensitive-argument",
    ]) {
      expect(message).not.toContain(secret);
    }
    expect(sanitizeDiagnostics("x".repeat(20000))).toHaveLength(8192);
    expect(sanitizeDiagnostics("?code=oauth-code&state=oauth-state")).toBe(
      "?code=[REDACTED]&state=[REDACTED]",
    );
  });

  test("bounds captured output without imposing a total workload deadline", () => {
    vi.mocked(execFileSync).mockReturnValueOnce('{"loaded":true}');
    expect(runOpenclaw(["plugins", "inspect"], {})).toBe('{"loaded":true}');
    expect(execFileSync).toHaveBeenLastCalledWith(
      "openclaw",
      ["plugins", "inspect"],
      expect.objectContaining({
        maxBuffer: 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    expect(execFileSync.mock.calls.at(-1)[2]).not.toHaveProperty("timeout");
  });

  test("uses temporary home and config without inherited credentials", () => {
    vi.stubEnv("WEFT_API_KEY", "must-not-inherit");
    vi.stubEnv("OPENCLAW_CONFIG_PATH", "/must-not-read");
    const isolated = isolatedEnvironment("weft-openclaw-diagnostic-test-");
    try {
      expect(isolated.environment.HOME).toBe(isolated.root);
      expect(isolated.environment.OPENCLAW_CONFIG_PATH).toBe(`${isolated.root}/config.json`);
      expect(isolated.environment.XDG_CONFIG_HOME).toBe(`${isolated.root}/config`);
      expect(isolated.environment.WEFT_API_KEY).toBeUndefined();
      expect(isolated.environment.npm_config_fetch_timeout).toBe("60000");
      expect(isolated.environment.npm_config_fetch_retries).toBe("0");
      expect(Object.keys(isolated.environment).sort()).toEqual(
        [
          "PATH",
          "HOME",
          "OPENCLAW_CONFIG_PATH",
          "OPENCLAW_STATE_DIR",
          "XDG_CACHE_HOME",
          "XDG_CONFIG_HOME",
          "npm_config_fetch_timeout",
          "npm_config_fetch_retries",
        ].sort(),
      );
    } finally {
      rmSync(isolated.root, { recursive: true, force: true });
      vi.unstubAllEnvs();
    }
  });
});

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const packageFiles = [
  "package.json",
  "openclaw.plugin.json",
  "agent-plugin/plugin.json",
  "agent-plugin/mcp.json",
  "agent-plugin/README.md",
  "agent-plugin/skills/weft/SKILL.md",
  "agent-plugin/skills/weft/rules/cli.md",
  "SKILLS_REF",
  "src/index.ts",
  "src/identity.ts",
  "dist/index.js",
  "dist/index.d.ts",
  "docs/architecture/openclaw-plugin.md",
  "docs/specs/openclaw-plugin.md",
  "docs/decisions/2026-09-01-mcp-first-weft-integration.md",
  "README.md",
  "LICENSE",
];

function preparationFixture(runtime, fault) {
  const source = join(dirname(runtime), "source");
  for (const file of [...packageFiles, "pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
    mkdirSync(dirname(join(source, file)), { recursive: true });
    if (file.startsWith("dist/")) {
      writeFileSync(join(source, file), "fixture prepack build output");
    } else {
      copyFileSync(join(sourceRoot, file), join(source, file));
    }
  }
  const calls = [];
  vi.mocked(execFileSync).mockImplementation((command, args, options) => {
    calls.push({ command, args, options });
    if (fault === `${command} ${args[0]}`) {
      throw Object.assign(new Error("raw failure"), {
        status: 1,
        stderr: "dependency refused https://example.test/oauth?code=hidden-code",
      });
    }
    if (command === "pnpm" && args[0] === "pack") {
      writeFileSync(join(args[2], "weft-labs-openclaw-plugin-0.1.0.tgz"), "fixture archive");
    } else if (command === "tar" && args[0] === "-tzf") {
      return packageFiles
        .filter((f) => fault !== "omitted" || f !== "dist/index.js")
        .map((f) => `package/${f}`)
        .join("\n");
    } else if (command === "tar") {
      for (const file of packageFiles) {
        mkdirSync(dirname(join(runtime, file)), { recursive: true });
        copyFileSync(join(source, file), join(runtime, file));
      }
      if (fault === "stale") writeFileSync(join(runtime, "dist/index.js"), "stale build");
    } else if (command === "pnpm" && args[0] === "install") {
      mkdirSync(join(runtime, "node_modules/.pnpm"), { recursive: true });
      const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
      for (const [name, version] of Object.entries(manifest.dependencies)) {
        const path = join(runtime, "node_modules", name);
        mkdirSync(path, { recursive: true });
        writeFileSync(
          join(path, "package.json"),
          JSON.stringify({ version: fault === "version" ? "wrong" : version }),
        );
      }
      if (fault === "host") mkdirSync(join(runtime, "node_modules/.pnpm/openclaw@2026.10.4"));
      if (fault === "payload") writeFileSync(join(runtime, "dist/index.js"), "modified payload");
      if (fault === "lock") writeFileSync(join(runtime, "pnpm-lock.yaml"), "modified lock");
    } else if (command === "openclaw") {
      throw Object.assign(new Error("raw failure"), { status: 1, stderr: "install refused" });
    }
    return "";
  });
  return calls;
}

describe("prepared local-link runtime", () => {
  test("builds through pack, preserves exact preparation inputs, excludes dev host and retains user runtime", () => {
    const root = mkdtempSync(join(tmpdir(), "weft-preparation-test-"));
    const runtime = join(root, "plugin");
    const calls = preparationFixture(runtime);
    try {
      expect(prepareLinkedRuntime(runtime, join(root, "source"))).toBe(runtime);
      expect(existsSync(runtime)).toBe(true);
      expect(calls[0].args[0]).toBe("pack");
      expect(calls[0].args).not.toContain("--ignore-scripts");
      const install = calls.find((c) => c.args[0] === "install");
      expect(install.args).toEqual([
        "install",
        "--prod",
        "--frozen-lockfile",
        "--store-dir",
        join(calls[0].args[2], "store"),
        "--fetch-timeout",
        "60000",
        "--fetch-retries",
        "0",
      ]);
      expect(install.options.cwd).toBe(runtime);
      expect(install.options.env.WEFT_API_KEY).toBeUndefined();
      expect(install.options).not.toHaveProperty("timeout");
      for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
        expect(readFileSync(join(runtime, file))).toEqual(readFileSync(join(sourceRoot, file)));
      }
      expect(existsSync(calls[0].args[2])).toBe(false);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  test.each(["pnpm pack", "tar -xzf", "pnpm install"])(
    "cleans owned runtime and private environment after %s failure",
    (fault) => {
      const root = mkdtempSync(join(tmpdir(), "weft-preparation-test-"));
      const runtime = join(root, "plugin");
      const calls = preparationFixture(runtime, fault);
      try {
        expect(() => prepareLinkedRuntime(runtime, join(root, "source"))).toThrow(
          "dependency refused",
        );
        expect(existsSync(runtime)).toBe(false);
        expect(existsSync(calls[0].options.env.HOME)).toBe(false);
      } finally {
        rmSync(root, { force: true, recursive: true });
      }
    },
  );

  test.each([
    ["omitted", "Packed plugin is missing"],
    ["stale", "differs from current source/build"],
    ["host", "must not contain the development OpenClaw host"],
    ["version", "does not match its exact pin"],
    ["payload", "changed packed payload"],
    ["lock", "changed pnpm-lock.yaml"],
  ])("rejects %s preparation without retaining an invalid runtime", (fault, message) => {
    const root = mkdtempSync(join(tmpdir(), "weft-preparation-test-"));
    const runtime = join(root, "plugin");
    const calls = preparationFixture(runtime, fault);
    try {
      expect(() => prepareLinkedRuntime(runtime, join(root, "source"))).toThrow(message);
      expect(existsSync(runtime)).toBe(false);
      expect(existsSync(calls[0].options.env.HOME)).toBe(false);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  test("refuses an existing destination without deleting another install", () => {
    const root = mkdtempSync(join(tmpdir(), "weft-preparation-test-"));
    writeFileSync(join(root, "keep"), "existing install");
    try {
      expect(() => prepareLinkedRuntime(root)).toThrow();
      expect(readFileSync(join(root, "keep"), "utf8")).toBe("existing install");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  test("documents the same retained production-prepared source path instead of the development root", () => {
    const readme = readFileSync(join(sourceRoot, "README.md"), "utf8");
    expect(readme).toContain('scripts/check-openclaw.mjs --prepare "$WEFT_RUNTIME"');
    expect(readme).toContain('plugins install --link "$WEFT_RUNTIME"');
    expect(readme).not.toContain("plugins install --link .");
    expect(readme).toContain("Keep that directory while OpenClaw links to it");
    expect(readme).toContain("not npm/ClawHub publication");
  });
});

describe("retained prepared runtime validation", () => {
  test("checks retained payload and pins without pack, writes, or dependency fetches", () => {
    const root = mkdtempSync(join(tmpdir(), "weft-preparation-test-"));
    const runtime = join(root, "plugin");
    preparationFixture(runtime);
    try {
      prepareLinkedRuntime(runtime, join(root, "source"));
      vi.mocked(execFileSync).mockClear();
      validatePreparedRuntime(runtime, join(root, "source"));
      expect(execFileSync).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  test.each([
    ["package.json", '{"name":"not-weft"}'],
    ["pnpm-lock.yaml", "changed policy"],
    ["pnpm-workspace.yaml", "changed policy"],
    ["dist/index.js", "changed build"],
    ["src/unexpected.ts", "extra payload"],
    ["node_modules/typebox/package.json", '{"version":"wrong"}'],
    ["node_modules/.pnpm/openclaw@2026.10.4", "nested development host"],
  ])("rejects changed retained %s without deleting caller-owned runtime", (file, content) => {
    const root = mkdtempSync(join(tmpdir(), "weft-preparation-test-"));
    const runtime = join(root, "plugin");
    preparationFixture(runtime);
    try {
      prepareLinkedRuntime(runtime, join(root, "source"));
      writeFileSync(join(runtime, file), content);
      expect(() => validatePreparedRuntime(runtime, join(root, "source"))).toThrow();
      expect(existsSync(runtime)).toBe(true);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
