import { Connection } from 'vscode-languageserver';
import { Methods, RunParams, RunResult, SymbolGraphParams, SymbolGraphResult, SymbolNode, SymbolEdge } from './protocol';
import { analyzeProject } from './analyzer';
import { parseTSFile } from './parse_ts';
import { parsePyFile } from './parse_py';
import * as path from 'path';

export function registerApi(connection: Connection) {
  console.log('[server] api.ts registerApi(): registering RunAnalysis');
  connection.onRequest<RunResult, RunParams>(
    Methods.RunAnalysis,
    async (params) => {
      console.log(`[server] api.ts registerApi(): params =>>> ${JSON.stringify(params)}`);
      const { root, maxFiles } = params;
      const { modules, stats } = await analyzeProject(root, maxFiles);

      console.log(`[server] api.ts registerApi(): modules =>>> ${JSON.stringify(modules)} stats =>>> ${JSON.stringify(stats)}`);

      return { modules, stats, workspaceRoot: root };
    }
  );

  // --- NEW: 单文件符号图 ---
  connection.onRequest<SymbolGraphResult, SymbolGraphParams>(
    Methods.SymbolGraph,
    async (params) => {
      const file = params.file;
      console.log('[server] SymbolGraph called for', file);

      const ext = path.extname(file).toLowerCase();
      let mod;
      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
        mod = await parseTSFile(file, params.workspaceRoot);
      } else if (ext === '.py') {
        mod = await parsePyFile(file, params.workspaceRoot);
      } else {
        return { file, nodes: [], edges: [] };
      }

      const nodes: SymbolNode[] = (mod.exports || []).map((e, i) => ({
        id: `${e.type}:${e.name || i}`,
        name: e.name,
        kind: e.type,
        loc: e.loc, // 没有就 undefined
      }));

      const edges: SymbolEdge[] = []; // 先留空，占位，后面可以加调用/引用关系

      return { file, nodes, edges, workspaceRoot: params.workspaceRoot };
    }
  );
}
