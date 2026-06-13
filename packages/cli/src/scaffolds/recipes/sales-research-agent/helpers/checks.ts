export function isDefaultSalesResearchPrompt(prompt: string): boolean {
  return prompt.includes('Build a concise account research brief')
    && prompt.includes('Do not invent account facts');
}

export function isDefaultSalesResearchEval(evalJson: string): boolean {
  return evalJson.includes('enterprise account research brief')
    && evalJson.includes('acct_company');
}
