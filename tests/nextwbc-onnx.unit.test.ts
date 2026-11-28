/**
 * NextWBC — ONNX Backend Unit Test Suite
 * ─────────────────────────────────────────────────────────
 * Tests the pure inference helpers of the client-side ONNX backend
 * (the ones that do not need a canvas or ONNX Runtime):
 *   1. Default ONNX Configuration
 *   2. Letterbox Geometry
 *   3. Output Decoding (cx, cy, w, h + class scores)
 *   4. Per-class Non-Maximum Suppression
 *   5. Letterbox Scale-back
 *   6. Model Class Name → WbcClass Mapping
 *
 * Run: npx vitest run tests/nextwbc-onnx.unit.test.ts
 */

import { describe, it, expect } from 'vitest';

import {
	WbcClass,
	WBC_CLASSES,
	DEFAULT_ONNX_INFERENCE_CONFIG,
	type BBox,
} from '../src/lib/nextwbc/nextwbc-types';

import { OnnxRuntimeBackend, ORT_SCRIPT_URL } from '../src/lib/nextwbc/onnx-backend';

// ── Test helpers ─────────────────────────────────────────────
/** Build a channel-major [1, channels, anchors] output tensor from one array per channel. */
function makeOutput(channels: number[][]): number[] {
	const anchors = channels[0].length;
	const data: number[] = new Array(channels.length * anchors);
	channels.forEach((channel, c) => channel.forEach((v, i) => { data[c * anchors + i] = v; }));
	return data;
}

/** Compose a detection quickly. */
function det(x1: number, y1: number, x2: number, y2: number, confidence: number, classIndex = 0) {
	return { bbox: { x1, y1, x2, y2 } as BBox, confidence, classIndex };
}

// ═══════════════════════════════════════════════════════════
// 1. DEFAULT ONNX CONFIGURATION
// ═══════════════════════════════════════════════════════════

describe('ONNX Inference Config Defaults', () => {
	it('serves the model from the site root as best.onnx', () => {
		expect(DEFAULT_ONNX_INFERENCE_CONFIG.modelUrl).toBe('/best.onnx');
	});

	it('uses the 640x640 input the model was exported with', () => {
		expect(DEFAULT_ONNX_INFERENCE_CONFIG.inputSize).toBe(640);
	});

	it('lists the 6 class names in the model output order', () => {
		expect(DEFAULT_ONNX_INFERENCE_CONFIG.classNames).toEqual([
			'basophils', 'eosinophils', 'heterophils', 'lymphocytes', 'monocytes', 'thrombocytes',
		]);
	});

	it('uses the Ultralytics default predict thresholds', () => {
		expect(DEFAULT_ONNX_INFERENCE_CONFIG.confThreshold).toBe(0.25);
		expect(DEFAULT_ONNX_INFERENCE_CONFIG.iouThreshold).toBe(0.7);
		expect(DEFAULT_ONNX_INFERENCE_CONFIG.maxDetections).toBe(300);
	});

	it('every default class name resolves to a distinct WbcClass', () => {
		const resolved = DEFAULT_ONNX_INFERENCE_CONFIG.classNames.map((name, i) =>
			OnnxRuntimeBackend.toWbcClass(name, i));
		expect(new Set(resolved).size).toBe(WBC_CLASSES.length);
	});
});

describe('OnnxRuntimeBackend Construction', () => {
	it('uses default config when no options provided', () => {
		const backend = new OnnxRuntimeBackend();
		expect(backend.modelUrl).toBe(DEFAULT_ONNX_INFERENCE_CONFIG.modelUrl);
	});

	it('merges custom config over defaults', () => {
		const backend = new OnnxRuntimeBackend({ modelUrl: '/models/custom.onnx' });
		expect(backend.modelUrl).toBe('/models/custom.onnx');
	});
});

describe('ONNX Runtime Web Loader', () => {
	it('points at the pinned UMD bundle on jsDelivr', () => {
		expect(ORT_SCRIPT_URL).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@\d+\.\d+\.\d+\/dist\/ort\.min\.js$/);
	});
});

// ═══════════════════════════════════════════════════════════
// 2. LETTERBOX GEOMETRY
// ═══════════════════════════════════════════════════════════

