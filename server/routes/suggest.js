import fetch from "node-fetch";

export default function registerSuggestRoute(app) {
    const TM_API_KEY = process.env.TM_API_KEY;
    if (!TM_API_KEY) {
        console.warn("[WARN] TM_API_KEY is not set. /api/suggest will fail.");
    }

    app.get("/api/suggest", async (req, res) => {
        try {
            const keyword = (req.query.keyword || "").trim();
            const size = Number(req.query.size || 10);

            if (!keyword) {
                return res.json({ suggestions: [] });
            }

            const url = new URL("https://app.ticketmaster.com/discovery/v2/suggest");
            url.searchParams.set("apikey", TM_API_KEY);
            url.searchParams.set("keyword", keyword);

            const r = await fetch(url.toString());
            if (!r.ok) {
                const text = await r.text();
                return res.status(r.status).json({ error: "upstream_error", detail: text });
            }
            const data = await r.json();

            const names =
                data?._embedded?.attractions?.map((a) => a?.name).filter(Boolean) ?? [];

            const uniq = Array.from(new Set(names)).slice(0, size);

            return res.json({ suggestions: uniq });
        } catch (e) {
            return res.status(500).json({ error: "internal_error", detail: String(e) });
        }
    });
}