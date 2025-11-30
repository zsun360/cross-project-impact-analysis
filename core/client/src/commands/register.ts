import {
  commands,
  ExtensionContext,
  window,
  OutputChannel,
  workspace,
  RelativePattern,
  Uri,
} from 'vscode';
import * as path from 'path';

import { Methods, RunParams, RunResult } from '../protocol';
import { getClient } from '../utils/lspClientApi';
import { GraphPanel } from '../panel/GraphPanel';
import { GraphModel } from '../types/graph';
import { ModuleIR, ImportEntry } from '../types/ir';

export function registerCommands(
  context: ExtensionContext,
  output: OutputChannel
) {
  const out = output;

  context.subscriptions.push(
    commands.registerCommand('impact.runAnalysis', async () => {
      const client = getClient();
      const folder = workspace.workspaceFolders?.[0];

      if (!folder) {
        window.showErrorMessage('No workspace opened.');
        return;
      }

      const root = folder.uri.fsPath;
      const maxFiles = workspace
        .getConfiguration('impact')
        .get<number>('maxFiles', 200);

      const panel = GraphPanel.current ?? GraphPanel.show(context, out);
      await panel.whenReady?.();

      const analyzeAndRender = async () => {
        try {
          const params: RunParams = { root, maxFiles };
          const res = await client.sendRequest<RunResult>(
            Methods.RunAnalysis,
            params
          );

          console.log(`[client] register.ts registerCommands() res =>>> ${JSON.stringify(res)}`);

          const graphModel = toGraphModel(res, root);
          const payload = toWebviewPayload(graphModel);

          panel.postMessage({ type: 'render:graph', payload });

          window.setStatusBarMessage(
            `parsed=${graphModel.stats.parsed}, edges=${graphModel.stats.edges}`,
            1500
          );
        } catch (err) {
          console.error('[impact] analysis failed', err);
          window.showErrorMessage(
            '[Impact] analysis failed. See Output for details.'
          );
        }
      };

      await analyzeAndRender();

      // ---- watcher: re analyze in realtime ----
      const pattern = new RelativePattern(
        folder,
        '**/*.{ts,tsx,js,jsx,py}'
      );
      const watcher = workspace.createFileSystemWatcher(
        pattern,
        false,
        false,
        false
      );

      const shouldIgnore = (uri: Uri) => {
        const p = uri.fsPath.replace(/\\/g, '/').toLowerCase();
        return (
          p.includes('/node_modules/') ||
          p.includes('/.git/') ||
          p.includes('/dist/') ||
          p.includes('/out/')
        );
      };

      const debounced = debounce(async (uri?: Uri) => {
        if (uri && shouldIgnore(uri)) { return; }
        if ((panel).isDisposed) { return; }
        await analyzeAndRender();
      }, 800);

      watcher.onDidCreate(debounced);
      watcher.onDidChange(debounced);
      watcher.onDidDelete(debounced);

      panel.onDispose?.(() => watcher.dispose());
      context.subscriptions.push(watcher);
    })
  );

  context.subscriptions.push(
    commands.registerCommand(
      'impact.exportGraphPng',
      async () => {
        const panel = GraphPanel.current;
        if (!panel) {
          window.showErrorMessage(
            'No Impact graph to export. Please open the Impact — Import Graph view first.'
          );
          return;
        }

        panel.exportPng();
      }
    )
  );

}

/**
 * 用统一规则把 ModuleIR[] 转成 GraphModel
 * - file / resolved: 一律视为绝对路径
 */
function toGraphModel(res: RunResult, root: string): GraphModel {
  const modules: ModuleIR[] = (res.modules || []) as ModuleIR[];

  // 统一规范：所有内部比较用“规范化绝对路径”
  const toAbs = (p: string): string =>
    path.normalize(path.isAbsolute(p) ? p : path.resolve(root, p));

  const toId = (abs: string): string =>
    path.relative(root, abs).replace(/\\/g, '/');

  // 1) 收集文件 -> 节点 id
  const fileToId = new Map<string, string>();

  for (const m of modules) {
    if (!m.file) { continue; }
    const abs = toAbs(m.file);
    fileToId.set(abs, toId(abs));
  }

  const hasId = (abs: string) => fileToId.has(toAbs(abs));

  // 2) 基于 resolved / 相对路径构建边
  const edgeKeys = new Set<string>();

  for (const m of modules) {
    if (!m.file) { continue; }

    const fromAbs = toAbs(m.file);
    const fromId = fileToId.get(fromAbs);
    if (!fromId) { continue; }

    const imports: ImportEntry[] = m.imports || [];

    for (const im of imports) {
      let targetAbs: string | undefined;

      // ① 优先使用统一的 resolved（Python / TS / JS / etc）
      if (im.resolved) {
        const candAbs = toAbs(im.resolved);
        if (candAbs !== fromAbs && hasId(candAbs)) {
          targetAbs = candAbs;
        }
      }

      // ② 无 resolved 时，仅兜底处理 ./ ../（兼容旧逻辑）
      if (!targetAbs && im.source) {
        const s = im.source;
        if (s.startsWith('./') || s.startsWith('../')) {
          const candAbs = toAbs(path.resolve(path.dirname(fromAbs), s));
          if (candAbs !== fromAbs && hasId(candAbs)) {
            targetAbs = candAbs;
          }
        }
      }

      if (!targetAbs) { continue; }

      const toIdVal = fileToId.get(toAbs(targetAbs));
      if (!toIdVal || toIdVal === fromId) { continue; }

      edgeKeys.add(`${fromId}|${toIdVal}`);
    }
  }

  // 3) 生成节点 / 边数组
  const nodes = Array.from(fileToId.entries()).map(([abs, id]) => {
    // 找到对应 module 的 lang
    const mod = modules.find((m) => m.file && toAbs(m.file) === abs);
    const lang = mod?.lang ?? 'unknown';
    return { id, lang };
  });

  const edges = Array.from(edgeKeys).map((key) => {
    const [source, target] = key.split('|');
    return { source, target };
  });

  const s = (res).stats || {};

  return {
    nodes,
    edges,
    stats: {
      files: nodes.length,
      edges: edges.length,
      parsed: s.parsed ?? modules.length,
      cached: s.cached ?? 0,
      timeMs: s.timeMs ?? 0,
    },
    workspaceRoot: root
  };
}

function basename(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] || id;
}

export interface GraphNodeView {
  id: string;
  label: string;
  path: string;
}

/**
 * Webview 需要的 payload
 */
function toWebviewPayload(graph: GraphModel) {
  const payload = {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: basename(n.id),
      path: n.id,
      lang: n.lang,
    })),
    edges: graph.edges,
    meta: {
      stats: graph.stats
    },
    workspaceRoot: graph.workspaceRoot
  };

  console.log(`[client][webview] payload =>>> ${JSON.stringify(payload)}`);

  return payload;
}

/** 强类型防抖 */
function debounce<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  ms = 400
) {
  let h: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Args): void => {
    if (h) { clearTimeout(h); }
    h = setTimeout(() => {
      fn(...args);
    }, ms);
  };

  debounced.cancel = (): void => {
    if (h) {
      clearTimeout(h);
      h = undefined;
    }
  };

  debounced.flush = (...args: Args): R => {
    if (h) {
      clearTimeout(h);
      h = undefined;
    }
    return fn(...args);
  };

  return debounced as ((...args: Args) => void) & {
    cancel(): void;
    flush(...args: Args): R;
  };
}
