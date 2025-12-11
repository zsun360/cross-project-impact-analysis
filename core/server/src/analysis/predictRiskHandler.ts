
import * as path from 'path';

import {buildPredictionInput} from './prediction/buildPredictionInput';
import {predictWithLLM} from '../llm/provider';
import type {PredictRiskParams, 
	PredictRiskResult, 
	FileRisk} from '../protocol';

export async function handlePredictRisk(
	params: PredictRiskParams
): Promise<PredictRiskResult> {
	const workspaceRoot = params.workspaceRoot && params.workspaceRoot.length > 0
	? params.workspaceRoot : process.cwd();
	
	const items: FileRisk[] = [];

	for (const f of params.changedFiles ?? []) {
		const absPath = path.isAbsolute(f) ? f : path.join(workspaceRoot, f);

		const input = buildPredictionInput({
			workspaceRoot, 
			filePath: absPath
			// later can be moduleIr info.
		});

		const result = await predictWithLLM(input);
		items.push({
			filePath: absPath,
			riskScore: result.riskScore,
			reasons: result.reasons,
			suggestedTests: result.suggestedTests,
		});
	}

	return {items};
}