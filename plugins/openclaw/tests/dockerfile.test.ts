import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const dockerfile = readFileSync(new URL("../Dockerfile.dogfood", import.meta.url), "utf8");
const compose = readFileSync(new URL("../docker-compose.dogfood.yml", import.meta.url), "utf8");
const dogfood = readFileSync(new URL("../scripts/dogfood.mjs", import.meta.url), "utf8");

describe("Docker dogfood prepared-runtime caller", () => {
  test("includes checker imports and the complete validated package payload", () => {
    expect(dockerfile).not.toMatch(/^COPY\s+(?:--\S+\s+)*\.\s+\.\s*$/m);
    expect(dockerfile).toContain("COPY src ./src");
    expect(dockerfile).toContain("COPY agent-plugin ./agent-plugin");
    expect(dockerfile).toContain("COPY docs ./docs");
    expect(dockerfile).toMatch(/COPY[^\n]*scripts\/check-package\.mjs[^\n]*\.\/scripts\//);
  });

  test("prepares and retains the validated runtime at writable image build time", () => {
    const preparation = dockerfile.indexOf(
      "RUN pnpm exec node scripts/check-openclaw.mjs --prepare /plugin-runtime",
    );
    const hostStartup = dockerfile.indexOf("pnpm exec openclaw --version");
    expect(hostStartup).toBeGreaterThan(0);
    expect(hostStartup).toBeLessThan(preparation);
    expect(preparation).toBeGreaterThan(0);
    expect(preparation).toBeLessThan(dockerfile.indexOf("USER node"));
    expect(dockerfile).toContain("WEFT_DOGFOOD_RUNTIME=/plugin-runtime");
    expect(dogfood).toContain("checkPreparedRuntime(runtime.path)");
    expect(dogfood).toMatch(/"--link",\s*runtime\.path/);
    expect(dogfood).not.toContain('["scripts/check-openclaw.mjs"]');
    expect(dogfood).not.toMatch(/"--link",\s*"\."/);
    expect(dogfood).toMatch(/finally\s*\{\s*runtime\.cleanup\(\)/);
  });

  test("retains the nonroot read-only tmpfs, staging and spending boundaries", () => {
    expect(dockerfile).toContain("USER node");
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("/tmp:mode=1777");
    expect(compose).toContain("/home/node/.cache:uid=1000,gid=1000,mode=0700");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toContain(
      "WEFT_API_KEY: $" + "{WEFT_API_KEY:?Set a short-lived staging Weft buyer key}",
    );
    expect(dogfood).toContain('const STAGING_URL = "https://staging.weft.network"');
    expect(dogfood).toContain('maxCostUsd: "0.01"');
    expect(dogfood).toContain("if (!apiKey) throw new Error");
  });
});
