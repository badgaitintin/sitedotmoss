/**
 * NextWBC — UI State Machine & Renderer
 * ─────────────────────────────────────────────────────────
 * OOP controller for all DOM interactions and state transitions.
 * Pure render methods produce HTML strings for easy unit testing.
 */

import type {
	DetectionResult,
	DetectedCell,
	FileValidationError,
} from './nextwbc-types';
import {
	AppState,
	WbcClass,
	WBC_CLASSES,
	WBC_CLASS_MAP,
	VALID_TRANSITIONS,
	validateFile,
} from './nextwbc-types';
import { GradioSpaceClient } from './gradio-client';

// ── Cached DOM element references ───────────────────────────
interface DOMElements {
	dropzone: HTMLElement;
	fileInput: HTMLInputElement;
	errorContainer: HTMLElement;
	resultContainer: HTMLElement;
	previewContainer: HTMLElement;
	progressFill: HTMLElement;
	statusText: HTMLElement;
	uploadPrompt: HTMLElement;
	resetBtn: HTMLElement;
	annotatedImg: HTMLImageElement;
	panelBadge: HTMLElement;
	sampleBtn: HTMLButtonElement | null;
	cellCountNum: HTMLElement;
	distributionContainer: HTMLElement;
	cropsGrid: HTMLElement;
	previewImg: HTMLImageElement;
}

/**
 * NextWBC UI controller.
 *
 * Manages the entire UI lifecycle: file upload → inference → result display.
 * State transitions are guarded via the `VALID_TRANSITIONS` map.
 */
export class NextWbcUI {
	private state: AppState = AppState.Idle;
	private elements!: DOMElements;
	private client: GradioSpaceClient;
	private currentResult: DetectionResult | null = null;
	private bboxVisible: boolean = true;
	private uploadedImageBase64: string | null = null;

	constructor(client: GradioSpaceClient) {
		this.client = client;
	}

	// ── Initialization ───────────────────────────────────────

	/** Bind all DOM elements and event listeners. Call once on page load. */
	init(): void {
		this.elements = {
			dropzone: document.getElementById('wbcDropzone') || document.createElement('div'),
			fileInput: (document.getElementById('wbcFileInput') as HTMLInputElement) || document.createElement('input'),
			errorContainer: document.getElementById('wbcError') || document.createElement('div'),
			resultContainer: document.getElementById('wbcResult') || document.createElement('div'),
			previewContainer: document.getElementById('wbcPreview') || document.createElement('div'),
			progressFill: document.getElementById('wbcProgressFill') || document.createElement('div'),
			statusText: document.getElementById('wbcStatusText') || document.createElement('div'),
			uploadPrompt: document.getElementById('wbcUploadPrompt') || document.createElement('div'),
			resetBtn: document.getElementById('wbcResetBtn') || document.createElement('div'),
			annotatedImg: (document.getElementById('wbcAnnotatedImg') as HTMLImageElement) || document.createElement('img'),
			panelBadge: document.getElementById('panelBadge') || document.createElement('div'),
			sampleBtn: document.getElementById('wbcSampleBtn') as HTMLButtonElement | null,
			cellCountNum: document.getElementById('wbcCellCountNum') || document.createElement('div'),
			distributionContainer: document.getElementById('wbcDistributionContainer') || document.createElement('div'),
			cropsGrid: document.getElementById('wbcCropsGrid') || document.createElement('div'),
			previewImg: (document.getElementById('wbcPreviewImg') as HTMLImageElement) || document.createElement('img'),
		};

		this.bindEvents();
	}

	// ── State machine ────────────────────────────────────────

	/**
	 * Transition to a new state, guarded by the valid-transitions map.
	 * Throws if the transition is not allowed.
	 */
	private transition(to: AppState): void {
		const allowed = VALID_TRANSITIONS.get(this.state);
		if (!allowed || !allowed.includes(to)) {
			console.warn(`[NextWbcUI] Invalid transition: ${this.state} → ${to}`);
			return;
		}
		this.state = to;
		this.applyStateToDOM();
	}

	/** Apply the current state to DOM visibility. */
	private applyStateToDOM(): void {
		const { uploadPrompt, previewContainer, resultContainer, errorContainer } = this.elements;

		// Hide all panels first
		uploadPrompt.classList.add('hidden');
		previewContainer.classList.add('hidden');
		resultContainer.classList.add('hidden');
		errorContainer.classList.add('hidden');

		switch (this.state) {
			case AppState.Idle:
				uploadPrompt.classList.remove('hidden');
				break;
			case AppState.Uploading:
			case AppState.Processing:
				previewContainer.classList.remove('hidden');
				break;
			case AppState.ShowingResult:
				resultContainer.classList.remove('hidden');
				break;
			case AppState.Error:
				uploadPrompt.classList.remove('hidden');
				errorContainer.classList.remove('hidden');
				break;
		}
	}

