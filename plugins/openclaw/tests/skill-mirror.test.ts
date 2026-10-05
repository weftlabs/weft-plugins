import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { assertSkillMirrorMatches } from "../scripts/skill-mirror.mjs";

const roots: string[] = [];

function makeTree(name: string, files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), `weft-skill-mirror-${name}-`));
  roots.push(root);
  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, contents);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("canonical skill mirror", () => {
  test("rejects a changed mirror file", () => {
    const canonical = makeTree("canonical", {
      "SKILL.md": "---\nname: weft\n",
      "rules/cli.md": "install the cli\n",
    });
    const mirror = makeTree("mirror", {
      "SKILL.md": "---\nname: weft\n",
      "rules/cli.md": "install the changed cli\n",
    });

    expect(() => assertSkillMirrorMatches(canonical, mirror)).toThrow(/rules\/cli\.md/);
  });

  test("accepts a byte-identical tree and rejects an extra mirror file", () => {
    const files = {
      "SKILL.md": "---\nname: weft\n",
      "rules/cli.md": "install the cli\n",
    };
    const canonical = makeTree("canonical-ok", files);
    const mirror = makeTree("mirror-ok", files);

    expect(() => assertSkillMirrorMatches(canonical, mirror)).not.toThrow();

    writeFileSync(join(mirror, "rules/extra.md"), "not canonical\n");
    expect(() => assertSkillMirrorMatches(canonical, mirror)).toThrow(/extra\.md/);
  });
});
