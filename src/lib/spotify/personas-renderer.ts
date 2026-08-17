/**
 * personas-renderer.ts — Renders the "Sonic Personas" tab (Tab 1)
 * with a high-energy live 4/4 beat spectrum visualizer, 9D Audio Radar DNA,
 * track acoustic passport HUD, and clean, streamlined, non-verbose layouts.
 */

import type { Track, ClusterSummary, ClusterMeta, WeightedImpact } from './spotify-types';
import type { SpotifyDataStore } from './spotify-store';
import type { SpotifyState } from './spotify-state';

export class PersonasRenderer {
	private readonly store: SpotifyDataStore;
	private readonly state: SpotifyState;
	private viewSubMode: 'radar' | 'bars' = 'radar';
	private spectrumAnimId: number | null = null;

	// Cached DOM refs
	private railList!: HTMLElement;
	private clusterNameEl!: HTMLElement;
	private clusterDescEl!: HTMLElement | null;
	private clusterShareEl!: HTMLElement;
	private clusterMetricsEl!: HTMLElement;
	private tracksListEl!: HTMLElement;
	private searchInput!: HTMLInputElement | null;
	private trackInspectorEl!: HTMLElement | null;
	private eraBreakdownEl!: HTMLElement | null;
	private vibeTagsEl!: HTMLElement | null;
	private subModeBtn!: HTMLButtonElement | null;

	constructor(store: SpotifyDataStore, state: SpotifyState) {
		this.store = store;
		this.state = state;
	}

	/** Cache DOM refs and bind all events once */
	init(): void {
		this.railList = document.getElementById('cluster-rail-list')!;
		this.clusterNameEl = document.getElementById('cluster-name')!;
		this.clusterDescEl = document.getElementById('cluster-desc');
		this.clusterShareEl = document.getElementById('cluster-share')!;
		this.clusterMetricsEl = document.getElementById('cluster-metrics')!;
		this.tracksListEl = document.getElementById('cluster-tracks-list')!;
		this.searchInput = document.getElementById('personas-search') as HTMLInputElement | null;
		this.trackInspectorEl = document.getElementById('persona-track-inspector');
		this.eraBreakdownEl = document.getElementById('persona-era-breakdown');
		this.vibeTagsEl = document.getElementById('persona-vibe-tags');
		this.subModeBtn = document.getElementById('persona-submode-btn') as HTMLButtonElement | null;

		// Rail cluster button clicks
		this.railList?.addEventListener('click', (e) => {
			const btn = (e.target as Element).closest<HTMLButtonElement>('.cluster-btn');
			if (!btn) return;
			const clusterId = Number(btn.dataset.cluster);
			this.state.setCluster(clusterId);
			const firstTrack = this.store.getClusterTracks(clusterId)[0];
			if (firstTrack) {
				this.state.setTrackIndex(this.store.getTrackGlobalIndex(firstTrack));
			}
			this.render();
		});

		// Track list item clicks
		this.tracksListEl?.addEventListener('click', (e) => {
			const btn = (e.target as Element).closest<HTMLButtonElement>('.track-list-item');
			if (!btn) return;
			const idx = Number(btn.dataset.idx);
			if (!isNaN(idx)) {
				this.state.setTrackIndex(idx);
				this.render();
			}
		});

		// Track inspector sister track jumps
		this.trackInspectorEl?.addEventListener('click', (e) => {
			const sisterBtn = (e.target as Element).closest<HTMLButtonElement>('.sister-jump-btn');
			if (!sisterBtn) return;
			const idx = Number(sisterBtn.dataset.trackIdx);
			if (!isNaN(idx)) {
				const track = this.store.tracks[idx];
				if (track) {
					this.state.setCluster(track.cluster);
					this.state.setTrackIndex(idx);
					this.render();
				}
			}
		});

		// Search input
		this.searchInput?.addEventListener('input', () => {
			this.renderTrackListOnly();
		});

		// Sub-mode toggle button (Radar vs Bars)
		this.subModeBtn?.addEventListener('click', () => {
			this.viewSubMode = this.viewSubMode === 'radar' ? 'bars' : 'radar';
			this.renderMetricsArea();
		});
	}

