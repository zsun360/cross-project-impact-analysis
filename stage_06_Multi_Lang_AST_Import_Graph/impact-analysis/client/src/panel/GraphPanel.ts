import * as vscode from 'vscode';
import * as fs from 'fs';

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
      switch (msg?.type) {
        case 'ready':
          this._readyResolve();
          this.output.appendLine('[GraphPanel] Webview is ready.');
          break;
        case 'drill':
          this.output.appendLine(`[GraphPanel] Drill request for id: ${msg?.payload?.id ?? ''}`);
          vscode.window.showInformationMessage(`Drill: ${msg?.payload?.id ?? ''}`);
          break;
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
        case 'export:edges': {
          vscode.window.showInformationMessage(
            "Exported " + msg.payload.length + " edges"
          );

          // optional: save to file
          const uri = await vscode.window.showSaveDialog({
            filters: { JSON: ["json"] },
            saveLabel: "Save Dependency edges JSON"
          });

          if (uri) {
            await vscode.workspace.fs.writeFile(
              uri,
              Buffer.from(JSON.stringify(msg.payload, null, 2))
            );
            vscode.window.showInformationMessage("Saved to: " + uri.fsPath);
          }
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
