// JSON-RPC method name constants to prevent errors from manually typing strings.
import type { ModuleIR } from './types/ir';

export const Methods = {
  RunAnalysis: 'impact/runAnalysis',
  SymbolGraph: 'impact/symbolGraph',
} as const;

export interface RunParams {
  root: string;
  maxFiles: number;
}

export interface RunResult {
  modules: ModuleIR[];
  stats: { total: number; parsed: number; cached: number; timeMs: number };
  workspaceRoot?: string
}
 
export interface SymbolGraphParams {
  file: string; // absolute path
  workspaceRoot?: string;
}

export interface SymbolNode {
  id: string;   // unique ID
  name: string;
  kind: 'function' | 'class' | 'var' | 'default' | 'reexport';
  loc?: { line: number; column: number }; // 可选，后面慢慢补
}

export interface SymbolEdge {
  source: string;
  target: string;
  kind: 'ref' | 'call' | 'use';
}

export interface SymbolGraphResult {
  file: string;
  nodes: SymbolNode[];
  edges: SymbolEdge[];
  workspaceRoot?: string
}