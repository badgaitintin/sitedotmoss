/**
 * Spotify Math — Extended Unit Test Suite
 * ─────────────────────────────────────────────────────────
 * ครอบคลุมฟังก์ชัน pure math ทั้งหมดใน spotify-math.ts:
 *  - clamp()
 *  - normalizeMinMax()
 *  - jacobi3x3()
 *  - getEllipsoidTrace()
 *
 * Run: npx vitest run tests/spotify-math.unit.test.ts
 */

import { describe, it, expect } from "vitest";
import { clamp, normalizeMinMax, jacobi3x3, getEllipsoidTrace } from "../src/lib/spotify/spotify-math";

// ════════════════════════════════════════════════════════════
// clamp()
// ════════════════════════════════════════════════════════════

describe("clamp()", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("returns min when value is below range", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(-100, -50, 50)).toBe(-50);
  });

  it("returns max when value is above range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(200, -50, 50)).toBe(50);
  });

  it("handles min === max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
    expect(clamp(1, 3, 3)).toBe(3);
  });

  it("handles negative ranges", () => {
    expect(clamp(-3, -10, -1)).toBe(-3);
    expect(clamp(0, -10, -1)).toBe(-1);
    expect(clamp(-20, -10, -1)).toBe(-10);
  });

  it("handles floating point values", () => {
    expect(clamp(0.5, 0, 1)).toBeCloseTo(0.5);
    expect(clamp(1.1, 0, 1)).toBeCloseTo(1.0);
    expect(clamp(-0.1, 0, 1)).toBeCloseTo(0.0);
  });
});

// ════════════════════════════════════════════════════════════
// normalizeMinMax()
// ════════════════════════════════════════════════════════════

describe("normalizeMinMax()", () => {
  it("normalizes [0, 5, 10] to [0, 0.5, 1]", () => {
    const result = normalizeMinMax([0, 5, 10]);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(1);
  });

  it("normalizes all-same values to 0.5", () => {
    const result = normalizeMinMax([7, 7, 7]);
    expect(result).toEqual([0.5, 0.5, 0.5]);
  });

  it("handles single-element array", () => {
    const result = normalizeMinMax([42]);
    expect(result[0]).toBe(0.5); // all-same edge case
  });

  it("handles negative values", () => {
    const result = normalizeMinMax([-10, 0, 10]);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(1);
  });

  it("clamps output to [0, 1]", () => {
    const result = normalizeMinMax([1, 2, 3, 4, 5]);
    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("preserves relative ordering", () => {
    const input = [3, 1, 4, 1, 5, 9, 2, 6];
    const result = normalizeMinMax(input);
    for (let i = 0; i < input.length; i++) {
      for (let j = 0; j < input.length; j++) {
        if (input[i] < input[j]) {
          expect(result[i]).toBeLessThanOrEqual(result[j]);
        }
      }
    }
  });
});

// ════════════════════════════════════════════════════════════
// jacobi3x3()
// ════════════════════════════════════════════════════════════

describe("jacobi3x3()", () => {
  it("correctly decomposes diagonal matrix", () => {
    const A = [[3, 0, 0], [0, 7, 0], [0, 0, 2]];
    const { eigenvalues } = jacobi3x3(A);
    const sorted = [...eigenvalues].sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(2, 4);
    expect(sorted[1]).toBeCloseTo(3, 4);
    expect(sorted[2]).toBeCloseTo(7, 4);
  });

  it("identity matrix has eigenvalues [1, 1, 1]", () => {
    const A = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const { eigenvalues } = jacobi3x3(A);
    for (const ev of eigenvalues) {
      expect(ev).toBeCloseTo(1, 4);
    }
  });

  it("returns 3 eigenvalues and 3x3 eigenvectors", () => {
    const A = [[4, 1, 0], [1, 3, 1], [0, 1, 2]];
    const { eigenvalues, eigenvectors } = jacobi3x3(A);
    expect(eigenvalues).toHaveLength(3);
    expect(eigenvectors).toHaveLength(3);
    expect(eigenvectors[0]).toHaveLength(3);
    expect(eigenvectors[1]).toHaveLength(3);
    expect(eigenvectors[2]).toHaveLength(3);
  });

  it("eigenvalues are all finite numbers", () => {
    const A = [[2, 1, 0], [1, 3, 1], [0, 1, 4]];
    const { eigenvalues } = jacobi3x3(A);
    for (const ev of eigenvalues) {
      expect(isFinite(ev)).toBe(true);
      expect(isNaN(ev)).toBe(false);
    }
  });

  it("handles symmetric matrix with off-diagonal elements", () => {
    const A = [[5, 2, 1], [2, 4, 3], [1, 3, 6]];
    const { eigenvalues } = jacobi3x3(A);
    // Trace = sum of eigenvalues = sum of diagonal elements
    const trace = A[0][0] + A[1][1] + A[2][2]; // 15
    const evSum = eigenvalues.reduce((s, v) => s + v, 0);
    expect(evSum).toBeCloseTo(trace, 3);
  });

  it("eigenvectors matrix is approximately orthogonal (V^T * V ≈ I)", () => {
    const A = [[4, 1, 0], [1, 3, 1], [0, 1, 2]];
    const { eigenvectors: V } = jacobi3x3(A);

    // Check V^T * V ≈ I (columns are orthonormal)
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let dot = 0;
        for (let k = 0; k < 3; k++) {
          dot += V[k][i] * V[k][j];
        }
        if (i === j) {
          expect(dot).toBeCloseTo(1, 3);
        } else {
          expect(dot).toBeCloseTo(0, 3);
        }
      }
    }
  });
});

