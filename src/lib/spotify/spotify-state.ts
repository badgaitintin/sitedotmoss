/**
 * spotify-state.ts — Reactive application state for the Spotify Analysis page.
 * Wraps the mutable state object behind a typed class to prevent invalid states.
 */

import { type SpotifyTab, type SpotifyAppState, SpotifyTab as Tabs } from './spotify-types';

export class SpotifyState {
	private _state: SpotifyAppState = {
		tab: Tabs.Personas,
		cluster: 0,
		trackIndex: 0,
	};

	get tab(): SpotifyTab { return this._state.tab; }
	get cluster(): number { return this._state.cluster; }
	get trackIndex(): number { return this._state.trackIndex; }

	/** Snapshot of full state (read-only). */
	get snapshot(): Readonly<SpotifyAppState> { return { ...this._state }; }

	setTab(tab: SpotifyTab): void { this._state.tab = tab; }

	setCluster(id: number): void { this._state.cluster = id; }

	setTrackIndex(idx: number): void { this._state.trackIndex = idx; }
}
