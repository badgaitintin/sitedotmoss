/**
 * NextWBC — Gradio Space API Client
 * ─────────────────────────────────────────────────────────
 * OOP wrapper around the Hugging Face Gradio Spaces REST API.
 * Encapsulates: wake → upload → predict → poll SSE pipeline.
 */

import type {
	InferenceConfig,
	DetectionResult,
	DetectedCell,
} from './nextwbc-types';
import {
	WbcClass,
	WBC_CLASSES,
	DEFAULT_INFERENCE_CONFIG,
} from './nextwbc-types';

// ── Raw Gradio response shape (private) ─────────────────────
interface RawGradioCell {
	class: string;
	confidence: number;
	crop_base64: string;
	bbox?: { x1: number; y1: number; x2: number; y2: number };
}

interface RawGradioResult {
	annotated_image: string;
	total_cells: number;
	class_counts?: Record<string, number>;
	cells?: RawGradioCell[];
}

/**
 * Client for communicating with a Gradio-powered HF Space.
 *
 * Usage:
 * ```ts
 * const client = new GradioSpaceClient();
 * const result = await client.infer(imageFile);
 * ```
 */
export class GradioSpaceClient {
	private readonly config: InferenceConfig;

	constructor(config: Partial<InferenceConfig> = {}) {
		this.config = { ...DEFAULT_INFERENCE_CONFIG, ...config };
	}

	/** Getter for the configured space URL (useful for testing). */
	get spaceUrl(): string {
		return this.config.spaceUrl;
	}

	// ── Public API ────────────────────────────────────────────

	/** Ping the Space to wake it from cold start. */
	async wakeSpace(): Promise<void> {
		await fetch(this.config.spaceUrl + '/gradio_api/info').catch(() => {});
	}

	/** Upload a file to the Gradio upload endpoint, returns server path. */
	async uploadFile(file: File): Promise<string> {
		const formData = new FormData();
		formData.append('files', file);
		const res = await fetch(this.config.spaceUrl + '/gradio_api/upload', {
			method: 'POST',
			body: formData,
		});
		if (!res.ok) throw new Error('Upload failed');
		const data: string[] = await res.json();
		return data[0];
	}

	/** Submit a predict request, returns the SSE event ID. */
	async runPredict(filePath: string): Promise<string> {
		const res = await fetch(this.config.spaceUrl + '/gradio_api/call/predict', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: [{ path: filePath, meta: { _type: 'gradio.FileData' } }],
			}),
		});
		if (!res.ok) throw new Error('Run failed');
		const data: { event_id: string } = await res.json();
		return data.event_id;
	}

	/**
	 * Poll the SSE result stream for a given event ID.
	 * Parses the Server-Sent Events protocol inline.
	 */
	async pollResult(eventId: string): Promise<DetectionResult> {
		const res = await fetch(
			this.config.spaceUrl + '/gradio_api/call/predict/' + eventId,
		);
		if (!res.ok) throw new Error(`Poll failed (${res.status})`);

		const rawPayload = await this.parseSSEStream(res);
		return GradioSpaceClient.parseRawResponse(rawPayload);
	}

	/**
	 * Full inference pipeline: wake → upload → predict → poll.
	 * Calls the optional `onProgress` callback at each stage.
	 */
	async infer(
		file: File,
		onProgress?: (pct: number, status: string) => void,
	): Promise<DetectionResult> {
		onProgress?.(5, 'Waking up Space...');
		await this.wakeSpace();

		onProgress?.(20, 'Uploading image...');
		const filePath = await this.uploadFile(file);

		onProgress?.(40, 'Submitting detection task...');
		const eventId = await this.runPredict(filePath);

		onProgress?.(65, 'Waiting for model (this may take a moment)...');
		const result = await this.pollResult(eventId);

		onProgress?.(100, 'Processing result...');
		return result;
	}

	// ── SSE stream parser (private) ──────────────────────────

	/**
	 * Parse a Gradio SSE response body.
	 * Reads the stream looking for `event: complete` + `data: {...}`.
	 */
	private async parseSSEStream(res: Response): Promise<RawGradioResult> {
		const reader = res.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let lastEvent: string | null = null;

		try {
			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					// Flush remaining buffer on stream end
					if (buffer.trim() && buffer.startsWith('data:') && lastEvent === 'complete') {
						try {
							const payload = JSON.parse(buffer.slice(5).trim());
							return Array.isArray(payload) ? payload[0] : payload;
						} catch {
							// fall through to error
						}
					}
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop()!; // keep incomplete line in buffer

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;

					if (trimmed.startsWith('event:')) {
						lastEvent = trimmed.slice(6).trim();
					} else if (trimmed.startsWith('data:')) {
						const raw = trimmed.slice(5).trim();

						if (lastEvent === 'complete') {
							try {
								const payload = JSON.parse(raw);
								reader.cancel();
								return Array.isArray(payload) ? payload[0] : payload;
							} catch {
								reader.cancel();
								throw new Error('Failed to parse result');
							}
						}

						if (lastEvent === 'error') {
							reader.cancel();
							let msg = raw;
							try { msg = JSON.parse(raw); } catch { /* use raw string */ }
							throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
						}
					}
				}
			}
		} finally {
			// Ensure reader is always released
			reader.releaseLock();
		}

		throw new Error('Stream ended without result');
	}

	// ── Response normalization (static, testable) ────────────

	/**
	 * Transform a raw Gradio JSON payload into a typed `DetectionResult`.
	 * Static so it can be unit-tested without instantiating the client.
	 */
	static parseRawResponse(raw: RawGradioResult): DetectionResult {
		const rawCounts = raw.class_counts ?? {};
		const classCounts = new Map<WbcClass, number>();

		for (const cls of WBC_CLASSES) {
			classCounts.set(cls, rawCounts[cls] ?? 0);
		}

		const cells: DetectedCell[] = (raw.cells ?? []).map((c) => ({
			class: (WBC_CLASSES.includes(c.class as WbcClass)
				? c.class
				: WbcClass.Heterophil) as WbcClass,
			confidence: c.confidence,
			cropBase64: c.crop_base64,
			bbox: c.bbox ? { x1: c.bbox.x1, y1: c.bbox.y1, x2: c.bbox.x2, y2: c.bbox.y2 } : undefined,
		}));

		return {
			annotatedImage: raw.annotated_image,
			totalCells: raw.total_cells ?? 0,
			classCounts,
			cells,
		};
	}
}
