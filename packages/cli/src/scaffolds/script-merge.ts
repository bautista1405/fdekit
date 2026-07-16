import { starterScripts } from './project.js';

export const baseScripts = {
  doctor: 'fdekit doctor',
  dev: 'fdekit dev',
  validate: 'fdekit validate',
  'validate:strict': 'fdekit validate --strict',
  diff: 'fdekit diff',
  eval: 'fdekit eval run',
  macro: 'fdekit eval macro',
  report: 'fdekit report',
} satisfies Record<string, string>;

const KNOWN_SCAFFOLD_SCRIPT_DEFAULTS = new Set<string>([
  ...Object.values(baseScripts),
  ...Object.values(starterScripts),
]);

/**
 * Merges recipe scripts into a project without creating near-duplicates of the
 * `fdekit init` scaffold (`doctor` vs `fdekit:doctor`, ...):
 * - an existing script is never overwritten;
 * - an incoming script whose command already exists under any name is skipped;
 * - an incoming `fdekit:<name>` whose bare `<name>` still holds a known
 *   scaffold default is folded into the bare script (upgrading its command).
 */
export function mergeProjectScripts(
  existing: Record<string, unknown>,
  incoming: Record<string, string>,
): Record<string, unknown> {
  const merged = { ...existing };

  for (const [name, command] of Object.entries(incoming)) {
    if (merged[name] !== undefined) {
      continue;
    }

    if (Object.values(merged).includes(command)) {
      continue;
    }

    const bareName = bareScriptName(name);

    if (
      bareName
      && typeof merged[bareName] === 'string'
      && KNOWN_SCAFFOLD_SCRIPT_DEFAULTS.has(merged[bareName] as string)
    ) {
      merged[bareName] = command;
      continue;
    }

    merged[name] = command;
  }

  return merged;
}

function bareScriptName(name: string): string | null {
  if (!name.startsWith('fdekit:')) {
    return null;
  }

  const tail = name.split(':').slice(1).join(':');
  return tail.length > 0 ? tail : null;
}
