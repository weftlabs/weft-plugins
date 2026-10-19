import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const requiredPackageFiles = [
  "package/package.json",
  "package/openclaw.plugin.json",
  "package/agent-plugin/plugin.json",
  "package/agent-plugin/mcp.json",
  "package/agent-plugin/README.md",
  "package/agent-plugin/skills/weft/SKILL.md",
  "package/agent-plugin/skills/weft/rules/cli.md",
  "package/SKILLS_REF",
  "package/src/index.ts",
  "package/src/identity.ts",
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/docs/architecture/openclaw-plugin.md",
  "package/docs/specs/openclaw-plugin.md",
  "package/docs/decisions/2026-09-01-mcp-first-weft-integration.md",
  "package/README.md",
  "package/LICENSE",
];

export function validatePackageContents(listing) {
  const files = new Set(listing.trim().split("\n"));
  const missing = requiredPackageFiles.filter((file) => !files.has(file));
  if (missing.length > 0) {
    throw new Error(`Packed plugin is missing: ${missing.join(", ")}`);
  }
  if ([...files].some((file) => file.split("/").includes("node_modules"))) {
    throw new Error("Packed plugin must not contain development dependencies");
  }
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outputDirectory = mkdtempSync(join(tmpdir(), "weft-openclaw-package-"));
  try {
    execFileSync("pnpm", ["pack", "--pack-destination", outputDirectory], { stdio: "ignore" });
    const archive = join(outputDirectory, "weft-labs-openclaw-plugin-0.1.0.tgz");
    const listing = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" });
    const files = validatePackageContents(listing);
    console.log(`Packed plugin contains ${files.size} files and all required entries.`);
  } finally {
    rmSync(outputDirectory, { force: true, recursive: true });
  }
}
