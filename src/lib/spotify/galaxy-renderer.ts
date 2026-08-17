/**
 * galaxy-renderer.ts — Renders the "Music Galaxy" Plotly 3D scatter tab (Tab 2).
 * tsneBounds is computed once at construction; all rendering is stateless.
 */

import { AUDIO_FEATURE_KEYS, type Track, type TsneBounds } from './spotify-types';
import type { SpotifyDataStore } from './spotify-store';
import type { SpotifyState } from './spotify-state';

export class GalaxyRenderer {
	private readonly store: SpotifyDataStore;
	private readonly state: SpotifyState;
	readonly tsneBounds: TsneBounds;

	// Cached DOM refs
	private gdEl!: HTMLElement;
	private trackNameEl!: HTMLElement;
	private trackYearEl!: HTMLElement;
	private trackMetricsEl!: HTMLElement;
	private wormholesListEl!: HTMLElement;

	constructor(store: SpotifyDataStore, state: SpotifyState) {
		this.store = store;
		this.state = state;
		// Computed once at construction — immutable thereafter
		this.tsneBounds = GalaxyRenderer.computeTsneBounds(store.tracks);
	}

	init(): void {
		this.gdEl = document.getElementById('plotly-galaxy-3d')!;
		this.trackNameEl = document.getElementById('galaxy-track-name')!;
		this.trackYearEl = document.getElementById('galaxy-track-year')!;
		this.trackMetricsEl = document.getElementById('galaxy-track-metrics')!;
		this.wormholesListEl = document.getElementById('galaxy-wormholes-list')!;

		// Event delegation on wormholes list
		this.wormholesListEl.addEventListener('click', (e) => {
			const btn = (e.target as Element).closest<HTMLButtonElement>('.track-list-item');
			if (!btn) return;
			this.state.setTrackIndex(Number(btn.dataset.idx));
			this.render();
		});
	}

