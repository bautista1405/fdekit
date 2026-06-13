let macroEvalIdCounter = 0;

export function createMacroEvalId(): string {
  macroEvalIdCounter += 1;
  return `macro_eval_${Date.now()}_${macroEvalIdCounter}`;
}
