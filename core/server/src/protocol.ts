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
  changedFiles: string[]; // Stage 1: We only pass one active file
}

export interface FileRisk {
  filePath: string;
  riskScore: number;
  reasons: string[];
  suggestedTests: string[];
}

export interface PredictRiskResult {
  items: FileRisk[];
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
  file: string;
  workspaceRoot?: string;
}

export interface SymbolNode {
  id: string;
  name: string;
  kind: 'function' | 'class' | 'var' | 'default' | 'reexport';
  loc?: { line: number; column: number };
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