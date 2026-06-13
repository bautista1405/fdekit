import { promises as fs } from 'fs';
import * as path from 'path';

let runIdCounter = 0;

export function createRunId(): string {
  runIdCounter += 1;
  return `run_${Date.now()}_${runIdCounter}`;
}

export async function loadInstructions(projectDir: string, instructions: string): Promise<string> {
  const instructionsPath = path.resolve(projectDir, instructions);

  try {
    return await fs.readFile(instructionsPath, 'utf8');
  } catch {
    return instructions;
  }
}
