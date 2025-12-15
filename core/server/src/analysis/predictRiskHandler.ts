
// import * as path from 'path';

import {predictWithLLM} from '../llm/provider';
import { collectChangedSet } from '../git/collectChangedSet';
import { PredictionInput } from '../../../llm/llm-types';
import type {PredictRiskParams, 
	PredictRiskResult,
} from '../protocol';

export async function handlePredictRisk(
	params: PredictRiskParams
): Promise<PredictRiskResult> {
	const workspaceRoot = params.workspaceRoot && params.workspaceRoot.length > 0
	? params.workspaceRoot : process.cwd();

	const changedSet = collectChangedSet(workspaceRoot, {
		maxFiles: 20,
		maxChunksPerFile: 10,
		maxCharsPerChunk: 1200,
	});

	const input: PredictionInput = {
		changedSet,
	};

	const result = await predictWithLLM(input);
	 
	return {
		riskScore: result.riskScore,
		reasons: result.reasons,
		suggestedTests: result.suggestedTests,
	};
}