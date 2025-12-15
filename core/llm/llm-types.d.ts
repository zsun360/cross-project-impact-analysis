export interface ChangedBlob {
  path: string;
  chunks: string[]; // every element is a chunk(begin with @@)
}

export interface ChangedSet {
  blobs: ChangedBlob[];
}

export interface PredictionInput {  
  changedSet?: ChangedSet;

  // optional, kept for backward compatibility
  changedFiles?: string[];
  codeContext?: string;
  changedFunctions?: string[];
}

export interface PredictionResult {  
  riskScore: number; // 0 - 1  
  reasons: string[];  
  suggestedTests: string[];  
}