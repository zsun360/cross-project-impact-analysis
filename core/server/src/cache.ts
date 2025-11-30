// a cache that uses hashing for indexing
import fs from "fs";
import crypto from "crypto";
import {ModuleIR} from "./types/ir";

const mem = new Map<string, {hash: string; ir: ModuleIR }>();

function hashFile(file: string) {
	const buf = fs.readFileSync(file);
	return crypto.createHash("md5").update(buf).digest("hex");
}

export function getCached(file: string): ModuleIR | null {
	const h = hashFile(file);
	const c = mem.get(file);
	if (c && c.hash === h) {
		c.ir.meta.cacheHit = true;
		return c.ir;
	}
	return null;
}

export function setCached(file: string, ir: ModuleIR) {
	mem.set(file, {hash: hashFile(file), ir});
}
