/**
 * NextWBC — ONNX Runtime Web Backend
 * ─────────────────────────────────────────────────────────
 * Client-side inference backend that runs the Ultralytics YOLO26n export
 * (`best.onnx`) through ONNX Runtime Web (WASM). Nothing leaves the browser:
 * load model → letterbox → run → decode → NMS → annotate.
 */

import type {
	BBox,
	DetectedCell,
	DetectionResult,
	OnnxInferenceConfig,
	WbcInferenceBackend,
} from './nextwbc-types';
import {
	WbcClass,
	WBC_CLASSES,
	WBC_CLASS_MAP,
	DEFAULT_ONNX_INFERENCE_CONFIG,
} from './nextwbc-types';

// ── ONNX Runtime Web loader ─────────────────────────────────
/** UMD bundle of ONNX Runtime Web; exposes `window.ort`. The page loads it via `<script>`. */
export const ORT_SCRIPT_URL =
	'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.min.js';
/** Folder holding the `.wasm` binaries that match `ORT_SCRIPT_URL`. */
const ORT_WASM_PATHS = ORT_SCRIPT_URL.slice(0, ORT_SCRIPT_URL.lastIndexOf('/') + 1);

// ── Model I/O contract (Ultralytics export) ─────────────────
const INPUT_NAME = 'images';
const OUTPUT_NAME = 'output0';

// ── Rendering constants ─────────────────────────────────────
/** Longest side of the annotated result image (keeps the data URL small). */
const MAX_RENDER_SIZE = 1280;
/** Side of the square cell crops (px). */
const CROP_SIZE = 64;
/** Margin around a cell box before cropping (fraction of the box's longest side). */
const CROP_MARGIN = 0.25;

// ── Minimal typings for the `ort` global (UMD bundle) ───────
interface OrtTensor {
	readonly data: Float32Array;
	readonly dims: readonly number[];
}

interface OrtSession {
	run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
}

interface OrtGlobal {
	InferenceSession: {
		create(model: ArrayBuffer, options?: { executionProviders: string[] }): Promise<OrtSession>;
	};
	Tensor: new (type: 'float32', data: Float32Array, dims: readonly number[]) => OrtTensor;
	env: { wasm: { wasmPaths: string } };
}

/** The global only exists once the CDN script has executed. */
function getOrt(): OrtGlobal {
	const ort = (globalThis as { ort?: OrtGlobal }).ort;
	if (!ort) {
		throw new Error('ONNX Runtime Web is not loaded. Check your connection, or switch to the HF Space API engine.');
	}
	return ort;
}

// ── Geometry types ──────────────────────────────────────────
/** Placement of an original image on the square model input (letterbox). */
export interface Letterbox {
	/** Uniform scale applied to the original image. */
	readonly gain: number;
	/** Resized image size, in model-input pixels. */
	readonly width: number;
	readonly height: number;
	/** Padding on the left/right (padX) and top/bottom (padY). */
	readonly padX: number;
	readonly padY: number;
}

/** One decoded detection: confidence + model class index, with a bbox in pixel space. */
export interface RawDetection {
	readonly bbox: BBox;
	readonly confidence: number;
	readonly classIndex: number;
}

/**
 * Backend running `best.onnx` (Ultralytics YOLO26n) in the browser with
 * ONNX Runtime Web. Satisfies the same `infer()` contract as
 * `GradioSpaceClient`, so the page can swap engines freely.
 *
 * The model is downloaded and initialised once, on first use, and the
 * session is reused for every following image.
 *
 * Usage (the page must load `ORT_SCRIPT_URL` first):
 * ```ts
 * const backend = new OnnxRuntimeBackend();
 * const result = await backend.infer(imageFile);
 * ```
 */
export class OnnxRuntimeBackend implements WbcInferenceBackend {
	private readonly config: OnnxInferenceConfig;
	private sessionPromise: Promise<OrtSession> | null = null;

	constructor(config: Partial<OnnxInferenceConfig> = {}) {
		this.config = { ...DEFAULT_ONNX_INFERENCE_CONFIG, ...config };
	}

	/** Getter for the configured model URL (useful for testing). */
	get modelUrl(): string {
		return this.config.modelUrl;
	}

	// ── Public API ────────────────────────────────────────────

