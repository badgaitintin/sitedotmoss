/**
 * dot-matrix-engine.ts — Performance-optimized Dot Matrix Canvas Engine.
 * 
 * Uses packed Float32Array for dot properties to avoid JS object allocations and GC pressure:
 * Layout per dot (10 floats):
 *   [0] x, [1] y, [2] radius, [3] r, [4] g, [5] b, [6] targetRadius, [7] targetR, [8] targetG, [9] targetB
 */

export interface DotMatrixConfig {
	cellSize: number;
	minRadius: number;
	maxRadius: number;
	darkPixelBrighten: number;
	backgroundColor: string;
	imageIntervalMs: number;
}

export const DEFAULT_DOT_CONFIG: DotMatrixConfig = {
	cellSize: 7,
	minRadius: 0.4,
	maxRadius: 7 / 2 - 0.2,
	darkPixelBrighten: 70,
	backgroundColor: '#ffffff',
	imageIntervalMs: 20000,
};

const STRIDE = 10;

export class DotMatrixEngine {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly offCanvas: HTMLCanvasElement;
	private readonly offCtx: CanvasRenderingContext2D;
	private readonly config: DotMatrixConfig;

	private dots: Float32Array = new Float32Array(0);
	private animId: number | null = null;
	private intervalId: number | null = null;
	private currentImg: HTMLImageElement | null = null;
	private images: string[] = [];

	constructor(canvas: HTMLCanvasElement, config: Partial<DotMatrixConfig> = {}) {
		this.canvas = canvas;
		this.config = { ...DEFAULT_DOT_CONFIG, ...config };
		this.ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;

		this.offCanvas = document.createElement('canvas');
		this.offCtx = this.offCanvas.getContext('2d', { willReadFrequently: true })!;

		this.handleResize = this.handleResize.bind(this);
	}

	start(imageSources: string[]): void {
		this.images = imageSources;
		window.addEventListener('resize', this.handleResize);
		this.handleResize();

		this.loadNextImage();
		if (this.config.imageIntervalMs > 0) {
			this.intervalId = window.setInterval(() => this.loadNextImage(), this.config.imageIntervalMs);
		}
	}

