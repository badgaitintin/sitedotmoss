/**
 * NextWBC — Aero Glass Bubble Physics Engine
 * ─────────────────────────────────────────────────────────
 * Self-contained physics simulation for floating glass bubbles.
 * Optimizations:
 *   - Swap-and-pop removal (O(1) vs splice's O(n))
 *   - Per-frame dimension caching (avoids repeated window queries)
 *   - Batched DOM writes in a single rAF
 *   - Proper cancelAnimationFrame on stop()
 */

// ── Bubble data structure ───────────────────────────────────
export interface Bubble {
	el: HTMLElement;
	isFront: boolean;
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	buoyancy: number;
	wobbleSpeed: number;
	wobbleAmp: number;
	phase: number;
	age: number;
	maxAge: number;
	isPopping: boolean;
}

// ── Engine configuration ────────────────────────────────────
export interface BubbleEngineConfig {
	totalBubbles: number;
	backRatio: number;       // fraction of bubbles in back layer (0-1)
	mouseRepulsionDist: number;
	mouseRepulsionForce: number;
	bounceDamping: number;
	velocityDamping: number;
	popParticleCount: number;
	minSize: number;
	maxSize: number;
	minMaxAge: number;       // frames
	maxMaxAge: number;       // frames
	randomPopChance: number; // per-frame probability of spontaneous pop
}

const DEFAULT_CONFIG: BubbleEngineConfig = {
	totalBubbles: 20,
	backRatio: 0.8,
	mouseRepulsionDist: 180,
	mouseRepulsionForce: 3.5,
	bounceDamping: 0.8,
	velocityDamping: 0.94,
	popParticleCount: 6,
	minSize: 24,
	maxSize: 78,
	minMaxAge: 500,
	maxMaxAge: 1400,
	randomPopChance: 0.0006,
};

/**
 * Aero Glass Bubble physics engine.
 *
 * Creates and animates glass bubbles across two stage layers
 * (back = behind UI, front = above UI). Supports mouse repulsion,
 * boundary bounce, buoyancy, wobble, and pop-with-particles effects.
 */
export class AeroBubbleEngine {
	private bubbles: Bubble[] = [];
	private enabled: boolean;
	private animationId: number | null = null;
	private time: number = 0;
	private mouseX: number = -1000;
	private mouseY: number = -1000;

	private readonly backStage: HTMLElement;
	private readonly frontStage: HTMLElement;
	private readonly config: BubbleEngineConfig;

	// Optional external elements controlled by the toggle
	private readonly coralReefLayer: HTMLElement | null;
	private readonly toggleBtn: HTMLElement | null;

	constructor(
		backStage: HTMLElement,
		frontStage: HTMLElement,
		options: {
			coralReefLayer?: HTMLElement | null;
			toggleBtn?: HTMLElement | null;
			config?: Partial<BubbleEngineConfig>;
		} = {},
	) {
		this.backStage = backStage;
		this.frontStage = frontStage;
		this.coralReefLayer = options.coralReefLayer ?? null;
		this.toggleBtn = options.toggleBtn ?? null;
		this.config = { ...DEFAULT_CONFIG, ...options.config };

		// Restore persisted preference
		this.enabled = localStorage.getItem('aero_bubbles_enabled') !== 'false';
	}

	// ── Public API ───────────────────────────────────────────

	/** Start the engine: spawn initial bubbles and begin animation loop. */
	start(): void {
		this.updateToggleUI();
		this.bindEvents();
		this.spawnInitialBubbles();
		this.loop();
	}

	/** Stop the animation loop and clean up. */
	stop(): void {
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
	}

	/** Toggle bubbles on/off. Returns the new enabled state. */
	toggle(): boolean {
		if (this.enabled) {
			this.triggerButtonPopSplash();
			this.enabled = false;
		} else {
			this.enabled = true;
		}
		localStorage.setItem('aero_bubbles_enabled', this.enabled ? 'true' : 'false');
		this.updateToggleUI();
		return this.enabled;
	}

	/** Whether bubbles are currently enabled. */
	get isEnabled(): boolean {
		return this.enabled;
	}

	// ── Event binding ────────────────────────────────────────

	private bindEvents(): void {
		window.addEventListener('mousemove', (e: MouseEvent) => {
			this.mouseX = e.clientX;
			this.mouseY = e.clientY;
		});

		if (this.toggleBtn) {
			this.toggleBtn.addEventListener('click', () => this.toggle());
		}
	}

