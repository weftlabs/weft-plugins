import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

const CANONICAL_REMOTE = "https://github.com/weftlabs/skills.git";

function toPosix(file) {
  return sep === "/" ? file : file.split(sep).join("/");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    timeout: options.timeout ?? 60_000,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
    input: options.input,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.error) {
    throw new Error(`${command} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim() ?? "";
    throw new Error(`${command} failed (${result.status}): ${stderr}`);
  }
  return result;
}

export function listSkillFiles(dir) {
  if (lstatSync(dir).isSymbolicLink()) {
    throw new Error("Skill mirror root must not be a symlink");
  }
  const files = [];
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Skill mirror must not contain a symlink: ${toPosix(relative(dir, path))}`);
      }
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Skill mirror has an unsupported entry: ${toPosix(relative(dir, path))}`);
      }
      files.push(toPosix(relative(dir, path)));
    }
  }
  walk(dir);
  return files.sort();
}

export function assertSkillMirrorMatches(canonicalDir, mirrorDir) {
  const canonicalFiles = listSkillFiles(canonicalDir);
  const mirrorFiles = listSkillFiles(mirrorDir);
  const missing = canonicalFiles.filter((file) => !mirrorFiles.includes(file));
  const extra = mirrorFiles.filter((file) => !canonicalFiles.includes(file));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Skill mirror file list does not match canonical skills/weft. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`,
    );
  }
  for (const file of canonicalFiles) {
    const canonicalBytes = readFileSync(join(canonicalDir, file));
    const mirrorBytes = readFileSync(join(mirrorDir, file));
    if (!canonicalBytes.equals(mirrorBytes)) {
      throw new Error(`Skill mirror byte mismatch: ${file}`);
    }
  }
}

export function fetchCanonicalSkillDir(ref) {
  if (!/^[0-9a-f]{40}$/.test(ref)) {
    throw new Error("SKILLS_REF must pin one canonical weftlabs/skills commit");
  }
  const root = mkdtempSync(join(tmpdir(), "weft-skills-ref-"));
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  try {
    run("git", ["init", "-q", root], { timeout: 15_000 });
    run("git", ["-C", root, "remote", "add", "origin", CANONICAL_REMOTE], { timeout: 15_000 });
    run("git", ["-C", root, "fetch", "--depth", "1", "origin", ref], { timeout: 60_000 });
    const extract = join(root, "extract");
    mkdirSync(extract);
    const archive = run("git", ["-C", root, "archive", "FETCH_HEAD", "skills/weft"], {
      timeout: 30_000,
    });
    run("tar", ["-x", "-C", extract], { input: archive.stdout, timeout: 30_000 });
    const skillDir = join(extract, "skills", "weft");
    if (!statSync(skillDir, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`Canonical skills/weft is missing at ${ref}`);
    }
    return { skillDir, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