	render(): void {
		const { store, state } = this;
		if (!this.gdEl || !(window as any).Plotly) return;

		const snap = state.snapshot;
		const selTrack = store.tracks[snap.trackIndex];

		// ── Detail card ──────────────────────────────────────────────────────
		const clusterColor = selTrack ? store.clusterMeta.get(selTrack.cluster)?.color ?? '#888' : '#888';
		const clusterName = selTrack ? store.clusterMeta.get(selTrack.cluster)?.name ?? '' : '';

		this.trackNameEl.textContent = selTrack?.name ?? '-';
		(this.trackNameEl as HTMLElement).title = selTrack?.name ?? '';
		this.trackYearEl.textContent = selTrack
			? `${selTrack.release_year} • ${clusterName}`
			: '-';

		// Audio feature bars
		let featuresHTML = AUDIO_FEATURE_KEYS.map((k) => {
			const val = selTrack ? Number(selTrack[k]) : 0;
			return `
				<div class="geo-feature-row">
					<div class="geo-feature-meta">
						<span style="text-transform: uppercase; font-weight: 800; font-size: 0.65rem; color: var(--geo-black);">${k}</span>
						<span style="font-weight: 900; font-family: monospace; font-size: 0.72rem; color: var(--geo-black);">${Math.round(val * 100)}%</span>
					</div>
					<div class="metric-bar">
						<div class="metric-fill" style="width: ${val * 100}%; background-color: ${clusterColor};"></div>
					</div>
				</div>
			`;
		}).join('');

		if (selTrack) {
			const tempo = Math.round(selTrack.tempo || 120);
			const loudness = (selTrack.loudness || 0).toFixed(1);
			const popularity = selTrack.popularity || 0;
			featuresHTML += `
				<div class="geo-hud-stats-grid">
					<div class="geo-hud-stat-chip">
						<div class="geo-hud-stat-label">POPULARITY</div>
						<div class="geo-hud-stat-val" style="color: var(--geo-blue);">${popularity}%</div>
					</div>
					<div class="geo-hud-stat-chip">
						<div class="geo-hud-stat-label">TEMPO</div>
						<div class="geo-hud-stat-val" style="color: var(--geo-red);">${tempo} <small>BPM</small></div>
					</div>
					<div class="geo-hud-stat-chip">
						<div class="geo-hud-stat-label">LOUDNESS</div>
						<div class="geo-hud-stat-val" style="color: #b45309;">${loudness} <small>dB</small></div>
					</div>
				</div>
			`;
		}
		this.trackMetricsEl.innerHTML = featuresHTML;

		// ── Wormholes ────────────────────────────────────────────────────────
		const wormholes = store.featureSpace.getTopSimilar(snap.trackIndex, 5);
		this.wormholesListEl.innerHTML = wormholes.map((w) => {
			const track = store.tracks[w.index];
			return `
				<button class="track-list-item" data-idx="${w.index}">
					<span class="track-item-title">${track.name}</span>
					<span class="track-item-badge" style="background: var(--geo-blue); color: #fff;">${Math.round(w.similarity * 100)}% SIMILAR</span>
				</button>
			`;
		}).join('');

		// ── Build Plotly traces ───────────────────────────────────────────────
		const traces: object[] = [];

		// Wormhole lines
		if (selTrack && wormholes.length > 0) {
			const lineX: (number | null)[] = [], lineY: (number | null)[] = [], lineZ: (number | null)[] = [];
			for (const w of wormholes) {
				const target = store.tracks[w.index];
				lineX.push(selTrack.tsne_x, target.tsne_x, null);
				lineY.push(selTrack.tsne_y, target.tsne_y, null);
				lineZ.push(selTrack.release_year, target.release_year, null);
			}
			traces.push({ type: 'scatter3d', mode: 'lines', x: lineX, y: lineY, z: lineZ,
				line: { color: 'rgba(125,211,252,0.85)', width: 3.5 },
				name: 'Wormholes', showlegend: false, hoverinfo: 'skip' });
		}

		// Cluster point clouds
		for (const c of store.clusters) {
			const clusterTracks = store.getClusterTracks(c.cluster) as (Track & { _idx: number })[];
			if (clusterTracks.length === 0) continue;
			const meta = store.clusterMeta.get(c.cluster)!;
			const isDimmed = snap.cluster !== c.cluster;
			const indices = clusterTracks.map((t) => store.getTrackGlobalIndex(t));
			traces.push({
				x: clusterTracks.map((t) => t.tsne_x),
				y: clusterTracks.map((t) => t.tsne_y),
				z: clusterTracks.map((t) => t.release_year),
				customdata: indices,
				mode: 'markers', type: 'scatter3d', name: meta.name,
				marker: { size: 4, color: meta.color, opacity: isDimmed ? 0.3 : 0.85, line: { color: '#fff', width: 0.5 } },
				hoverinfo: 'text',
				hovertext: clusterTracks.map((t) => `<strong>${t.name}</strong> (${t.release_year})<br>Popularity: ${t.popularity || 0}%`),
			});
		}

		// Selected track marker
		if (selTrack) {
			traces.push({
				x: [selTrack.tsne_x], y: [selTrack.tsne_y], z: [selTrack.release_year],
				mode: 'markers', type: 'scatter3d', name: `Selected: ${selTrack.name}`,
				marker: { size: 10, color: '#ffffff', symbol: 'diamond', line: { color: clusterColor, width: 2.5 } },
				hoverinfo: 'text', hovertext: `Selected: ${selTrack.name} (${selTrack.release_year})`, showlegend: false,
			});
		}

		const layout = {
			margin: { l: 0, r: 0, b: 0, t: 0 },
			paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
			scene: {
				xaxis: { title: 'Manifold X', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.15)', showbackground: false, tickcolor: '#fff', titlefont: { size: 10, color: '#9ca3af' }, tickfont: { size: 9, color: '#94a3b8' } },
				yaxis: { title: 'Manifold Y', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.15)', showbackground: false, tickcolor: '#fff', titlefont: { size: 10, color: '#9ca3af' }, tickfont: { size: 9, color: '#94a3b8' } },
				zaxis: { title: 'Release Year', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.15)', showbackground: false, tickcolor: '#fff', titlefont: { size: 10, color: '#9ca3af' }, tickfont: { size: 9, color: '#94a3b8' } },
				camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
			},
			showlegend: true,
			legend: { x: 0.02, y: 0.98, font: { size: 9, color: '#fff' }, bgcolor: 'rgba(13,17,30,0.8)', bordercolor: 'rgba(255,255,255,0.08)', borderwidth: 1 },
		};

		(window as any).Plotly.newPlot('plotly-galaxy-3d', traces, layout, { responsive: true, displayModeBar: false });

		// Click handler
		(this.gdEl as any).on('plotly_click', (data: any) => {
			if (data?.points?.length > 0) {
				const pt = data.points[0];
				if (pt.customdata !== undefined) {
					this.state.setTrackIndex(pt.customdata);
					this.render();
				}
			}
		});
	}

	// ── Pure static methods ─────────────────────────────────────────────────

	static computeTsneBounds(tracks: readonly Track[]): TsneBounds {
		if (tracks.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
		let minX = tracks[0].tsne_x, maxX = tracks[0].tsne_x;
		let minY = tracks[0].tsne_y, maxY = tracks[0].tsne_y;
		for (const t of tracks) {
			if (t.tsne_x < minX) minX = t.tsne_x;
			if (t.tsne_x > maxX) maxX = t.tsne_x;
			if (t.tsne_y < minY) minY = t.tsne_y;
			if (t.tsne_y > maxY) maxY = t.tsne_y;
		}
		return { minX, maxX, minY, maxY };
	}
}