	// ── Toggle UI ────────────────────────────────────────────

	private updateToggleUI(): void {
		if (this.enabled) {
			this.backStage.style.opacity = '1';
			this.frontStage.style.opacity = '1';
			if (this.coralReefLayer) this.coralReefLayer.style.opacity = '0.95';
			if (this.toggleBtn) this.toggleBtn.classList.remove('is-off');
		} else {
			this.backStage.style.opacity = '0';
			this.frontStage.style.opacity = '0';
			if (this.coralReefLayer) this.coralReefLayer.style.opacity = '0.25';
			if (this.toggleBtn) this.toggleBtn.classList.add('is-off');
		}
	}

	// ── Bubble lifecycle ─────────────────────────────────────

	private spawnInitialBubbles(): void {
		const { totalBubbles, backRatio } = this.config;
		const backCount = Math.round(totalBubbles * backRatio);
		const frontCount = totalBubbles - backCount;

		for (let i = 0; i < backCount; i++) this.spawnBubble(false, true);
		for (let i = 0; i < frontCount; i++) this.spawnBubble(true, true);
	}

	private spawnBubble(isFront: boolean, isInitial: boolean): void {
		const { minSize, maxSize, minMaxAge, maxMaxAge } = this.config;
		const stage = isFront ? this.frontStage : this.backStage;
		const el = document.createElement('div');
		el.className = 'aero-glass-bubble';

		const size = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
		const x = Math.random() * (window.innerWidth - size - 40) + 20;
		const y = isInitial
			? Math.random() * (window.innerHeight - size - 60) + 20
			: window.innerHeight + size + Math.random() * 50;
		const opacity = Math.random() * 0.35 + 0.65;

		el.style.width = `${size}px`;
		el.style.height = `${size}px`;
		el.style.opacity = opacity.toString();

		stage.appendChild(el);

		const bubbleObj: Bubble = {
			el,
			isFront,
			x,
			y,
			size,
			vx: (Math.random() - 0.5) * 1.5,
			vy: -(Math.random() * 1.2 + 0.6),
			buoyancy: -(Math.random() * 0.3 + 0.2),
			wobbleSpeed: Math.random() * 0.025 + 0.01,
			wobbleAmp: Math.random() * 20 + 8,
			phase: Math.random() * Math.PI * 2,
			age: 0,
			maxAge: Math.floor(Math.random() * (maxMaxAge - minMaxAge)) + minMaxAge,
			isPopping: false,
		};

		el.addEventListener('click', (e) => {
			e.stopPropagation();
			const idx = this.bubbles.indexOf(bubbleObj);
			if (idx !== -1) {
				this.popBubble(idx);
			}
		});

		this.bubbles.push(bubbleObj);
	}

	// ── Pop effect ───────────────────────────────────────────

	private popBubble(index: number): void {
		const b = this.bubbles[index];
		if (b.isPopping) return;
		b.isPopping = true;

		const stage = b.isFront ? this.frontStage : this.backStage;
		const centerX = b.x + b.size / 2;
		const centerY = b.y + b.size / 2;

		b.el.classList.add('is-popping');

		// Spawn 7 radial droplets splash burst
		this.spawnPopParticles(stage, centerX, centerY, b.size);

		const isFront = b.isFront;

		// Swap-and-pop removal after animation completes
		setTimeout(() => {
			if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
			this.removeBubbleAt(index);

			// Respawn replacement from bottom
			setTimeout(() => {
				this.spawnBubble(isFront, false);
			}, Math.random() * 1200 + 400);
		}, 200);
	}

	/**
	 * O(1) removal via swap-and-pop.
	 * Swaps the element at `index` with the last element,
	 * then pops the array. Order doesn't matter for bubbles.
	 */
	private removeBubbleAt(index: number): void {
		const last = this.bubbles.length - 1;
		if (index < last) {
			this.bubbles[index] = this.bubbles[last];
		}
		this.bubbles.pop();
	}