	/** Stop active spectrum animation loop */
	destroy(): void {
		if (this.spectrumAnimId !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this.spectrumAnimId);
			this.spectrumAnimId = null;
		}
	}

	/** Full re-render of the Personas tab */
	render(): void {
		const { store, state } = this;
		const snap = state.snapshot;
		const meta = store.clusterMeta.get(snap.cluster)!;
		const impact = store.clusterWeightedImpact.get(snap.cluster)!;
		const clusterData = store.clusters[snap.cluster];
		const clusterTracks = store.getClusterTracks(snap.cluster);

		// 1. Update Rail Buttons
		if (this.railList) {
			this.railList.innerHTML = PersonasRenderer.renderClusterRail(
				store.clusters,
				store.clusterMeta,
				store.clusterWeightedImpact,
				snap.cluster,
			);
		}

		// 2. Update Cluster Header
		if (this.clusterNameEl) this.clusterNameEl.textContent = meta.name;
		if (this.clusterDescEl) this.clusterDescEl.textContent = meta.description;
		if (this.clusterShareEl) this.clusterShareEl.textContent = `${Math.round(impact.share * 100)}% share`;

		// 3. Update Vibe Tags
		if (this.vibeTagsEl) {
			this.vibeTagsEl.innerHTML = PersonasRenderer.renderVibeTags(clusterData, meta.color);
		}

		// 4. Update Metrics Area (Radar or Bars + Soundwave)
		this.renderMetricsArea();

		// 5. Update Track List
		this.renderTrackListOnly();

		// 6. Update Selected Track Passport HUD
		const currentTrack = store.tracks[snap.trackIndex] || clusterTracks[0];
		if (this.trackInspectorEl && currentTrack) {
			const similar = store.featureSpace.getTopSimilar(snap.trackIndex, 3);
			this.trackInspectorEl.innerHTML = PersonasRenderer.renderTrackPassport(
				currentTrack,
				store.clusterMeta,
				similar,
				(t) => store.getTrackGlobalIndex(t),
				store.tracks,
			);
		}

		// 7. Update Era Breakdown Histogram
		if (this.eraBreakdownEl) {
			this.eraBreakdownEl.innerHTML = PersonasRenderer.renderDecadeBreakdown(clusterTracks, meta.color);
		}
	}

	private renderMetricsArea(): void {
		const snap = this.state.snapshot;
		const meta = this.store.clusterMeta.get(snap.cluster)!;
		const clusterData = this.store.clusters[snap.cluster];

		if (this.subModeBtn) {
			this.subModeBtn.innerHTML = this.viewSubMode === 'radar'
				? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> <span>BARS</span>`
				: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg> <span>RADAR</span>`;
		}

		if (this.clusterMetricsEl) {
			if (this.viewSubMode === 'radar') {
				this.clusterMetricsEl.innerHTML = `
					<div class="personas-radar-wrap">
						${PersonasRenderer.renderRadarSvg(clusterData, meta.color)}
						${PersonasRenderer.renderSoundwaveBars(clusterData, meta.color)}
					</div>
				`;
				// Hook live animated canvas spectrum
				this.startLiveSpectrumCanvas(clusterData, meta.color);
			} else {
				if (this.spectrumAnimId !== null && typeof cancelAnimationFrame !== 'undefined') {
					cancelAnimationFrame(this.spectrumAnimId);
					this.spectrumAnimId = null;
				}
				this.clusterMetricsEl.innerHTML = PersonasRenderer.renderMetricsGrid(clusterData, meta.color);
			}
		}
	}

	/** Live 4/4 Beat Pulsing Spectrum Canvas Engine */
	private startLiveSpectrumCanvas(cluster: ClusterSummary, color: string): void {
		if (typeof window === 'undefined') return;
		if (this.spectrumAnimId !== null) {
			cancelAnimationFrame(this.spectrumAnimId);
			this.spectrumAnimId = null;
		}

		const canvas = document.getElementById('persona-spectrum-canvas') as HTMLCanvasElement | null;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const numBars = 16;
		const peakCaps = new Float32Array(numBars);
		const barValues = new Float32Array(numBars);
		const bpm = Math.max(80, Math.min(170, cluster.tempo || 120));
		const energy = Math.max(0.35, Math.min(0.95, cluster.energy || 0.65));
		const beatInterval = 60000 / bpm; // ms per beat

		const renderFrame = (now: number) => {
			const beatPhase = (now % beatInterval) / beatInterval;
			const quarterPhase = ((now % (beatInterval / 2)) / (beatInterval / 2));

			// 4/4 Kick & Snare dynamic attack
			const kickPulse = Math.pow(1 - beatPhase, 2.8);
			const snarePulse = (beatPhase > 0.45) ? Math.pow(1 - (beatPhase - 0.45) * 1.8, 2.2) : 0;
			const hatPulse = Math.pow(1 - quarterPhase, 2.0);

			ctx.clearRect(0, 0, canvas.width, canvas.height);
			const w = canvas.width;
			const h = canvas.height;
			const gap = 3;
			const barWidth = (w - (numBars - 1) * gap) / numBars;

			for (let i = 0; i < numBars; i++) {
				let target = 0.15;
				if (i < 4) {
					// Sub & Kick Bass
					target = 0.25 + 0.72 * kickPulse * energy + (Math.sin(now * 0.008 + i) * 0.08);
				} else if (i < 8) {
					// Mid Snare
					target = 0.20 + 0.68 * snarePulse * energy + (Math.cos(now * 0.012 + i) * 0.1);
				} else if (i < 12) {
					// Hi-hats
					target = 0.22 + 0.60 * hatPulse * energy + (Math.sin(now * 0.018 + i * 0.8) * 0.12);
				} else {
					// Air Shimmer
					target = 0.18 + 0.48 * (Math.sin(now * 0.02 + i) * 0.5 + 0.5) * energy;
				}

				barValues[i] += (target - barValues[i]) * 0.4;
				const barH = Math.max(3, barValues[i] * (h - 7));

				if (barH > peakCaps[i]) {
					peakCaps[i] = barH;
				} else {
					peakCaps[i] = Math.max(3, peakCaps[i] - 0.65);
				}

				const x = i * (barWidth + gap);
				const y = h - barH;

				const grad = ctx.createLinearGradient(0, h, 0, y);
				grad.addColorStop(0, color);
				grad.addColorStop(0.7, color);
				grad.addColorStop(1, '#ffffff');

				ctx.fillStyle = grad;
				ctx.fillRect(x, y, barWidth, barH);

				ctx.fillStyle = '#ffffff';
				ctx.fillRect(x, Math.max(0, h - peakCaps[i] - 2), barWidth, 2);
			}

			this.spectrumAnimId = requestAnimationFrame(renderFrame);
		};

		this.spectrumAnimId = requestAnimationFrame(renderFrame);
	}

	private renderTrackListOnly(): void {
		const snap = this.state.snapshot;
		const query = (this.searchInput?.value ?? '').toLowerCase().trim();
		const clusterTracks = [...this.store.getClusterTracks(snap.cluster)].sort(
			(a, b) => b.release_year - a.release_year,
		);
		if (this.tracksListEl) {
			this.tracksListEl.innerHTML = PersonasRenderer.renderTrackList(
				clusterTracks,
				query,
				snap.trackIndex,
				(t) => this.store.getTrackGlobalIndex(t),
			);
		}
	}

	// ── Pure static renderers (unit-testable) ──────────────────────────────────

	static renderClusterRail(
		clusters: readonly ClusterSummary[],
		meta: Map<number, ClusterMeta>,
		impact: Map<number, WeightedImpact>,
		activeCluster: number,
	): string {
		const icons = ['●', '▲', '◆', '■'];
		return clusters.map((c, idx) => {
			const m = meta.get(c.cluster)!;
			const count = impact.get(c.cluster)?.count ?? 0;
			const active = activeCluster === c.cluster;
			const icon = icons[idx % icons.length];
			return `
				<button class="cluster-btn ${active ? 'active' : ''}" data-cluster="${c.cluster}" style="--cluster-theme-color: ${m.color};">
					<div class="cluster-title-wrap">
						<span class="cluster-label-text">
							<span class="cluster-geo-icon" style="color: ${m.color}; font-size: 0.85rem;">${icon}</span>
							<strong style="margin-left: 6px;">${m.name}</strong>
						</span>
						<span class="cluster-count-pill">${count} tracks</span>
					</div>
				</button>
			`;
		}).join('');
	}

	static renderTrackList(
		tracks: readonly Track[],
		query: string,
		activeTrackIndex: number,
		getGlobalIndex: (t: Track) => number,
	): string {
		return tracks.map((t) => {
			const idx = getGlobalIndex(t);
			const active = activeTrackIndex === idx;
			const matches = !query || t.name.toLowerCase().includes(query);
			return `
				<button class="track-list-item ${active ? 'selected' : ''} ${matches ? '' : 'hidden'}" data-idx="${idx}">
					<div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
						<span class="track-item-dot" style="${active ? 'background: var(--geo-yellow);' : ''}"></span>
						<span class="track-item-title">${t.name}</span>
					</div>
					<span class="track-item-badge">${t.release_year}</span>
				</button>
			`;
		}).join('');
	}

	static renderMetricsGrid(cluster: ClusterSummary, color: string): string {
		const bars = [
			{ label: 'Danceability', val: cluster.danceability },
			{ label: 'Energy', val: cluster.energy },
			{ label: 'Valence', val: cluster.valence },
			{ label: 'Acousticness', val: cluster.acousticness },
			{ label: 'Speechiness', val: cluster.speechiness || 0.05 },
			{ label: 'Instrumental', val: cluster.instrumentalness || 0.02 },
		].map((m) => `
			<div class="metric-box">
				<div class="metric-meta">
					<span style="font-weight: 800; font-size: 0.65rem; color: var(--geo-black);">${m.label}</span>
					<span style="font-weight: 900; font-size: 0.72rem; font-family: monospace; color: var(--geo-black);">${Math.round(m.val * 100)}%</span>
				</div>
				<div class="metric-bar">
					<div class="metric-fill" style="width: ${Math.min(100, Math.round(m.val * 100))}%; background-color: ${color};"></div>
				</div>
			</div>
		`).join('');

		const tempo = Math.round(cluster.tempo || 115);
		const loudness = (cluster.loudness || 0).toFixed(1);
		return `
			<div class="metrics-grid">
				${bars}
				<div class="metric-chip-stat">
					<span class="metric-chip-title">AVG TEMPO</span>
					<span class="metric-chip-val" style="color: var(--geo-blue);">${tempo} <small>BPM</small></span>
				</div>
				<div class="metric-chip-stat">
					<span class="metric-chip-title">AVG LOUDNESS</span>
					<span class="metric-chip-val" style="color: var(--geo-red);">${loudness} <small>dB</small></span>
				</div>
			</div>
		`;
	}

	/** 9D Interactive SVG Radar Spider Polygon */
	static renderRadarSvg(cluster: ClusterSummary, color: string): string {
		const features = [
			{ key: 'Dance', val: cluster.danceability },
			{ key: 'Energy', val: cluster.energy },
			{ key: 'Valence', val: cluster.valence },
			{ key: 'Acoustic', val: cluster.acousticness },
			{ key: 'Speech', val: Math.min(1, (cluster.speechiness || 0.05) * 5) },
			{ key: 'Liveness', val: Math.min(1, (cluster.liveness || 0.15) * 3) },
		];

		const cx = 80;
		const cy = 60;
		const r = 42;
		const numPoints = features.length;

		const points = features.map((f, i) => {
			const angle = (Math.PI * 2 / numPoints) * i - Math.PI / 2;
			const radius = r * Math.max(0.15, Math.min(1, f.val));
			const x = cx + radius * Math.cos(angle);
			const y = cy + radius * Math.sin(angle);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		}).join(' ');

		const ringCircles = [0.33, 0.66, 1.0].map(ratio => {
			const ringPoints = Array.from({ length: numPoints }, (_, i) => {
				const angle = (Math.PI * 2 / numPoints) * i - Math.PI / 2;
				const x = cx + (r * ratio) * Math.cos(angle);
				const y = cy + (r * ratio) * Math.sin(angle);
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			}).join(' ');
			return `<polygon points="${ringPoints}" fill="none" stroke="#334155" stroke-width="1" stroke-dasharray="2,2"/>`;
		}).join('');

		const spokes = features.map((f, i) => {
			const angle = (Math.PI * 2 / numPoints) * i - Math.PI / 2;
			const x2 = cx + r * Math.cos(angle);
			const y2 = cy + r * Math.sin(angle);
			const lx = cx + (r + 11) * Math.cos(angle);
			const ly = cy + (r + 11) * Math.sin(angle);
			return `
				<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#475569" stroke-width="1"/>
				<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-size="7" font-weight="800" fill="#94a3b8">${f.key}</text>
			`;
		}).join('');

		return `
			<div class="persona-radar-card">
				<div class="radar-card-header">
					<span class="radar-title">DNA RADAR</span>
					<span class="radar-live-badge" style="background:${color}; color:#fff;">9D</span>
				</div>
				<svg viewBox="0 0 160 120" class="radar-svg-canvas">
					${ringCircles}
					${spokes}
					<polygon points="${points}" fill="${color}" fill-opacity="0.38" stroke="${color}" stroke-width="2.2" />
				</svg>
			</div>
		`;
	}

	/** Live Pulsing Soundwave Equalizer Canvas Container */
	static renderSoundwaveBars(cluster: ClusterSummary, color: string): string {
		const tempo = Math.round(cluster.tempo || 115);
		const energy = Math.round(cluster.energy * 100);

		return `
			<div class="persona-soundwave-card">
				<div class="soundwave-header">
					<span class="soundwave-label">4/4 BEAT SPECTRUM</span>
					<span class="soundwave-tempo">${tempo} BPM • ${energy}%</span>
				</div>
				<div class="soundwave-canvas-box">
					<canvas id="persona-spectrum-canvas" class="soundwave-canvas" width="220" height="68"></canvas>
				</div>
			</div>
		`;
	}

	/** Vibe Archetype Tags (Concise 2 tags) */
	static renderVibeTags(cluster: ClusterSummary, color: string): string {
		const tags: string[] = [];
		if (cluster.acousticness > 0.4) tags.push('#Organic');
		else tags.push('#Synthesizer');

		if (cluster.energy > 0.65) tags.push('#HighEnergy');
		else tags.push('#LaidBack');

		return tags.slice(0, 2).map(tag => `
			<span class="persona-vibe-tag" style="border-color:${color}; color:${color};">${tag}</span>
		`).join('');
	}

	/** Selected Track Acoustic Passport HUD */
	static renderTrackPassport(
		track: Track,
		metaMap: Map<number, ClusterMeta>,
		similarTracks: readonly { readonly index?: number; readonly trackIndex?: number; readonly similarity: number }[],
		getGlobalIndex: (t: Track) => number,
		allTracks: readonly Track[],
	): string {
		const meta = metaMap.get(track.cluster) || { name: 'Catalog', color: '#1642e8' };
		const era = track.release_year < 1990 ? '80s' : track.release_year < 2000 ? '90s' : track.release_year < 2010 ? '00s' : '10s';

		const sisterItems = similarTracks.slice(0, 2).map(item => {
			const idx = item.index ?? item.trackIndex ?? 0;
			const sTrack = allTracks[idx];
			if (!sTrack) return '';
			const sMeta = metaMap.get(sTrack.cluster);
			return `
				<button type="button" class="sister-jump-btn" data-track-idx="${idx}" title="Jump to sister track">
					<span class="sister-dot" style="background:${sMeta?.color || '#38bdf8'};"></span>
					<span class="sister-name">${sTrack.name} (${sTrack.release_year})</span>
					<span class="sister-sim">${(item.similarity * 100).toFixed(0)}%</span>
				</button>
			`;
		}).join('');

		return `
			<div class="track-passport-card">
				<div class="passport-header">
					<span class="passport-tag">SELECTED TRACK</span>
					<span class="passport-era-pill">${era}</span>
				</div>
				<h4 class="passport-title">${track.name}</h4>
				<div class="passport-meta-row">
					<span class="passport-cluster-badge" style="background:${meta.color}; color:#fff;">${meta.name}</span>
					<span class="passport-year">${track.release_year}</span>
					<span class="passport-pop">Pop: ${track.popularity || 70}/100</span>
				</div>

				<div class="passport-fingerprint-grid">
					<div class="fp-item">
						<span class="fp-lbl">Dance</span>
						<span class="fp-val">${Math.round(track.danceability * 100)}%</span>
					</div>
					<div class="fp-item">
						<span class="fp-lbl">Energy</span>
						<span class="fp-val">${Math.round(track.energy * 100)}%</span>
					</div>
					<div class="fp-item">
						<span class="fp-lbl">Valence</span>
						<span class="fp-val">${Math.round(track.valence * 100)}%</span>
					</div>
					<div class="fp-item">
						<span class="fp-lbl">Acoustic</span>
						<span class="fp-val">${Math.round(track.acousticness * 100)}%</span>
					</div>
				</div>

				${sisterItems ? `
					<div class="passport-sister-section">
						<span class="sister-section-lbl">SISTER TRACKS</span>
						<div class="sister-list">${sisterItems}</div>
					</div>
				` : ''}
			</div>
		`;
	}

	/** Decade Distribution Histogram Bar */
	static renderDecadeBreakdown(clusterTracks: readonly Track[], color: string): string {
		const decades: Record<string, number> = { '80s': 0, '90s': 0, '00s': 0, '10s': 0 };
		clusterTracks.forEach(t => {
			if (t.release_year < 1990) decades['80s']++;
			else if (t.release_year < 2000) decades['90s']++;
			else if (t.release_year < 2010) decades['00s']++;
			else decades['10s']++;
		});

		const total = clusterTracks.length || 1;
		const bars = Object.entries(decades).map(([decade, count]) => {
			const pct = Math.round((count / total) * 100);
			return `
				<div class="era-bar-col" title="${decade}: ${count} tracks (${pct}%)">
					<span class="era-pct">${pct}%</span>
					<div class="era-bar-track">
						<div class="era-bar-fill" style="height:${Math.max(8, pct)}%; background:${color};"></div>
					</div>
					<span class="era-lbl">${decade}</span>
				</div>
			`;
		}).join('');

		return `
			<div class="persona-era-card">
				<div class="era-header">
					<span class="era-title">ERA BREAKDOWN</span>
					<span class="era-count">${total} Tracks</span>
				</div>
				<div class="era-histogram-box">
					${bars}
				</div>
			</div>
		`;
	}
}
