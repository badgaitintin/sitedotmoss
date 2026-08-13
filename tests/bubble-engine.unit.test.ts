/**
 * Bubble Physics Engine — Extended Unit Test Suite
 * ─────────────────────────────────────────────────────────
 * ทดสอบ pure logic ของ AeroBubbleEngine.applyBoundaryBounce()
 * ซึ่งเป็น static method ที่ไม่ต้องใช้ DOM
 *
 * Run: npx vitest run tests/bubble-engine.unit.test.ts
 */

import { describe, it, expect } from "vitest";
import { AeroBubbleEngine } from "../src/lib/nextwbc/bubble-engine";

type BubbleSample = { x: number; y: number; vx: number; vy: number; size: number };

const W = 1920;
const H = 1080;
const D = 0.8; // damping

function makeBubble(overrides: Partial<BubbleSample> = {}): BubbleSample {
  return { x: 500, y: 400, vx: 2, vy: -1, size: 40, ...overrides };
}

// ════════════════════════════════════════════════════════════
// applyBoundaryBounce — Left Edge
// ════════════════════════════════════════════════════════════

describe("BoundaryBounce — Left Edge", () => {
  it("clamps x to 0 when bubble exits left", () => {
    const b = makeBubble({ x: -5, vx: -3 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.x).toBe(0);
  });

  it("vx becomes positive after left-edge bounce", () => {
    const b = makeBubble({ x: -5, vx: -3 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.vx).toBeGreaterThan(0);
  });

  it("vx = |vx| * damping + 0.6 after left bounce", () => {
    const b = makeBubble({ x: -1, vx: -10 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.vx).toBeCloseTo(10 * D + 0.6, 5);
  });

  it("y is unaffected by left-edge bounce", () => {
    const b = makeBubble({ x: -1, y: 300, vx: -5 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.y).toBe(300);
  });
});

// ════════════════════════════════════════════════════════════
// applyBoundaryBounce — Right Edge
// ════════════════════════════════════════════════════════════

describe("BoundaryBounce — Right Edge", () => {
  it("clamps x to screenW - size when bubble exits right", () => {
    const b = makeBubble({ x: W - 20, size: 40, vx: 5 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.x).toBe(W - 40);
  });

  it("vx becomes negative after right-edge bounce", () => {
    const b = makeBubble({ x: W - 20, size: 40, vx: 5 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.vx).toBeLessThan(0);
  });

  it("vx = -(|vx| * damping + 0.6) after right bounce", () => {
    const b = makeBubble({ x: W - 10, size: 40, vx: 8 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.vx).toBeCloseTo(-(8 * D + 0.6), 5);
  });
});

// ════════════════════════════════════════════════════════════
// applyBoundaryBounce — Top Edge
// ════════════════════════════════════════════════════════════

describe("BoundaryBounce — Top Edge", () => {
  it("clamps y to 0 when bubble exits top", () => {
    const b = makeBubble({ y: -10, vy: -4 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.y).toBe(0);
  });

  it("vy becomes positive after top-edge bounce", () => {
    const b = makeBubble({ y: -10, vy: -4 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.vy).toBeGreaterThan(0);
  });

  it("vy = |vy| * damping + 0.6 after top bounce", () => {
    const b = makeBubble({ y: -1, vy: -6 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.vy).toBeCloseTo(6 * D + 0.6, 5);
  });
});

// ════════════════════════════════════════════════════════════
// applyBoundaryBounce — Bottom Edge
// ════════════════════════════════════════════════════════════

describe("BoundaryBounce — Bottom Edge", () => {
  it("clamps y to screenH - size when bubble exits bottom", () => {
    const b = makeBubble({ y: H - 20, size: 40, vy: 5 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.y).toBe(H - 40);
  });

  it("vy becomes negative after bottom-edge bounce", () => {
    const b = makeBubble({ y: H - 20, size: 40, vy: 5 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.vy).toBeLessThan(0);
  });
});

// ════════════════════════════════════════════════════════════
// applyBoundaryBounce — In-bounds (no modification)
// ════════════════════════════════════════════════════════════

describe("BoundaryBounce — Fully In-Bounds", () => {
  it("no modification when bubble is entirely within bounds", () => {
    const b = makeBubble({ x: 100, y: 200, vx: 2, vy: -3, size: 40 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.x).toBe(100);
    expect(b.y).toBe(200);
    expect(b.vx).toBe(2);
    expect(b.vy).toBe(-3);
  });

  it("bubble touching left edge (x=0) is NOT re-clamped (edge is valid position)", () => {
    const b = makeBubble({ x: 0, vx: 3 }); // moving right, at left edge — no bounce needed
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    // x=0 does not trigger bounce (condition is x < 0)
    expect(b.x).toBe(0);
    expect(b.vx).toBe(3); // unchanged
  });
});

// ════════════════════════════════════════════════════════════
// applyBoundaryBounce — Corner Cases
// ════════════════════════════════════════════════════════════

describe("BoundaryBounce — Corners & Special Cases", () => {
  it("handles top-left corner: both x and y out of bounds", () => {
    const b = makeBubble({ x: -5, y: -5, vx: -3, vy: -4 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(b.vy).toBeGreaterThan(0);
  });

  it("handles bottom-right corner", () => {
    const b = makeBubble({ x: W - 10, y: H - 10, size: 40, vx: 5, vy: 5 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.x).toBe(W - 40);
    expect(b.y).toBe(H - 40);
    expect(b.vx).toBeLessThan(0);
    expect(b.vy).toBeLessThan(0);
  });

  it("handles zero damping (elastic collision, no energy loss)", () => {
    const b = makeBubble({ x: -5, vx: -10 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, 0);
    // vx = |vx| * 0 + 0.6 = 0.6
    expect(b.vx).toBeCloseTo(0.6, 5);
  });

  it("handles damping > 1 (energized bounce)", () => {
    const b = makeBubble({ x: -5, vx: -5 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, 1.5);
    // vx = |vx| * 1.5 + 0.6 = 8.1
    expect(b.vx).toBeCloseTo(5 * 1.5 + 0.6, 5);
  });

  it("tiny bubble (size=1) bounces at correct position", () => {
    const b = makeBubble({ x: W - 0.5, size: 1, vx: 3 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.x).toBe(W - 1);
  });

  it("very large bubble (size=1000) clamps correctly even if larger than screen", () => {
    const b = makeBubble({ x: W - 500, size: 1000, vx: 5 });
    AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    expect(b.x).toBe(W - 1000);
    expect(b.vx).toBeLessThan(0);
  });
});

// ════════════════════════════════════════════════════════════
// Simulation: Multi-step physics consistency
// ════════════════════════════════════════════════════════════

describe("BoundaryBounce — Multi-step Simulation", () => {
  it("bubble eventually stays in bounds after multiple bounces", () => {
    const b = makeBubble({ x: -50, y: -50, vx: -20, vy: -15 });

    for (let frame = 0; frame < 100; frame++) {
      // Apply velocity
      b.x += b.vx;
      b.y += b.vy;
      // Apply damping
      b.vx *= 0.94;
      b.vy *= 0.94;
      // Bounce
      AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    }

    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeLessThanOrEqual(W - b.size);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeLessThanOrEqual(H - b.size);
  });

  it("bubble velocity converges toward 0 due to damping", () => {
    const b = makeBubble({ x: 100, y: 100, vx: 50, vy: 50 });

    for (let frame = 0; frame < 200; frame++) {
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.94;
      b.vy *= 0.94;
      AeroBubbleEngine.applyBoundaryBounce(b, W, H, D);
    }

    // After 200 frames of 0.94 damping: 50 * 0.94^200 ≈ ~0
    expect(Math.abs(b.vx)).toBeLessThan(0.1);
    expect(Math.abs(b.vy)).toBeLessThan(0.1);
  });
});
