import type {
  PredictionInput,
  PredictionResult
} from "../../../llm/llm-types";

export async function predictRiskMock(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  input: PredictionInput
): Promise<PredictionResult> {
  // Here, we can return a fixed result first, and then gradually enrich it later.
  return {
    riskScore: 0,
    reasons: [
      "LLM prediction module is not installed (public/mock version)."
    ],
    suggestedTests: []
  };
}
