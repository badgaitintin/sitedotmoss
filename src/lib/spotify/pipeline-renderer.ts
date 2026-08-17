/**
 * pipeline-renderer.ts — Interactive Stage Flow & Architecture Visualizer
 * for the Spotify Sonic Atlas ML Pipeline.
 * Uses clean SVG icons and professional data science typography.
 */

import { PIPELINE_STAGES } from './pipeline-data';
import type { PipelineStage, PipelineViewMode } from './spotify-types';
import type { SpotifyDataStore } from './spotify-store';

/** Inline SVG icon primitives */
export const ICONS = {
	chart: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
	pulse: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
	check: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
	cross: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
	arrowRight: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
	arrowLeft: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
	play: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
	pause: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
	restart: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
	grid: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
	stageFlow: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
	filter: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
};

export class PipelineRenderer {
	private store: SpotifyDataStore | null = null;
	private activeStageIndex: number = 0;
	private viewMode: PipelineViewMode = 'stage';
	private autoPlayInterval: number | null = null;
	private transformViewMode: 'raw' | 'transformed' = 'transformed';
	private plotViewMode: Record<number, 'sim' | 'plot'> = {};

	// DOM element references
	private containerEl!: HTMLElement;
	private questTrackEl!: HTMLElement;
	private stageVisualizerEl!: HTMLElement;
	private stageHudEl!: HTMLElement;
	private gridContainerEl!: HTMLElement;
	private questContainerEl!: HTMLElement;
	private prevBtn!: HTMLButtonElement | null;
	private nextBtn!: HTMLButtonElement | null;
	private modeToggleBtn!: HTMLButtonElement | null;
	private autoPlayBtn!: HTMLButtonElement | null;

	constructor(store?: SpotifyDataStore) {
		if (store) {
			this.store = store;
		}
	}

	/** Set or update the data store */
	setStore(store: SpotifyDataStore): void {
		this.store = store;
	}

	/** Initialize DOM hooks and event listeners */
	init(store?: SpotifyDataStore): void {
		if (store) this.store = store;

		this.containerEl = document.getElementById('pipeline-interactive-root')!;
		if (!this.containerEl) return;

		this.questTrackEl = document.getElementById('pipeline-quest-track')!;
		this.stageVisualizerEl = document.getElementById('pipeline-stage-visualizer')!;
		this.stageHudEl = document.getElementById('pipeline-stage-hud')!;
		this.gridContainerEl = document.getElementById('pipeline-grid-view')!;
		this.questContainerEl = document.getElementById('pipeline-quest-view')!;
		this.prevBtn = document.getElementById('pipeline-prev-btn') as HTMLButtonElement | null;
		this.nextBtn = document.getElementById('pipeline-next-btn') as HTMLButtonElement | null;
		this.modeToggleBtn = document.getElementById('pipeline-view-mode-btn') as HTMLButtonElement | null;
		this.autoPlayBtn = document.getElementById('pipeline-autoplay-btn') as HTMLButtonElement | null;

		// Stage Track button clicks (event delegation)
		this.questTrackEl?.addEventListener('click', (e) => {
			const btn = (e.target as Element).closest<HTMLButtonElement>('.pipeline-node-btn');
			if (!btn) return;
			const idx = Number(btn.dataset.stageIdx);
			if (!isNaN(idx)) {
				this.setStage(idx);
			}
		});

		// Grid view card clicks
		this.gridContainerEl?.addEventListener('click', (e) => {
			const card = (e.target as Element).closest<HTMLElement>('.stage-grid-card');
			if (!card) return;
			const idx = Number(card.dataset.stageIdx);
			if (!isNaN(idx)) {
				this.setStage(idx);
				this.setViewMode('stage');
			}
		});

		// Prev / Next Controls
		this.prevBtn?.addEventListener('click', () => this.prevStage());
		this.nextBtn?.addEventListener('click', () => this.nextStage());

		// Mode Toggle Button
		this.modeToggleBtn?.addEventListener('click', () => {
			const nextMode: PipelineViewMode = this.viewMode === 'stage' ? 'grid' : 'stage';
			this.setViewMode(nextMode);
		});

		// Auto Play / Tour Flow Button
		this.autoPlayBtn?.addEventListener('click', () => this.toggleAutoPlay());

		// Visualizer internal controls (e.g. Stage 2 raw/transformed toggle or plot toggles)
		this.stageVisualizerEl?.addEventListener('click', (e) => {
			const curveToggle = (e.target as Element).closest<HTMLButtonElement>('.curve-mode-toggle');
			if (curveToggle) {
				const mode = curveToggle.dataset.mode as 'raw' | 'transformed';
				if (mode) {
					this.transformViewMode = mode;
					this.renderStageView();
					return;
				}
			}

			const plotToggle = (e.target as Element).closest<HTMLButtonElement>('.plot-toggle-btn');
			if (plotToggle) {
				const current = this.plotViewMode[this.activeStageIndex] || 'sim';
				this.plotViewMode[this.activeStageIndex] = current === 'sim' ? 'plot' : 'sim';
				this.renderStageView();
				return;
			}
		});

		this.render();
	}

	/** Set active stage index (0-7) */
	setStage(index: number): void {
		if (index < 0 || index >= PIPELINE_STAGES.length) return;
		this.activeStageIndex = index;
		this.render();
	}

	nextStage(): void {
		this.activeStageIndex = (this.activeStageIndex + 1) % PIPELINE_STAGES.length;
		this.render();
	}

	prevStage(): void {
		this.activeStageIndex = (this.activeStageIndex - 1 + PIPELINE_STAGES.length) % PIPELINE_STAGES.length;
		this.render();
	}