	/**
	 * Full inference pipeline: load (once) → letterbox → run → decode → NMS → annotate.
	 * Calls the optional `onProgress` callback at each stage.
	 */
	async infer(
		file: File,
		onProgress?: (pct: number, status: string) => void,
	): Promise<DetectionResult> {
		const { inputSize } = this.config;
		const session = await this.getSession(onProgress);

		onProgress?.(75, 'Preparing image...');
		const image = await OnnxRuntimeBackend.loadImage(file);
		const letterbox = OnnxRuntimeBackend.letterbox(image.naturalWidth, image.naturalHeight, inputSize);
		const pixels = OnnxRuntimeBackend.buildTensor(image, letterbox, inputSize);

		onProgress?.(90, 'Running detection...');
		const feeds = { [INPUT_NAME]: new (getOrt()).Tensor('float32', pixels, [1, 3, inputSize, inputSize]) };
		const outputs = await session.run(feeds);
		const output = outputs[OUTPUT_NAME];
		if (!output) throw new Error(`Unexpected model output (expected "${OUTPUT_NAME}")`);

		// Decode + NMS in model-input space (IoU is unaffected by the letterbox),
		// then map the survivors back onto the original image.
		const detections = OnnxRuntimeBackend.decodeOutput(output.data, output.dims, this.config.confThreshold);
		const kept = OnnxRuntimeBackend.nonMaxSuppression(detections, this.config.iouThreshold)
			.slice(0, this.config.maxDetections)
			.map((det) => ({
				...det,
				bbox: OnnxRuntimeBackend.scaleToImage(det.bbox, letterbox, image.naturalWidth, image.naturalHeight),
			}));
		const classes = kept.map((det) =>
			OnnxRuntimeBackend.toWbcClass(this.config.classNames[det.classIndex] ?? '', det.classIndex));
		const { annotatedImage, crops } = OnnxRuntimeBackend.render(image, kept, classes);

		const classCounts = new Map<WbcClass, number>();
		for (const cls of WBC_CLASSES) classCounts.set(cls, 0);
		const cells: DetectedCell[] = kept.map((det, i) => {
			const cls = classes[i];
			classCounts.set(cls, (classCounts.get(cls) ?? 0) + 1);
			return { class: cls, confidence: det.confidence, bbox: det.bbox, cropBase64: crops[i] };
		});

		return { annotatedImage, totalCells: cells.length, classCounts, cells };
	}

	// ── Session lifecycle (private) ──────────────────────────

	/**
	 * Load the model (download + initialise) once and cache the session.
	 * A failed load is not cached, so the next call retries.
	 */
	private async getSession(onProgress?: (pct: number, status: string) => void): Promise<OrtSession> {
		if (!this.sessionPromise) {
			this.sessionPromise = this.createSession(onProgress).catch((err: unknown) => {
				this.sessionPromise = null;
				throw err;
			});
		}
		return this.sessionPromise;
	}

	private async createSession(onProgress?: (pct: number, status: string) => void): Promise<OrtSession> {
		onProgress?.(5, 'Loading inference engine...');
		const ort = getOrt();
		ort.env.wasm.wasmPaths = ORT_WASM_PATHS;

		const model = await this.fetchModel(onProgress);
		onProgress?.(70, 'Initializing model...');
		return ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
	}

	/** Stream the model file so the ~10 MB download can report real progress. */
	private async fetchModel(onProgress?: (pct: number, status: string) => void): Promise<ArrayBuffer> {
		const res = await fetch(this.config.modelUrl);
		if (!res.ok || !res.body) {
			throw new Error(`Could not download the model (${res.status} ${res.statusText})`);
		}

		const total = Number(res.headers.get('content-length')) || 0;
		const reader = res.body.getReader();
		const chunks: Uint8Array[] = [];
		let received = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			received += value.length;
			onProgress?.(total ? 10 + Math.round((received / total) * 55) : 10, 'Downloading model...');
		}

