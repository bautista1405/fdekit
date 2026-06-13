import { readFileSync } from 'node:fs';

export function readRecipeAsset(baseUrl: string, relativePath: string): string {
  return readFileSync(new URL(relativePath, baseUrl), 'utf8');
}

export function readRecipeJsonAsset<T>(baseUrl: string, relativePath: string): T {
  return JSON.parse(readRecipeAsset(baseUrl, relativePath)) as T;
}
