/**
 * spotify-store.ts — Central data store for all Spotify Analysis data.
 * Pre-groups and indexes data at construction time for O(1) lookup.
 */

import {
	type Track,
	type ClusterSummary,
	type ClusterMeta,
	type WeightedImpact,
} from './spotify-types';
import { FeatureSpace } from './feature-space';
import { normalizeMinMax } from './spotify-math';

export class SpotifyDataStore {
	/** Deduplicated tracks (release_year ≤ 2020, canonical name dedup) */
	readonly tracks: readonly Track[];

	/** Raw cluster summary array from JSON */
	readonly clusters: readonly ClusterSummary[];

	/** Map<clusterId, ClusterMeta> for O(1) metadata lookup */
	readonly clusterMeta: Map<number, ClusterMeta>;

	/** Map<clusterId, WeightedImpact> */
	readonly clusterWeightedImpact: Map<number, WeightedImpact>;

	/** Normalized centrality scores [0,1] per track index */
	readonly popularityProxy: number[];

	/** Feature similarity engine */
	readonly featureSpace: FeatureSpace;

	/** Pre-grouped tracks per cluster: Map<clusterId, Track[]> — O(1) per call */
	private readonly _clusterGroups: Map<number, Track[]>;

	/** Reverse index: Track object → global index — O(1) via WeakMap */
	private readonly _trackIndex: WeakMap<Track, number>;

	constructor(rawTracks: Track[], clusters: ClusterSummary[]) {
		this.clusters = clusters;

		// ── Deduplicate by canonical name (keep first occurrence) ──────────────
		const seen = new Map<string, Track>();
		for (const t of rawTracks) {
			if (t.release_year > 2020) continue;
			const key = t.name.toLowerCase().trim();
			if (!seen.has(key)) seen.set(key, t);
		}
		this.tracks = Array.from(seen.values());

		// ── Build clusterMeta map ──────────────────────────────────────────────
		this.clusterMeta = new Map(
			clusters.map((c) => [
				c.cluster,
				{
					name: c.name || `Cluster ${c.cluster}`,
					description: c.description || '',
					color: c.color || '#888',
					image: c.image || '/assets/spotify/thediscodynamo-1.jpg',
				},
			])
		);

		// ── Pre-group tracks per cluster ──────────────────────────────────────
		this._clusterGroups = new Map();
		for (const c of clusters) this._clusterGroups.set(c.cluster, []);
		for (const t of this.tracks) {
			const group = this._clusterGroups.get(t.cluster);
			if (group) group.push(t);
		}

		// ── Build reverse WeakMap index ───────────────────────────────────────
		this._trackIndex = new WeakMap();
		this.tracks.forEach((t, i) => this._trackIndex.set(t, i));

		// ── Compute FeatureSpace & popularity proxy ───────────────────────────
		this.featureSpace = new FeatureSpace(this.tracks);
		const centrality = Array.from(this.featureSpace.getCentrality());
		this.popularityProxy = normalizeMinMax(centrality);

		// ── Compute weighted impact per cluster ───────────────────────────────
		const impactAccum = new Map<number, { sum: number; count: number }>();
		for (const c of clusters) impactAccum.set(c.cluster, { sum: 0, count: 0 });
		this.tracks.forEach((t, i) => {
			const acc = impactAccum.get(t.cluster);
			if (acc) {
				const weight = this.popularityProxy[i] * 0.85 + 0.15;
				acc.sum += weight;
				acc.count += 1;
			}
		});
		const totalWeight = [...impactAccum.values()].reduce((s, a) => s + a.sum, 0) || 1;
		this.clusterWeightedImpact = new Map(
			[...impactAccum.entries()].map(([id, { sum, count }]) => [
				id,
				{ share: sum / totalWeight, count },
			])
		);
	}

	/** O(1) — returns pre-grouped tracks for a cluster. */
	getClusterTracks(clusterId: number): readonly Track[] {
		return this._clusterGroups.get(clusterId) ?? [];
	}

	/** O(1) — returns the global index of a track object via WeakMap. */
	getTrackGlobalIndex(track: Track): number {
		return this._trackIndex.get(track) ?? -1;
	}
}
