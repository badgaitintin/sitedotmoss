/**
 * dot-matrix-engine.ts — Performance-optimized Geometric Halftone & Dot Matrix Canvas Engine.
 * 
 * Supports diverse geometric glyphs (Circles, Squares, Triangles, 4-Pointed Stars, Crosses)
 * and randomized Bauhaus accent color pops (Crimson Red, Cobalt Blue, Gold Yellow, Electric Cyan)
 * layered over Madonna album halftone imagery.
 * 
 * Layout per dot (Stride 12 floats):
 *   [0] x, [1] y, [2] radius, [3] r, [4] g, [5] b,
 *   [6] targetRadius, [7] targetR, [8] targetG, [9] targetB,
 *   [10] shapeType (0: circle, 1: square, 2: triangle, 3: star, 4: plus),
 *   [11] accentType (0: standard RGB, 1: red, 2: blue, 3: yellow, 4: cyan)
 */

export interface DotMatrixConfig {
	cellSize: number;
	minRadius: number;
	maxRadius: number;
	darkPixelBrighten: number;
	backgroundColor: string;
	imageIntervalMs: number;
	accentFrequency: number; // probability of accent dot (0.0 to 1.0)
}

export const DEFAULT_DOT_CONFIG: DotMatrixConfig = {
	cellSize: 7,
	minRadius: 0.4,
	maxRadius: 7 / 2 - 0.2,
	darkPixelBrighten: 70,
	backgroundColor: '#ffffff',
	imageIntervalMs: 20000,
	accentFrequency: 0.08,
};

const STRIDE = 12;

// Bauhaus accent RGB color definitions
const ACCENT_COLORS = [
	null, // 0: natural image color
	{ r: 239, g: 35, b: 60 },  // 1: Crimson Red (#ef233c)
	{ r: 22, g: 66, b: 232 },  // 2: Cobalt Blue (#1642e8)
	{ r: 251, g: 191, b: 36 }, // 3: Gold Yellow (#fbbf24)
	{ r: 56, g: 189, b: 248 }, // 4: Electric Cyan (#38bdf8)
];

export class DotMatrixEngine {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly offCanvas: HTMLCanvasElement;
	private readonly offCtx: CanvasRenderingContext2D;
	private readonly config: DotMatrixConfig;

	private dots: Float32Array = new Float32Array(0);
	private animId: number | null = null;
	private intervalId: number | null = null;
	private shimmerIntervalId: number | null = null;
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

		// Subtle randomized color shimmer on accent dots every 3.5 seconds
		this.shimmerIntervalId = window.setInterval(() => {
			this.randomizeSomeAccents();
		}, 3500);
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
		if (this.shimmerIntervalId !== null) {
			clearInterval(this.shimmerIntervalId);
			this.shimmerIntervalId = null;
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

				// Assign Geometric Shape: 0: Circle (55%), 1: Square (15%), 2: Triangle (12%), 3: Star (12%), 4: Cross (6%)
				const shapeRand = (Math.sin(c * 12.9898 + r * 78.233) * 43758.5453) % 1;
				const absRand = Math.abs(shapeRand);
				let shapeType = 0;
				if (absRand > 0.94) shapeType = 4;      // Cross
				else if (absRand > 0.82) shapeType = 3; // 4-Point Star
				else if (absRand > 0.70) shapeType = 2; // Triangle
				else if (absRand > 0.55) shapeType = 1; // Square
				else shapeType = 0;                     // Circle

				this.dots[ptr + 10] = shapeType;

				// Random accent color pop
				const accentRand = (Math.sin(c * 93.9898 + r * 37.233) * 12758.5453) % 1;
				if (Math.abs(accentRand) < this.config.accentFrequency) {
					// 1: Red, 2: Blue, 3: Yellow, 4: Cyan
					this.dots[ptr + 11] = 1 + Math.floor(Math.abs(accentRand) * 400) % 4;
				} else {
					this.dots[ptr + 11] = 0;
				}

				ptr += STRIDE;
			}
		}
	}

	private randomizeSomeAccents(): void {
		const totalDots = this.dots.length / STRIDE;
		const countToShift = Math.floor(totalDots * 0.03); // shift 3% of dots

		for (let i = 0; i < countToShift; i++) {
			const idx = Math.floor(Math.random() * totalDots);
			const ptr = idx * STRIDE;
			if (Math.random() < 0.5) {
				this.dots[ptr + 11] = 1 + Math.floor(Math.random() * 4); // assign new random accent
			} else {
				this.dots[ptr + 11] = 0; // return to natural color
			}
		}

		if (this.animId === null && this.currentImg) {
			this.renderLoop();
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

				const accent = this.dots[ptr + 11] | 0;
				if (accent > 0 && ACCENT_COLORS[accent]) {
					const ac = ACCENT_COLORS[accent]!;
					r = ac.r;
					g = ac.g;
					b = ac.b;
				}

				this.dots[ptr + 7] = r;
				this.dots[ptr + 8] = g;
				this.dots[ptr + 9] = b;

				let targetRadius = ((255 - brightness) / 255) * (cellSize / 1.6);
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

			if (Math.abs(dr) > 0.08 || Math.abs(dR) > 1 || Math.abs(dG) > 1 || Math.abs(dB) > 1) {
				needsMoreFrames = true;
			}

			this.dots[ptr + 2] += dr * 0.065;
			this.dots[ptr + 3] += dR * 0.065;
			this.dots[ptr + 4] += dG * 0.065;
			this.dots[ptr + 5] += dB * 0.065;

			const radius = this.dots[ptr + 2];
			if (radius > 0.15) {
				const r = this.dots[ptr + 3] | 0;
				const g = this.dots[ptr + 4] | 0;
				const b = this.dots[ptr + 5] | 0;
				const x = this.dots[ptr] + halfCell;
				const y = this.dots[ptr + 1] + halfCell;
				const shapeType = this.dots[ptr + 10] | 0;

				this.ctx.fillStyle = `rgb(${r},${g},${b})`;

				switch (shapeType) {
					case 1: { // Square
						const side = radius * 1.6;
						this.ctx.fillRect(x - side / 2, y - side / 2, side, side);
						break;
					}
					case 2: { // Triangle
						this.ctx.beginPath();
						this.ctx.moveTo(x, y - radius * 1.3);
						this.ctx.lineTo(x + radius * 1.15, y + radius * 0.85);
						this.ctx.lineTo(x - radius * 1.15, y + radius * 0.85);
						this.ctx.closePath();
						this.ctx.fill();
						break;
					}
					case 3: { // 4-Pointed Diamond Star
						const rOuter = radius * 1.35;
						this.ctx.beginPath();
						this.ctx.moveTo(x, y - rOuter);
						this.ctx.quadraticCurveTo(x, y, x + rOuter, y);
						this.ctx.quadraticCurveTo(x, y, x, y + rOuter);
						this.ctx.quadraticCurveTo(x, y, x - rOuter, y);
						this.ctx.quadraticCurveTo(x, y, x, y - rOuter);
						this.ctx.closePath();
						this.ctx.fill();
						break;
					}
					case 4: { // Cross / Plus
						const armW = radius * 0.4;
						const armL = radius * 1.25;
						this.ctx.fillRect(x - armW, y - armL, armW * 2, armL * 2);
						this.ctx.fillRect(x - armL, y - armW, armL * 2, armW * 2);
						break;
					}
					default: { // Circle (0)
						this.ctx.beginPath();
						this.ctx.arc(x, y, radius, 0, Math.PI * 2);
						this.ctx.fill();
						break;
					}
				}
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
