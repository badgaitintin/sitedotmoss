/**
 * NextWBC — Core Type Definitions & Data Structures
 * ─────────────────────────────────────────────────────────
 * Central type registry for the NextWBC avian WBC classification system.
 * All enums, interfaces, and lookup maps live here so every other module
 * can import from a single source of truth.
 */

// ── WBC Class Enum ──────────────────────────────────────────
/** The six avian white blood cell types detected by the YOLO12 model. */
export enum WbcClass {
	Heterophil  = 'heterophil',
	Eosinophil  = 'eosinophil',
	Basophil    = 'basophil',
	Lymphocyte  = 'lymphocyte',
	Monocyte    = 'monocyte',
	Thrombocyte = 'thrombocyte',
}

/** Ordered list of all WBC classes (for deterministic iteration). */
export const WBC_CLASSES: readonly WbcClass[] = [
	WbcClass.Heterophil,
	WbcClass.Eosinophil,
	WbcClass.Basophil,
	WbcClass.Lymphocyte,
	WbcClass.Monocyte,
	WbcClass.Thrombocyte,
] as const;

// ── Per-class display configuration ─────────────────────────
/** Visual configuration for a single WBC class. */
export interface WbcClassConfig {
	readonly color: string;
	readonly label: string;
}

/**
 * Immutable lookup map: WbcClass → display config.
 * Replaces the old loose `CLASS_COLORS` / `CLASS_LABELS` objects.
 */
export const WBC_CLASS_MAP: ReadonlyMap<WbcClass, WbcClassConfig> = new Map([
	[WbcClass.Heterophil,  { color: '#FFC800', label: 'Heterophil'  }],
	[WbcClass.Eosinophil,  { color: '#FF0000', label: 'Eosinophil'  }],
	[WbcClass.Basophil,    { color: '#8000FF', label: 'Basophil'    }],
	[WbcClass.Lymphocyte,  { color: '#00C8FF', label: 'Lymphocyte'  }],
	[WbcClass.Monocyte,    { color: '#00FF00', label: 'Monocyte'    }],
	[WbcClass.Thrombocyte, { color: '#C8C8C8', label: 'Thrombocyte' }],
]);

// ── Detection result interfaces ─────────────────────────────
/** Bounding box coordinates (pixel space). */
export interface BBox {
	readonly x1: number;
	readonly y1: number;
	readonly x2: number;
	readonly y2: number;
}

/** A single detected cell returned by the model. */
export interface DetectedCell {
	readonly class: WbcClass;
	readonly confidence: number;
	readonly cropBase64: string;
	readonly bbox?: BBox;
}

/** Full detection result after model inference. */
export interface DetectionResult {
	readonly annotatedImage: string;
	readonly totalCells: number;
	readonly classCounts: Map<WbcClass, number>;
	readonly cells: DetectedCell[];
}

// ── Application state machine ───────────────────────────────
/** Finite states of the NextWBC UI. */
export enum AppState {
	Idle          = 'idle',
	Uploading     = 'uploading',
	Processing    = 'processing',
	ShowingResult = 'showing_result',
	Error         = 'error',
}

/**
 * Valid state transitions.
 * Used by `NextWbcUI.transition()` to guard against invalid jumps.
 */
export const VALID_TRANSITIONS: ReadonlyMap<AppState, readonly AppState[]> = new Map([
	[AppState.Idle,          [AppState.Uploading, AppState.Error]],
	[AppState.Uploading,     [AppState.Processing, AppState.Error, AppState.Idle]],
	[AppState.Processing,    [AppState.ShowingResult, AppState.Error, AppState.Idle]],
	[AppState.ShowingResult,  [AppState.Idle, AppState.Uploading]],
	[AppState.Error,          [AppState.Idle, AppState.Uploading]],
]);

// ── Inference configuration ─────────────────────────────────
/** Configuration for the Gradio Spaces connection. */
export interface InferenceConfig {
	readonly spaceUrl: string;
	readonly maxFileSizeMB: number;
	readonly allowedMimePrefix: string;
}

/** Default production configuration. */
export const DEFAULT_INFERENCE_CONFIG: InferenceConfig = {
	spaceUrl: 'https://badgaitintin-nextwbc.hf.space',
	maxFileSizeMB: 20,
	allowedMimePrefix: 'image/',
};

// ── File validation ─────────────────────────────────────────
/** Validation error result. `null` means valid. */
export type FileValidationError = string | null;

/**
 * Validate a file before upload.
 * Pure function — no side effects, fully testable.
 */
export function validateFile(
	file: { type: string; size: number },
	config: InferenceConfig = DEFAULT_INFERENCE_CONFIG,
): FileValidationError {
	if (!file.type.startsWith(config.allowedMimePrefix)) {
		return 'Please upload an image file (JPG, PNG, etc.)';
	}
	const maxBytes = config.maxFileSizeMB * 1024 * 1024;
	if (file.size > maxBytes) {
		return `Image too large. Maximum ${config.maxFileSizeMB}MB.`;
	}
	return null;
}
