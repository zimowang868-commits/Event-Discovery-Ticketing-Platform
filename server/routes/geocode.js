import fetch from "node-fetch";

export default function registerGeocodeRoute(app) {
    app.get("/api/geocode", async (req, res) => {
        const address = (req.query.address || "").trim();
        if (!address) return res.status(400).json({ error: "address_required" });

        const key = process.env.GOOGLE_MAPS_KEY;
        if (!key) return res.status(500).json({ error: "server_not_configured" });

        try {
            const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
            url.searchParams.set("address", address);
            url.searchParams.set("key", key);

            const r = await fetch(url.toString());
            const data = await r.json();

            const loc = data?.results?.[0]?.geometry?.location;
            if (!loc) return res.status(404).json({ error: "not_found", raw: data });
            res.json({ lat: loc.lat, lng: loc.lng });
        } catch (err) {
            res.status(500).json({ error: "geocode_failed" });
        }
    });
}