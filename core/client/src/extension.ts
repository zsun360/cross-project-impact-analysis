import {
  window,
  ExtensionContext,
  OutputChannel,
  Uri,
  ExtensionMode
} from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import * as fs from 'fs';

import { setClient } from './utils/lspClientApi';
import { registerCommands } from './commands/register';
import {registerGitDiffCommand} from './commands/gitDiff';

let client: LanguageClient;
let output: OutputChannel;

export async function activate(context: ExtensionContext) {
  const isDev = context.extensionMode === ExtensionMode.Development;

  const build = context.extension?.packageJSON?.version ?? 'dev';

  output = window.createOutputChannel("Impact");

  // The server is implemented in node
  const serverModule = Uri.joinPath(
    context.extensionUri, '..', 'server', 'out', 'server.js'
  ).fsPath;

  // 加一个存在性检查
  if (!fs.existsSync(serverModule)) {
    output.appendLine(`Server entry not found: ${serverModule}`);
    window.showErrorMessage(`Server entry not found: ${serverModule}`);
    return;
  }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'], // 没有 --inspect，VS Code 没法 attach
      }
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "typescript" }, { scheme: "file", language: "javascript" }, { scheme: "file", language: "python" }],
    initializationOptions: { debug: isDev, build },
    synchronize: { configurationSection: 'impact' },
  };

  // Start the client. This will also launch the server
  client = new LanguageClient(
    "impactAnalysisServer",
    "Impact Analysis Server",
    serverOptions,
    clientOptions
  );

  // Start the client and expose it to Webview commands
  await client.start();
  context.subscriptions.push(client);

  setClient(client);

  // Register commands (e.g., Impact: Show Import Graph)
  registerCommands(context, output);

  registerGitDiffCommand(output);

  // Optional: show ready info
  window.setStatusBarMessage('Impact Analysis: ready', 3000);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

