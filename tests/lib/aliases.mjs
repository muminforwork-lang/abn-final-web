/**
 * Test-only module resolution.
 *
 * The app uses the `@/*` path alias (see tsconfig.json). Node itself knows
 * nothing about it, so when the test runner imports a project module that
 * contains `import ... from '@/data/...'` it fails with
 * ERR_MODULE_NOT_FOUND.
 *
 * Rather than duplicating the alias map — which would silently drift out of
 * sync with tsconfig — this resolves `@/x` by reading `tsconfig.json` and
 * applying the very same mapping the bundler uses.
 *
 * Loaded via `--import` before the tests; see package.json.
 */

import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Strips // and /* *\/ comments from JSONC without touching string contents.
 * A naive regex cannot do this: it would corrupt values like
 * "https://nextjs.org" by treating the // inside the string as a comment.
 */
function stripJsonComments(source) {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inLine) {
      if (char === '\n') {
        inLine = false;
        out += char;
      }
      continue;
    }
    if (inBlock) {
      if (char === '*' && next === '/') {
        inBlock = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += char;
      if (char === '\\') {
        // Keep the escaped character verbatim so \" does not end the string.
        if (next !== undefined) {
          out += next;
          i += 1;
        }
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && next === '/') {
      inLine = true;
      i += 1;
    } else if (char === '/' && next === '*') {
      inBlock = true;
      i += 1;
    } else {
      out += char;
    }
  }
  return out;
}

/** Reads compilerOptions.paths from tsconfig.json and turns them into a map. */
function loadAliases() {
  const raw = readFileSync(path.join(projectRoot, 'tsconfig.json'), 'utf8');
  const { compilerOptions } = JSON.parse(stripJsonComments(raw));
  const paths = compilerOptions?.paths ?? {};
  const baseUrl = compilerOptions?.baseUrl ?? '.';
  const base = path.resolve(projectRoot, baseUrl);

  // "@/*": ["./src/*"]  →  [{ prefix: '@/', targets: ['<root>/src/'] }]
  return Object.entries(paths).map(([pattern, targets]) => {
    const prefix = pattern.replace(/\*$/, '');
    const resolved = (targets ?? []).map((target) =>
      path.resolve(base, String(target).replace(/\*$/, '')),
    );
    return { prefix, targets: resolved };
  });
}

const aliases = loadAliases();

function resolveAlias(specifier) {
  for (const { prefix, targets } of aliases) {
    if (!specifier.startsWith(prefix)) continue;
    const rest = specifier.slice(prefix.length);
    for (const target of targets) {
      const candidate = path.join(target, rest);
      // Match how the bundler resolves a missing extension.
      for (const attempt of [candidate, `${candidate}.ts`, `${candidate}.tsx`]) {
        try {
          readFileSync(attempt);
          return pathToFileURL(attempt).href;
        } catch {
          // try the next candidate
        }
      }
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = resolveAlias(specifier);
    if (mapped) return { url: mapped, shortCircuit: true };
    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    // Next.js lets `import data from './x.json'` work without an import
    // attribute. Node requires `with { type: 'json' }`, so supply it here
    // rather than editing application source to suit the test runner.
    if (url.endsWith('.json') && !context.importAttributes?.type) {
      return nextLoad(url, { ...context, importAttributes: { type: 'json' } });
    }
    return nextLoad(url, context);
  },
});
