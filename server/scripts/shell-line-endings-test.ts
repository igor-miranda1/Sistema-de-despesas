import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function findShellFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findShellFiles(path));
    } else if (entry.name.endsWith('.sh')) {
      files.push(path);
    }
  }
  return files;
}

const files = await findShellFiles(resolve('.'));
const invalid = [];
for (const file of files) {
  const content = await readFile(file);
  if (content.includes(0x0d)) invalid.push(file);
}
if (invalid.length > 0) {
  throw new Error(`Scripts shell com CRLF: ${invalid.join(', ')}`);
}
console.log(`Scripts shell verificados em LF: ${files.length}`);
