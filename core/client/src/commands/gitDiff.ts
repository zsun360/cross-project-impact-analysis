import {commands, window, workspace, OutputChannel } from 'vscode';
import {Methods, GitDiffParams, GitDiffResult} from '../protocol';
import {getClient} from '../utils/lspClientApi';

export function registerGitDiffCommand(output: OutputChannel) {
	commands.registerCommand('impact.gitDiff', async () => {
		const client = getClient();
		const folder = workspace.workspaceFolders?.[0];

		if (!folder) {
			window.showErrorMessage("No workspace folder.");
			return;
		}

		const params: GitDiffParams = {
			workspaceRoot: folder.uri.fsPath
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
	});
}