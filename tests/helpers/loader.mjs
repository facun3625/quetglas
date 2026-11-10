// Carga módulos TypeScript de src/ en un contexto aislado (alias @/ y rutas relativas) con stubs opcionales.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);

export function loader(stubs = {}) {
  const cache = new Map();
  function resolveFile(base) {
    for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) if (existsSync(candidate)) return candidate;
    throw new Error(`No se encontró ${base}`);
  }
  function loadFile(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const mod = { exports: {} };
    cache.set(file, mod);
    const req = (name) => {
      if (name in stubs) return stubs[name];
      if (name.startsWith('@/')) return loadFile(resolveFile(path.resolve('src', name.slice(2))));
      if (name.startsWith('.')) return loadFile(resolveFile(path.resolve(path.dirname(file), name)));
      return nodeRequire(name);
    };
    vm.runInThisContext(`(function(require, module, exports) {${code}\n})`)(req, mod, mod.exports);
    return mod.exports;
  }
  return (name) => loadFile(resolveFile(path.resolve('src', name.replace(/^@\//, ''))));
}
