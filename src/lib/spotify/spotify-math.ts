/**
 * spotify-math.ts — Pure math utility functions (no DOM, no side effects).
 * All functions are stateless and fully unit-testable.
 */

// ── Jacobi eigendecomposition for 3x3 symmetric matrices ─────────────────────

export interface EigenResult {
	eigenvalues: [number, number, number];
	eigenvectors: [[number, number, number], [number, number, number], [number, number, number]];
}

/**
 * Computes eigenvalues and eigenvectors of a 3×3 symmetric matrix
 * using the Jacobi iterative algorithm (up to 50 iterations).
 */
export function jacobi3x3(A: number[][]): EigenResult {
	const V: number[][] = [
		[1, 0, 0],
		[0, 1, 0],
		[0, 0, 1],
	];
	const d: [number, number, number] = [A[0][0], A[1][1], A[2][2]];
	const a: number[][] = [
		[A[0][0], A[0][1], A[0][2]],
		[A[1][0], A[1][1], A[1][2]],
		[A[2][0], A[2][1], A[2][2]],
	];

	for (let iter = 0; iter < 50; iter++) {
		let p = 0, q = 1;
		let maxVal = Math.abs(a[0][1]);
		if (Math.abs(a[0][2]) > maxVal) { p = 0; q = 2; maxVal = Math.abs(a[0][2]); }
		if (Math.abs(a[1][2]) > maxVal) { p = 1; q = 2; }
		if (Math.abs(a[p][q]) < 1e-9) break;

		const theta = 0.5 * (d[q] - d[p]) / a[p][q];
		let t = 1.0 / (Math.abs(theta) + Math.sqrt(1.0 + theta * theta));
		if (theta < 0) t = -t;
		const c = 1.0 / Math.sqrt(1.0 + t * t);
		const s = t * c;
		const tau = s / (1.0 + c);
		const h = t * a[p][q];

		d[p] -= h;
		d[q] += h;
		a[p][q] = 0;

		for (let i = 0; i < 3; i++) {
			if (i !== p && i !== q) {
				const g = a[i][p];
				const j = a[i][q];
				a[i][p] = c * g - s * j;
				a[i][q] = s * g + c * j;
				a[p][i] = a[i][p];
				a[q][i] = a[i][q];
			}
		}
		for (let i = 0; i < 3; i++) {
			const g = V[i][p];
			const j = V[i][q];
			V[i][p] = c * g - s * j;
			V[i][q] = s * g + c * j;
		}
	}

	return {
		eigenvalues: d,
		eigenvectors: V as EigenResult['eigenvectors'],
	};
}

// ── Ellipsoid mesh trace for Plotly ──────────────────────────────────────────

interface TrackedPoint {
	pc1: number;
	pc2: number;
	bias_score: number;
}

export interface EllipsoidTrace {
	type: 'mesh3d';
	x: number[];
	y: number[];
	z: number[];
	alphahull: number;
	opacity: number;
	color: string;
	showlegend: boolean;
	hoverinfo: string;
}

/**
 * Computes a Plotly mesh3d ellipsoid trace fitted to a cluster of tracks
 * using covariance-based PCA (Jacobi eigendecomposition).
 * Returns null if fewer than 3 tracks (degenerate case).
 */
export function getEllipsoidTrace(tracks: TrackedPoint[], color: string): EllipsoidTrace | null {
	if (tracks.length < 3) return null;

	// Compute mean
	const mean = [0, 0, 0];
	for (const t of tracks) {
		mean[0] += t.pc1;
		mean[1] += t.pc2;
		mean[2] += t.bias_score;
	}
	mean[0] /= tracks.length;
	mean[1] /= tracks.length;
	mean[2] /= tracks.length;

	// Compute covariance matrix
	const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
	for (const t of tracks) {
		const dx = t.pc1 - mean[0];
		const dy = t.pc2 - mean[1];
		const dz = t.bias_score - mean[2];
		cov[0][0] += dx * dx;
		cov[0][1] += dx * dy;
		cov[0][2] += dx * dz;
		cov[1][1] += dy * dy;
		cov[1][2] += dy * dz;
		cov[2][2] += dz * dz;
	}
	cov[1][0] = cov[0][1];
	cov[2][0] = cov[0][2];
	cov[2][1] = cov[1][2];
	const n = tracks.length;
	for (let r = 0; r < 3; r++)
		for (let c = 0; c < 3; c++)
			cov[r][c] /= n - 1;

	const { eigenvalues, eigenvectors } = jacobi3x3(cov);

	const scale = 1.6;
	const s0 = scale * Math.sqrt(Math.max(0, eigenvalues[0]));
	const s1 = scale * Math.sqrt(Math.max(0, eigenvalues[1]));
	const s2 = scale * Math.sqrt(Math.max(0, eigenvalues[2]));

	const uSteps = 15, vSteps = 15;
	const xArr: number[] = [], yArr: number[] = [], zArr: number[] = [];

	for (let i = 0; i <= uSteps; i++) {
		const theta = (i / uSteps) * 2 * Math.PI;
		for (let j = 0; j <= vSteps; j++) {
			const phi = (j / vSteps) * Math.PI;
			const ux = Math.cos(theta) * Math.sin(phi);
			const uy = Math.sin(theta) * Math.sin(phi);
			const uz = Math.cos(phi);
			const sx = ux * s0, sy = uy * s1, sz = uz * s2;
			xArr.push(mean[0] + eigenvectors[0][0] * sx + eigenvectors[0][1] * sy + eigenvectors[0][2] * sz);
			yArr.push(mean[1] + eigenvectors[1][0] * sx + eigenvectors[1][1] * sy + eigenvectors[1][2] * sz);
			zArr.push(mean[2] + eigenvectors[2][0] * sx + eigenvectors[2][1] * sy + eigenvectors[2][2] * sz);
		}
	}

	return { type: 'mesh3d', x: xArr, y: yArr, z: zArr, alphahull: 0, opacity: 0.08, color, showlegend: false, hoverinfo: 'skip' };
}

// ── General math utilities ────────────────────────────────────────────────────

/** Clamps a value between min and max (inclusive). */
export function clamp(val: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, val));
}

/** Normalizes an array of numbers to [0, 1] using min-max scaling. */
export function normalizeMinMax(values: number[]): number[] {
	const min = Math.min(...values);
	const max = Math.max(...values);
	if (max === min) return values.map(() => 0.5);
	return values.map(v => clamp((v - min) / (max - min), 0, 1));
}
