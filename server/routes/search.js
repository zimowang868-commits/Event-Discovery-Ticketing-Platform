import fetch from "node-fetch";

const SEGMENT_IDS = {
    music: "KZFzniwnSyZfZ7v7nJ",
    sports: "KZFzniwnSyZfZ7v7nE",
    arts_theatre: "KZFzniwnSyZfZ7v7na",
    film: "KZFzniwnSyZfZ7v7nn",
    misc: "KZFzniwnSyZfZ7v7n1",
    all: null,
};

function encodeGeoHash(lat, lon) {
    const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
    let idx = 0, bit = 0, evenBit = true, geohash = "";
    let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
    while (geohash.length < 9) {
        if (evenBit) {
            const lonMid = (lonMin + lonMax) / 2;
            if (lon >= lonMid) { idx = (idx << 1) + 1; lonMin = lonMid; }
            else { idx = (idx << 1) + 0; lonMax = lonMid; }
        } else {
            const latMid = (latMin + latMax) / 2;
            if (lat >= latMid) { idx = (idx << 1) + 1; latMin = latMid; }
            else { idx = (idx << 1) + 0; latMax = latMid; }
        }
        evenBit = !evenBit;
        if (++bit === 5) { geohash += BASE32.charAt(idx); bit = 0; idx = 0; }
    }
    return geohash;
}

async function tmFetch(url) {
    const r = await fetch(url.toString());
    if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`TM ${r.status} ${r.statusText} :: ${text.slice(0, 200)}`);
    }
    return r.json();
}

function extractStart(ev) {
    const s = ev?.dates?.start || {};
    let localDate = s.localDate || "";
    let localTime = s.localTime || "";

    if ((!localDate || !localTime) && s.dateTime) {
        const dt = new Date(s.dateTime);
        if (!localDate && !Number.isNaN(dt.getTime())) {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, "0");
            const d = String(dt.getDate()).padStart(2, "0");
            localDate = `${y}-${m}-${d}`;
        }
        if (!localTime && !Number.isNaN(dt.getTime())) {
            const hh = String(dt.getHours()).padStart(2, "0");
            const mm = String(dt.getMinutes()).padStart(2, "0");
            localTime = `${hh}:${mm}`;
        }
    }
    return { localDate, localTime };
}

function normalizeEvents(data) {
    const raw = data?._embedded?.events || [];
    return raw.slice(0, 20).map((ev) => {
        const { localDate, localTime } = extractStart(ev);
        const images = (ev.images || []).slice().sort((a, b) => b.width - a.width);
        return {
            id: ev.id,
            name: ev.name,
            segment: ev.classifications?.[0]?.segment?.name || "Other",
            date: localDate,
            time: localTime,
            image: images[0]?.url || "",
            venue: ev._embedded?.venues?.[0]?.name || "",
        };
    });
}

export default function registerSearchRoute(app) {
    app.get("/api/search", async (req, res) => {
        const apikey = process.env.TM_API_KEY;
        if (!apikey) return res.status(500).json({ error: "server_not_configured" });

        const {
            keyword = "",
            category = "all",
            lat,
            lng,
            radius = "10",
            unit = "miles",
        } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ error: "latlng_required" });
        }

        try {
            const seg = SEGMENT_IDS[String(category || "all")];
            const trimmedKeyword = String(keyword || "").trim();

            const url1 = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
            url1.searchParams.set("apikey", apikey);
            if (trimmedKeyword) url1.searchParams.set("keyword", trimmedKeyword);
            if (seg) url1.searchParams.set("segmentId", seg);
            url1.searchParams.set("latlong", `${lat},${lng}`);
            url1.searchParams.set("radius", String(radius || 10));
            url1.searchParams.set("unit", unit);
            url1.searchParams.set("size", "20");
            url1.searchParams.set("sort", "date,asc");

            const data1 = await tmFetch(url1);
            let events = normalizeEvents(data1);

            if (events.length === 0) {
                const ghash = encodeGeoHash(Number(lat), Number(lng));
                const url2 = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
                url2.searchParams.set("apikey", apikey);
                if (trimmedKeyword) url2.searchParams.set("keyword", trimmedKeyword);
                if (seg) url2.searchParams.set("segmentId", seg);
                url2.searchParams.set("geoPoint", ghash);
                url2.searchParams.set("radius", String(radius || 10));
                url2.searchParams.set("unit", unit);
                url2.searchParams.set("size", "20");
                url2.searchParams.set("sort", "date,asc");

                const data2 = await tmFetch(url2);
                events = normalizeEvents(data2);
            }

            res.json({ events });
        } catch (e) {
            console.error("[/api/search] error:", e);
            res.status(500).json({ error: "tm_search_failed" });
        }
    });
}