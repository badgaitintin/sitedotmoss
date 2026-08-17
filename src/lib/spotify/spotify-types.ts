/**
 * spotify-types.ts — Core TypeScript types and enums for the Spotify Analysis page.
 * All domain objects are readonly to prevent accidental mutation.
 */

// ── Audio Feature Keys ────────────────────────────────────────────────────────

export const AUDIO_FEATURE_KEYS = [
	'danceability',
	'energy',
	'valence',
	'acousticness',
	'speechiness',
] as const;

export type AudioFeatureKey = (typeof AUDIO_FEATURE_KEYS)[number];

// ── Domain Interfaces ─────────────────────────────────────────────────────────

export interface Track {
	readonly name: string;
	readonly release_year: number;
	readonly cluster: number;
	readonly tsne_x: number;
	readonly tsne_y: number;
	readonly pc1: number;
	readonly pc2: number;
	readonly bias_score: number;
	readonly danceability: number;
	readonly energy: number;
	readonly valence: number;
	readonly acousticness: number;
	readonly speechiness: number;
	readonly tempo: number;
	readonly loudness: number;
	readonly popularity: number;
	[key: string]: unknown; // allow dynamic audio feature access
}

export interface ClusterMeta {
	readonly name: string;
	readonly description: string;
	readonly color: string;
	readonly image: string;
}

export interface ClusterSummary extends ClusterMeta {
	readonly cluster: number;
	readonly danceability: number;
	readonly energy: number;
	readonly valence: number;
	readonly acousticness: number;
	readonly tempo: number;
	readonly loudness: number;
}

export interface WeightedImpact {
	readonly share: number;
	readonly count: number;
}

export interface SimilarTrack {
	readonly index: number;
	readonly similarity: number;
}

export interface PersonalRatingTrack {
	readonly track: string;
	readonly album: string;
	readonly label: string;
	readonly bias_score: number;
	readonly pc1: number;
	readonly pc2: number;
}

export interface TsneBounds {
	readonly minX: number;
	readonly maxX: number;
	readonly minY: number;
	readonly maxY: number;
}

// ── App State ─────────────────────────────────────────────────────────────────

export const SpotifyTab = {
	Personas: 'personas',
	Galaxy: 'galaxy',
	Rating: 'rating',
	Pipeline: 'pipeline',
} as const;

export type SpotifyTab = (typeof SpotifyTab)[keyof typeof SpotifyTab];

export interface SpotifyAppState {
	tab: SpotifyTab;
	cluster: number;
	trackIndex: number;
}

// ── Rating Groups ─────────────────────────────────────────────────────────────

export const RATING_GROUPS = [
	{ label: 'My Favorite', color: '#10B981', border: '#047857' },
	{ label: 'So Far, So Good', color: '#F59E0B', border: '#B45309' },
	{ label: 'Not My Favorite', color: '#EF4444', border: '#B91C1C' },
] as const;

// ── ML Pipeline Architecture & Stage Types ──────────────────────────────────────

export type PipelineStageType = 'preprocessing' | 'transformation' | 'clustering' | 'validation' | 'projection' | 'similarity';
export type PipelineViewMode = 'stage' | 'grid';

export interface PipelineStage {
	readonly id: string;
	readonly stageNumber: number;
	readonly title: string;
	readonly subtitle: string;
	readonly stageTag: string;
	readonly stageType: PipelineStageType;
	readonly themeColor: string;
	readonly categoryBadge: string;
	readonly objective: string;
	readonly formulaBadge: string;
	readonly latexFormula?: string;
	readonly metricBadge: string;
	readonly keyStatLabel: string;
	readonly keyStatValue: string;
	readonly techSummary: string;
	readonly bullets: readonly string[];
	readonly graphicType: 'dedup' | 'power-transform' | 'k-stability' | 'gmm' | 'personas' | 'bootstrap' | 'manifold' | 'wormhole';
	readonly imageSrc?: string;
}