// ════════════════════════════════════════════════════════════
// getEllipsoidTrace()
// ════════════════════════════════════════════════════════════

describe("getEllipsoidTrace()", () => {
  const threePts = [
    { pc1: 1, pc2: 0, bias_score: 0 },
    { pc1: 0, pc2: 1, bias_score: 0 },
    { pc1: 0, pc2: 0, bias_score: 1 },
  ];

  it("returns null for fewer than 3 tracks", () => {
    expect(getEllipsoidTrace([], "#fff")).toBeNull();
    expect(getEllipsoidTrace([{ pc1: 0, pc2: 0, bias_score: 0 }], "#fff")).toBeNull();
    expect(getEllipsoidTrace([{ pc1: 0, pc2: 0, bias_score: 0 }, { pc1: 1, pc2: 1, bias_score: 1 }], "#fff")).toBeNull();
  });

  it("returns mesh3d trace for 3+ tracks", () => {
    const trace = getEllipsoidTrace(threePts, "#ff0000");
    expect(trace).not.toBeNull();
    expect(trace!.type).toBe("mesh3d");
  });

  it("passes through color correctly", () => {
    const colors = ["#ff0000", "#00ff00", "#0000ff", "rgba(255,0,0,0.5)"];
    for (const color of colors) {
      const trace = getEllipsoidTrace(threePts, color);
      expect(trace!.color).toBe(color);
    }
  });

  it("generates non-empty x, y, z arrays", () => {
    const trace = getEllipsoidTrace(threePts, "#fff");
    expect(trace!.x.length).toBeGreaterThan(0);
    expect(trace!.y.length).toBeGreaterThan(0);
    expect(trace!.z.length).toBeGreaterThan(0);
    expect(trace!.x.length).toBe(trace!.y.length);
    expect(trace!.y.length).toBe(trace!.z.length);
  });

  it("all x, y, z values are finite numbers", () => {
    const pts = [
      { pc1: 2.5, pc2: -1.2, bias_score: 8.0 },
      { pc1: -3.1, pc2: 2.7, bias_score: 7.5 },
      { pc1: 0.8, pc2: 0.3, bias_score: 9.2 },
      { pc1: 1.2, pc2: -0.5, bias_score: 8.8 },
    ];
    const trace = getEllipsoidTrace(pts, "#abc");
    for (const v of [...trace!.x, ...trace!.y, ...trace!.z]) {
      expect(isFinite(v)).toBe(true);
    }
  });

  it("opacity is 0.08 and showlegend is false", () => {
    const trace = getEllipsoidTrace(threePts, "#fff");
    expect(trace!.opacity).toBeCloseTo(0.08);
    expect(trace!.showlegend).toBe(false);
  });

  it("alphahull is 0", () => {
    const trace = getEllipsoidTrace(threePts, "#fff");
    expect(trace!.alphahull).toBe(0);
  });

  it("works with collinear points (degenerate covariance)", () => {
    const collinear = [
      { pc1: 1, pc2: 1, bias_score: 1 },
      { pc1: 2, pc2: 2, bias_score: 2 },
      { pc1: 3, pc2: 3, bias_score: 3 },
    ];
    // Should not throw even with degenerate (near-zero eigenvalue) covariance
    expect(() => getEllipsoidTrace(collinear, "#fff")).not.toThrow();
  });

  it("works with a large set of tracks (performance check)", () => {
    const bigPts = Array.from({ length: 500 }, (_, i) => ({
      pc1: Math.sin(i * 0.1),
      pc2: Math.cos(i * 0.1),
      bias_score: i * 0.02,
    }));
    const t0 = Date.now();
    const trace = getEllipsoidTrace(bigPts, "#000");
    const elapsed = Date.now() - t0;
    expect(trace).not.toBeNull();
    expect(elapsed).toBeLessThan(1000); // Should complete in < 1 second
  });
});
