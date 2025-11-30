import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { getClient } from '../utils/lspClientApi';
import { Methods, SymbolGraphParams, SymbolGraphResult } from '../protocol';

// Webview host with message bridge

/**
+ * GraphPanel (Stage 05)
+ * - Keeps ready-handshake
+ * - Adds safe 'openInEditor' handling: only open when id resolves to an existing local file
+*/

export class GraphPanel {
  public static current: GraphPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private _readyResolve!: () => void;
  private _readyPromise: Promise<void>;
  private output: vscode.OutputChannel;
  public isDisposed = false;

  static show(context: vscode.ExtensionContext, output: vscode.OutputChannel) {
    const column = vscode.ViewColumn.Beside;
    if (GraphPanel.current) {
      GraphPanel.current.panel.reveal(column);
      return GraphPanel.current;
    }

    const webroot = vscode.Uri.joinPath(context.extensionUri, 'src', 'webview');
    output.appendLine(`Current webroot is --> ${webroot}.`);
    const panel = vscode.window.createWebviewPanel(
      'impactGraph',
      'Impact — Import Graph',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        // (Optional) narrow this to the webview folder if you like:
        // Use context.extensionUri with Uri.joinPath — not extensionPath 
        // Modern & cross-platform: extensionUri is the canonical root. Uri.joinPath handles separators and URI schemes correctly (Windows/Unix, remote, virtual FS).
        // Future-proof: extensionPath is the old string API; it’s kept for compatibility but the recommended pattern is URI-based.
        localResourceRoots: [webroot]
      }
    );

