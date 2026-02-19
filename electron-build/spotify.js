import crypto from "crypto";
export function base64url(input) {
    return input
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}
export function randomString(len = 64) {
    return base64url(crypto.randomBytes(len));
}
export function sha256(verifier) {
    return crypto.createHash("sha256").update(verifier).digest();
}
export function buildAuthorizeUrl(args) {
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
export async function exchangeCodeForToken(args) {
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
    const json = await res.json();
    const expiresIn = Number(json.expires_in ?? 3600);
    return {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_at: Date.now() + (expiresIn - 30) * 1000
    };
}
export async function refreshAccessToken(args) {
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
    const json = await res.json();
    const expiresIn = Number(json.expires_in ?? 3600);
    return {
        access_token: json.access_token,
        expires_at: Date.now() + (expiresIn - 30) * 1000
    };
}
export async function getNowPlaying(accessToken) {
    const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });
    if (res.status === 204)
        return null;
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Now playing failed: ${res.status} ${t}`);
    }
    const json = (await res.json());
    return json;
}
async function spotifyPlayerAction(accessToken, path, method) {
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
export async function playNext(accessToken) {
    await spotifyPlayerAction(accessToken, "next", "POST");
}
export async function playPrevious(accessToken) {
    await spotifyPlayerAction(accessToken, "previous", "POST");
}
export async function togglePlayPause(accessToken, isPlaying) {
    if (isPlaying) {
        await spotifyPlayerAction(accessToken, "pause", "PUT");
    }
    else {
        await spotifyPlayerAction(accessToken, "play", "PUT");
    }
}
export async function getPlaybackStats(accessToken) {
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
    const recentJson = await recentRes.json();
    const topTracksShortJson = await topTracksShortRes.json();
    const topTracksMediumJson = await topTracksMediumRes.json();
    const topArtistsShortJson = await topArtistsShortRes.json();
    const topArtistsMediumJson = await topArtistsMediumRes.json();
    return {
        recentlyPlayed: Array.isArray(recentJson.items) ? recentJson.items : [],
        topTracksShort: Array.isArray(topTracksShortJson.items) ? topTracksShortJson.items : [],
        topTracksMedium: Array.isArray(topTracksMediumJson.items) ? topTracksMediumJson.items : [],
        topArtistsShort: Array.isArray(topArtistsShortJson.items) ? topArtistsShortJson.items : [],
        topArtistsMedium: Array.isArray(topArtistsMediumJson.items) ? topArtistsMediumJson.items : []
    };
}
export async function getLyrics(track, artist, durationMs) {
    const cleanTrack = track.trim();
    const cleanArtist = artist.trim();
    if (!cleanTrack || !cleanArtist)
        return null;
    const safeTrack = encodeURIComponent(cleanTrack);
    const safeArtist = encodeURIComponent(cleanArtist);
    try {
        // Source 1: LRCLIB (often richer catalog and synced lyrics).
        const q = new URLSearchParams({
            track_name: cleanTrack,
            artist_name: cleanArtist
        });
        if (durationMs && durationMs > 0)
            q.set("duration", String(Math.round(durationMs / 1000)));
        const lrcRes = await fetch(`https://lrclib.net/api/get?${q.toString()}`);
        if (lrcRes.ok) {
            const json = await lrcRes.json();
            const text = json?.syncedLyrics || json?.plainLyrics;
            if (text && String(text).trim().length > 0)
                return String(text);
        }
    }
    catch {
        // fallback below
    }
    try {
        // Source 2: lyrics.ovh fallback.
        const res = await fetch(`https://api.lyrics.ovh/v1/${safeArtist}/${safeTrack}`);
        if (!res.ok)
            return null;
        const json = await res.json();
        if (!json?.lyrics)
            return null;
        return String(json.lyrics);
    }
    catch {
        return null;
    }
}
