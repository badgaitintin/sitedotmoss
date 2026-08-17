/**
 * personas-renderer.ts — Renders the "Sonic Personas" tab (Tab 1).
 * Uses event delegation instead of per-element addEventListener calls.
 * Pure static methods are fully testable without DOM.
 */

import { AUDIO_FEATURE_KEYS, type Track, type ClusterSummary, type ClusterMeta, type WeightedImpact } from './spotify-types';
import type { SpotifyDataStore } from './spotify-store';
import type { SpotifyState } from './spotify-state';

export class PersonasRenderer {
	private readonly store: SpotifyDataStore;
	private readonly state: SpotifyState;

	// Cached DOM refs — queried once at init
	private railList!: HTMLElement;
	private clusterNameEl!: HTMLElement;
	private clusterDescEl!: HTMLElement;
	private clusterShareEl!: HTMLElement;
	private clusterMetricsEl!: HTMLElement;
	private tracksListEl!: HTMLElement;
	private searchInput!: HTMLInputElement | null;

	constructor(store: SpotifyDataStore, state: SpotifyState) {
		this.store = store;
		this.state = state;
	}

	/** Cache DOM refs and bind all events once (event delegation on containers). */
	init(): void {
		this.railList = document.getElementById('cluster-rail-list')!;
		this.clusterNameEl = document.getElementById('cluster-name')!;
		this.clusterDescEl = document.getElementById('cluster-desc')!;
		this.clusterShareEl = document.getElementById('cluster-share')!;
		this.clusterMetricsEl = document.getElementById('cluster-metrics')!;
		this.tracksListEl = document.getElementById('cluster-tracks-list')!;
		this.searchInput = document.getElementById('personas-search') as HTMLInputElement | null;

		// Event delegation on rail list — one listener for all cluster buttons
		this.railList.addEventListener('click', (e) => {
			const btn = (e.target as Element).closest<HTMLButtonElement>('.cluster-btn');
			if (!btn) return;
			const clusterId = Number(btn.dataset.cluster);
			this.state.setCluster(clusterId);
			// Auto-select first track in new cluster
			const firstTrack = this.store.getClusterTracks(clusterId)[0];
			if (firstTrack) {
				this.state.setTrackIndex(this.store.getTrackGlobalIndex(firstTrack));
			}
			this.render();
		});

		// Event delegation on tracks list
		this.tracksListEl.addEventListener('click', (e) => {
			const btn = (e.target as Element).closest<HTMLButtonElement>('.track-list-item');
			if (!btn) return;
			this.state.setTrackIndex(Number(btn.dataset.idx));
			this.render();
		});

		// Search input
		this.searchInput?.addEventListener('input', () => this.render());
	}

	/** Full re-render of the Personas tab with current state. */
	render(): void {
		const { store, state } = this;
		const snap = state.snapshot;

		// Rail
		this.railList.innerHTML = PersonasRenderer.renderClusterRail(
			store.clusters,
			store.clusterMeta,
			store.clusterWeightedImpact,
			snap.cluster,
		);

		// Cluster header
		const meta = store.clusterMeta.get(snap.cluster)!;
		const impact = store.clusterWeightedImpact.get(snap.cluster)!;
		this.clusterNameEl.textContent = meta.name;
		this.clusterDescEl.textContent = meta.description;
		this.clusterShareEl.textContent = `${Math.round(impact.share * 100)}% share`;

		// Metrics grid
		const clusterData = store.clusters[snap.cluster];
		this.clusterMetricsEl.innerHTML = PersonasRenderer.renderMetricsGrid(clusterData, meta.color);

		// Track list
		const query = (this.searchInput?.value ?? '').toLowerCase().trim();
		const clusterTracks = [...store.getClusterTracks(snap.cluster)].sort(
			(a, b) => b.release_year - a.release_year,
		);
		this.tracksListEl.innerHTML = PersonasRenderer.renderTrackList(
			clusterTracks,
			query,
			snap.trackIndex,
			(t) => store.getTrackGlobalIndex(t),
		);
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
					<span class="track-item-title">${t.name}</span>
					<span class="track-item-badge">${t.release_year}</span>
				</button>
			`;
		}).join('');
	}

	static renderMetricsGrid(cluster: ClusterSummary, color: string): string {
		const bars = [
			{ label: 'Danceability', val: cluster.danceability, icon: 'D' },
			{ label: 'Energy', val: cluster.energy, icon: 'E' },
			{ label: 'Valence', val: cluster.valence, icon: 'V' },
			{ label: 'Acousticness', val: cluster.acousticness, icon: 'A' },
		].map((m) => `
			<div class="metric-box">
				<div class="metric-meta">
					<span style="display: flex; align-items: center; gap: 4px;">
						<span style="font-weight: 800; font-size: 0.65rem; color: var(--geo-black);">${m.label}</span>
					</span>
					<span style="font-weight: 900; font-size: 0.72rem; font-family: monospace; color: var(--geo-black);">${Math.round(m.val * 100)}%</span>
				</div>
				<div class="metric-bar">
					<div class="metric-fill" style="width: ${m.val * 100}%; background-color: ${color};"></div>
				</div>
			</div>
		`).join('');

		const tempo = Math.round(cluster.tempo || 115);
		const loudness = (cluster.loudness || 0).toFixed(1);
		return bars + `
			<div class="metric-chip-stat">
				<span class="metric-chip-title">AVG TEMPO</span>
				<span class="metric-chip-val" style="color: var(--geo-blue);">${tempo} <small>BPM</small></span>
			</div>
			<div class="metric-chip-stat">
				<span class="metric-chip-title">AVG LOUDNESS</span>
				<span class="metric-chip-val" style="color: var(--geo-red);">${loudness} <small>dB</small></span>
			</div>
		`;
	}
}