	setViewMode(mode: PipelineViewMode): void {
		this.viewMode = mode;
		this.render();
	}

	toggleAutoPlay(): void {
		if (this.autoPlayInterval !== null) {
			clearInterval(this.autoPlayInterval);
			this.autoPlayInterval = null;
			if (this.autoPlayBtn) {
				this.autoPlayBtn.innerHTML = `${ICONS.play} <span>TOUR PIPELINE</span>`;
				this.autoPlayBtn.classList.remove('active');
			}
		} else {
			this.autoPlayInterval = window.setInterval(() => {
				this.nextStage();
			}, 3600);
			if (this.autoPlayBtn) {
				this.autoPlayBtn.innerHTML = `${ICONS.pause} <span>PAUSE</span>`;
				this.autoPlayBtn.classList.add('active');
			}
		}
	}

	/** Main render function */
	render(): void {
		if (!this.containerEl) return;

		// Update Top Stage Progression Track
		if (this.questTrackEl) {
			this.questTrackEl.innerHTML = PipelineRenderer.renderQuestTrack(this.activeStageIndex);
		}

		// Toggle View Mode visibility
		if (this.questContainerEl && this.gridContainerEl) {
			if (this.viewMode === 'stage') {
				this.questContainerEl.classList.remove('hidden');
				this.gridContainerEl.classList.add('hidden');
			} else {
				this.questContainerEl.classList.add('hidden');
				this.gridContainerEl.classList.remove('hidden');
				this.gridContainerEl.innerHTML = PipelineRenderer.renderGridOverview(this.activeStageIndex);
			}
		}

		// Update Mode Toggle Button text
		if (this.modeToggleBtn) {
			this.modeToggleBtn.innerHTML = this.viewMode === 'stage'
				? `${ICONS.grid} <span>ARCHITECTURE GRID</span>`
				: `${ICONS.stageFlow} <span>STAGE FLOW VIEW</span>`;
		}

		if (this.viewMode === 'stage') {
			this.renderStageView();
		}
	}

	private renderStageView(): void {
		const stage = PIPELINE_STAGES[this.activeStageIndex];
		if (!stage) return;

		const showPlot = this.plotViewMode[this.activeStageIndex] === 'plot';

		if (this.stageVisualizerEl) {
			this.stageVisualizerEl.innerHTML = PipelineRenderer.renderStageGraphic(
				stage,
				this.transformViewMode,
				this.store,
				showPlot
			);
		}
		if (this.stageHudEl) {
			this.stageHudEl.innerHTML = PipelineRenderer.renderStageHud(stage, this.activeStageIndex, PIPELINE_STAGES.length);
			this.applyKatexToDom();
		}
	}

	/** Apply KaTeX typesetting to formula chips in the DOM if KaTeX is loaded */
	private applyKatexToDom(): void {
		if (typeof window === 'undefined') return;
		const katex = (window as any).katex;
		if (!katex) return;

		const chips = this.stageHudEl?.querySelectorAll<HTMLElement>('.formula-chip[data-latex]');
		chips?.forEach((chip) => {
			const encoded = chip.dataset.latex;
			if (encoded) {
				try {
					const latex = decodeURIComponent(encoded);
					chip.innerHTML = katex.renderToString(latex, {
						throwOnError: false,
						displayMode: false,
					});
				} catch {
					// keep fallback
				}
			}
		});
	}

	// ── Pure Static HTML Builders (Fully Testable) ─────────────────────────────

	/** Render the top interactive Stage Progression Track */
	static renderQuestTrack(activeIndex: number): string {
		const nodes = PIPELINE_STAGES.map((s, idx) => {
			const isPassed = idx < activeIndex;
			const isActive = idx === activeIndex;

			let statusText = 'PENDING';
			if (isPassed) statusText = `${ICONS.check} COMPLETED`;
			else if (isActive) statusText = 'CURRENT STAGE';

			const stateClass = isActive ? 'active' : isPassed ? 'passed' : 'upcoming';

			return `
				<button 
					type="button" 
					class="pipeline-node-btn ${stateClass}" 
					data-stage-idx="${idx}"
					title="${s.stageTag}: ${s.title}"
				>
					<div class="node-pill-top">
						<span class="node-num">${idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
						<span class="node-category-pill">${s.categoryBadge.split(' ')[0]}</span>
					</div>
					<div class="node-title">${s.title}</div>
					<div class="node-status-badge">${statusText}</div>
				</button>
			`;
		}).join(`
			<div class="node-connector-line">
				<div class="connector-pulse"></div>
			</div>
		`);

		return `<div class="quest-track-wrapper">${nodes}</div>`;
	}

	/** Render the Visual Simulation Graphic for the given Stage using real data when available */
	static renderStageGraphic(
		stage: PipelineStage,
		transformMode: 'raw' | 'transformed' = 'transformed',
		store?: SpotifyDataStore | null,
		showPlot: boolean = false
	): string {
		if (showPlot && stage.imageSrc) {
			return PipelineRenderer.renderPlotImageGraphic(stage);
		}

		switch (stage.graphicType) {
			case 'dedup':
				return PipelineRenderer.renderDedupGraphic(stage, store);
			case 'power-transform':
				return PipelineRenderer.renderPowerTransformGraphic(stage, transformMode, store);
			case 'k-stability':
				return PipelineRenderer.renderKStabilityGraphic(stage, store);
			case 'gmm':
				return PipelineRenderer.renderModelSelectionGraphic(stage, store);
			case 'personas':
				return PipelineRenderer.renderPersonasGraphic(stage, store);
			case 'bootstrap':
				return PipelineRenderer.renderBootstrapGraphic(stage, store);
			case 'manifold':
				return PipelineRenderer.renderManifoldGraphic(stage, store);
			case 'wormhole':
				return PipelineRenderer.renderWormholeGraphic(stage, store);
			default:
				return `<div class="generic-graphic-box">Stage Graphic: ${stage.title}</div>`;
		}
	}

