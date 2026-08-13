/**
 * NextWBC — Aero Aquarium Fish Spawner
 * ─────────────────────────────────────────────────────────
 * Spawns and manages swimming tropical fish (fish1-fish4)
 * with Frutiger Aero aesthetics, organic undulating motion,
 * randomized depths, and reactive cursor darting.
 */

export interface FishConfig {
	src: string;
	baseWidth: number;
	flippedByDefault?: boolean;
}

export const FISH_SPECIES: FishConfig[] = [
	{ src: '/fish1.png', baseWidth: 72 },
	{ src: '/fish2.png', baseWidth: 88 },
	{ src: '/fish3.webp', baseWidth: 68 },
	{ src: '/fish4.png', baseWidth: 78 },
];

export class FishSpawner {
	private container: HTMLElement;
	private timerId: number | null = null;
	private activeFishCount: number = 0;
	private maxConcurrentFish: number = 4;
	private isRunning: boolean = false;

	constructor(container: HTMLElement, options: { maxFish?: number } = {}) {
		this.container = container;
		this.maxConcurrentFish = options.maxFish ?? 4;
	}

	public start(): void {
		if (this.isRunning) return;
		this.isRunning = true;
		// Spawn 2 initial fish with slight stagger
		this.spawnFish();
		setTimeout(() => {
			if (this.isRunning) this.spawnFish();
		}, 1800);
		this.scheduleNextSpawn();
	}

	public stop(): void {
		this.isRunning = false;
		if (this.timerId !== null) {
			clearTimeout(this.timerId);
			this.timerId = null;
		}
	}

	private scheduleNextSpawn(): void {
		if (!this.isRunning) return;
		const delay = Math.random() * 3500 + 2500; // 2.5s - 6s
		this.timerId = window.setTimeout(() => {
			if (this.activeFishCount < this.maxConcurrentFish) {
				this.spawnFish();
			}
			this.scheduleNextSpawn();
		}, delay);
	}

	public spawnFish(): void {
		if (!this.container) return;

		const species = FISH_SPECIES[Math.floor(Math.random() * FISH_SPECIES.length)];
		const goingRight = Math.random() > 0.5;
		const scale = 0.75 + Math.random() * 0.5; // 0.75x to 1.25x
		const width = Math.round(species.baseWidth * scale);
		const startY = Math.round(Math.random() * 62 + 18); // 18% to 80% vh
		const duration = Math.round((12 + Math.random() * 10) * 10) / 10; // 12s to 22s
		const isBackground = Math.random() > 0.35; // 65% background, 35% midground

		const fishEl = document.createElement('div');
		fishEl.className = `wbc-swimming-fish ${isBackground ? 'fish-layer-back' : 'fish-layer-mid'}`;
		fishEl.style.width = `${width}px`;
		fishEl.style.top = `${startY}%`;
		fishEl.style.animationDuration = `${duration}s`;

		const img = document.createElement('img');
		img.src = species.src;
		img.alt = 'Swimming Tropical Fish';
		img.className = 'wbc-fish-img';
		// Flip sprite according to swim direction
		img.style.transform = goingRight ? 'scaleX(-1)' : 'scaleX(1)';

		fishEl.appendChild(img);

		if (goingRight) {
			fishEl.classList.add('swim-left-to-right');
		} else {
			fishEl.classList.add('swim-right-to-left');
		}

		// Cursor hover interaction: dart forward slightly with bubbles
		fishEl.addEventListener('mouseenter', () => {
			fishEl.style.animationDuration = `${Math.max(4, duration * 0.45)}s`;
			fishEl.style.filter = 'drop-shadow(0 0 12px rgba(56,189,248,0.7)) brightness(1.15)';
		});

		this.activeFishCount++;
		this.container.appendChild(fishEl);

		// Remove on animation end
		fishEl.addEventListener('animationend', () => {
			fishEl.remove();
			this.activeFishCount = Math.max(0, this.activeFishCount - 1);
		});
	}
}