describe('OnnxRuntimeBackend.letterbox', () => {
	it('leaves a square image untouched (gain 1, no padding)', () => {
		expect(OnnxRuntimeBackend.letterbox(640, 640, 640)).toEqual({
			gain: 1, width: 640, height: 640, padX: 0, padY: 0,
		});
	});

	it('letterboxes a wide image with top/bottom padding', () => {
		expect(OnnxRuntimeBackend.letterbox(1600, 900, 640)).toEqual({
			gain: 0.4, width: 640, height: 360, padX: 0, padY: 140,
		});
	});

	it('letterboxes a tall image with left/right padding', () => {
		expect(OnnxRuntimeBackend.letterbox(900, 1600, 640)).toEqual({
			gain: 0.4, width: 360, height: 640, padX: 140, padY: 0,
		});
	});

	it('upscales a small image to fill the input (Ultralytics scaleup=True)', () => {
		expect(OnnxRuntimeBackend.letterbox(320, 240, 640)).toEqual({
			gain: 2, width: 640, height: 480, padX: 0, padY: 80,
		});
	});

	it('splits odd padding with the smaller share first', () => {
		// 1280x609 → 640x305 → 335 px of padding → 167 top / 168 bottom
		expect(OnnxRuntimeBackend.letterbox(1280, 609, 640)).toEqual({
			gain: 0.5, width: 640, height: 305, padX: 0, padY: 167,
		});
	});

	it('always keeps the resized image inside the square input', () => {
		const sizes = [[1920, 1080], [1080, 1920], [623, 623], [1, 5000], [5000, 1], [801, 600]];
		for (const [w, h] of sizes) {
			const box = OnnxRuntimeBackend.letterbox(w, h, 640);
			expect(box.width + 2 * box.padX).toBeLessThanOrEqual(640);
			expect(box.height + 2 * box.padY).toBeLessThanOrEqual(640);
			expect(box.width).toBeGreaterThan(0);
			expect(box.height).toBeGreaterThan(0);
			expect(Math.abs(w * box.gain - box.width)).toBeLessThan(1);
			expect(Math.abs(h * box.gain - box.height)).toBeLessThan(1);
		}
	});
});

// ═══════════════════════════════════════════════════════════
// 3. OUTPUT DECODING
// ═══════════════════════════════════════════════════════════

