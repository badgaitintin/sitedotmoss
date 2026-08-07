/**
 * rating-renderer.ts — Renders the "Personal Rating" Plotly 3D tab (Tab 3).
 * Manages accordion album cards and 3D bias score visualization.
 */

import { RATING_GROUPS, type PersonalRatingTrack } from './spotify-types';
import { getEllipsoidTrace } from './spotify-math';

export class RatingRenderer {
	private readonly allTracks: (PersonalRatingTrack & { album: string })[];
	private readonly albumGroups: Map<string, (PersonalRatingTrack & { album: string })[]>;
	private readonly albums: string[];
	private selectedAlbum: string | null = null;
	private isFirstRender = true;

	// Cached DOM ref
	private containerEl!: HTMLElement;

	constructor(personalRating: PersonalRatingTrack[]) {
		// Ensure every track has an album field
		this.allTracks = personalRating.map((t) => ({
			...t,
			album: t.album || 'Confessions II',
		}));
		// Pre-group by album (Map preserves insertion order)
		this.albumGroups = RatingRenderer.groupByAlbum(this.allTracks);
		this.albums = Array.from(this.albumGroups.keys());
	}

	init(): void {
		this.containerEl = document.getElementById('album-cards-container')!;

		// Event delegation — one listener for all album headers
		this.containerEl.addEventListener('click', (e) => {
			const header = (e.target as Element).closest<HTMLElement>('.album-card-header');
			if (!header) return;
			const card = header.parentElement as HTMLElement;
			const albumName = card.dataset.album ?? null;
			this.selectedAlbum = this.selectedAlbum === albumName ? null : albumName;
			this.render();
		});
	}

	render(): void {
		if (!this.containerEl) return;

		if (this.isFirstRender && this.albums.length > 0) {
			this.selectedAlbum = this.albums[0];
			this.isFirstRender = false;
		}

		this.containerEl.innerHTML = this.albums.map((albumName) => {
			const tracks = this.albumGroups.get(albumName)!;
			const isActive = this.selectedAlbum === albumName;
			return RatingRenderer.renderAlbumCard(albumName, tracks, isActive);
		}).join('');

		this._renderPlot();
	}

	private _renderPlot(): void {
		const gd = document.getElementById('plotly-3d-map');
		if (!gd || !(window as any).Plotly) return;

		const ratings = this.selectedAlbum
			? this.albumGroups.get(this.selectedAlbum) ?? this.allTracks
			: this.allTracks;

		const traces: object[] = [];

		for (const g of RATING_GROUPS) {
			const groupTracks = ratings.filter((t) => t.label === g.label);
			if (groupTracks.length === 0) continue;

			traces.push({
				x: groupTracks.map((t) => t.pc1),
				y: groupTracks.map((t) => t.pc2),
				z: groupTracks.map((t) => t.bias_score),
				mode: 'markers+text', type: 'scatter3d', name: g.label,
				text: groupTracks.map((t) => t.track),
				textposition: 'top center',
				textfont: { size: 8, color: '#cbd5e1' },
				marker: { size: 5, color: g.color, line: { color: g.border, width: 1 } },
				hoverinfo: 'text',
				hovertext: groupTracks.map((t) =>
					`${t.track}<br>${this.selectedAlbum ? '' : `Album: ${t.album}<br>`}PC1: ${t.pc1.toFixed(3)}<br>PC2: ${t.pc2.toFixed(3)}<br>Bias Score: ${t.bias_score}`
				),
			});

			if (this.selectedAlbum && groupTracks.length >= 3) {
				const mesh = getEllipsoidTrace(groupTracks, g.color);
				if (mesh) traces.push(mesh);
			}
		}

		const axisStyle = {
			gridcolor: 'rgba(255,255,255,0.1)', zerolinecolor: 'rgba(255,255,255,0.2)',
			backgroundColor: 'rgba(0,0,0,0)', showbackground: false,
			tickcolor: '#cbd5e1', titlefont: { size: 10, color: '#cbd5e1' }, tickfont: { size: 9, color: '#94a3b8' },
		};
		const layout = {
			margin: { l: 0, r: 0, b: 0, t: 0 },
			paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
			scene: {
				xaxis: { ...axisStyle, title: 'PC1 - style (84% var)' },
				yaxis: { ...axisStyle, title: 'PC2 - style (8% var)' },
				zaxis: { ...axisStyle, title: 'Personal Bias Score' },
				camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
			},
			showlegend: true,
			legend: { x: 0, y: 1, font: { size: 9, color: '#cbd5e1' }, bgcolor: 'rgba(30,41,59,0.8)', bordercolor: 'rgba(255,255,255,0.1)', borderwidth: 1 },
		};

		(window as any).Plotly.newPlot('plotly-3d-map', traces, layout, { responsive: true, displayModeBar: false });
	}

	// ── Pure static methods ─────────────────────────────────────────────────

	static groupByAlbum<T extends { album: string }>(tracks: T[]): Map<string, T[]> {
		const map = new Map<string, T[]>();
		for (const t of tracks) {
			if (!map.has(t.album)) map.set(t.album, []);
			map.get(t.album)!.push(t);
		}
		return map;
	}

	static renderAlbumCard(
		albumName: string,
		tracks: (PersonalRatingTrack & { album: string })[],
		isActive: boolean,
	): string {
		const sorted = [...tracks].sort((a, b) => b.bias_score - a.bias_score);

		let favHtml = '', goodHtml = '', notfavHtml = '';
		for (const t of sorted) {
			const row = `
				<div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; border-bottom: 1px dashed rgba(0,0,0,0.05); transition: background-color 0.15s;" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.2)'" onmouseout="this.style.backgroundColor='transparent'">
					<span style="font-weight: 700; font-size: 0.72rem; color: var(--bh-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 175px;" title="${t.track}">${t.track}</span>
					<span style="font-size: 0.62rem; color: var(--bh-muted); flex-shrink: 0;">Bias: <strong style="color: var(--bh-text); font-size: 0.68rem;">${t.bias_score}</strong></span>
				</div>
			`;
			if (t.label === 'My Favorite') favHtml += row;
			else if (t.label === 'So Far, So Good') goodHtml += row;
			else notfavHtml += row;
		}

		const none = `<span style="font-size:0.7rem; color:var(--bh-muted); font-style:italic;">None</span>`;
		return `
			<div class="album-card ${isActive ? 'active' : ''}" data-album="${albumName}">
				<div class="album-card-header">
					<div class="album-card-info">
						<span class="album-card-title">${albumName}</span>
						<span class="album-card-subtitle">${tracks.length} tracks rated</span>
					</div>
					<svg class="album-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="6 9 12 15 18 9"></polyline>
					</svg>
				</div>
				<div class="album-card-body">
					<div class="rating-group-sec" style="border-left: 4px solid #10B981;">
						<span class="rating-group-title-sec" style="color: #10B981;">My Favorite</span>
						<div class="rating-group-tracks-sec">${favHtml || none}</div>
					</div>
					<div class="rating-group-sec" style="border-left: 4px solid #F59E0B;">
						<span class="rating-group-title-sec" style="color: #F59E0B;">So Far, So Good</span>
						<div class="rating-group-tracks-sec">${goodHtml || none}</div>
					</div>
					<div class="rating-group-sec" style="border-left: 4px solid #EF4444;">
						<span class="rating-group-title-sec" style="color: #EF4444;">Not My Favorite</span>
						<div class="rating-group-tracks-sec">${notfavHtml || none}</div>
					</div>
				</div>
			</div>
		`;
	}
}