	/** Render Plot Image View */
	static renderPlotImageGraphic(stage: PipelineStage): string {
		return `
			<div class="stage-sim-box stage-sim-plot-view">
				<div class="sim-header">
					<span class="sim-tag">NOTEBOOK PLOT ARTIFACT</span>
					<button type="button" class="plot-toggle-btn active">${ICONS.pulse} <span>VIEW INTERACTIVE SIMULATION</span></button>
				</div>
				<div class="notebook-plot-container">
					<img src="${stage.imageSrc}" alt="${stage.title}" class="notebook-plot-img" />
				</div>
				<div class="sim-footer-hud">
					<div class="hud-stat-chip">
						<span class="hud-lbl">ARTIFACT SOURCE</span>
						<span class="hud-val">${stage.imageSrc?.split('/').pop()}</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">STATUS</span>
						<span class="hud-val" style="color: var(--geo-blue);">${ICONS.check} SEABORN / MATPLOTLIB EXPORT</span>
					</div>
				</div>
			</div>
		`;
	}

	/** STAGE 1 GRAPHIC: Real Catalog Token Deduplication Conveyor (Sections 1–3) */
	static renderDedupGraphic(stage: PipelineStage, store?: SpotifyDataStore | null): string {
		const tracksCount = store?.tracksCount ?? 169;
		const rawCount = 284;

		return `
			<div class="stage-sim-box stage-sim-dedup">
				<div class="sim-header">
					<span class="sim-tag">ARTIST ID FILTER & DURATION WINDOW DEDUPLICATION</span>
					<span class="sim-metric-pill">${stage.metricBadge}</span>
				</div>
				<div class="dedup-visualizer-canvas">
					<!-- Inflow noisy queue -->
					<div class="dedup-stream raw-stream">
						<div class="stream-label">RAW MADONNA TRACKS (ID: 6tbjWDEIzxoDsBA1FuhfPW)</div>
						<div class="stream-tokens">
							<div class="stream-token token-dup" title="Duration delta: 1.2s">
								<span class="token-sym">${ICONS.cross}</span>
								<span class="token-name">Hung Up (2005 Remaster - 329s)</span>
							</div>
							<div class="stream-token token-orig">
								<span class="token-sym">${ICONS.check}</span>
								<span class="token-name">Hung Up (Canonical Master - 330s)</span>
							</div>
							<div class="stream-token token-dup" title="Duration delta: 0.8s">
								<span class="token-sym">${ICONS.cross}</span>
								<span class="token-name">Material Girl (Deluxe 2009 - 240s)</span>
							</div>
							<div class="stream-token token-orig">
								<span class="token-sym">${ICONS.check}</span>
								<span class="token-name">Like a Prayer (Standard 2009 - 340s)</span>
							</div>
						</div>
					</div>

					<!-- Processing Filter Gate -->
					<div class="dedup-filter-gate">
						<div class="gate-core">
							<div class="gate-radar-sweep"></div>
							<div class="gate-icon">${ICONS.filter}</div>
							<div class="gate-label">±2s DURATION BUCKET & TITLE DE-DUPE</div>
						</div>
						<div class="gate-arrow">${ICONS.arrowRight}</div>
					</div>

					<!-- Outflow Cleaned Set -->
					<div class="dedup-stream clean-stream">
						<div class="stream-label">CANONICAL DISCOGRAPHY (1983–2015)</div>
						<div class="clean-tokens-grid">
							<div class="clean-token-card">
								<span class="clean-dot" style="background: var(--geo-red);"></span>
								<span class="clean-name">Hung Up (2005)</span>
								<span class="clean-status">MASTER</span>
							</div>
							<div class="clean-token-card">
								<span class="clean-dot" style="background: var(--geo-blue);"></span>
								<span class="clean-name">Material Girl (2009)</span>
								<span class="clean-status">MASTER</span>
							</div>
							<div class="clean-token-card">
								<span class="clean-dot" style="background: var(--geo-yellow);"></span>
								<span class="clean-name">Like a Prayer (2009)</span>
								<span class="clean-status">MASTER</span>
							</div>
						</div>
					</div>
				</div>

				<div class="sim-footer-hud">
					<div class="hud-stat-chip">
						<span class="hud-lbl">RAW INGESTED</span>
						<span class="hud-val">${rawCount} Tracks</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">DUPLICATES PURGED</span>
						<span class="hud-val" style="color: var(--geo-red);">-115 Reissues/Remasters</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">CLEANED DISCOGRAPHY</span>
						<span class="hud-val" style="color: var(--geo-blue);">${tracksCount} Canonical Tracks</span>
					</div>
				</div>
			</div>
		`;
	}

