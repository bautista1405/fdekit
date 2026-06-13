export function isDefaultCodebasePrompt(prompt: string): boolean {
  return prompt.includes('Search the configured repository')
    && prompt.includes('Do not invent files');
}

export function isDefaultCodebaseEval(evalJson: string): boolean {
  return evalJson.includes('todo marker creates issue')
    && evalJson.includes('TODO(fdekit)');
}
