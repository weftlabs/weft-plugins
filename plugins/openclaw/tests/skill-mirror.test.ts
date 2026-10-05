import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

  test("rejects a missing mirror file", () => {
    const canonical = makeTree("canonical-missing", {
      "SKILL.md": "---\nname: weft\n",
      "rules/cli.md": "install the cli\n",
    });
    const mirror = makeTree("mirror-missing", {
      "SKILL.md": "---\nname: weft\n",
    });

    expect(() => assertSkillMirrorMatches(canonical, mirror)).toThrow(/Missing: rules\/cli\.md/);
  });

  test("compares binary file bytes", () => {
    const canonical = makeTree("canonical-binary", { "SKILL.md": "same\n" });
    const mirror = makeTree("mirror-binary", { "SKILL.md": "same\n" });
    const same = Buffer.from([0x00, 0xff, 0x10, 0x80]);
    writeFileSync(join(canonical, "payload.bin"), same);
    writeFileSync(join(mirror, "payload.bin"), Buffer.from(same));

    expect(() => assertSkillMirrorMatches(canonical, mirror)).not.toThrow();

    writeFileSync(join(mirror, "payload.bin"), Buffer.from([0x00, 0xfe, 0x10, 0x80]));
    expect(() => assertSkillMirrorMatches(canonical, mirror)).toThrow(/payload\.bin/);
  });

  test("rejects a symbolic link at either comparison root", () => {
    const files = { "SKILL.md": "---\nname: weft\n" };
    const canonical = makeTree("canonical-root-link", files);
    const mirrorTarget = makeTree("mirror-root-target", files);
    const mirrorParent = mkdtempSync(join(tmpdir(), "weft-skill-mirror-root-link-"));
    roots.push(mirrorParent);
    const mirror = join(mirrorParent, "weft");
    symlinkSync(mirrorTarget, mirror);

    expect(() => assertSkillMirrorMatches(canonical, mirror)).toThrow(
      /Skill mirror root must not be a symlink/,
    );

    const canonicalTarget = makeTree("canonical-root-target", files);
    const canonicalParent = mkdtempSync(join(tmpdir(), "weft-skill-mirror-canonical-link-"));
    roots.push(canonicalParent);
    const canonicalLink = join(canonicalParent, "weft");
    symlinkSync(canonicalTarget, canonicalLink);
    const realMirror = makeTree("mirror-real", files);

    expect(() => assertSkillMirrorMatches(canonicalLink, realMirror)).toThrow(
      /Skill mirror root must not be a symlink/,
    );
  });
});
