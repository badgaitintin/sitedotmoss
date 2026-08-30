/**
 * NextWBC — Three.js Iridescent Soap Bubble Engine
 * ─────────────────────────────────────────────────────────
 * WebGL-rendered soap bubbles with physically-based thin-film
 * interference, Fresnel transparency, and specular highlights.
 *
 * Renders to a fixed canvas behind the UI. Bubbles float upward
 * with buoyancy, wobble, and mouse repulsion physics. Age-expired
 * bubbles pop with a 3D inflate-fade + CSS particle splash.
 */

import {
	Scene,
	PerspectiveCamera,
	WebGLRenderer,
	IcosahedronGeometry,
	ShaderMaterial,
	Mesh,
	Vector2,
	Vector3,
	Clock,
	FrontSide,
	type BufferGeometry,
} from 'three';

// ── GLSL Shaders ────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;

void main() {
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vWorldPos = worldPos.xyz;
	vNormal = normalize(normalMatrix * normal);
	vViewDir = normalize(cameraPosition - worldPos.xyz);
	gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uThickness;
uniform float uPopProgress;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;

// ── Physically-based thin-film interference ──
// Simulates the rainbow colors on a soap bubble surface.
// Based on optical path difference: 2 * n * d * cos(theta_refracted)
vec3 thinFilmColor(float cosI, float thickness) {
	float n = 1.33; // refractive index of soap film
	float sinI = sqrt(max(1.0 - cosI * cosI, 0.0));
	float sinR = sinI / n;           // Snell's law
	float cosR = sqrt(max(1.0 - sinR * sinR, 0.0));
	float pathDiff = 2.0 * n * thickness * cosR;

	// Interference intensity for RGB wavelengths (micrometers)
	float pi = 3.14159265;
	vec3 lambda = vec3(0.650, 0.510, 0.475);
	vec3 phase = vec3(pi) * pathDiff / lambda;
	return cos(phase) * 0.5 + 0.5;
}

void main() {
	vec3 N = normalize(vNormal);
	vec3 V = normalize(vViewDir);
	float NdotV = max(dot(N, V), 0.0);

	// ── Fresnel (Schlick approximation) ──
	float F0 = 0.04;
	float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

	// ── Animated film thickness ──
	float t = uThickness
		+ sin(N.y * 3.14159 + uTime * 0.4) * 0.06
		+ cos(N.x * 2.5 - uTime * 0.3) * 0.04;

	vec3 filmColor = thinFilmColor(NdotV, t);

	// ── Key light specular (upper-left) ──
	vec3 L1 = normalize(vec3(-0.4, 1.0, 0.7));
	vec3 H1 = normalize(L1 + V);
	float spec1 = pow(max(dot(N, H1), 0.0), 96.0) * 0.85;

	// ── Fill light specular (lower-right, softer) ──
	vec3 L2 = normalize(vec3(0.7, -0.3, 0.5));
	vec3 H2 = normalize(L2 + V);
	float spec2 = pow(max(dot(N, H2), 0.0), 32.0) * 0.2;

	// ── Procedural environment reflection ──
	vec3 R = reflect(-V, N);
	float envY = R.y * 0.5 + 0.5;
	vec3 envColor = mix(
		vec3(0.78, 0.90, 1.0),   // horizon
		vec3(0.50, 0.70, 0.95),  // sky
		envY
	);

	// ── Compose final color ──
	vec3 color = filmColor;
	color = mix(color, envColor, fresnel * 0.3);
	color += (spec1 + spec2) * vec3(1.0, 0.98, 0.96);

	// Alpha: transparent in center, opaque at edges (like real bubbles)
	float alpha = fresnel * 0.42 + 0.04;

	// ── Pop animation: inflate + fade + glow ──
	alpha *= (1.0 - uPopProgress);
	color += uPopProgress * 0.4 * vec3(0.6, 0.85, 1.0);

	gl_FragColor = vec4(color, alpha);
}
`;

// ── Bubble data ─────────────────────────────────────────────

interface Bubble3D {
	mesh: Mesh<BufferGeometry, ShaderMaterial>;
	vx: number;
	vy: number;
	buoyancy: number;
	wobbleSpeed: number;
	wobbleAmp: number;
	phase: number;
	age: number;
	maxAge: number;
	isPopping: boolean;
	popStartTime: number;
	size: number; // world-space radius
}

// ── Config ──────────────────────────────────────────────────

export interface BubbleEngine3DConfig {
	totalBubbles: number;
	minSize: number;
	maxSize: number;
	mouseRepulsionDist: number;
	mouseRepulsionForce: number;
	minMaxAge: number;
	maxMaxAge: number;
	popDurationMs: number;
}

const DEFAULT_CONFIG: BubbleEngine3DConfig = {
	totalBubbles: 12,
	minSize: 0.15,
	maxSize: 0.65,
	mouseRepulsionDist: 2.5,
	mouseRepulsionForce: 0.06,
	minMaxAge: 600,
	maxMaxAge: 1800,
	popDurationMs: 350,
};

// ── Engine ──────────────────────────────────────────────────

export class AeroBubbleEngine3D {
	private scene: Scene;
	private camera: PerspectiveCamera;
	private renderer: WebGLRenderer;
	private bubbles: Bubble3D[] = [];
	private mouseNDC = new Vector2(-100, -100);
	private mouse3D = new Vector3(-100, -100, 0);
	private time = 0;
	private enabled: boolean;
	private animationId: number | null = null;
	private config: BubbleEngine3DConfig;
	private geometry: BufferGeometry;
	private clock = new Clock();

	private readonly coralReefLayer: HTMLElement | null;
	private readonly toggleBtn: HTMLElement | null;
	private readonly popContainer: HTMLElement | null;

	constructor(
		canvas: HTMLCanvasElement,
		options: {
			coralReefLayer?: HTMLElement | null;
			toggleBtn?: HTMLElement | null;
			popContainer?: HTMLElement | null;
			config?: Partial<BubbleEngine3DConfig>;
		} = {},
	) {
		this.config = { ...DEFAULT_CONFIG, ...options.config };
		this.coralReefLayer = options.coralReefLayer ?? null;
		this.toggleBtn = options.toggleBtn ?? null;
		this.popContainer = options.popContainer ?? null;
		this.enabled = localStorage.getItem('aero_bubbles_enabled') !== 'false';

		// Three.js setup
		this.scene = new Scene();

		const aspect = window.innerWidth / window.innerHeight;
		this.camera = new PerspectiveCamera(50, aspect, 0.1, 100);
		this.camera.position.z = 8;

		this.renderer = new WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			premultipliedAlpha: false,
		});
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setClearColor(0x000000, 0);

		// Shared geometry — smooth sphere (1280 triangles)
		this.geometry = new IcosahedronGeometry(1, 4);
	}

	// ── Public API ──────────────────────────────────────────

	start(): void {
		this.updateToggleUI();
		this.bindEvents();
		this.spawnInitialBubbles();
		this.clock.start();
		this.loop();
	}

	stop(): void {
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		this.geometry.dispose();
		for (const b of this.bubbles) b.mesh.material.dispose();
		this.renderer.dispose();
	}

	toggle(): boolean {
		this.enabled = !this.enabled;
		localStorage.setItem(
			'aero_bubbles_enabled',
			this.enabled ? 'true' : 'false',
		);
		this.updateToggleUI();
		return this.enabled;
	}

	get isEnabled(): boolean {
		return this.enabled;
	}

	// ── Event binding ─────────────────────────────────────

	private bindEvents(): void {
		window.addEventListener('mousemove', this.handleMouseMove);
		window.addEventListener('resize', this.handleResize);
		if (this.toggleBtn) {
			this.toggleBtn.addEventListener('click', () => this.toggle());
		}
	}

	private handleMouseMove = (e: MouseEvent): void => {
		this.mouseNDC.set(
			(e.clientX / window.innerWidth) * 2 - 1,
			-(e.clientY / window.innerHeight) * 2 + 1,
		);
		// Project mouse to 3D plane at z = 0
		const vec = new Vector3(this.mouseNDC.x, this.mouseNDC.y, 0.5);
		vec.unproject(this.camera);
		const dir = vec.sub(this.camera.position).normalize();
		const t = -this.camera.position.z / dir.z;
		this.mouse3D.copy(this.camera.position).add(dir.multiplyScalar(t));
	};

	private handleResize = (): void => {
		const w = window.innerWidth;
		const h = window.innerHeight;
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(w, h);
	};

	// ── Toggle UI ─────────────────────────────────────────

	private updateToggleUI(): void {
		const canvas = this.renderer.domElement;
		canvas.style.opacity = this.enabled ? '1' : '0';
		if (this.coralReefLayer) {
			this.coralReefLayer.style.opacity = this.enabled ? '0.95' : '0.25';
		}
		if (this.toggleBtn) {
			this.toggleBtn.classList.toggle('is-off', !this.enabled);
		}
	}

	// ── Visible bounds at z=0 ─────────────────────────────

	private getVisibleBounds() {
		const vFOV = (this.camera.fov * Math.PI) / 180;
		const halfH = Math.tan(vFOV / 2) * this.camera.position.z;
		const halfW = halfH * this.camera.aspect;
		return { halfW, halfH };
	}

	// ── Bubble lifecycle ──────────────────────────────────

	private spawnInitialBubbles(): void {
		for (let i = 0; i < this.config.totalBubbles; i++) {
			this.spawnBubble(true);
		}
	}

	private spawnBubble(isInitial: boolean): void {
		const { minSize, maxSize, minMaxAge, maxMaxAge } = this.config;
		const { halfW, halfH } = this.getVisibleBounds();

		const size = Math.random() * (maxSize - minSize) + minSize;
		const filmThickness = Math.random() * 0.5 + 0.25; // 0.25–0.75 micrometers

		const material = new ShaderMaterial({
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_SHADER,
			uniforms: {
				uTime: { value: 0 },
				uThickness: { value: filmThickness },
				uPopProgress: { value: 0 },
			},
			transparent: true,
			depthWrite: false,
			side: FrontSide,
		});

		const mesh = new Mesh(this.geometry, material);
		mesh.scale.setScalar(size);

		const x = (Math.random() - 0.5) * halfW * 1.8;
		const y = isInitial
			? (Math.random() - 0.5) * halfH * 1.8
			: -halfH - size - Math.random() * 2;
		mesh.position.set(x, y, (Math.random() - 0.5) * 2);

		this.scene.add(mesh);

		this.bubbles.push({
			mesh,
			vx: (Math.random() - 0.5) * 0.02,
			vy: Math.random() * 0.008 + 0.004,
			buoyancy: Math.random() * 0.0004 + 0.0002,
			wobbleSpeed: Math.random() * 0.015 + 0.005,
			wobbleAmp: Math.random() * 0.015 + 0.005,
			phase: Math.random() * Math.PI * 2,
			age: 0,
			maxAge:
				Math.floor(Math.random() * (maxMaxAge - minMaxAge)) + minMaxAge,
			isPopping: false,
			popStartTime: 0,
			size,
		});
	}

	private popBubble(b: Bubble3D): void {
		if (b.isPopping) return;
		b.isPopping = true;
		b.popStartTime = this.time;
	}

	/** O(1) swap-and-pop removal. */
	private removeBubbleAt(index: number): void {
		const b = this.bubbles[index];
		this.scene.remove(b.mesh);
		b.mesh.material.dispose();

		const last = this.bubbles.length - 1;
		if (index < last) this.bubbles[index] = this.bubbles[last];
		this.bubbles.pop();
	}

	// ── CSS pop particle splash ───────────────────────────

	private spawnPopParticlesAt(worldPos: Vector3, size: number): void {
		if (!this.popContainer) return;

		const screen = worldPos.clone().project(this.camera);
		const sx = (screen.x * 0.5 + 0.5) * window.innerWidth;
		const sy = (-screen.y * 0.5 + 0.5) * window.innerHeight;

		const burst = document.createElement('div');
		burst.className = 'aero-pop-burst';
		burst.style.left = `${sx}px`;
		burst.style.top = `${sy}px`;

		const dropDist = Math.max(size * 55, 16);
		burst.style.setProperty('--drop-dist', `${dropDist}px`);

		for (let d = 0; d < 7; d++) {
			const drop = document.createElement('div');
			drop.className = 'aero-pop-drop';
			drop.style.transform = `rotate(${((360 / 7) * d).toFixed(1)}deg)`;
			burst.appendChild(drop);
		}

		this.popContainer.appendChild(burst);
		setTimeout(() => burst.remove(), 450);
	}

	// ── Animation loop ──────────────────────────────────

	private loop = (): void => {
		this.animationId = requestAnimationFrame(this.loop);
		this.time += 1;

		const elapsed = this.clock.getElapsedTime();

		if (!this.enabled) {
			this.renderer.render(this.scene, this.camera);
			return;
		}

		const { halfW, halfH } = this.getVisibleBounds();
		const { mouseRepulsionDist, mouseRepulsionForce, popDurationMs } =
			this.config;
		const popFrames = popDurationMs / 16.67;

		for (let i = this.bubbles.length - 1; i >= 0; i--) {
			const b = this.bubbles[i];
			const mat = b.mesh.material;

			// Update shader time
			mat.uniforms.uTime.value = elapsed;

			// ── Pop animation ──
			if (b.isPopping) {
				const popAge = this.time - b.popStartTime;
				const progress = Math.min(popAge / popFrames, 1);
				mat.uniforms.uPopProgress.value = progress;
				b.mesh.scale.setScalar(b.size * (1 + progress * 0.5));

				if (progress >= 1) {
					this.spawnPopParticlesAt(b.mesh.position, b.size);
					this.removeBubbleAt(i);
					setTimeout(
						() => this.spawnBubble(false),
						Math.random() * 1500 + 500,
					);
				}
				continue;
			}

			b.age += 1;

			// ── Age pop or random pop ──
			if (b.age > b.maxAge || Math.random() < 0.0004) {
				this.popBubble(b);
				continue;
			}

			// Buoyancy
			b.vy += b.buoyancy;

			// Wobble
			b.vx +=
				Math.sin(this.time * b.wobbleSpeed + b.phase) * b.wobbleAmp;

			// Mouse repulsion
			const dx = b.mesh.position.x - this.mouse3D.x;
			const dy = b.mesh.position.y - this.mouse3D.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < mouseRepulsionDist && dist > 0.01) {
				const force =
					(1 - dist / mouseRepulsionDist) * mouseRepulsionForce;
				b.vx += (dx / dist) * force;
				b.vy += (dy / dist) * force;
			}

			// Apply velocity
			b.mesh.position.x += b.vx;
			b.mesh.position.y += b.vy;

			// Damping
			b.vx *= 0.96;
			b.vy *= 0.96;

			// Recycle off-top
			if (b.mesh.position.y > halfH + b.size * 2) {
				b.mesh.position.y = -halfH - b.size - Math.random() * 2;
				b.mesh.position.x = (Math.random() - 0.5) * halfW * 1.8;
				b.vy = Math.random() * 0.008 + 0.004;
				b.vx = (Math.random() - 0.5) * 0.02;
				b.age = 0;
			}

			// Boundary bounce (left/right)
			if (b.mesh.position.x < -halfW + b.size) {
				b.mesh.position.x = -halfW + b.size;
				b.vx = Math.abs(b.vx) * 0.6;
			} else if (b.mesh.position.x > halfW - b.size) {
				b.mesh.position.x = halfW - b.size;
				b.vx = -Math.abs(b.vx) * 0.6;
			}

			// Organic breathing scale
			const breathe = 1 + Math.sin(elapsed * 0.8 + b.phase) * 0.03;
			b.mesh.scale.setScalar(b.size * breathe);
		}

		this.renderer.render(this.scene, this.camera);
	};
}
