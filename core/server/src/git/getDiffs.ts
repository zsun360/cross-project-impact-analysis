import * as cp from "child_process";
import * as path from "path";

export function getChangedFiles(workspaceRoot: string): string[] {
  try {
    const stdout = cp.execSync("git diff --name-only", {
      cwd: workspaceRoot,
      encoding: "utf8",
    });
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function getFileDiff(workspaceRoot: string, file: string): string {
	try {
		const stdout = cp.execSync(`git diff ${file}`, {
		cwd: workspaceRoot,
		encoding: "utf8"
	});
	return stdout;
	} catch {
		return "";
	}
}
