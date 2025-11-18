import fetch from "node-fetch";

export async function fetchJsonWithRetry(
    url,
    { timeoutMs = 8000, retries = 2, headers } = {}
) {
    let attempt = 0;
    let lastErr;

    while (attempt <= retries) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), timeoutMs);

        try {
            const res = await fetch(url, { headers, signal: ac.signal });
            clearTimeout(timer);

            if (!res.ok) {
                if (res.status >= 500 && attempt < retries) {
                    attempt++;
                    await new Promise(r => setTimeout(r, 400 * Math.pow(2, attempt)));
                    continue;
                }
                const text = await res.text().catch(() => "");
                throw new Error(`Upstream ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
            }
            return await res.json();
        } catch (err) {
            clearTimeout(timer);
            const code = err?.code || err?.errno;
            const isTimeout = code === "ETIMEDOUT" || err?.name === "AbortError";
            const isConnReset = code === "ECONNRESET";

            if ((isTimeout || isConnReset) && attempt < retries) {
                attempt++;
                await new Promise(r => setTimeout(r, 400 * Math.pow(2, attempt)));
                continue;
            }
            lastErr = err;
            break;
        }
    }
    throw lastErr;
}