import type {
  PredictionInput,
  PredictionResult
} from "../../../llm/llm-types";

export async function predictRiskMock(
   
  input: PredictionInput
): Promise<PredictionResult> {
 
  const fileCount = input.changedSet?.blobs.length ?? 0;
  const chunkCount = input.changedSet?.blobs.reduce((acc, f) => acc + f.chunks.length, 0) ?? 0;

  return {
    riskScore: fileCount === 0 ? 0.0:Math.min(0.2 + fileCount * 0.08 + chunkCount * 0.02, 0.9),
    reasons: [
      "Mock prediction (public repository).",
      `Changed files: ${fileCount}`,
      `Total chunks: ${chunkCount}`,
    ],
    suggestedTests: [
      "Run targeted unit tests for modified modules.",
      "Run a quick smoke test flow.",
    ]
  };
}
