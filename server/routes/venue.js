import express from "express";

export default function registerVenueRoute(app) {
    app.get("/api/venue/:eventId", async (req, res) => {
        try {
            const id = req.params.eventId;
            const key = process.env.TM_API_KEY;
            if (!key) {
                return res.status(500).json({ error: "Missing TM_API_KEY env" });
            }

            const url = `https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(id)}.json?apikey=${key}`;
            const r = await fetch(url);
            if (!r.ok) {
                return res.status(r.status).json({ error: "Ticketmaster request failed" });
            }
            const raw = await r.json();

            const v = raw?._embedded?.venues?.[0];
            if (!v) return res.json({ venue: null });

            const venue = {
                name: v.name || "",
                url: v.url || "",
                images: Array.isArray(v.images) ? v.images.map(i => ({ url: i.url })) : [],
                address: { line1: v.address?.line1 || "" },
                city: { name: v.city?.name || "" },
                state: { stateCode: v.state?.stateCode || v.state?.name || "" },
                location: {
                    latitude: v.location?.latitude,
                    longitude: v.location?.longitude
                },
                parkingDetail: v.parkingDetail || "",
                generalInfo: {
                    generalRule: v.generalInfo?.generalRule || "",
                    childRule: v.generalInfo?.childRule || ""
                }
            };
            res.json({ venue });
        } catch (e) {
            console.error("[/api/venue/:eventId] error:", e);
            res.status(500).json({ error: "Internal error" });
        }
    });
}