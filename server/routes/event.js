import fetch from "node-fetch";

function pickGenres(ev) {
    const c = ev.classifications?.[0] || {};
    const names = [
        c.segment?.name,
        c.genre?.name,
        c.subGenre?.name,
        c.type?.name,
        c.subType?.name,
    ].filter(Boolean);
    return Array.from(new Set(names));
}

function normalizeEvent(ev) {
    if (!ev) return null;
    const artists =
        ev._embedded?.attractions?.map(a => a.name).filter(Boolean) || [];
    const venues =
        ev._embedded?.venues?.map(v => v.name).filter(Boolean) || [];
    const seatmap = ev.seatmap?.staticUrl || "";
    const priceRanges = Array.isArray(ev.priceRanges) ? ev.priceRanges : [];
    const ticketStatus = ev.dates?.status?.code || "";

    return {
        id: ev.id,
        name: ev.name,
        url: ev.url,
        date: ev.dates?.start?.localDate || "",
        time: ev.dates?.start?.localTime || "",
        artists,
        venues,
        genres: pickGenres(ev),
        priceRanges: priceRanges.map(p => ({
            type: p.type,
            min: p.min,
            max: p.max,
            currency: p.currency
        })),
        ticketStatus,
        seatmap,
        raw: ev
    };
}

export default function registerEventRoute(app) {
    app.get("/api/event/:id", async (req, res) => {
        const apikey = process.env.TM_API_KEY;
        if (!apikey) return res.status(500).json({ error: "server_not_configured" });

        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "id_required" });

        try {
            const url = new URL(`https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(id)}.json`);
            url.searchParams.set("apikey", apikey);
            const r = await fetch(url.toString());
            const data = await r.json();
            const ev = normalizeEvent(data);
            res.json({ event: ev });
        } catch (e) {
            console.error("[/api/event/:id] error", e);
            res.status(500).json({ error: "tm_event_failed" });
        }
    });
}