/**
 * NextWBC Module — Public API
 * Re-exports everything consumers need from a single entry point.
 */
export {
	WbcClass,
	WBC_CLASSES,
	WBC_CLASS_MAP,
	AppState,
	VALID_TRANSITIONS,
	DEFAULT_INFERENCE_CONFIG,
	DEFAULT_ONNX_INFERENCE_CONFIG,
	validateFile,
} from './nextwbc-types';

export type {
	WbcClassConfig,
	DetectedCell,
	DetectionResult,
	BBox,
	InferenceConfig,
	OnnxInferenceConfig,
	WbcInferenceBackend,
	FileValidationError,
} from './nextwbc-types';

export { GradioSpaceClient } from './gradio-client';
export { OnnxRuntimeBackend, ORT_SCRIPT_URL } from './onnx-backend';
export type { Letterbox, RawDetection } from './onnx-backend';
export { NextWbcUI } from './nextwbc-ui';
export { AeroBubbleEngine } from './bubble-engine';
export type { Bubble, BubbleEngineConfig } from './bubble-engine';
export { AeroBubbleEngine3D } from './bubble-engine-3d';
export type { BubbleEngine3DConfig } from './bubble-engine-3d';
