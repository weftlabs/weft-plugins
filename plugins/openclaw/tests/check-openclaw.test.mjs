import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";

import {
  isolatedEnvironment,
  runOpenclaw,
  sanitizeDiagnostics,
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
  });

  test("bounds stalled CLI operations and captured output, retaining successful JSON", () => {
    vi.mocked(execFileSync).mockReturnValueOnce('{"loaded":true}');
    expect(runOpenclaw(["plugins", "inspect"], {})).toBe('{"loaded":true}');
    expect(execFileSync).toHaveBeenLastCalledWith(
      "openclaw",
      ["plugins", "inspect"],
      expect.objectContaining({
        timeout: 60000,
        killSignal: "SIGKILL",
        maxBuffer: 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
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
      expect(Object.keys(isolated.environment).sort()).toEqual(
        [
          "PATH",
          "HOME",
          "OPENCLAW_CONFIG_PATH",
          "OPENCLAW_STATE_DIR",
          "XDG_CACHE_HOME",
          "XDG_CONFIG_HOME",
        ].sort(),
      );
    } finally {
      rmSync(isolated.root, { recursive: true, force: true });
      vi.unstubAllEnvs();
    }
  });
});
