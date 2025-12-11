import * as fs from 'fs';
import * as path from 'path';

import type {PredictionInput} from '../../../../llm/llm-types';
// import type {ModuleIR} from '../../types/ir';

export interface BuildPredictionInputParams {
	workspaceRoot: string;
	filePath: string; // Absolute path or relative path to the workspace.
	// Later we can add a property: moduleIR ? ModuleIR | null;
}

export function buildPredictionInput(
	params: BuildPredictionInputParams
): PredictionInput {
	const {workspaceRoot, filePath} = params;
	const absPath = path.isAbsolute(filePath)
	? filePath
	: path.join(workspaceRoot, filePath);

	let codeContext = '';
	try {
		const content = fs.readFileSync(absPath, 'utf8');
		// Stage 1: To avoid overly long prompts, 
		// truncate the text to the first 4,000 characters.
		const MAX_LEN = 4000;
		codeContext = content.length > MAX_LEN ? content.slice(0, MAX_LEN) : content;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (err) {
		// When reading the file fails, do not throw an exception; 
		// just leave the context empty.
		codeContext = '';
	}

	// Provide an empty array initially when function-level diff is unavailable.
	// After we have the call graph or diff, we can populate actual changedFunctions.
	const changedFunctions: string[] = [];
	
	return {
		filePath: absPath,
		codeContext,
		changedFunctions,
	};
}