	/** STAGE 2 GRAPHIC: Power Transformation Yeo-Johnson Skew Morph (Sections 4–5) */
	static renderPowerTransformGraphic(
		stage: PipelineStage,
		mode: 'raw' | 'transformed',
		store?: SpotifyDataStore | null
	): string {
		const isTransformed = mode === 'transformed';
		return `
			<div class="stage-sim-box stage-sim-transform">
				<div class="sim-header">
					<span class="sim-tag">YEO-JOHNSON DISTRIBUTION WARP</span>
					<div class="sim-toggle-group">
						<button type="button" class="curve-mode-toggle ${!isTransformed ? 'active' : ''}" data-mode="raw">RAW SKEWED</button>
						<button type="button" class="curve-mode-toggle ${isTransformed ? 'active' : ''}" data-mode="transformed">TRANSFORMED GAUSSIAN</button>
						${stage.imageSrc ? `<button type="button" class="plot-toggle-btn">${ICONS.chart} <span>EDA PLOT</span></button>` : ''}
					</div>
				</div>

				<div class="transform-curve-viewport">
					<svg viewBox="0 0 400 180" class="curve-svg">
						<defs>
							<linearGradient id="curveGradRaw" x1="0%" y1="0%" x2="100%" y2="0%">
								<stop offset="0%" stop-color="#ef233c" stop-opacity="0.85" />
								<stop offset="70%" stop-color="#fbbf24" stop-opacity="0.6" />
								<stop offset="100%" stop-color="#38bdf8" stop-opacity="0.2" />
							</linearGradient>
							<linearGradient id="curveGradTrans" x1="0%" y1="0%" x2="100%" y2="0%">
								<stop offset="0%" stop-color="#1642e8" stop-opacity="0.3" />
								<stop offset="50%" stop-color="#1642e8" stop-opacity="0.9" />
								<stop offset="100%" stop-color="#1642e8" stop-opacity="0.3" />
							</linearGradient>
						</defs>

						<line x1="30" y1="150" x2="380" y2="150" stroke="#cbd5e1" stroke-width="1.5" />
						<line x1="30" y1="20" x2="30" y2="150" stroke="#cbd5e1" stroke-width="1.5" />
						<line x1="120" y1="20" x2="120" y2="150" stroke="#e2e8f0" stroke-dasharray="3,3" />
						<line x1="205" y1="20" x2="205" y2="150" stroke="#94a3b8" stroke-dasharray="4,4" />
						<line x1="290" y1="20" x2="290" y2="150" stroke="#e2e8f0" stroke-dasharray="3,3" />

						${!isTransformed ? `
							<path d="M 30,150 Q 55,20 100,60 T 220,135 T 380,150 Z" fill="url(#curveGradRaw)" opacity="0.85" />
							<path d="M 30,150 Q 55,20 100,60 T 220,135 T 380,150" fill="none" stroke="#ef233c" stroke-width="3" />
							<circle cx="65" cy="35" r="5" fill="#ef233c" stroke="#ffffff" stroke-width="2" />
							<text x="75" y="32" font-size="11" font-weight="bold" fill="#ef233c">Right-Skewed Instrumentalness (+2.41)</text>
						` : `
							<path d="M 30,150 C 100,150 140,25 205,25 C 270,25 310,150 380,150 Z" fill="url(#curveGradTrans)" opacity="0.85" />
							<path d="M 30,150 C 100,150 140,25 205,25 C 270,25 310,150 380,150 Z" fill="none" stroke="#1642e8" stroke-width="3" />
							<circle cx="205" cy="25" r="5" fill="#1642e8" stroke="#ffffff" stroke-width="2" />
							<text x="215" y="28" font-size="11" font-weight="bold" fill="#1642e8">Symmetric Normal Centroid (μ=0, σ=1)</text>
						`}

						<text x="30" y="168" font-size="9" fill="#64748b" font-weight="bold">-3σ</text>
						<text x="110" y="168" font-size="9" fill="#64748b" font-weight="bold">-1σ</text>
						<text x="200" y="168" font-size="10" fill="#0f172a" font-weight="bold">μ=0</text>
						<text x="280" y="168" font-size="9" fill="#64748b" font-weight="bold">+1σ</text>
						<text x="360" y="168" font-size="9" fill="#64748b" font-weight="bold">+3σ</text>
					</svg>
				</div>

				<div class="sim-footer-hud">
					<div class="hud-stat-chip">
						<span class="hud-lbl">TRANSFORMATION</span>
						<span class="hud-val">PowerTransformer (Yeo-Johnson)</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">SKEWNESS METRIC</span>
						<span class="hud-val" style="color: ${isTransformed ? 'var(--geo-blue)' : 'var(--geo-red)'};">
							${isTransformed ? '+0.02 (NORMALIZED)' : '+2.41 (RAW ASYMMETRIC)'}
						</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">CORRELATED FEATURES</span>
						<span class="hud-val">Energy / Loudness Retained (r ≈ 0.74)</span>
					</div>
				</div>
			</div>
		`;
	}

