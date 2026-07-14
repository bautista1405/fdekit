export function isDefaultCodebasePrompt(prompt: string): boolean {
  return prompt.includes('Search the configured repository')
    && prompt.includes('Do not invent files');
}

export function isDefaultCodebaseEval(evalJson: string): boolean {
  // Match both the pre-0.5 literal query and the escaped regex form.
  return evalJson.includes('todo marker creates issue')
    && (evalJson.includes('TODO(fdekit)') || evalJson.includes('TODO\\\\(fdekit\\\\)'));
}