describe('OnnxRuntimeBackend.decodeOutput', () => {
	// [1, 4 + 2 classes, 8 anchors] — the trailing zero anchors never clear the threshold
	const data = makeOutput([
		[100, 50, 300, 400, 0, 0, 0, 0],   // cx
		[200, 50, 300, 400, 0, 0, 0, 0],   // cy
		[40, 10, 20, 20, 0, 0, 0, 0],      // w
		[60, 20, 20, 20, 0, 0, 0, 0],      // h
		[0.9, 0.2, 0.1, 0.5, 0, 0, 0, 0],  // class 0 score
		[0.1, 0.8, 0.2, 0.5, 0, 0, 0, 0],  // class 1 score
	]);
	const dims = [1, 6, 8];

	it('converts cx, cy, w, h into corner coordinates', () => {
		const out = OnnxRuntimeBackend.decodeOutput(data, dims, 0.25);
		expect(out[0]).toEqual(det(80, 170, 120, 230, 0.9, 0));
	});

	it('picks the highest scoring class per anchor', () => {
		const out = OnnxRuntimeBackend.decodeOutput(data, dims, 0.25);
		expect(out[1]).toEqual(det(45, 40, 55, 60, 0.8, 1));
	});

	it('drops anchors whose best score is below the confidence threshold', () => {
		const out = OnnxRuntimeBackend.decodeOutput(data, dims, 0.25);
		// anchor 2 (best 0.2) and the zero anchors are gone; 0, 1 and 3 remain
		expect(out).toHaveLength(3);
		expect(out.some((d) => d.bbox.x1 === 290)).toBe(false);
	});

	it('keeps an anchor exactly at the threshold', () => {
		const out = OnnxRuntimeBackend.decodeOutput(data, dims, 0.5);
		// 0.9 and 0.8 clear it comfortably; 0.5 sits right on it and is kept
		expect(out.map((d) => d.confidence)).toEqual([0.9, 0.8, 0.5]);
	});

	it('raises the bar with a stricter threshold', () => {
		expect(OnnxRuntimeBackend.decodeOutput(data, dims, 0.85)).toHaveLength(1);
		expect(OnnxRuntimeBackend.decodeOutput(data, dims, 0.95)).toHaveLength(0);
	});

	it('resolves equal scores to the lower class index', () => {
		const out = OnnxRuntimeBackend.decodeOutput(data, dims, 0.25);
		expect(out[2]).toEqual(det(390, 390, 410, 410, 0.5, 0));
	});

	it('reads a float32 tensor the way ONNX Runtime hands it over', () => {
		const tensor = Float32Array.from(data);
		const out = OnnxRuntimeBackend.decodeOutput(tensor, dims, 0.25);
		expect(out).toHaveLength(3);
		expect(out[0].confidence).toBeCloseTo(0.9, 5);
		expect(out[0].bbox).toEqual({ x1: 80, y1: 170, x2: 120, y2: 230 });
	});

	it('throws on an output shape that is not [1, 4 + classes, anchors]', () => {
		// [1, 300, 6] is what an end-to-end (nms=True) export produces
		expect(() => OnnxRuntimeBackend.decodeOutput(data, [1, 300, 6], 0.25)).toThrow(/Unexpected model output shape \[1, 300, 6\]/);
		expect(() => OnnxRuntimeBackend.decodeOutput(data, [1, 4, 8], 0.25)).toThrow(/Unexpected model output shape/);
		expect(() => OnnxRuntimeBackend.decodeOutput(data, [1, 6, 8, 1], 0.25)).toThrow(/Unexpected model output shape/);
	});

	it('returns nothing when no anchor clears the threshold', () => {
		expect(OnnxRuntimeBackend.decodeOutput(new Float32Array(7 * 16), [1, 7, 16], 0.25)).toEqual([]);
	});
});

// ═══════════════════════════════════════════════════════════
// 4. NON-MAXIMUM SUPPRESSION
// ═══════════════════════════════════════════════════════════

describe('OnnxRuntimeBackend.nonMaxSuppression', () => {
	// A and B overlap with IoU ≈ 0.68
	const a = det(0, 0, 10, 10, 0.9, 0);
	const b = det(1, 1, 11, 11, 0.8, 0);
	const c = det(1, 1, 11, 11, 0.7, 1);

	it('keeps a lower-confidence box when the overlap stays within the threshold', () => {
		const out = OnnxRuntimeBackend.nonMaxSuppression([b, a], 0.7);
		expect(out).toHaveLength(2);
	});

	it('suppresses a lower-confidence box of the same class once the overlap is too high', () => {
		const out = OnnxRuntimeBackend.nonMaxSuppression([b, a], 0.5);
		expect(out).toEqual([a]);
	});

	it('is class-aware: the same overlap in another class survives', () => {
		const out = OnnxRuntimeBackend.nonMaxSuppression([b, a, c], 0.5);
		expect(out).toEqual([a, c]);
	});

	it('returns survivors by descending confidence', () => {
		const out = OnnxRuntimeBackend.nonMaxSuppression([det(100, 100, 110, 110, 0.3), det(200, 200, 210, 210, 0.95), det(300, 300, 310, 310, 0.6)], 0.5);
		expect(out.map((d) => d.confidence)).toEqual([0.95, 0.6, 0.3]);
	});

	it('only drops boxes whose IoU is strictly greater than the threshold', () => {
		const twinA = det(0, 0, 10, 10, 0.9, 0);
		const twinB = det(0, 0, 10, 10, 0.8, 0);
		expect(OnnxRuntimeBackend.nonMaxSuppression([twinA, twinB], 1.0)).toHaveLength(2);
		expect(OnnxRuntimeBackend.nonMaxSuppression([twinA, twinB], 0.99)).toHaveLength(1);
	});

	it('handles an empty list', () => {
		expect(OnnxRuntimeBackend.nonMaxSuppression([], 0.7)).toEqual([]);
	});
});