	/** STAGE 3 GRAPHIC: K-Selection Diagnostics & Stability Sweep (Sections 6 & 6b) */
	static renderKStabilityGraphic(stage: PipelineStage, store?: SpotifyDataStore | null): string {
		const kValues = [
			{ k: 2, ari: 0.985, sil: 0.245 },
			{ k: 3, ari: 0.892, sil: 0.210 },
			{ k: 4, ari: 0.948, sil: 0.179, isUsed: true },
			{ k: 5, ari: 0.764, sil: 0.162 },
			{ k: 6, ari: 0.721, sil: 0.155 },
			{ k: 7, ari: 0.680, sil: 0.148 },
		];

		const barItems = kValues.map(item => `
			<div class="resample-bar-item ${item.isUsed ? 'active' : ''}" title="K=${item.k}: Seed ARI = ${item.ari}">
				<div class="bar-num" style="${item.isUsed ? 'font-weight:900; color:var(--geo-yellow);' : ''}">K=${item.k}</div>
				<div class="bar-track">
					<div class="bar-fill" style="width: ${Math.round(item.ari * 100)}%; background: ${item.isUsed ? 'var(--geo-yellow)' : 'var(--geo-blue)'};"></div>
				</div>
				<div class="bar-val">${item.ari.toFixed(3)}</div>
			</div>
		`).join('');

		return `
			<div class="stage-sim-box stage-sim-k-stability">
				<div class="sim-header">
					<span class="sim-tag">K-STABILITY SWEEP & DIAGNOSTICS</span>
					<div style="display:flex; gap:6px;">
						<span class="sim-metric-pill" style="background: var(--geo-yellow); color: var(--geo-black);">${stage.metricBadge}</span>
						${stage.imageSrc ? `<button type="button" class="plot-toggle-btn">${ICONS.chart} <span>K-CURVES</span></button>` : ''}
					</div>
				</div>

				<div class="bootstrap-grid-layout">
					<div class="resample-bars-container">
						<div class="bars-label">SEED-TO-SEED ARI STABILITY (15 SEEDS PER K)</div>
						<div class="resample-bars-list">
							${barItems}
						</div>
					</div>

					<div class="gauge-card">
						<div class="radial-gauge-circle">
							<svg viewBox="0 0 100 100" class="gauge-svg">
								<circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" stroke-width="8" />
								<circle cx="50" cy="50" r="42" fill="none" stroke="var(--geo-yellow)" stroke-width="8" stroke-dasharray="264" stroke-dashoffset="14" stroke-linecap="round" />
							</svg>
							<div class="gauge-center-text">
								<span class="gauge-score">K = 4</span>
								<span class="gauge-sub">PROJECT SPEC</span>
							</div>
						</div>
						<span class="gauge-badge">${ICONS.check} ARI: 0.948 (HIGH STABILITY)</span>
					</div>
				</div>

				<div class="sim-footer-hud">
					<div class="hud-stat-chip">
						<span class="hud-lbl">K-DIAGNOSTIC COMPARISON</span>
						<span class="hud-val">Silhouette (K=4: 0.179) | BIC Best: K=2</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">K=4 STABILITY RANK</span>
						<span class="hud-val" style="color: var(--geo-yellow);">Rank #2 of 6 (Robust Partition)</span>
					</div>
				</div>
			</div>
		`;
	}

	/** STAGE 4 GRAPHIC: Model Fitting KMeans vs GMM (Section 7) */
	static renderModelSelectionGraphic(stage: PipelineStage, store?: SpotifyDataStore | null): string {
		return `
			<div class="stage-sim-box stage-sim-gmm">
				<div class="sim-header">
					<span class="sim-tag">KMEANS VS GMM MODEL COMPETITION (K=4)</span>
					<div style="display:flex; gap:6px;">
						<span class="sim-metric-pill" style="background: var(--geo-black); color: #ffffff;">${stage.metricBadge}</span>
						${stage.imageSrc ? `<button type="button" class="plot-toggle-btn">${ICONS.chart} <span>DASHBOARD PLOT</span></button>` : ''}
					</div>
				</div>

				<div class="gmm-density-canvas">
					<svg viewBox="0 0 400 180" class="gmm-svg">
						<g class="gmm-cluster-group">
							<ellipse cx="90" cy="70" rx="50" ry="32" transform="rotate(-15 90 70)" fill="#FF4D8D" opacity="0.25" stroke="#FF4D8D" stroke-width="1.5" />
							<circle cx="90" cy="70" r="5" fill="#FF4D8D" stroke="#ffffff" stroke-width="2" />
							<text x="45" y="36" font-size="9.5" font-weight="900" fill="#FF4D8D">0: Acoustic & Mellow (36)</text>
						</g>

						<g class="gmm-cluster-group">
							<ellipse cx="290" cy="65" rx="52" ry="34" transform="rotate(18 290 65)" fill="#22C55E" opacity="0.25" stroke="#22C55E" stroke-width="1.5" />
							<circle cx="290" cy="65" r="5" fill="#22C55E" stroke="#ffffff" stroke-width="2" />
							<text x="240" y="34" font-size="9.5" font-weight="900" fill="#16a34a">1: Uplifting & Danceable (54)</text>
						</g>

						<g class="gmm-cluster-group">
							<ellipse cx="140" cy="125" rx="50" ry="30" transform="rotate(-8 140 125)" fill="#FACC15" opacity="0.3" stroke="#d97706" stroke-width="1.5" />
							<circle cx="140" cy="125" r="5" fill="#d97706" stroke="#ffffff" stroke-width="2" />
							<text x="90" y="162" font-size="9.5" font-weight="900" fill="#b45309">2: Instrumental & Produced (28)</text>
						</g>

						<g class="gmm-cluster-group">
							<ellipse cx="275" cy="125" rx="52" ry="30" transform="rotate(10 275 125)" fill="#38BDF8" opacity="0.3" stroke="#0284c7" stroke-width="1.5" />
							<circle cx="275" cy="125" r="5" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
							<text x="235" y="162" font-size="9.5" font-weight="900" fill="#0369a1">3: Bold & Energetic (51)</text>
						</g>

						<circle cx="80" cy="62" r="2.5" fill="#FF4D8D" />
						<circle cx="102" cy="78" r="3" fill="#FF4D8D" />
						<circle cx="280" cy="58" r="2.5" fill="#22C55E" />
						<circle cx="305" cy="72" r="3" fill="#22C55E" />
						<circle cx="130" cy="120" r="3" fill="#d97706" />
						<circle cx="265" cy="120" r="3" fill="#0284c7" />
					</svg>
				</div>

				<div class="sim-footer-hud">
					<div class="hud-stat-chip">
						<span class="hud-lbl">MODEL METRIC COMPARISON</span>
						<span class="hud-val">KMeans (Sil: 0.179, DB: 1.784) vs GMM (Sil: 0.165)</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">KMEANS VS GMM AGREEMENT</span>
						<span class="hud-val">ARI = 0.281 (Different Boundaries)</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">15-FOLD BOOTSTRAP STABILITY</span>
						<span class="hud-val" style="color: var(--geo-blue);">ARI = 0.858 ± 0.05</span>
					</div>
				</div>
			</div>
		`;
	}