	stop(): void {
		window.removeEventListener('resize', this.handleResize);
		if (this.animId !== null) {
			cancelAnimationFrame(this.animId);
			this.animId = null;
		}
		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	private handleResize(): void {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.initDots();

		if (this.currentImg && this.currentImg.complete) {
			this.updateDotTargets(this.currentImg);
			if (this.animId === null) {
				this.renderLoop();
			}
		}
	}

	private initDots(): void {
		const cols = Math.ceil(this.canvas.width / this.config.cellSize);
		const rows = Math.ceil(this.canvas.height / this.config.cellSize);
		const totalDots = cols * rows;

		this.dots = new Float32Array(totalDots * STRIDE);

		let ptr = 0;
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				this.dots[ptr] = c * this.config.cellSize;     // x
				this.dots[ptr + 1] = r * this.config.cellSize; // y
				this.dots[ptr + 2] = 0;                        // radius
				this.dots[ptr + 3] = 255;                      // r
				this.dots[ptr + 4] = 255;                      // g
				this.dots[ptr + 5] = 255;                      // b
				this.dots[ptr + 6] = 0;                        // targetRadius
				this.dots[ptr + 7] = 255;                      // targetR
				this.dots[ptr + 8] = 255;                      // targetG
				this.dots[ptr + 9] = 255;                      // targetB
				ptr += STRIDE;
			}
		}
	}

	private updateDotTargets(img: HTMLImageElement): void {
		if (!img.complete || img.naturalWidth === 0) return;

		const w = this.canvas.width;
		const h = this.canvas.height;
		this.offCanvas.width = w;
		this.offCanvas.height = h;
		this.offCtx.clearRect(0, 0, w, h);

		const imgRatio = img.naturalWidth / img.naturalHeight;
		const canvasRatio = w / h;
		let drawW: number, drawH: number, drawX: number, drawY: number;

		if (canvasRatio > imgRatio) {
			drawW = w;
			drawH = w / imgRatio;
			drawX = 0;
			drawY = (h - drawH) / 2;
		} else {
			drawW = h * imgRatio;
			drawH = h;
			drawX = (w - drawW) / 2;
			drawY = 0;
		}

		this.offCtx.drawImage(img, drawX, drawY, drawW, drawH);
		const imgData = this.offCtx.getImageData(0, 0, w, h).data;

		const totalDots = this.dots.length / STRIDE;
		const cellSize = this.config.cellSize;

		for (let i = 0; i < totalDots; i++) {
			const ptr = i * STRIDE;
			const dx = this.dots[ptr];
			const dy = this.dots[ptr + 1];

			const imgIdx = (dy * w + dx) * 4;
			if (imgIdx < imgData.length - 2) {
				let r = imgData[imgIdx];
				let g = imgData[imgIdx + 1];
				let b = imgData[imgIdx + 2];

				const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
				if (brightness < 60) {
					r = Math.min(255, r + this.config.darkPixelBrighten);
					g = Math.min(255, g + this.config.darkPixelBrighten);
					b = Math.min(255, b + this.config.darkPixelBrighten);
				}

				this.dots[ptr + 7] = r;
				this.dots[ptr + 8] = g;
				this.dots[ptr + 9] = b;

				let targetRadius = ((255 - brightness) / 255) * (cellSize / 1.5);
				if (targetRadius < this.config.minRadius) targetRadius = this.config.minRadius;
				if (targetRadius > this.config.maxRadius) targetRadius = this.config.maxRadius;

				this.dots[ptr + 6] = targetRadius;
			}
		}
	}

	private renderLoop = (): void => {
		const w = this.canvas.width;
		const h = this.canvas.height;
		this.ctx.fillStyle = this.config.backgroundColor;
		this.ctx.fillRect(0, 0, w, h);

		let needsMoreFrames = false;
		const totalDots = this.dots.length / STRIDE;
		const halfCell = this.config.cellSize / 2;

		for (let i = 0; i < totalDots; i++) {
			const ptr = i * STRIDE;
			const dr = this.dots[ptr + 6] - this.dots[ptr + 2];
			const dR = this.dots[ptr + 7] - this.dots[ptr + 3];
			const dG = this.dots[ptr + 8] - this.dots[ptr + 4];
			const dB = this.dots[ptr + 9] - this.dots[ptr + 5];

			if (Math.abs(dr) > 0.1 || Math.abs(dR) > 1 || Math.abs(dG) > 1 || Math.abs(dB) > 1) {
				needsMoreFrames = true;
			}

			this.dots[ptr + 2] += dr * 0.06;
			this.dots[ptr + 3] += dR * 0.06;
			this.dots[ptr + 4] += dG * 0.06;
			this.dots[ptr + 5] += dB * 0.06;

			const radius = this.dots[ptr + 2];
			if (radius > 0.1) {
				const r = this.dots[ptr + 3] | 0;
				const g = this.dots[ptr + 4] | 0;
				const b = this.dots[ptr + 5] | 0;
				const x = this.dots[ptr] + halfCell;
				const y = this.dots[ptr + 1] + halfCell;

				this.ctx.fillStyle = `rgb(${r},${g},${b})`;
				this.ctx.beginPath();
				this.ctx.arc(x, y, radius, 0, Math.PI * 2);
				this.ctx.fill();
			}
		}

		if (needsMoreFrames) {
			this.animId = requestAnimationFrame(this.renderLoop);
		} else {
			this.animId = null;
		}
	};

	private loadNextImage(): void {
		if (this.images.length === 0) return;
		const src = this.images[Math.floor(Math.random() * this.images.length)];
		const img = new Image();
		img.crossOrigin = 'Anonymous';
		img.onload = () => {
			this.currentImg = img;
			this.updateDotTargets(img);
			if (this.animId === null) {
				this.renderLoop();
			}
		};
		img.src = src;
	}
}