	// ── Event binding ────────────────────────────────────────

	private bindEvents(): void {
		const { dropzone, fileInput, resetBtn, annotatedImg, sampleBtn } = this.elements;

		// Dropzone click → open file picker
		dropzone.addEventListener('click', (e) => {
			if (this.state !== AppState.Idle) return;
			if (e.target === fileInput) return;
			fileInput.click();
		});

		// Drag & drop
		dropzone.addEventListener('dragover', (e) => {
			e.preventDefault();
			if (this.state !== AppState.Idle) return;
			dropzone.classList.add('dragging');
		});

		dropzone.addEventListener('dragleave', () => {
			dropzone.classList.remove('dragging');
		});

		dropzone.addEventListener('drop', (e) => {
			e.preventDefault();
			dropzone.classList.remove('dragging');
			if (this.state !== AppState.Idle) return;
			const file = (e as DragEvent).dataTransfer?.files[0];
			if (file) this.handleFileSelect(file);
		});

		// File input change
		fileInput.addEventListener('change', () => {
			const file = fileInput.files?.[0];
			if (file) this.handleFileSelect(file);
		});

		// Reset button
		resetBtn.addEventListener('click', () => this.handleReset());

		// Toggle bbox on annotated image click
		annotatedImg.addEventListener('click', () => this.handleToggleBbox());

		// Sample button
		if (sampleBtn) {
			sampleBtn.addEventListener('click', () => this.handleSampleClick());
		}
	}

	// ── Action handlers ──────────────────────────────────────

	private async handleFileSelect(file: File): Promise<void> {
		const error = validateFile(file);
		if (error) {
			this.showError(error);
			return;
		}

		if (this.state === AppState.ShowingResult) {
			await this.handleReset();
		}

		this.transition(AppState.Uploading);
		this.setProgress(0, 'Preparing...');

		// Read image as base64 for preview
		this.uploadedImageBase64 = await NextWbcUI.readAsBase64(file);
		this.elements.previewImg.src = this.uploadedImageBase64;

		try {
			this.transition(AppState.Processing);
			const result = await this.client.infer(file, (pct, status) => {
				this.setProgress(pct, status);
			});
			this.renderResult(result);
			this.transition(AppState.ShowingResult);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			this.showError(`Detection failed: ${msg}`);
		}
	}

	private async handleSampleClick(): Promise<void> {
		if (this.state !== AppState.Idle && this.state !== AppState.ShowingResult) return;
		const sampleBtn = this.elements.sampleBtn;
		if (!sampleBtn) return;

		try {
			sampleBtn.disabled = true;
			if (this.state === AppState.ShowingResult) {
				await this.handleReset();
			}
			const res = await fetch('/raptor_wbc_00001.jpeg');
			if (!res.ok) throw new Error('Could not fetch sample image');
			const blob = await res.blob();
			const file = new File([blob], 'raptor_wbc_00001.jpeg', { type: 'image/jpeg' });
			await this.handleFileSelect(file);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			this.showError('Failed to load sample image: ' + msg);
		} finally {
			sampleBtn.disabled = false;
		}
	}

	private async handleReset(): Promise<void> {
		const isFromShowingResult = this.state === AppState.ShowingResult;

		if (isFromShowingResult) {
			// 1. Pop all crop bubbles
			const cropBubbles = this.elements.cropsGrid.querySelectorAll('.wbc-crop-bubble');
			cropBubbles.forEach((el, idx) => {
				(el as HTMLElement).style.animationDelay = `${idx * 0.04}s`;
				el.classList.add('is-popping');
			});

			// 2. Magic mirror dissolve on central detection image
			this.elements.resultContainer.classList.add('is-dissolving');

			// Wait for the magic animation to finish
			await new Promise((resolve) => setTimeout(resolve, 400));
		}

		this.currentResult = null;
		this.bboxVisible = true;
		this.uploadedImageBase64 = null;
		this.elements.fileInput.value = '';
		this.elements.progressFill.style.width = '0%';
		this.elements.errorContainer.innerText = '';
		this.elements.cropsGrid.innerHTML = '';
		this.elements.resultContainer.classList.remove('is-dissolving');

		// Force state back to Idle regardless
		this.state = AppState.Idle;
		this.applyStateToDOM();
	}

