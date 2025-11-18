import express from "express";

const router = express.Router();

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
        return cachedToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Spotify client id / secret are not configured.");
    }

    const body = new URLSearchParams();
    body.set("grant_type", "client_credentials");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);

    const resp = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to obtain Spotify token: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return cachedToken;
}

async function searchArtistByName(name, token) {
    const params = new URLSearchParams({
        q: name,
        type: "artist",
        limit: "1",
    });

    const resp = await fetch(
        `https://api.spotify.com/v1/search?${params.toString()}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Spotify search failed: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    const items = data?.artists?.items || [];
    if (!items.length) return null;
    return items[0];
}

async function getArtistAlbums(artistId, token) {
    const params = new URLSearchParams({
        limit: "50",
    });

    const resp = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}/albums?${params.toString()}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Spotify albums failed: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    const items = data?.items || [];
    const seenNames = new Set();
    const albums = [];

    for (const a of items) {
        if (!a || !a.name) continue;
        if (seenNames.has(a.name)) continue;
        seenNames.add(a.name);

        albums.push({
            id: a.id,
            name: a.name,
            imageUrl: a.images && a.images.length ? a.images[0].url : null,
            spotifyUrl: a.external_urls?.spotify ?? null,
            releaseDate: a.release_date,
            totalTracks: a.total_tracks,
        });
    }

    return albums;
}

router.get("/artist", async (req, res) => {
    const { name } = req.query;
    if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "missing_name" });
    }

    try {
        const token = await getAccessToken();
        const artist = await searchArtistByName(name, token);
        if (!artist) {
            return res.json({ artist: null });
        }

        const albums = await getArtistAlbums(artist.id, token);

        const payload = {
            name: artist.name,
            followers: artist.followers?.total ?? null,
            popularity: artist.popularity ?? null,
            spotifyUrl: artist.external_urls?.spotify ?? null,
            imageUrl:
                artist.images && artist.images.length
                    ? artist.images[0].url
                    : null,
            genres: artist.genres ?? [],
            albums,
        };

        return res.json({ artist: payload });
    } catch (err) {
        console.error("Spotify artist route error:", err);
        return res.status(500).json({ error: "spotify_error" });
    }
});

export default function registerSpotifyRoutes(app) {
    app.use("/api/spotify", router);
}