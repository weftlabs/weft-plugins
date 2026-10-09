import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import plugin from "../index.js";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const entrypoint = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const pluginSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const oxlintConfig = JSON.parse(
  readFileSync(new URL("../.oxlintrc.json", import.meta.url), "utf8"),
);
const oxfmtConfig = JSON.parse(readFileSync(new URL("../.oxfmtrc.json", import.meta.url), "utf8"));
const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const releaseWorkflow = readFileSync(
  new URL("../.github/workflows/release.yml", import.meta.url),
  "utf8",
);

describe("package installation contract", () => {
  test("ships a source entrypoint for lifecycle-free OpenCode installs", () => {
    expect(plugin.id).toBe("weft.websearch");
    expect(manifest.name).toBe("@weftlabs/opencode-websearch");
    expect(manifest.exports).toBe("./index.ts");
    expect(manifest.files).toContain("index.ts");
    expect(manifest.files).toContain("src");
    expect(manifest.dependencies["@opencode-ai/plugin"]).toBe("0.0.0-beta-18743");
    expect(manifest.devDependencies["@opencode-ai/plugin"]).toBeUndefined();
    expect(manifest.peerDependencies).toBeUndefined();
    expect(entrypoint).toContain('export { default } from "./src/index.js"');
    expect(entrypoint).toContain('export * from "./src/index.js"');
    expect(pluginSource).toContain('import { Plugin } from "@opencode-ai/plugin"');
    expect(pluginSource).toContain("Plugin.define({");
  });

  test("explicitly ignores the optional msgpackr native build", () => {
    expect(workspace).toMatch(/ignoredBuiltDependencies:\s*\n\s*- msgpackr-extract/);
  });

  test("limits the fresh-release exception to the pinned OpenCode beta", () => {
    expect(workspace).toContain('"@opencode-ai/ai@0.0.0-beta-18743"');
    expect(workspace).toContain('"@opencode-ai/client@0.0.0-beta-18743"');
    expect(workspace).toContain('"@opencode-ai/plugin@0.0.0-beta-18743"');
    expect(workspace).toContain('"@opencode-ai/protocol@0.0.0-beta-18743"');
    expect(workspace).toContain('"@opencode-ai/schema@0.0.0-beta-18743"');
  });

  test("keeps oxlint and oxfmt config files and script names", () => {
    expect(oxlintConfig.$schema).toBe("./node_modules/oxlint/configuration_schema.json");
    expect(oxfmtConfig.$schema).toBe("./node_modules/oxfmt/configuration_schema.json");
    expect(manifest.scripts.lint).toBe("oxlint");
    expect(manifest.scripts.format).toBe("oxfmt");
    expect(manifest.scripts["format:check"]).toBe("oxfmt --check");
  });

  test("promotes the exact main CI package through npm trusted publishing", () => {
    expect(ciWorkflow).toMatch(/npm-package-\$\{\{ github\.sha \}\}/);
    expect(ciWorkflow).toContain("actions/upload-artifact@v4");
    expect(releaseWorkflow).toMatch(/release:\s*\n\s*types: \[published\]/);
    expect(releaseWorkflow).toContain("actions: read");
    expect(releaseWorkflow).toContain("id-token: write");
    expect(releaseWorkflow).toContain("environment: npm");
    expect(releaseWorkflow).toContain("gh run download");
    expect(releaseWorkflow).toContain("dist.integrity");
    expect(releaseWorkflow).toContain("sha512-");
    expect(releaseWorkflow).toContain('"@weftlabs/opencode-websearch"');
    expect(releaseWorkflow).not.toContain('"@weftlab/opencode-websearch"');
    expect(releaseWorkflow).toContain('pnpm publish "./$TARBALL"');
    expect(releaseWorkflow).not.toContain("NPM_TOKEN");
    expect(releaseWorkflow).not.toContain("NODE_AUTH_TOKEN");
  });
});
