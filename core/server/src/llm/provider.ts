import type {
  PredictionInput,
  PredictionResult
} from "../../../llm/llm-types";
import { predictRiskMock } from "./mockPredictor";

// The provider currently in use defaults to a mock implementation.
let currentProvider: (
  input: PredictionInput
) => Promise<PredictionResult> = predictRiskMock;

/**
 * Invoked externally to replace the current provider 
 * with a real LLM implementation.
 */
export function registerLLMProvider(
  provider: (input: PredictionInput) => Promise<PredictionResult>
): void {
  // Defensive handling: avoid passing undefined/null to break the system
  if (provider) {
    currentProvider = provider;
  } else {
    currentProvider = predictRiskMock;
  }
}

/**
 * All LLM prediction calls inside the server go through this function.
 *
 * By default, it uses the mock.
 * If it is injected via registerLLMProvider,it uses the real LLM.
 */
export async function predictWithLLM(
  input: PredictionInput
): Promise<PredictionResult> {
  return currentProvider(input);
}

/**
 * export the current provider.
 */
export function getCurrentLLMProvider() {
  return currentProvider;
}
