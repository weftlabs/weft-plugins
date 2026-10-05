export function listSkillFiles(dir: string): string[];

export function assertSkillMirrorMatches(canonicalDir: string, mirrorDir: string): void;

export function fetchCanonicalSkillDir(ref: string): {
  skillDir: string;
  cleanup: () => void;
};
