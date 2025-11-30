// Define a graph model to be used in the frontend.
export interface GraphNode {
	id: string;
	lang?: 'js' | 'ts' | 'py' | string;
}

export interface GraphModel {
	nodes: GraphNode[];
	edges: { source: string; target: string }[];
	stats: { files: number; edges: number; parsed: number; cached: number; timeMs: number };
	workspaceRoot?: string;
}

