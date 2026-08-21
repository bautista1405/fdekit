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
 *
 * `fdekit:run` folds onto `agent`, the script `fdekit init` writes and points the
 * user at in its next steps. Installing a recipe swaps out the agent that script
 * targets, so without the fold the first command a new user runs still carries the
 * starter input shape and answers "No ticket id was provided" with no tool calls.
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

/**
 * Scaffold scripts whose name differs from the recipe's. Matched on the last
 * segment so namespaced recipes (`fdekit:codebase:run`) fold too - their run
 * command replaces the starter `agent` script just as an unnamespaced one does.
 *
 * Only a pristine default is ever replaced, so installing a second recipe into
 * the same project leaves the first recipe's `agent` script alone and keeps its
 * own run command under the namespaced name.
 */
const BARE_SCRIPT_ALIASES: Record<string, string> = {
  run: 'agent',
};

function bareScriptName(name: string): string | null {
  if (!name.startsWith('fdekit:')) {
    return null;
  }

  const tail = name.split(':').slice(1).join(':');

  if (tail.length === 0) {
    return null;
  }

  const lastSegment = tail.split(':').at(-1) ?? tail;

  return BARE_SCRIPT_ALIASES[lastSegment] ?? tail;
}
