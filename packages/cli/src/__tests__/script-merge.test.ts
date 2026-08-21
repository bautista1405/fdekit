import { describe, expect, it } from 'vitest';
import { mergeProjectScripts } from '../scaffolds/script-merge.js';
import { starterScripts } from '../scaffolds/project.js';

const recipeRun = 'fdekit run supportTriage --ticket tick_1001';

describe('mergeProjectScripts', () => {
  /**
   * `fdekit init` writes an `agent` script for the starter agent and signs off by
   * telling the user to run it. Installing a recipe replaces that agent, so an
   * untouched `agent` script has to be retargeted - otherwise the first command a
   * new user runs reports "No ticket id was provided" and makes no tool calls.
   */
  it('retargets the scaffold agent script at the recipe run command', () => {
    const merged = mergeProjectScripts({ ...starterScripts }, { 'fdekit:run': recipeRun });

    expect(merged.agent).toBe(recipeRun);
    expect(merged['fdekit:run']).toBeUndefined();
  });

  it('retargets it from namespaced recipes too', () => {
    const merged = mergeProjectScripts({ ...starterScripts }, { 'fdekit:codebase:run': recipeRun });

    expect(merged.agent).toBe(recipeRun);
    expect(merged['fdekit:codebase:run']).toBeUndefined();
  });

  it('leaves an agent script the user has edited alone', () => {
    const edited = 'fdekit run supportTriage --ticket tick_9999 --strict';
    const merged = mergeProjectScripts({ ...starterScripts, agent: edited }, { 'fdekit:run': recipeRun });

    expect(merged.agent).toBe(edited);
    expect(merged['fdekit:run']).toBe(recipeRun);
  });

  /** A second recipe keeps its own namespaced run rather than stealing `agent`. */
  it('does not let a second recipe claim an agent script the first one set', () => {
    const afterFirst = mergeProjectScripts({ ...starterScripts }, { 'fdekit:run': recipeRun });
    const codebaseRun = 'fdekit run codebaseAgent --input \'{"task":"review"}\'';
    const afterSecond = mergeProjectScripts(afterFirst, { 'fdekit:codebase:run': codebaseRun });

    expect(afterSecond.agent).toBe(recipeRun);
    expect(afterSecond['fdekit:codebase:run']).toBe(codebaseRun);
  });

  it('does not fold unrelated multi-segment scripts', () => {
    const merged = mergeProjectScripts({ ...starterScripts }, { 'fdekit:validate:strict': 'fdekit validate --strict' });

    // `validate:strict` already holds that exact command, so nothing is added.
    expect(merged['validate:strict']).toBe('fdekit validate --strict');
    expect(merged['fdekit:validate:strict']).toBeUndefined();
    expect(merged.agent).toBe(starterScripts.agent);
  });
});