	/** STAGE 5 GRAPHIC: Dynamic Z-Score Personas (Section 8) */
	static renderPersonasGraphic(stage: PipelineStage, store?: SpotifyDataStore | null): string {
		const clusters = store?.clusters || [
			{ name: 'Acoustic & Mellow', size: 36, color: '#FF4D8D' },
			{ name: 'Uplifting & Danceable', size: 54, color: '#22C55E' },
			{ name: 'Instrumental & Produced', size: 28, color: '#FACC15' },
			{ name: 'Bold & Energetic', size: 51, color: '#38BDF8' },
		];

		const cards = clusters.map((c, i) => `
			<div class="clean-token-card" style="border-left: 4px solid ${c.color};">
				<span class="clean-dot" style="background: ${c.color};"></span>
				<div style="flex:1;">
					<div style="font-weight:900; font-size:0.75rem;">Cluster ${i}: ${c.name}</div>
					<div style="font-size:0.6rem; color:var(--geo-muted); font-family:monospace;">${c.size} tracks (${((c.size / 169) * 100).toFixed(1)}%)</div>
				</div>
			</div>
		`).join('');

		return `
			<div class="stage-sim-box stage-sim-personas">
				<div class="sim-header">
					<span class="sim-tag">AUTOMATED Z-SCORE PERSONA EXTRACTION</span>
					<span class="sim-metric-pill" style="background: var(--geo-yellow); color: var(--geo-black);">${stage.metricBadge}</span>
				</div>

				<div class="personas-grid-showcase" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:10px;">
					${cards}
				</div>

				<div class="sim-footer-hud">
					<div class="hud-stat-chip">
						<span class="hud-lbl">DERIVATION METHOD</span>
						<span class="hud-val">Top 2 Absolute Z-Scores vs Global Catalog Mean</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">SMALLEST CLUSTER SHARE</span>
						<span class="hud-val" style="color: var(--geo-blue);">16.6% (28 tracks) — Balanced</span>
					</div>
				</div>
			</div>
		`;
	}

	/** STAGE 6 GRAPHIC: Structural Robustness Validation (Section 7b) */
	static renderBootstrapGraphic(stage: PipelineStage, store?: SpotifyDataStore | null): string {
		return `
			<div class="stage-sim-box stage-sim-bootstrap">
				<div class="sim-header">
					<span class="sim-tag">50-SEED STABILITY & SILHOUETTE PROFILE</span>
					<div style="display:flex; gap:6px;">
						<span class="sim-metric-pill" style="background: #ffffff; color: var(--geo-black);">${stage.metricBadge}</span>
						${stage.imageSrc ? `<button type="button" class="plot-toggle-btn">${ICONS.chart} <span>10x10 MATRIX</span></button>` : ''}
					</div>
				</div>

				<div class="bootstrap-grid-layout">
					<div class="resample-bars-container">
						<div class="bars-label">FEATURE-SET SENSITIVITY (ARI VS MAIN 9-FEATURE)</div>
						<div class="resample-bars-list">
							<div class="resample-bar-item"><div class="bar-num">All 9</div><div class="bar-track"><div class="bar-fill" style="width:100%;"></div></div><div class="bar-val">1.000</div></div>
							<div class="resample-bar-item"><div class="bar-num">Drop Corr</div><div class="bar-track"><div class="bar-fill" style="width:68%;"></div></div><div class="bar-val">0.684</div></div>
							<div class="resample-bar-item"><div class="bar-num">Core 5 (v1)</div><div class="bar-track"><div class="bar-fill" style="width:62%;"></div></div><div class="bar-val">0.618</div></div>
							<div class="resample-bar-item"><div class="bar-num">Random 6A</div><div class="bar-track"><div class="bar-fill" style="width:58%;"></div></div><div class="bar-val">0.582</div></div>
							<div class="resample-bar-item"><div class="bar-num">Random 6B</div><div class="bar-track"><div class="bar-fill" style="width:54%;"></div></div><div class="bar-val">0.537</div></div>
							<div class="resample-bar-item"><div class="bar-num">PCA 90%</div><div class="bar-track"><div class="bar-fill" style="width:48%;"></div></div><div class="bar-val">0.485</div></div>
						</div>
					</div>

					<div class="gauge-card">
						<div class="radial-gauge-circle">
							<svg viewBox="0 0 100 100" class="gauge-svg">
								<circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" stroke-width="8" />
								<circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" stroke-width="8" stroke-dasharray="264" stroke-dashoffset="9" stroke-linecap="round" />
							</svg>
							<div class="gauge-center-text">
								<span class="gauge-score">0.967</span>
								<span class="gauge-sub">50-SEED ARI</span>
							</div>
						</div>
						<span class="gauge-badge">${ICONS.check} STABILITY MATRIX (10x10)</span>
					</div>
				</div>

				<div class="sim-footer-hud">
					<div class="hud-stat-chip">
						<span class="hud-lbl">SEED STABILITY (50 SEEDS)</span>
						<span class="hud-val">Mean: 0.967, Std: 0.048, Min: 0.742</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">PER-TRACK SILHOUETTE</span>
						<span class="hud-val" style="color: #10b981;">Inspected (Borderlines Flagged)</span>
					</div>
				</div>
			</div>
		`;
	}

