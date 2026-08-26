import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IGNORED = new Set(['node_modules', 'dist', '.git', '.jest-cache', 'generated', 'coverage', 'storage']);
const CITATION = /`([A-Za-z0-9_./-]+\.(?:ts|tsx|prisma|cjs|mjs|js|json|md|yml|yaml)):(\d+)(?:-(\d+))?`?/g;

function markdownFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED.has(entry.name)) markdownFiles(join(dir, entry.name), found);
    } else if (entry.name.endsWith('.md')) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function ancestors(from) {
  const chain = [];
  let current = from;
  while (current.startsWith(REPO)) {
    chain.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return chain;
}

function findByBasename(root, basename) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === basename) return join(root, entry.name);
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !IGNORED.has(entry.name)) {
      const found = findByBasename(join(root, entry.name), basename);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function resolveTarget(documentPath, citedPath) {
  for (const ancestor of ancestors(dirname(documentPath))) {
    const candidate = normalize(join(ancestor, citedPath));
    if (isFile(candidate)) return candidate;
  }

  if (!citedPath.includes('/')) {
    for (const ancestor of ancestors(dirname(documentPath))) {
      const found = findByBasename(ancestor, citedPath);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function lineCount(path) {
  return readFileSync(path, 'utf8').split('\n').length;
}

const missing = [];
const outOfRange = [];
let checked = 0;

for (const document of markdownFiles(REPO).sort()) {
  const lines = readFileSync(document, 'utf8').split('\n');

  lines.forEach((line, index) => {
    for (const match of line.matchAll(CITATION)) {
      const [, citedPath, rawStart, rawEnd] = match;
      if (citedPath.startsWith('node_modules/')) continue;

      const target = resolveTarget(document, citedPath);
      const where = `${relative(REPO, document)}:${index + 1}`;

      if (target === undefined) {
        missing.push(`  ${where} → ${citedPath} (el fichero no existe)`);
        continue;
      }

      checked += 1;
      const start = Number(rawStart);
      const end = rawEnd === undefined ? start : Number(rawEnd);
      const total = lineCount(target);

      if (start < 1 || start > end || end > total) {
        outOfRange.push(`  ${where} → ${citedPath}:${rawStart}${rawEnd ? `-${rawEnd}` : ''} (el fichero tiene ${total} líneas)`);
      }
    }
  });
}

process.stdout.write(`citas comprobadas: ${checked}\n`);
process.stdout.write('(las citas a node_modules/ se saltan: su ruta real depende del gestor de paquetes)\n');

if (missing.length > 0) {
  process.stdout.write(`\nficheros citados que no existen (${missing.length}):\n${missing.join('\n')}\n`);
}

if (outOfRange.length > 0) {
  process.stdout.write(`\ncitas fuera de rango (${outOfRange.length}):\n${outOfRange.join('\n')}\n`);
}

if (missing.length > 0 || outOfRange.length > 0) {
  process.stdout.write('\nUn README es la única copia del porqué en este repo. Una cita rota no es documentación vieja: es la única fuente del contexto, mintiendo.\n');
  process.exit(1);
}

process.stdout.write('ninguna cita se sale de su fichero\n');
