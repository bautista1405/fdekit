export function isDefaultSupportTriagePrompt(prompt: string): boolean {
  return prompt.includes('Classify customer issues')
    && prompt.includes('create concise handoff notes');
}

export function isDefaultSupportTriageEval(evalJson: string): boolean {
  return evalJson.includes('enterprise-customer-escalation')
    && evalJson.includes('company Corp cannot access billing');
}
