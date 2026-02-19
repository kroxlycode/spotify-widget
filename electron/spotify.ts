import crypto from "crypto";

export type TokenSet = {
    access_token: string;
    refresh_token: string;
    expires_at: number; // epoch ms
};

export type NowPlaying = {
    is_playing: boolean;
    progress_ms?: number;
    item?: {
        id?: string;
        name: string;
        duration_ms?: number;
        external_urls?: { spotify?: string };
        album: {
            name: string;
            images: { url: string; height: number; width: number }[];
        };
        artists: { name: string }[];
    };
};

type SpotifyTrack = {
    id?: string;
    name: string;
    duration_ms?: number;
    available_markets?: string[];
    external_urls?: { spotify?: string };
    album?: {
        name?: string;
        images?: { url: string; height: number; width: number }[];
    };
    artists?: { id?: string; name: string }[];
};

type SpotifyArtist = {
    id?: string;
    name: string;
    genres?: string[];
    images?: { url: string; height: number; width: number }[];
    external_urls?: { spotify?: string };
};

export type PlaybackStats = {
    recentlyPlayed: Array<{ played_at: string; track: SpotifyTrack }>;
    topTracksShort: SpotifyTrack[];
    topTracksMedium: SpotifyTrack[];
    topArtistsShort: SpotifyArtist[];
    topArtistsMedium: SpotifyArtist[];
};

export function base64url(input: Buffer) {
    return input
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

export function randomString(len = 64) {
    return base64url(crypto.randomBytes(len));
}

export function sha256(verifier: string) {
    return crypto.createHash("sha256").update(verifier).digest();
}

export function buildAuthorizeUrl(args: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
}) {
    const scope = [
        "user-read-currently-playing",
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-recently-played",
        "user-top-read"
    ].join(" ");

    const params = new URLSearchParams({
        response_type: "code",
        client_id: args.clientId,
        scope,
        redirect_uri: args.redirectUri,
        state: args.state,
        code_challenge_method: "S256",
        code_challenge: args.codeChallenge
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(args: {
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
}): Promise<TokenSet> {
    const body = new URLSearchParams({
        client_id: args.clientId,
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: args.redirectUri,
        code_verifier: args.codeVerifier
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });

    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Token exchange failed: ${res.status} ${t}`);
    }

    const json: any = await res.json();
    const expiresIn = Number(json.expires_in ?? 3600);

    return {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_at: Date.now() + (expiresIn - 30) * 1000
    };
}

export async function refreshAccessToken(args: {
    clientId: string;
    refreshToken: string;
}): Promise<{ access_token: string; expires_at: number }> {
    const body = new URLSearchParams({
        client_id: args.clientId,
        grant_type: "refresh_token",
        refresh_token: args.refreshToken
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });

    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Refresh failed: ${res.status} ${t}`);
    }

    const json: any = await res.json();
    const expiresIn = Number(json.expires_in ?? 3600);

    return {
        access_token: json.access_token,
        expires_at: Date.now() + (expiresIn - 30) * 1000
    };
}

export async function getNowPlaying(accessToken: string): Promise<NowPlaying | null> {
    const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (res.status === 204) return null;

    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Now playing failed: ${res.status} ${t}`);
    }

    const json = (await res.json()) as NowPlaying;
    return json;
}

async function spotifyPlayerAction(accessToken: string, path: string, method: "POST" | "PUT") {
    const res = await fetch(`https://api.spotify.com/v1/me/player/${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!res.ok && res.status !== 204) {
        const t = await res.text();
        throw new Error(`Player action failed: ${res.status} ${t}`);
    }
}

export async function playNext(accessToken: string) {
    await spotifyPlayerAction(accessToken, "next", "POST");
}

export async function playPrevious(accessToken: string) {
    await spotifyPlayerAction(accessToken, "previous", "POST");
}

export async function togglePlayPause(accessToken: string, isPlaying: boolean) {
    if (isPlaying) {
        await spotifyPlayerAction(accessToken, "pause", "PUT");
    } else {
        await spotifyPlayerAction(accessToken, "play", "PUT");
    }
}

export async function getPlaybackStats(accessToken: string): Promise<PlaybackStats> {
    const [recentRes, topTracksShortRes, topTracksMediumRes, topArtistsShortRes, topArtistsMediumRes] = await Promise.all([
        fetch("https://api.spotify.com/v1/me/player/recently-played?limit=50", {
            headers: { Authorization: `Bearer ${accessToken}` }
        }),
        fetch("https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=short_term", {
            headers: { Authorization: `Bearer ${accessToken}` }
        }),
        fetch("https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=medium_term", {
            headers: { Authorization: `Bearer ${accessToken}` }
        }),
        fetch("https://api.spotify.com/v1/me/top/artists?limit=20&time_range=short_term", {
            headers: { Authorization: `Bearer ${accessToken}` }
        }),
        fetch("https://api.spotify.com/v1/me/top/artists?limit=20&time_range=medium_term", {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
    ]);

    if (!recentRes.ok || !topTracksShortRes.ok || !topTracksMediumRes.ok || !topArtistsShortRes.ok || !topArtistsMediumRes.ok) {
        throw new Error("İstatistik verileri alınamadı.");
    }

    const recentJson: any = await recentRes.json();
    const topTracksShortJson: any = await topTracksShortRes.json();
    const topTracksMediumJson: any = await topTracksMediumRes.json();
    const topArtistsShortJson: any = await topArtistsShortRes.json();
    const topArtistsMediumJson: any = await topArtistsMediumRes.json();

    return {
        recentlyPlayed: Array.isArray(recentJson.items) ? recentJson.items : [],
        topTracksShort: Array.isArray(topTracksShortJson.items) ? topTracksShortJson.items : [],
        topTracksMedium: Array.isArray(topTracksMediumJson.items) ? topTracksMediumJson.items : [],
        topArtistsShort: Array.isArray(topArtistsShortJson.items) ? topArtistsShortJson.items : [],
        topArtistsMedium: Array.isArray(topArtistsMediumJson.items) ? topArtistsMediumJson.items : []
    };
}

export async function getLyrics(track: string, artist: string, durationMs?: number): Promise<string | null> {
    const cleanTrack = track.trim();
    const cleanArtist = artist.trim();
    if (!cleanTrack || !cleanArtist) return null;

    const safeTrack = encodeURIComponent(cleanTrack);
    const safeArtist = encodeURIComponent(cleanArtist);

    try {
        // Source 1: LRCLIB (often richer catalog and synced lyrics).
        const q = new URLSearchParams({
            track_name: cleanTrack,
            artist_name: cleanArtist
        });
        if (durationMs && durationMs > 0) q.set("duration", String(Math.round(durationMs / 1000)));

        const lrcRes = await fetch(`https://lrclib.net/api/get?${q.toString()}`);
        if (lrcRes.ok) {
            const json: any = await lrcRes.json();
            const text = json?.syncedLyrics || json?.plainLyrics;
            if (text && String(text).trim().length > 0) return String(text);
        }
    } catch {
        // fallback below
    }

    try {
        // Source 2: lyrics.ovh fallback.
        const res = await fetch(`https://api.lyrics.ovh/v1/${safeArtist}/${safeTrack}`);
        if (!res.ok) return null;
        const json: any = await res.json();
        if (!json?.lyrics) return null;
        return String(json.lyrics);
    } catch {
        return null;
    }
}
