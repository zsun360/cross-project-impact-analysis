// JSON-RPC method name constants to prevent errors from manually typing strings.
import type { ModuleIR } from './types/ir';

export const Methods = {
  RunAnalysis: 'impact/runAnalysis',
  SymbolGraph: 'impact/symbolGraph',
  PredictRisk: 'impact/predictRisk',
  GitDiff: 'impact/gitDiff',
};

export interface GitDiffParams {
  workspaceRoot: string;
}

export interface GitDiffFile {
  filePath: string;
  diff: string;
}

export interface GitDiffResult {
  files: GitDiffFile[];
}

export interface PredictRiskParams {
  workspaceRoot?: string;
}

export interface PredictRiskResult {
  riskScore: number;
  reasons: string[];
  suggestedTests: string[];
}

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