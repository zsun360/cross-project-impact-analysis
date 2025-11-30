import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import { ImportEntry, ModuleIR, ExportEntry } from './types/ir';

const SCRIPT_PATH = path.resolve(__dirname, '..', '..', 'scripts', 'py_imports.py');

interface PythonImportRaw {
  source: string;
  specifiers: string[];
}

interface PythonExportRaw {
  name: string;
  type: 'function' | 'class' | 'var';
  loc?: { line: number; column: number };
}

export async function parsePyFile(file: string, workspaceRoot: string): Promise<ModuleIR> {
  const start = Date.now();

  const proc = cp.spawnSync('python', [SCRIPT_PATH, file], {
    encoding: 'utf8',
  });

  if (proc.status !== 0 || !proc.stdout) {
    return {
      file,
      lang: 'py',
      imports: [],
      exports: [],
      meta: { parseMs: Date.now() - start, loc: 0, cacheHit: false },
    };
  }

  console.log('from *parse_py.ts* [server][py] result from py_imports.py =>>> ', proc.stdout);

  const payload = JSON.parse(proc.stdout);

  const rawImports: PythonImportRaw[] = payload.imports || [];

  const imports: ImportEntry[] = rawImports.map((imp) => {
    const source = imp.source || '';
    const specs = imp.specifiers || [];

    const resolved = resolvePythonImport(
      payload.file || file,
      workspaceRoot,
      source,
      specs
    );

    return {
      source,
      specifiers: specs,
      resolved,
    };
  });

  const rawExports: PythonExportRaw[] = payload.exports || [];

  const exports: ExportEntry[] = rawExports.map((e) => ({
    name: e.name,
    type: e.type,
    loc: e.loc,
  }));

  const loc = (payload.meta && payload.meta.loc) || 0;

  console.log('from *parse_py.ts* [server][py] imports exports ', JSON.stringify({
    file: payload.file || file,
    imports: imports,
    exports: exports,
  })
  );

  return {
    file: payload.file || file,
    lang: 'py',
    imports,
    exports,
    meta: {
      parseMs: Date.now() - start,
      loc,
      cacheHit: false,
    },
  };
}

function resolvePythonImport(
  fromFile: string,
  workspaceRoot: string,
  source: string,
  specifiers: string[]
): string | undefined {
  const root = workspaceRoot || path.dirname(fromFile);
  const fromDir = path.dirname(fromFile);

  const candidates: string[] = [];

  // Helper: 给定一条 "pkg/submod" 的基路径，把可能的文件都 push 进去（绝对路径）
  const pushModuleCandidates = (base: string) => {
    const abs = path.resolve(base);
    candidates.push(abs + '.py');
    candidates.push(path.join(abs, '__init__.py'));
  };

  // 1) import pkg.submod / import utils
  if (source) {
    const parts = source.split('.');

    // 1.1 相对于 workspace 根（支持 fully-qualified 包名）
    pushModuleCandidates(path.join(root, ...parts));

    // 1.2 相对于当前文件目录（支持 "utils" 这种局部模块）
    pushModuleCandidates(path.join(fromDir, ...parts));
  }

  // 2) from pkg import submod
  if (source && specifiers.length) {
    const baseParts = source.split('.');

    for (const name of specifiers) {
      // 2.1 workspace 根
      pushModuleCandidates(path.join(root, ...baseParts, name));
      // 2.2 当前目录
      pushModuleCandidates(path.join(fromDir, ...baseParts, name));
    }
  }

  // 3) from . import utils / from .pkg import submod
  if (!source && specifiers.length) {
    for (const name of specifiers) {
      const rel = path.join(fromDir, name);
      pushModuleCandidates(rel);
    }
  }

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c; // 一律返回绝对路径
    }
  }

  return undefined;
}

