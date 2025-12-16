import * as cp from "child_process";
import type {DiffMode} from '../protocol';
import { diff } from 'util';

function buildDiffArgs(diffMode: DiffMode): string[] {
	const args = ["diff"];
	if (diffMode === "staged") {
		args.push("--cached");
	}
	return args;
}

export function getChangedFiles(
	workspaceRoot: string,
	diffMode: DiffMode = "working"
): string[] {
  try {
    const stdout = cp.execFileSync(
		"git",
		[...buildDiffArgs(diffMode), "--name-only"],
		{
			cwd: workspaceRoot,
			encoding: "utf8",
    	});
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function getFileDiff(
	workspaceRoot: string, 
	file: string,
	diffMode: DiffMode = 'working',
): string {
	try {
		const stdout = cp.execFileSync(
			"git",
			[...buildDiffArgs(diffMode), "--", file],
			{
				cwd: workspaceRoot,
				encoding: "utf8"
			});
		return stdout;
	} catch {
		return "";
	}
}