	private handleToggleBbox(): void {
		if (!this.currentResult || !this.uploadedImageBase64) return;
		this.bboxVisible = !this.bboxVisible;
		this.elements.annotatedImg.src = this.bboxVisible
			? this.currentResult.annotatedImage
			: this.uploadedImageBase64;
		this.elements.panelBadge.textContent = this.bboxVisible ? 'Detection' : 'Original';
	}

	// ── UI helpers ───────────────────────────────────────────

	private showError(msg: string): void {
		this.elements.errorContainer.innerText = msg;
		this.transition(AppState.Error);
	}

	private setProgress(pct: number, text: string): void {
		this.elements.progressFill.style.width = `${pct}%`;
		this.elements.statusText.innerText = text;
	}

	// ── Rendering ────────────────────────────────────────────

	private renderResult(result: DetectionResult): void {
		this.currentResult = result;
		this.bboxVisible = true;
		this.elements.panelBadge.textContent = 'Detection';
		this.elements.annotatedImg.src = result.annotatedImage;
		this.elements.cellCountNum.innerText = String(result.totalCells);

		this.elements.distributionContainer.innerHTML =
			NextWbcUI.renderDistributionBars(result.classCounts, result.totalCells);

		this.elements.cropsGrid.innerHTML =
			NextWbcUI.renderCropCards(result.cells);
	}

	// ── Pure render functions (static, testable) ─────────────

	/**
	 * Produce HTML for the class distribution bar chart.
	 * Pure function: takes data in, returns an HTML string.
	 */
	static renderDistributionBars(
		classCounts: Map<WbcClass, number>,
		total: number,
	): string {
		let html = '';

		for (const cls of WBC_CLASSES) {
			const config = WBC_CLASS_MAP.get(cls)!;
			const count = classCounts.get(cls) ?? 0;
			const pct = total > 0 ? (count / total) * 100 : 0;

			html += `
				<div class="wbc-count-bar-item">
					<div class="wbc-bar-dot" style="background-color: ${config.color}"></div>
					<span class="wbc-bar-label">${config.label}</span>
					<div class="wbc-bar-track">
						<div class="wbc-bar-fill" style="width: ${pct}%; background-color: ${config.color}; opacity: ${count > 0 ? 0.85 : 0.15}"></div>
					</div>
					<span class="wbc-bar-val" style="color: ${count > 0 ? config.color : 'rgba(255,255,255,0.3)'}">${count}</span>
				</div>
			`;
		}

		return html;
	}

	/**
	 * Produce HTML for the detected cell crop cards.
	 * Pure function: takes data in, returns an HTML string.
	 */
	static renderCropCards(cells: DetectedCell[]): string {
		let html = '';

		const orbitClasses = [
			'wbc-crop-orbit-tr',
			'wbc-crop-orbit-bl',
			'wbc-crop-orbit-br',
			'wbc-crop-orbit-tl',
			'wbc-crop-orbit-mr',
			'wbc-crop-orbit-ml',
		];

		for (let i = 0; i < cells.length; i++) {
			const cell = cells[i];
			const config = WBC_CLASS_MAP.get(cell.class);
			const color = config?.color ?? '#888';
			const label = config?.label ?? cell.class;
			const confPct = Math.round(cell.confidence * 100);
			const floatClass = `aero-float-${(i % 4) + 1}`;
			const orbitClass = orbitClasses[i % orbitClasses.length];

			html += `
				<div class="wbc-crop-card wbc-crop-bubble aero-component-bubble ${floatClass} ${orbitClass}" style="border: 2px solid ${color}; box-shadow: 0 8px 24px ${color}50, inset 0 -0.0625em 0 0.0625em rgba(255, 255, 255, 0.95), inset 0 0 0 0.0625em ${color}, inset 0 0 0.25em 0.25em ${color}80;">
					<div class="wbc-crop-img-wrap">
						<img src="${cell.cropBase64}" alt="${label}" />
					</div>
					<div class="wbc-crop-info" style="background: ${color}; color: #ffffff;">
						<span class="wbc-crop-label">${label}</span>
						<span class="wbc-crop-conf">${confPct}%</span>
					</div>
				</div>
			`;
		}

		return html;
	}

	// ── Utilities ────────────────────────────────────────────

	/** Read a file as a base64 data URL. */
	static readAsBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = (error) => reject(error);
			reader.readAsDataURL(file);
		});
	}
}
