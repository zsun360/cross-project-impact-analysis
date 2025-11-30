/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Stage 06 - Multi_Lang_AST_Import_Graph
 * - Supports language: 'auto' | 'python' | 'js' | 'ts'
 *   - 'auto' scans both Python (*.py) and JS/TS (*.js,*.jsx,*.ts,*.tsx)
 *   - Python parser: Python ast
 *   - JS/TS parser: ts-morph
 *
 * Notes:
 * - Nodes are file-level; node id is workspace-relative POSIX path for stable webview rendering.
 */

import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  TextDocuments,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { fileURLToPath } from 'url';

import { registerApi } from './api';
// -----------------------------------------------------------------------------
// LSP Boilerplate
// -----------------------------------------------------------------------------

const connection = createConnection(ProposedFeatures.all);
// new TextDocuments<TextDocument>(TextDocument)
const documents = new TextDocuments<TextDocument>(TextDocument);

let workspaceRootFsPath: string | undefined = undefined;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  // Capture workspace root for scanning
  if (params.rootUri) {
    try {
      workspaceRootFsPath = fileURLToPath(params.rootUri);
    } catch (err) {
      workspaceRootFsPath = params.rootPath ?? process.cwd();
    }
  } else {
    workspaceRootFsPath = params.rootPath ?? process.cwd();
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Add any other capabilities as needed
    }
  };
  return result;
});

connection.onInitialized(() => {
  connection.console.log('[impact] server initialized. workspaceRoot=' + (workspaceRootFsPath ?? 'N/A'));

});

  // new command call
  registerApi(connection);
// (Optional) wire up documents if you later want validations
documents.listen(connection);
connection.listen();
