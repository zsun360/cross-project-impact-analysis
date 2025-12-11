import type {
  PredictionInput,
  PredictionResult
} from "../../../llm/llm-types";
import { predictRiskMock } from "./mockPredictor";

// Type definition of LLM provider
export type LLMProvider = (input: PredictionInput) => Promise<PredictionResult>;

// The provider currently in use (defaults a mock implementation).
let currentProvider: LLMProvider = predictRiskMock;

/**
 * Invoked externally to replace the current provider 
 * with a real LLM implementation.
 */
export function registerLLMProvider(provider: LLMProvider) {
  currentProvider = provider;
}

/**
 * get the current provider.(for internal use)
 */
export function getCurrentLLMProvider():LLMProvider {
  return currentProvider;
}

/**
 * Unified external API entry point.
 * All server components inovke this function instead of others, avoiding 
 * direct dependencies on concrete LLM implementations.
 * @param input 
 * @returns 
 */
export async function predictWithLLM(
  input: PredictionInput
): Promise<PredictionResult> {
  const provider = getCurrentLLMProvider();
  return provider(input);
}


