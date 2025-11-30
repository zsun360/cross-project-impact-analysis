// Main entry point: multi-lang AST analysis + caching + aggregated metrics

import fg from 'fast-glob';

import { parseTSFile } from './parse_ts';
import { parsePyFile } from './parse_py';
import { getCached, setCached } from './cache';
import type { ModuleIR } from './types/ir';

export interface AnalyzeStats {
	total: number;
	parsed: number;
	cached: number;
	timeMs: number;
}

/**
 * Analyze project and return a list of ModuleIR (TS/JS/PY),
 * using AST-based parsers and an in-memory cache.
 *
 * This is Stage 06 core: multi-lang + AST.
 */
export async function analyzeProject(
	root: string,
	maxFiles = 200
): Promise<{ modules: ModuleIR[]; stats: AnalyzeStats }> {
	const files = await fg(
		['**/*.{ts,tsx,js,jsx,py}'],
		{
			cwd: root,
			absolute: true,
			ignore: [
				'**/node_modules/**',
				'**/.git/**',
				'**/.idea/**',
				'**/.vscode/**',
				'**/dist/**',
				'**/out/**',
				'**/build/**'
			]
		}
	);

	const limit = Math.max(1, Math.min(maxFiles, files.length));
	const target = files.slice(0, limit);

	const modules: ModuleIR[] = [];
	const stats: AnalyzeStats = {
		total: files.length,
		parsed: 0,
		cached: 0,
		timeMs: 0
	};

	const start = Date.now();

	for (const f of target) {
		try {
			// 1) try cache
			const cached = getCached(f);
			if (cached) {
				modules.push(cached);
				stats.cached += 1;
				continue;
			}

			// 2) parse via proper AST
			let ir: ModuleIR;
			if (f.endsWith('.py')) {
				ir = await parsePyFile(f, root);
			} else {
				// ts / tsx / js / jsx 都走 ts-morph
				ir = await parseTSFile(f);
			}

			setCached(f, ir);
			modules.push(ir);
			stats.parsed += 1;
		} catch (err) {
			// 最小侵入：静默跳过坏文件，避免影响整体结果
			// 如果需要日志，可以在这里加 console.log
			console.log('[analyzeProject] Failed for', f, err);
		}
	}

	stats.timeMs = Date.now() - start;
	return { modules, stats };
}