		const model = new Uint8Array(received);
		let offset = 0;
		for (const chunk of chunks) {
			model.set(chunk, offset);
			offset += chunk.length;
		}
		return model.buffer;
	}

	// ── Image handling (private, DOM-bound) ──────────────────

	/** Decode an uploaded image file into an HTMLImageElement. */
	private static loadImage(file: File): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const image = new Image();
			image.onload = () => {
				URL.revokeObjectURL(url);
				resolve(image);
			};
			image.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('Could not read the image file'));
			};
			image.src = url;
		});
	}

	/** Paint the image into a letterboxed canvas and return RGB / 255 in CHW order. */
	private static buildTensor(image: HTMLImageElement, box: Letterbox, inputSize: number): Float32Array {
		const canvas = document.createElement('canvas');
		canvas.width = inputSize;
		canvas.height = inputSize;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) throw new Error('Canvas 2D is not available');
		ctx.fillStyle = 'rgb(114, 114, 114)';
		ctx.fillRect(0, 0, inputSize, inputSize);
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(image, box.padX, box.padY, box.width, box.height);

		const rgba = ctx.getImageData(0, 0, inputSize, inputSize).data;
		const plane = inputSize * inputSize;
		const tensor = new Float32Array(3 * plane);
		for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
			tensor[p] = rgba[i] / 255;
			tensor[plane + p] = rgba[i + 1] / 255;
			tensor[2 * plane + p] = rgba[i + 2] / 255;
		}
		return tensor;
	}

	/**
	 * Draw the detections onto a copy of the image and cut out one square crop
	 * per cell. Returns JPEG data URLs: the annotated image, then crops in
	 * detection order.
	 */
	private static render(
		image: HTMLImageElement,
		detections: readonly RawDetection[],
		classes: readonly WbcClass[],
	): { annotatedImage: string; crops: string[] } {
		const scale = Math.min(1, MAX_RENDER_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
		canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		// JPEG has no alpha — give transparent uploads a white backing
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

		const boxes = detections.map((det) => OnnxRuntimeBackend.scaleBBox(det.bbox, scale));

		// Crops are cut from the clean canvas, before any box is drawn
		const crops = boxes.map((bbox) => OnnxRuntimeBackend.drawCrop(canvas, bbox));

		const longSide = Math.max(canvas.width, canvas.height);
		const fontSize = Math.max(11, Math.round(longSide / 45));
		const textPad = Math.round(fontSize * 0.35);
		const chipHeight = fontSize + textPad * 2;
		ctx.lineWidth = Math.max(2, Math.round(longSide / 320));
		ctx.font = `600 ${fontSize}px 'Google Sans Flex', -apple-system, BlinkMacSystemFont, sans-serif`;
		ctx.textBaseline = 'middle';

		boxes.forEach((bbox, i) => {
			const cfg = WBC_CLASS_MAP.get(classes[i])!;
			ctx.strokeStyle = cfg.color;
			ctx.strokeRect(bbox.x1, bbox.y1, bbox.x2 - bbox.x1, bbox.y2 - bbox.y1);

			// Label chip sits on top of the box (inside it when the box touches the upper edge)
			const text = `${cfg.label} ${Math.round(detections[i].confidence * 100)}%`;
			const chipWidth = ctx.measureText(text).width + textPad * 2;
			const chipX = Math.min(Math.max(bbox.x1, 0), canvas.width - chipWidth);
			const chipY = bbox.y1 - chipHeight >= 0 ? bbox.y1 - chipHeight : bbox.y1;
			ctx.fillStyle = cfg.color;
			ctx.fillRect(chipX, chipY, chipWidth, chipHeight);
			ctx.fillStyle = OnnxRuntimeBackend.readableInk(cfg.color);
			ctx.fillText(text, chipX + textPad, chipY + chipHeight / 2);
		});

		return { annotatedImage: canvas.toDataURL('image/jpeg', 0.9), crops };
	}

	/** Crop a square window around a cell (in canvas pixels) into a small JPEG data URL. */
	private static drawCrop(source: HTMLCanvasElement, bbox: BBox): string {
		const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
		const side = Math.max(1, Math.min(
			Math.max(bbox.x2 - bbox.x1, bbox.y2 - bbox.y1) * (1 + CROP_MARGIN),
			source.width,
			source.height,
		));
		const sx = clamp((bbox.x1 + bbox.x2) / 2 - side / 2, 0, source.width - side);
		const sy = clamp((bbox.y1 + bbox.y2) / 2 - side / 2, 0, source.height - side);

		const crop = document.createElement('canvas');
		crop.width = CROP_SIZE;
		crop.height = CROP_SIZE;
		const ctx = crop.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(source, sx, sy, side, side, 0, 0, CROP_SIZE, CROP_SIZE);
		return crop.toDataURL('image/jpeg', 0.85);
	}

	private static scaleBBox(bbox: BBox, scale: number): BBox {
		return { x1: bbox.x1 * scale, y1: bbox.y1 * scale, x2: bbox.x2 * scale, y2: bbox.y2 * scale };
	}

	/** Black or white text, whichever reads better on the given `#rrggbb` background. */
	private static readableInk(hex: string): string {
		const channel = (offset: number) => parseInt(hex.slice(offset, offset + 2), 16);
		const luminance = 0.299 * channel(1) + 0.587 * channel(3) + 0.114 * channel(5);
		return luminance > 150 ? '#000000' : '#ffffff';
	}

	// ── Pure helpers (static, testable) ──────────────────────

	/**
	 * Replicates Ultralytics' `LetterBox`: aspect-preserving resize onto a
	 * square canvas, centred, with the padding split left/right and top/bottom.
	 * Pure function — no side effects, fully testable.
	 */
	static letterbox(imageWidth: number, imageHeight: number, inputSize: number): Letterbox {
		const gain = Math.min(inputSize / imageWidth, inputSize / imageHeight);
		// Never shrink a side below 1 px (extremely thin images would otherwise vanish)
		const width = Math.max(1, Math.round(imageWidth * gain));
		const height = Math.max(1, Math.round(imageHeight * gain));
		return {
			gain,
			width,
			height,
			padX: Math.floor((inputSize - width) / 2),
			padY: Math.floor((inputSize - height) / 2),
		};
	}

	/**
	 * Turn a `[1, 4 + classes, anchors]` model output into detections, keeping
	 * the best class of each anchor above `confThreshold`.
	 * Channels 0-3 are `cx, cy, w, h` in model-input pixels; 4+ are class probabilities.
	 * Pure function — no side effects, fully testable.
	 */
	static decodeOutput(
		data: ArrayLike<number>,
		dims: readonly number[],
		confThreshold: number,
	): RawDetection[] {
		// A real head always has thousands of anchors; a tiny last dimension means
		// the file was exported end-to-end (`nms=True`), which this decoder cannot read.
		if (dims.length !== 3 || dims[1] < 5 || dims[2] <= 6) {
			throw new Error(`Unexpected model output shape [${dims.join(', ')}] (expected [1, 4 + classes, anchors])`);
		}
		const [, channels, anchors] = dims;
		const detections: RawDetection[] = [];

		for (let i = 0; i < anchors; i++) {
			let classIndex = 0;
			let confidence = -1;
			for (let c = 4; c < channels; c++) {
				const score = data[c * anchors + i];
				if (score > confidence) {
					confidence = score;
					classIndex = c - 4;
				}
			}
			if (confidence < confThreshold) continue;

			const cx = data[i];
			const cy = data[anchors + i];
			const w = data[2 * anchors + i];
			const h = data[3 * anchors + i];
			detections.push({
				bbox: { x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 },
				confidence,
				classIndex,
			});
		}
		return detections;
	}

	/**
	 * Greedy per-class NMS, matching Ultralytics' default (`agnostic=False`):
	 * a box is dropped when an already-kept box of the *same* class overlaps it
	 * by more than `iouThreshold`. Returns survivors by descending confidence.
	 * Pure function — no side effects, fully testable.
	 */
	static nonMaxSuppression(detections: readonly RawDetection[], iouThreshold: number): RawDetection[] {
		const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
		const kept: RawDetection[] = [];
		for (const det of sorted) {
			const suppressed = kept.some(
				(k) => k.classIndex === det.classIndex && OnnxRuntimeBackend.iou(k.bbox, det.bbox) > iouThreshold,
			);
			if (!suppressed) kept.push(det);
		}
		return kept;
	}

	private static iou(a: BBox, b: BBox): number {
		const interW = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
		const interH = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
		if (interW <= 0 || interH <= 0) return 0;
		const inter = interW * interH;
		const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
		return union > 0 ? inter / union : 0;
	}

	/**
	 * Map a bbox from model-input space back onto the original image: remove the
	 * letterbox padding, undo the scale, and clip to the image bounds.
	 * Pure function — no side effects, fully testable.
	 */
	static scaleToImage(bbox: BBox, box: Letterbox, imageWidth: number, imageHeight: number): BBox {
		const clampX = (v: number) => Math.min(Math.max(v, 0), imageWidth);
		const clampY = (v: number) => Math.min(Math.max(v, 0), imageHeight);
		return {
			x1: clampX((bbox.x1 - box.padX) / box.gain),
			y1: clampY((bbox.y1 - box.padY) / box.gain),
			x2: clampX((bbox.x2 - box.padX) / box.gain),
			y2: clampY((bbox.y2 - box.padY) / box.gain),
		};
	}

	/**
	 * Resolve a model class name to a `WbcClass`. The model uses plural names
	 * ("heterophils"); unknown names fall back to the class order, like
	 * `GradioSpaceClient.parseRawResponse` does.
	 * Pure function — no side effects, fully testable.
	 */
	static toWbcClass(modelClassName: string, classIndex: number): WbcClass {
		const singular = modelClassName.trim().toLowerCase().replace(/s$/, '');
		if (WBC_CLASSES.includes(singular as WbcClass)) return singular as WbcClass;
		return WBC_CLASSES[classIndex] ?? WbcClass.Heterophil;
	}
}
