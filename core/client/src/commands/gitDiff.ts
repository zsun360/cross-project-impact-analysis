import { commands, window, workspace, OutputChannel, ExtensionContext } from 'vscode';
import { Methods, GitDiffParams, GitDiffResult, DiffMode } from '../protocol';
import { getClient } from '../utils/lspClientApi';

export function registerGitDiffCommand(
	context: ExtensionContext,
	output: OutputChannel) {
	context.subscriptions.push(
		commands.registerCommand('impact.gitDiff', async () => {
			const client = getClient();
			const folder = workspace.workspaceFolders?.[0];

			if (!folder) {
				window.showErrorMessage("No workspace folder.");
				return;
			}

			const diffMode = workspace.getConfiguration("impact").get<DiffMode>('diffMode', 'staged');

			const params: GitDiffParams = {
				workspaceRoot: folder.uri.fsPath,
				diffMode,
			};

			const result = await client.sendRequest<GitDiffResult>(
				Methods.GitDiff,
				params
			);

			output.appendLine("=== Git Diff Demo ===");

			for (const f of result.files) {
				output.appendLine(`File: ${f.filePath}`);
				output.appendLine(f.diff);
				output.appendLine("");
			}

			output.show(true);
		}));
}