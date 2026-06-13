export function isDefaultLoadTestPrompt(prompt: string): boolean {
  return prompt.includes('Run the governed load-test tool')
    && prompt.includes('Do not increase load');
}

export function isDefaultLoadTestEval(evalJson: string): boolean {
  return evalJson.includes('customer api smoke load test')
    && evalJson.includes('loadtest.run');
}