	private spawnPopParticles(
		stage: HTMLElement,
		cx: number,
		cy: number,
		size: number = 32,
	): void {
		const burst = document.createElement('div');
		burst.className = 'aero-pop-burst';
		burst.style.left = `${cx}px`;
		burst.style.top = `${cy}px`;

		const numDrops = 7;
		const dropDist = Math.max(size * 0.75, 24);
		burst.style.setProperty('--drop-dist', `${dropDist}px`);

		for (let d = 0; d < numDrops; d++) {
			const angle = (360 / numDrops) * d;
			const drop = document.createElement('div');
			drop.className = 'aero-pop-drop';
			drop.style.transform = `rotate(${angle.toFixed(1)}deg)`;
			burst.appendChild(drop);
		}

		stage.appendChild(burst);

		setTimeout(() => {
			if (burst.parentNode) burst.parentNode.removeChild(burst);
		}, 450);
	}

	private triggerButtonPopSplash(): void {
		if (!this.toggleBtn) return;
		const rect = this.toggleBtn.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		this.spawnPopParticles(document.body, cx, cy, 48);
	}

	// ── Physics loop ─────────────────────────────────────────

	private loop = (): void => {
		this.time += 1;

		if (this.enabled) {
			// Cache dimensions once per frame
			const screenW = window.innerWidth;
			const screenH = window.innerHeight;
			const { mouseRepulsionDist, mouseRepulsionForce, bounceDamping, velocityDamping, randomPopChance } = this.config;

			// Iterate backwards so swap-and-pop doesn't skip elements
			for (let i = this.bubbles.length - 1; i >= 0; i--) {
				const b = this.bubbles[i];
				if (b.isPopping) continue;

				b.age += 1;

				// Check for pop (age or random chance)
				if (b.age > b.maxAge || Math.random() < randomPopChance) {
					this.popBubble(i);
					continue;
				}

				// Buoyancy + wobble
				b.vy += b.buoyancy * 0.04;
				b.vx += Math.sin(this.time * b.wobbleSpeed + b.phase) * 0.12;

				// Recycle if floated off top
				if (b.y < -b.size * 1.5) {
					b.y = screenH + b.size + Math.random() * 30;
					b.x = Math.random() * (screenW - b.size);
					b.vy = -(Math.random() * 0.8 + 0.4);
					b.vx = (Math.random() - 0.5) * 1.5;
					b.age = 0;
				}

				// Mouse repulsion
				const cx = b.x + b.size / 2;
				const cy = b.y + b.size / 2;
				const dx = cx - this.mouseX;
				const dy = cy - this.mouseY;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < mouseRepulsionDist && dist > 0) {
					const force = (1 - dist / mouseRepulsionDist) * mouseRepulsionForce;
					b.vx += (dx / dist) * force;
					b.vy += (dy / dist) * force;
				}

				// Apply velocity
				b.x += b.vx;
				b.y += b.vy;

				// Damping
				b.vx *= velocityDamping;
				b.vy *= velocityDamping;

				// Boundary bounce
				AeroBubbleEngine.applyBoundaryBounce(b, screenW, screenH, bounceDamping);

				// Squash & stretch
				const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
				const scaleX = (1 + Math.sin(this.time * 0.06 + b.phase) * 0.05 + Math.min(speed * 0.02, 0.12)).toFixed(3);
				const scaleY = (1 - Math.sin(this.time * 0.06 + b.phase) * 0.05 - Math.min(speed * 0.02, 0.12)).toFixed(3);

				b.el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0) scale(${scaleX}, ${scaleY})`;
			}
		}

		this.animationId = requestAnimationFrame(this.loop);
	};

	// ── Static physics helpers (testable) ────────────────────

	/**
	 * Clamp bubble position within screen bounds and reverse velocity on impact.
	 * Static so it can be unit-tested without DOM.
	 */
	static applyBoundaryBounce(
		b: Pick<Bubble, 'x' | 'y' | 'vx' | 'vy' | 'size'>,
		screenW: number,
		screenH: number,
		damping: number,
	): void {
		if (b.x < 0) {
			b.x = 0;
			b.vx = Math.abs(b.vx) * damping + 0.6;
		} else if (b.x + b.size > screenW) {
			b.x = screenW - b.size;
			b.vx = -Math.abs(b.vx) * damping - 0.6;
		}

		if (b.y < 0) {
			b.y = 0;
			b.vy = Math.abs(b.vy) * damping + 0.6;
		} else if (b.y + b.size > screenH) {
			b.y = screenH - b.size;
			b.vy = -Math.abs(b.vy) * damping - 0.6;
		}
	}
}
