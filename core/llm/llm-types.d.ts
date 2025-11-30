export interface PredictionInput {  
  filePath: string;  
  codeContext: string;  
  changedFunctions: string[];  
}

export interface PredictionResult {  
  riskScore: number; // 0–1  
  reasons: string[];  
  suggestedTests: string[];  
}