// ═══════════════════════════════════════════════════════════
// 5. LETTERBOX SCALE-BACK
// ═══════════════════════════════════════════════════════════

describe('OnnxRuntimeBackend.scaleToImage', () => {
	const box = OnnxRuntimeBackend.letterbox(1600, 900, 640); // gain 0.4, padY 140

	it('maps the full letterboxed image back onto the original size', () => {
		expect(OnnxRuntimeBackend.scaleToImage({ x1: 0, y1: 140, x2: 640, y2: 500 }, box, 1600, 900))
			.toEqual({ x1: 0, y1: 0, x2: 1600, y2: 900 });
	});

	it('is the inverse of the letterbox for an inner box', () => {
		const inner = { x1: 100, y1: 200, x2: 300, y2: 400 };
		const expected = {
			x1: (100 - box.padX) / box.gain,
			y1: (200 - box.padY) / box.gain,
			x2: (300 - box.padX) / box.gain,
			y2: (400 - box.padY) / box.gain,
		};
		expect(OnnxRuntimeBackend.scaleToImage(inner, box, 1600, 900)).toEqual(expected);
	});

	it('clips boxes that run into the padding or past the image edge', () => {
		expect(OnnxRuntimeBackend.scaleToImage({ x1: -10, y1: 100, x2: 700, y2: 520 }, box, 1600, 900))
			.toEqual({ x1: 0, y1: 0, x2: 1600, y2: 900 });
	});

	it('round-trips a letterboxed square input through any image size', () => {
		const sizes = [[1920, 1080], [623, 623], [480, 800]];
		for (const [w, h] of sizes) {
			const lb = OnnxRuntimeBackend.letterbox(w, h, 640);
			const scaled = OnnxRuntimeBackend.scaleToImage(
				{ x1: lb.padX, y1: lb.padY, x2: lb.padX + lb.width, y2: lb.padY + lb.height }, lb, w, h);
			expect(scaled.x1).toBe(0);
			expect(scaled.y1).toBe(0);
			expect(Math.abs(scaled.x2 - w)).toBeLessThan(1);
			expect(Math.abs(scaled.y2 - h)).toBeLessThan(1);
		}
	});
});

// ═══════════════════════════════════════════════════════════
// 6. MODEL CLASS NAME → WbcClass MAPPING
// ═══════════════════════════════════════════════════════════

describe('OnnxRuntimeBackend.toWbcClass', () => {
	it('maps the plural names embedded in best.onnx', () => {
		expect(OnnxRuntimeBackend.toWbcClass('basophils', 0)).toBe(WbcClass.Basophil);
		expect(OnnxRuntimeBackend.toWbcClass('eosinophils', 1)).toBe(WbcClass.Eosinophil);
		expect(OnnxRuntimeBackend.toWbcClass('heterophils', 2)).toBe(WbcClass.Heterophil);
		expect(OnnxRuntimeBackend.toWbcClass('lymphocytes', 3)).toBe(WbcClass.Lymphocyte);
		expect(OnnxRuntimeBackend.toWbcClass('monocytes', 4)).toBe(WbcClass.Monocyte);
		expect(OnnxRuntimeBackend.toWbcClass('thrombocytes', 5)).toBe(WbcClass.Thrombocyte);
	});

	it('accepts singular names and ignores case / surrounding spaces', () => {
		expect(OnnxRuntimeBackend.toWbcClass('heterophil', 0)).toBe(WbcClass.Heterophil);
		expect(OnnxRuntimeBackend.toWbcClass('  HETEROPHILS ', 0)).toBe(WbcClass.Heterophil);
	});

	it('falls back to the class order when the name is unknown', () => {
		expect(OnnxRuntimeBackend.toWbcClass('unknown_class', 2)).toBe(WBC_CLASSES[2]);
		expect(OnnxRuntimeBackend.toWbcClass('', 5)).toBe(WBC_CLASSES[5]);
	});

	it('defaults an out-of-range class index to Heterophil, like the Gradio parser', () => {
		expect(OnnxRuntimeBackend.toWbcClass('unknown_class', 99)).toBe(WbcClass.Heterophil);
	});
});