	/** STAGE 7 GRAPHIC: Manifold Projection & Topology Sensitivity (Sections 9 & 9b) */
	static renderManifoldGraphic(stage: PipelineStage, store?: SpotifyDataStore | null): string {
		const sampleTrack = store?.tracks?.[0];
		const trackLabel = sampleTrack ? `${sampleTrack.name} (${sampleTrack.release_year})` : 'Hung Up (2005)';

		return `
			<div class="stage-sim-box stage-sim-manifold">
				<div class="sim-header">
					<span class="sim-tag">PCA & UMAP 3D MANIFOLD PROJECTION</span>
					<div style="display:flex; gap:6px;">
						<span class="sim-metric-pill" style="background: var(--geo-cyan); color: var(--geo-black);">${stage.metricBadge}</span>
						${stage.imageSrc ? `<button type="button" class="plot-toggle-btn">${ICONS.chart} <span>UMAP SENSITIVITY</span></button>` : ''}
					</div>
				</div>

				<div class="manifold-projection-canvas">
					<!-- 9D Feature List -->
					<div class="hyper-feature-ring">
						<div class="ring-title">9D AUDIO HYPERCUBE</div>
						<div class="ring-features">
							<span class="feat-tag">Danceability</span>
							<span class="feat-tag">Energy</span>
							<span class="feat-tag">Valence</span>
							<span class="feat-tag">Acousticness</span>
							<span class="feat-tag">Speechiness</span>
							<span class="feat-tag">Tempo</span>
							<span class="feat-tag">Loudness</span>
							<span class="feat-tag">Instrumental</span>
							<span class="feat-tag">Liveness</span>
						</div>
					</div>

					<!-- Projection Lens -->
					<div class="projection-lens-unit">
						<div class="lens-beam beam-left"></div>
						<div class="lens-body">
							<div class="lens-label">PCA / UMAP</div>
							<div class="lens-sub">n_neighbors=15</div>
						</div>
						<div class="lens-beam beam-right"></div>
					</div>

					<!-- 3D Spatial Coordinates Constellation -->
					<div class="spatial-galaxy-box">
						<div class="galaxy-label">3D MUSIC GALAXY</div>
						<div class="galaxy-star-cloud">
							<div class="star s1" style="top: 25%; left: 30%; background: #FF4D8D;" title="Acoustic Cluster"></div>
							<div class="star s2" style="top: 40%; left: 70%; background: #22C55E;" title="Uplifting Cluster"></div>
							<div class="star s3" style="top: 70%; left: 45%; background: #FACC15;" title="Instrumental Cluster"></div>
							<div class="star s4" style="top: 60%; left: 20%; background: #38BDF8;" title="Bold Cluster"></div>
							<div class="star s5" style="top: 30%; left: 80%; background: #1642e8;" title="${trackLabel}"></div>
							<div class="galaxy-axis axis-x">X: TSNE_1</div>
							<div class="galaxy-axis axis-y">Y: TSNE_2</div>
							<div class="galaxy-axis axis-z">Z: PC1</div>
						</div>
					</div>
				</div>

				<div class="sim-footer-hud">
					<div class="hud-stat-chip">
						<span class="hud-lbl">PCA VARIANCE</span>
						<span class="hud-val">PC1 + PC2: 54.8% Variance</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">UMAP TOPOLOGY SENSITIVITY</span>
						<span class="hud-val">Spearman Tested (k=5/15/30/50)</span>
					</div>
				</div>
			</div>
		`;
	}

	/** STAGE 8 GRAPHIC: Cosine Similarity Wormhole Bridge & Web Export (Sections 10–13) */
	static renderWormholeGraphic(stage: PipelineStage, store?: SpotifyDataStore | null): string {
		const trackA = store?.tracks?.find(t => t.release_year <= 1990) || { name: 'Like a Virgin', release_year: 1984, danceability: 0.77, energy: 0.65 };
		const trackB = store?.tracks?.find(t => t.release_year >= 2005) || { name: 'Hung Up', release_year: 2005, danceability: 0.65, energy: 0.65 };

		return `
			<div class="stage-sim-box stage-sim-wormhole">
				<div class="sim-header">
					<span class="sim-tag">COSINE SIMILARITY ENGINE & UNIFIED WEB BUNDLE</span>
					<span class="sim-metric-pill" style="background: var(--geo-red); color: #ffffff;">${stage.metricBadge}</span>
				</div>

				<div class="wormhole-visualizer-canvas">
					<!-- Node 1 (Classic Era Track) -->
					<div class="wormhole-node node-left">
						<div class="node-badge" style="background: var(--geo-yellow); color: var(--geo-black);">${trackA.release_year} CLASSIC</div>
						<div class="node-name">"${trackA.name}"</div>
						<div class="node-specs">Dance: ${trackA.danceability.toFixed(2)} | Energy: ${trackA.energy.toFixed(2)}</div>
					</div>

					<!-- Central Wormhole Vortex -->
					<div class="wormhole-vortex-unit">
						<div class="vortex-rings ring-1"></div>
						<div class="vortex-rings ring-2"></div>
						<div class="vortex-core">
							<span class="vortex-sim-val">cos(θ) = 0.962</span>
							<span class="vortex-lbl">SISTER TRACK</span>
						</div>
						<div class="energy-beam"></div>
					</div>

					<!-- Node 2 (Modern Era Track) -->
					<div class="wormhole-node node-right">
						<div class="node-badge" style="background: var(--geo-cyan); color: var(--geo-black);">${trackB.release_year} MODERN</div>
						<div class="node-name">"${trackB.name}"</div>
						<div class="node-specs">Dance: ${trackB.danceability.toFixed(2)} | Energy: ${trackB.energy.toFixed(2)}</div>
					</div>
				</div>

				<div class="sim-footer-hud">
					<div class="hud-stat-chip">
						<span class="hud-lbl">SIMILARITY METRIC</span>
						<span class="hud-val">Cosine Metric: S_c(a, b) ≥ 0.95</span>
					</div>
					<div class="hud-stat-chip">
						<span class="hud-lbl">EXPORT WEB ASSETS</span>
						<span class="hud-val" style="color: var(--geo-red);">cluster_summary.json + music_galaxy.json</span>
					</div>
				</div>
			</div>
		`;
	}

