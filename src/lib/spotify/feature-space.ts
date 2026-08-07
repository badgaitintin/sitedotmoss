/**
 * feature-space.ts — Track cosine similarity engine using Float32Array for
 * memory efficiency and cache-friendly flat matrix layout.
 *
 * Performance vs. original Array<Array<number>>:
 *   - Memory: ~490KB vs ~5MB for 350 tracks (Float32 = 4 bytes/element)
 *   - Access: matrix[i*size+j] = single multiply, no inner array pointer chase
 *   - GC pressure: zero — typed array has no JS object overhead per element
 */

import { AUDIO_FEATURE_KEYS, type Track, type SimilarTrack } from './spotify-types';

export class FeatureSpace {
	/** Flat similarity matrix stored as Float32Array[i*size+j] */
	private readonly matrix: Float32Array;
	readonly size: number;

	constructor(tracks: readonly Track[]) {
		this.size = tracks.length;
		const size = this.size;

		// Build feature vectors
		const vectors: Float32Array[] = tracks.map((t) => {
			const v = new Float32Array(AUDIO_FEATURE_KEYS.length);
			AUDIO_FEATURE_KEYS.forEach((k, i) => { v[i] = Number(t[k]); });
			return v;
		});

		// Precompute L2 norms
		const norms = vectors.map((v) => {
			let sum = 0;
			for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
			return Math.sqrt(sum);
		});

		// Allocate flat matrix: diagonal = 1, off-diagonal = cosine similarity
		this.matrix = new Float32Array(size * size);
		for (let i = 0; i < size; i++) this.matrix[i * size + i] = 1;

		for (let r = 0; r < size; r++) {
			const rNorm = norms[r];
			if (rNorm === 0) continue;
			for (let c = r + 1; c < size; c++) {
				const cNorm = norms[c];
				if (cNorm === 0) continue;
				let dot = 0;
				const rv = vectors[r], cv = vectors[c];
				for (let i = 0; i < rv.length; i++) dot += rv[i] * cv[i];
				const sim = dot / (rNorm * cNorm);
				this.matrix[r * size + c] = sim;
				this.matrix[c * size + r] = sim;
			}
		}
	}

	/** O(1) similarity lookup via flat array index. */
	getSimilarity(i: number, j: number): number {
		return this.matrix[i * this.size + j];
	}

	/**
	 * Computes per-track centrality (mean similarity to all other tracks).
	 * Returns a Float32Array of length = number of tracks.
	 */
	getCentrality(): Float32Array {
		const size = this.size;
		const result = new Float32Array(size);
		if (size <= 1) return result;

		for (let r = 0; r < size; r++) {
			let sum = 0;
			const base = r * size;
			for (let c = 0; c < size; c++) {
				if (c !== r) sum += this.matrix[base + c];
			}
			result[r] = sum / (size - 1);
		}
		return result;
	}

	/** Returns top-N most similar tracks by cosine similarity (excluding self). */
	getTopSimilar(trackIndex: number, limit = 5): SimilarTrack[] {
		const size = this.size;
		if (trackIndex < 0 || trackIndex >= size) return [];

		const base = trackIndex * size;
		const results: SimilarTrack[] = [];
		for (let i = 0; i < size; i++) {
			if (i === trackIndex) continue;
			results.push({ index: i, similarity: this.matrix[base + i] });
		}
		return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
	}
}