    GraphPanel.current = new GraphPanel(panel, context, output);
    return GraphPanel.current;
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, output: vscode.OutputChannel) {
    this.panel = panel;
    this.output = output;
    this._readyPromise = new Promise<void>(res => (this._readyResolve = res));

    const base = vscode.Uri.joinPath(
      context.extensionUri, 'src', 'webview');

    const htmlPath = vscode.Uri.joinPath(base, 'graph.html');

    // 加一个存在性检查
    if (!fs.existsSync(htmlPath.fsPath)) {
      vscode.window.showErrorMessage(`HTML entry not found: ${htmlPath}`);
      return;
    }

    let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

    const cytoPath = vscode.Uri.joinPath(base, 'vendor', 'cytoscape.min.js');
    const graphJsPath = vscode.Uri.joinPath(base, 'graph.js');

    const cytoJsUri = this.panel.webview.asWebviewUri(cytoPath);
    const graphJsUri = this.panel.webview.asWebviewUri(graphJsPath);

    html = html
      .replace(/\{\{cspSource\}\}/g, this.panel.webview.cspSource)
      .replace(/\{\{cytoJsUri\}\}/g, String(cytoJsUri))
      .replace(/\{\{graphJsUri\}\}/g, String(graphJsUri))
      ;

    this.panel.webview.html = html;

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (this.isDisposed) { return; }

      switch (msg?.type) {
        case 'ready':
          this._readyResolve();
          this.output.appendLine('[GraphPanel] Webview is ready.');
          break;
        case 'drill': {

          const id = msg.payload?.id;
          if (!id) { return; }

          // 假设 id 是 workspace 相对路径：用 workspaceFolders[0] 拼绝对路径
          const folder = vscode.workspace.workspaceFolders?.[0];
          if (!folder) { return; }
          const workspaceRoot = folder?.uri.fsPath ?? '';
          const abs = path.isAbsolute(id)
            ? id
            : path.join(workspaceRoot, id);

          // 这里直接调用 LSP 的 symbolGraph
          try {
            const client = getClient();
            const params: SymbolGraphParams = { file: abs, workspaceRoot };
            this.output.appendLine(`[GraphPanel] SymbolGraph in ${abs}. params =>>> ${JSON.stringify(params)}`);
            const res = await client.sendRequest<SymbolGraphResult>(Methods.SymbolGraph, params);

            this.output.appendLine(`[GraphPanel] SymbolGraph in ${abs}. res =>>> ${JSON.stringify(res)}`);
            // 把结果回传给 webview，type 使用清晰前缀
            this.postMessage({ type: 'symbolGraph:render', payload: res });
          } catch (err) {
            this.output.appendLine(`[GraphPanel] SymbolGraph error for ${abs}. err =>>> ${String(err)}`);
          }

          return;   // 用 return 不用 break
        }

        /*
      case 'openInEditor':
        if (msg?.payload?.id) {
          const fileUri = vscode.Uri.file(msg.payload.id);
          const fsPath = fileUri.fsPath;
          if (fsPath && path.isAbsolute(fsPath) && fs.existsSync(fsPath)) {
            try {
              const uri = vscode.Uri.file(fsPath);;
              const doc = await vscode.workspace.openTextDocument(fileUri);
              await vscode.window.showTextDocument(doc, { preview: true });
            } catch (err) {
              this.output.appendLine(`[openInEditor:error] : ${fsPath}. Error: ${err}`);
              vscode.window.showErrorMessage(`Failed to open file: ${fsPath}`);
            }
          } else {
            // Demo-friendly: do not throw, just inform gently.
            this.output.appendLine(`[openInEditor:skip] Not a real file path or does not exist: ${fileUri}`);
            vscode.window.showInformationMessage('Demo node (no local file to open)');
          }
        }
        break;
        */
        case 'openSymbol': {
          const { file, loc } = msg.payload || {};
          if (!file || !loc) {
            return;
          }

          try {
            const doc = await vscode.workspace.openTextDocument(
              vscode.Uri.file(file)
            );
            const editor = await vscode.window.showTextDocument(doc, {
              preview: false,
            });

            // loc.line 通常是 1-based，自行根据 parse_ts 里写法调整
            const line = Math.max(0, (loc.line ?? 1) - 1);
            const col = Math.max(0, loc.column ?? 0);

            const pos = new vscode.Position(line, col);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(
              new vscode.Range(pos, pos),
              vscode.TextEditorRevealType.InCenter
            );
          } catch (err) {
            this.output.appendLine(
              `[GraphPanel] openSymbol failed for ${file}: ${String(err)}`
            );
          }
          return;
        }

        case 'export:result': {
          const kind = msg?.payload?.kind;
          const uri = await vscode.window.showSaveDialog({
            filters: kind === 'png' ? { PNG: ['png'] } : { SVG: ['svg'] },
            saveLabel: 'Save Graph'
          });
          if (!uri) { break; }

          if (kind === 'png') {
            // data:image/png;base64,XXXXX
            const base64 = String(msg.payload.dataUrl).split(',')[1] ?? '';
            const buf = Buffer.from(base64, 'base64');
            await vscode.workspace.fs.writeFile(uri, buf);
          } else {
            const svg = String(msg.payload.svg || '');
            await vscode.workspace.fs.writeFile(uri, Buffer.from(svg, 'utf8'));
          }
          vscode.window.showInformationMessage('Graph exported.');
          break;
        }

        case 'log':
          if (msg?.payload?.message) {
            this.output.appendLine(`[Webview] ${msg.payload.message}`);
          }
          break;
      }
    }, null, this.disposables);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  async whenReady() {
    await this._readyPromise;
  }

  postMessage(message: unknown) {
    this.panel.webview.postMessage(message);
  }

  public exportPng() {
    // 发消息给 webview，让它自己用 cy.png() 导出
    this.postMessage({ type: 'export:png' });
  }

  // 这个方法是用来销毁整个面板（由 VS Code 框架触发时调用的）
  dispose() {
    this.isDisposed = true; // 标记为已销毁
    GraphPanel.current = undefined;
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  // 注册“当面板销毁时做某事”的监听器
  public onDispose(listener: () => void) {
    this.panel.onDidDispose(listener, null, this.disposables);
  }
}
