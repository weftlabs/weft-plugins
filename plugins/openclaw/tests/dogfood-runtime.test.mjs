import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { prepareLinkedRuntime, validatePreparedRuntime } from "../scripts/check-openclaw.mjs";
import { acquireDogfoodRuntime } from "../scripts/dogfood.mjs";

vi.mock("../scripts/check-openclaw.mjs", () => ({
  prepareLinkedRuntime: vi.fn(),
  validatePreparedRuntime: vi.fn(),
  checkPreparedRuntime: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("dogfood prepared runtime ownership", () => {
  test("validates and retains a configured runtime without rebuilding or deleting it", () => {
    const root = mkdtempSync(join(tmpdir(), "weft-dogfood-retained-test-"));
    writeFileSync(join(root, "keep"), "retained validated install");
    try {
      const runtime = acquireDogfoodRuntime(root);
      expect(validatePreparedRuntime).toHaveBeenCalledWith(root);
      expect(prepareLinkedRuntime).not.toHaveBeenCalled();
      expect(runtime.path).toBe(root);
      runtime.cleanup();
      expect(existsSync(join(root, "keep"))).toBe(true);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  test("fails closed on an invalid configured runtime without a fallback", () => {
    vi.mocked(validatePreparedRuntime).mockImplementationOnce(() => {
      throw new Error("changed payload or policy");
    });
    expect(() => acquireDogfoodRuntime("/invalid-runtime")).toThrow("changed payload or policy");
    expect(prepareLinkedRuntime).not.toHaveBeenCalled();
    expect(() => acquireDogfoodRuntime(" ")).toThrow("must name a prepared runtime");
  });

  test("retains an owned temporary fallback until the caller finishes, then cleans it", () => {
    vi.stubEnv("WEFT_DOGFOOD_RUNTIME", undefined);
    vi.mocked(prepareLinkedRuntime).mockImplementationOnce((path) => {
      mkdirSync(path);
      writeFileSync(join(path, "retained"), "in use by later native link");
      return path;
    });
    const runtime = acquireDogfoodRuntime();
    expect(existsSync(join(runtime.path, "retained"))).toBe(true);
    runtime.cleanup();
    expect(existsSync(runtime.path)).toBe(false);
  });

  test("cleans the owned fallback parent after failed preparation", () => {
    vi.stubEnv("WEFT_DOGFOOD_RUNTIME", undefined);
    let destination;
    vi.mocked(prepareLinkedRuntime).mockImplementationOnce((path) => {
      destination = path;
      throw new Error("public dependency fetch failed");
    });
    expect(() => acquireDogfoodRuntime()).toThrow("public dependency fetch failed");
    expect(existsSync(join(destination, ".."))).toBe(false);
  });
});