	/** Render Stage Information HUD (Objective, Formula, Tech Specs, Navigation) */
	static renderStageHud(stage: PipelineStage, stageIndex: number, totalStages: number): string {
		const bulletsHtml = stage.bullets.map((b) => `
			<li class="quest-bullet-item">
				<span class="bullet-dot" style="background: ${stage.themeColor};"></span>
				<span class="bullet-text">${b}</span>
			</li>
		`).join('');

		let formulaContentHtml = `<code>${stage.formulaBadge}</code>`;
		if (stage.latexFormula && typeof window !== 'undefined' && (window as any).katex) {
			try {
				formulaContentHtml = (window as any).katex.renderToString(stage.latexFormula, {
					throwOnError: false,
					displayMode: false,
				});
			} catch {
				formulaContentHtml = `<code>${stage.formulaBadge}</code>`;
			}
		}

		return `
			<div class="quest-hud-card">
				<div class="quest-hud-header">
					<div class="hud-title-group">
						<div class="hud-badge-row">
							<span class="hud-lvl-pill" style="border-color: ${stage.themeColor};">
								${stage.stageTag}
							</span>
							<span class="hud-category-badge">
								${stage.categoryBadge}
							</span>
						</div>
						<h3 class="hud-stage-title">${stage.title}</h3>
						<h4 class="hud-quest-name">${stage.subtitle}</h4>
					</div>
				</div>

				<div class="quest-section-box">
					<span class="quest-sub-label">PIPELINE OBJECTIVE</span>
					<p class="quest-objective-p">${stage.objective}</p>
				</div>

				<div class="quest-section-box formula-box">
					<span class="quest-sub-label">MATHEMATICAL FORMULATION</span>
					<div class="formula-chip" data-latex="${stage.latexFormula ? encodeURIComponent(stage.latexFormula) : ''}">
						${formulaContentHtml}
					</div>
				</div>

				<div class="quest-section-box bullets-box">
					<span class="quest-sub-label">METHODOLOGY & ARCHITECTURE SPECS</span>
					<ul class="quest-bullets-list">
						${bulletsHtml}
					</ul>
				</div>

				<!-- Navigation Actions -->
				<div class="quest-hud-actions">
					<button type="button" class="stage-nav-btn prev-btn" id="hud-prev-btn" data-action="prev" ${stageIndex === 0 ? 'disabled' : ''}>
						${ICONS.arrowLeft} <span>PREV STAGE</span>
					</button>
					<div class="stage-progress-indicator">
						<span>STAGE ${stageIndex + 1} OF ${totalStages}</span>
						<div class="prog-dots">
							${Array.from({ length: totalStages }, (_, i) => `
								<span class="prog-dot ${i === stageIndex ? 'active' : i < stageIndex ? 'done' : ''}"></span>
							`).join('')}
						</div>
					</div>
					<button type="button" class="stage-nav-btn next-btn" id="hud-next-btn" data-action="next">
						${stageIndex === totalStages - 1 ? `${ICONS.restart} <span>RESTART</span>` : `<span>NEXT STAGE</span> ${ICONS.arrowRight}`}
					</button>
				</div>
			</div>
		`;
	}

	/** Render Overview Grid View (All 8 Stages connected) */
	static renderGridOverview(activeStageIdx: number): string {
		const cards = PIPELINE_STAGES.map((s, idx) => {
			const isCurrent = idx === activeStageIdx;
			return `
				<div class="stage-grid-card ${isCurrent ? 'current-stage' : ''}" data-stage-idx="${idx}">
					<div class="grid-card-top">
						<span class="grid-lvl-badge" style="background: ${s.themeColor}; color: #ffffff;">STAGE 0${s.stageNumber}</span>
						<span class="grid-category-pill">${s.categoryBadge.split(' ')[0]}</span>
					</div>
					<h4 class="grid-card-title">${s.title}</h4>
					<p class="grid-card-desc">${s.objective}</p>
					<div class="grid-card-metric">${s.metricBadge}</div>
					<div class="grid-card-footer">
						<span class="grid-jump-hint"><span>VIEW STAGE DETAILS</span> ${ICONS.arrowRight}</span>
					</div>
				</div>
			`;
		}).join('');

		return `
			<div class="pipeline-grid-overview-wrapper">
				<div class="grid-overview-header">
					<span class="section-title">END-TO-END PIPELINE ARCHITECTURE</span>
					<h3 class="panel-header-title">Madonna Sonic Atlas ML Architecture</h3>
					<p class="grid-overview-sub">Complete 8-stage unsupervised clustering, robustness validation, and manifold projection pipeline.</p>
				</div>
				<div class="pipeline-grid-6cards" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
					${cards}
				</div>
			</div>
		`;
	}
}
