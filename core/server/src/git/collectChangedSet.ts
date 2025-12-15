import {getChangedFiles, getFileDiff} from './getDiffs';
import {ChangedSet, ChangedBlob} from '../../../llm/llm-types';

/**
 * split unified raw diff into chunks(begin with @@)
 * light parse at the moment: no ast, not function identification 
 * @param result of git diff ${file}
 * @returns 
 */
function splitDiffIntoChunks(diff: string): string[] {
	// Only keep the part starting from the first @@ 
	// (ignoring the diff --git / index / --- / +++ headers).
	const firstChunkIdx = diff.search(/^@@/m);
	if (firstChunkIdx < 0) {return [];}

	const body = diff.slice(firstChunkIdx);
	// Use each chunk header as a split point and keep the @@ .
	const parts = body.split(/(?=^@@)/m).map(s => s.trim()).filter(Boolean);
	return parts;
}

export function collectChangedSet(
	workspaceRoot: string, 
	opts: {maxFiles?:number; maxChunksPerFile?: number;maxCharsPerChunk?:number} = {}
): ChangedSet {
	const {
		maxFiles = 20,
		maxChunksPerFile = 10,
		maxCharsPerChunk = 1200,
	} = opts;

	const changed = getChangedFiles(workspaceRoot).slice(0, maxFiles);

	const blobs: ChangedBlob[] = [];

	for (const relPath of changed) {
		const raw = getFileDiff(workspaceRoot, relPath);
		if (!raw || raw.trim().length === 0) {continue;}

		const chunks = splitDiffIntoChunks(raw);
		
		if (chunks.length === 0) {continue;}
		// maximum chunks per file
		chunks.slice(0, maxChunksPerFile).map(ch => 
			ch.length > maxCharsPerChunk ? ch.slice(0, maxCharsPerChunk) + "\n...<truncated>": ch
		);

		blobs.push({'path': relPath, 'chunks': chunks});
	}
	return {blobs};
}

