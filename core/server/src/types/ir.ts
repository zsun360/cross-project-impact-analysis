
export interface ModuleIR {
  file: string;                                   // absolute path
  lang: 'ts' | 'js' | 'py';
  imports: ImportEntry[];
  exports: ExportEntry[];                         
  meta: { parseMs: number; loc: number; cacheHit: boolean };
}

export interface ImportEntry {
  source: string;            // original import source（如 "./utils"、"../pkg/index"）
  specifiers: string[];      // ['A','B'] 或 ['default'] 或 ['*']（py）
  /**
 * Resolved absolute file path (if known).
 * - TS/JS: set when module specifier resolves to a workspace file
 * - Python: set when import resolves to a .py in workspace
 * - Others: optional
 */
  resolved?: string;
}

export interface ExportEntry {
  name: string;              // 导出名（default 也写 'default'）
  type: 'function' | 'class' | 'var' | 'default' | 'reexport';
  loc?: { line: number; column: number }; // added 2025-11-07 Optional
}