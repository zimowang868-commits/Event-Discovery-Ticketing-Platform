import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFavorites } from "../favorites/FavoritesContext.jsx";

const API_BASE = import.meta.env.VITE_SERVER_URL || "";

function formatDateTime(d, t) {
    if (!d) return "";
    try {
        const dt = new Date(t ? `${d}T${t}` : d);
        const date = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(dt);
        const time = t
            ? new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            }).format(dt)
            : "";
        return time ? `${date}, ${time}` : date;
    } catch {
        return d;
    }
}

function StatusPill({ code }) {
    if (!code) return null;
    const map = {
        onsale: { text: "On Sale", cls: "st-onsale" },
        offsale: { text: "Off Sale", cls: "st-offsale" },
        canceled: { text: "Canceled", cls: "st-canceled" },
        postponed: { text: "Postponed", cls: "st-postponed" },
        rescheduled: { text: "Rescheduled", cls: "st-postponed" },
    };
    const it = map[code.toLowerCase()];
    if (!it) return null;
    return <span className={`status-pill ${it.cls}`}>{it.text}</span>;
}

function buildShareLinks(ev, buyUrl) {
    const ticketUrl = ev?.url || buyUrl || "";
    if (!ticketUrl) return { fb: "", tw: "" };
    const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ticketUrl)}`;
    const text = `Check ${ev?.name ?? "this event"} on Ticketmaster`;
    const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(ticketUrl)}`;
    return { fb, tw };
}

function pickCardImage(ev) {
    if (!ev) return "";

    if (ev.image) return ev.image;

    const fromArray = (arr) => {
        if (!Array.isArray(arr)) return "";
        const pref = ["16_9", "3_2", "4_3", "1_1"];
        for (const ratio of pref) {
            const hit = arr.find(img => (img.ratio || img.aspectRatio) === ratio && img.url);
            if (hit?.url) return hit.url;
        }
        return arr.find(i => i?.url)?.url || "";
    };
    const a1 = fromArray(ev.images);
    if (a1) return a1;

    const a2 = fromArray(ev?._embedded?.attractions?.[0]?.images);
    if (a2) return a2;

    const a3 = fromArray(ev?._embedded?.venues?.[0]?.images);
    if (a3) return a3;

    return "";
}

function fallbackImageFromSearchCache(id) {
    if (!id) return "";
    const keys = ["SEARCH_STATE", "SEARCH_RESULTS", "LAST_RESULTS"];
    const tryRead = (k) => {
        try {
            const raw = sessionStorage.getItem(k);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    };
    const deepFindImage = (node) => {
        if (!node) return "";
        if (typeof node !== "object") return "";
        if (Array.isArray(node)) {
            for (const it of node) {
                const got = deepFindImage(it);
                if (got) return got;
            }
            return "";
        }
        if (node.id === id && typeof node.image === "string" && node.image) {
            return node.image;
        }
        for (const k of Object.keys(node)) {
            const got = deepFindImage(node[k]);
            if (got) return got;
        }
        return "";
    };

    for (const k of keys) {
        const obj = tryRead(k);
        const img = deepFindImage(obj);
        if (img) return img;
    }
    return "";
}

export default function EventDetail() {
    const { id } = useParams();
    const nav = useNavigate();

    const [ev, setEv] = useState(null);
    const [tab, setTab] = useState("info");
    const [loading, setLoading] = useState(true);

    const [artistInfo, setArtistInfo] = useState(null);
    const [artistLoading, setArtistLoading] = useState(false);
    const [artistError, setArtistError] = useState(null);

    const [venueDetail, setVenueDetail] = useState(null);
    const [venueLoading, setVenueLoading] = useState(false);
    const [venueError, setVenueError] = useState(null);

    const { isFav, toggle } = useFavorites();
    const active = ev?.id ? isFav(ev.id) : false;

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                const r = await fetch(`/api/event/${encodeURIComponent(id)}`);
                const j = await r.json();
                if (!alive) return;
                setEv(j.event || null);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [id]);

    const isMusicEvent = (() => {
        if (!ev) return false;
        const seg = (ev.segment || ev.segmentName || "").toString().toLowerCase();
        if (seg === "music") return true;
        if (Array.isArray(ev.genres)) {
            const lower = ev.genres.map(g => g.toString().toLowerCase());
            if (lower.includes("music")) return true;
        }
        return false;
    })();

    useEffect(() => {
        if (tab !== "artist") return;
        if (!ev || !isMusicEvent) return;
        const primaryArtist = ev.artists && ev.artists.length ? ev.artists[0] : null;
        if (!primaryArtist) return;

        let cancelled = false;
        (async () => {
            try {
                setArtistLoading(true);
                setArtistError(null);
                const resp = await fetch(`/api/spotify/artist?name=${encodeURIComponent(primaryArtist)}`);
                if (!resp.ok) throw new Error("Spotify request failed");
                const data = await resp.json();
                if (!cancelled) setArtistInfo(data.artist || null);
            } catch (err) {
                if (!cancelled) {
                    console.error("Error loading Spotify artist info", err);
                    setArtistError("Failed to load artist information.");
                }
            } finally {
                if (!cancelled) setArtistLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [tab, ev, isMusicEvent]);

    useEffect(() => {
        if (tab !== "venue") return;
        let done = false;
        (async () => {
            try {
                setVenueLoading(true);
                setVenueError(null);
                const r = await fetch(`/api/venue/${encodeURIComponent(id)}`);
                if (!r.ok) throw new Error("Venue request failed");
                const j = await r.json();
                if (!done) setVenueDetail(j.venue || null);
            } catch (e) {
                if (!done) setVenueError("Failed to load venue details.");
            } finally {
                if (!done) setVenueLoading(false);
            }
        })();
        return () => { done = true; };
    }, [tab, id]);

    const buyUrl = ev?.url;
    const artists = useMemo(() => (ev?.artists || []).join(", "), [ev]);
    const venueNameTop = useMemo(() => (ev?.venues || [])[0] || "", [ev]);
    const priceText = useMemo(() => {
        if (!ev?.priceRanges?.length) return "";
        const p = ev.priceRanges[0];
        if (p.min != null && p.max != null) return `${p.currency || ""} ${p.min} ~ ${p.max}`;
        if (p.min != null) return `${p.currency || ""} ${p.min}+`;
        if (p.max != null) return `${p.currency || ""} up to ${p.max}`;
        return "";
    }, [ev]);

    const coverImage = useMemo(() => {
        const fromSelf = pickCardImage(ev);
        if (fromSelf) return fromSelf;
        return fallbackImageFromSearchCache(ev?.id);
    }, [ev]);

    const onBack = () => {
        const raw = sessionStorage.getItem("SEARCH_STATE");
        if (raw) nav(-1);
        else nav("/");
    };

    function makeVenueAddress(v) {
        const parts = [];
        if (v?.address?.line1) parts.push(v.address.line1);
        if (v?.city?.name) parts.push(v.city.name);
        if (v?.state?.stateCode) parts.push(v.state.stateCode);
        return parts.join(", ");
    }

    function venueAddressHref(v) {
        const lat = v?.location?.latitude;
        const lng = v?.location?.longitude;
        const text = makeVenueAddress(v);
        if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}`;
        if (text) return `https://www.google.com/maps?q=${encodeURIComponent(text)}`;
        return "";
    }

    return (
        <div className="container-down">
            <div className="detail-topbar">
                <button className="back-link" onClick={onBack}>
                    <i className="fas fa-arrow-left"></i> Back to Search
                </button>
            </div>

            <div className="detail-headline">
                <h2 className="detail-title">
                    {ev?.name || (loading ? "Loading…" : "Event")}
                </h2>
                <div className="detail-actions">
                    {buyUrl && (
                        <a className="buy-btn" href={buyUrl} target="_blank" rel="noreferrer">
                            Buy Tickets <i className="fas fa-external-link-alt"></i>
                        </a>
                    )}
                    <button
                        className={`like-circle ${active ? "active" : ""}`}
                        aria-pressed={active}
                        aria-label={active ? "Remove from favorites" : "Add to favorites"}
                        onClick={() => {
                            if (!ev) return;
                            const favPayload = {
                                id: ev.id,
                                name: ev.name || "",
                                venue: venueNameTop || ev.venueName || "",
                                date: ev.date || ev.localDate || ev.dates?.start?.localDate || "",
                                time: ev.time || ev.localTime || ev.dates?.start?.localTime || "",
                                segment: ev.segment || ev.segmentName || "",
                                image: coverImage || "",
                                buyUrl: buyUrl || ev.url || "",
                            };
                            if (!favPayload.image) {
                                favPayload.image = fallbackImageFromSearchCache(ev.id);
                            }
                            toggle(favPayload);
                        }}
                    >
                        <i className={`${active ? "fas" : "far"} fa-heart`}></i>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${tab === "info" ? "active" : ""}`}
                    onClick={() => setTab("info")}
                >
                    Info
                </button>
                <button
                    className={`tab ${tab === "artist" ? "active" : ""} ${!isMusicEvent ? "tab-disabled" : ""}`}
                    onClick={() => { if (isMusicEvent) setTab("artist"); }}
                    disabled={!isMusicEvent}
                >
                    Artist
                </button>
                <button
                    className={`tab ${tab === "venue" ? "active" : ""}`}
                    onClick={() => setTab("venue")}
                >
                    Venue
                </button>
            </div>

            {loading ? (
                <div className="results-loading" style={{ justifyContent: "flex-start" }}>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span> Loading details…</span>
                </div>
            ) : !ev ? (
                <div className="no-results">
                    <i className="fas fa-search"></i>
                    <div className="no-results-title">Nothing found</div>
                </div>
            ) : tab === "info" ? (
                <div className="detail-grid">
                    <div className="detail-left">
                        {ev.date && (
                            <>
                                <div className="kv-head">Date</div>
                                <div className="kv-body">{formatDateTime(ev.date, ev.time)}</div>
                            </>
                        )}
                        {artists && (
                            <>
                                <div className="kv-head">Artist/Team</div>
                                <div className="kv-body">{artists}</div>
                            </>
                        )}
                        {venueNameTop && (
                            <>
                                <div className="kv-head">Venue</div>
                                <div className="kv-body">{venueNameTop}</div>
                            </>
                        )}
                        {!!ev.genres?.length && (
                            <>
                                <div className="kv-head">Genres</div>
                                <div className="kv-body">{ev.genres.join(", ")}</div>
                            </>
                        )}
                        {priceText && (
                            <>
                                <div className="kv-head">Price Ranges</div>
                                <div className="kv-body">{priceText}</div>
                            </>
                        )}
                        {ev.ticketStatus && (
                            <>
                                <div className="kv-head">Ticket Status</div>
                                <div className="kv-body"><StatusPill code={ev.ticketStatus} /></div>
                            </>
                        )}
                        {(() => {
                            const { fb, tw } = buildShareLinks(ev, buyUrl);
                            return fb && tw ? (
                                <>
                                    <div className="kv-head">Share</div>
                                    <div className="kv-body share-row">
                                        <a
                                            className="share-btn"
                                            href={fb}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Share on Facebook"
                                            title="Share on Facebook"
                                        >
                                            <i className="fab fa-facebook-f"></i>
                                        </a>
                                        <a
                                            className="share-btn"
                                            href={tw}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Share on X"
                                            title="Share on X"
                                        >
                                            <i className="fab fa-x-twitter"></i>
                                        </a>
                                    </div>
                                </>
                            ) : null;
                        })()}
                    </div>
                    <div className="detail-right-col">
                        <div className="kv-head">Seatmap</div>
                        <div className="detail-right">
                            {ev.seatmap ? (
                                <img className="seatmap" src={ev.seatmap} alt="Seat map" />
                            ) : (
                                <div className="seatmap empty">No Seat Map</div>
                            )}
                        </div>
                    </div>
                </div>
            ) : tab === "artist" ? (
                !isMusicEvent ? (
                    <div className="detail-simple">Artist information is only available for Music events.</div>
                ) : artistLoading ? (
                    <div className="results-loading" style={{ justifyContent: "flex-start" }}>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span> Loading artist details…</span>
                    </div>
                ) : artistError ? (
                    <div className="detail-simple">{artistError}</div>
                ) : !artistInfo ? (
                    <div className="detail-simple">No artist/team info</div>
                ) : (
                    <div className="artist-tab">
                        <div className="artist-header">
                            {artistInfo.imageUrl && (
                                <img className="artist-avatar" src={artistInfo.imageUrl} alt={artistInfo.name} />
                            )}
                            <div className="artist-main">
                                <h3 className="artist-name">{artistInfo.name}</h3>
                                <div className="artist-meta">
                                    <span className="fp">
                                        Followers: {artistInfo.followers != null ? artistInfo.followers.toLocaleString("en-US") : "N/A"}
                                    </span>
                                    <span className="fp">Popularity: {artistInfo.popularity ?? "N/A"}%</span>
                                </div>
                                {artistInfo.genres && artistInfo.genres.length > 0 && (
                                    <div className="artist-genres">Genres: {artistInfo.genres.join(", ")}</div>
                                )}
                                {artistInfo.spotifyUrl && (
                                    <a className="open-spotify-btn" href={artistInfo.spotifyUrl} target="_blank" rel="noreferrer">
                                        Open in Spotify <i className="fas fa-external-link-alt"></i>
                                    </a>
                                )}
                            </div>
                        </div>
                        {artistInfo.albums && artistInfo.albums.length > 0 && (
                            <>
                                <h4 className="artist-albums-title">Albums</h4>
                                <div className="albums-grid">
                                    {artistInfo.albums.map((al) =>
                                        al.spotifyUrl ? (
                                            <a
                                                key={al.id || al.spotifyUrl || al.name}
                                                className="album-card-link"
                                                href={al.spotifyUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <div className="album-card">
                                                    {al.imageUrl && <img className="album-cover" src={al.imageUrl} alt={al.name} />}
                                                    <div className="album-info">
                                                        <div className="album-name">{al.name}</div>
                                                        {al.releaseDate && <div className="album-sub">{al.releaseDate}</div>}
                                                    </div>
                                                </div>
                                            </a>
                                        ) : (
                                            <div key={al.id || al.name} className="album-card">
                                                {al.imageUrl && <img className="album-cover" src={al.imageUrl} alt={al.name} />}
                                                <div className="album-info">
                                                    <div className="album-name">{al.name}</div>
                                                    {al.releaseDate && <div className="album-sub">{al.releaseDate}</div>}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )
            ) : (
                venueLoading ? (
                    <div className="detail-simple">Loading venue…</div>
                ) : venueError ? (
                    <div className="detail-simple">{venueError}</div>
                ) : !venueDetail ? (
                    <div className="detail-simple">No venue details</div>
                ) : (
                    <div className="venue-wrap">
                        <div className="venue-top">
                            {venueDetail.name && <h3 className="venue-name">{venueDetail.name}</h3>}
                            {venueDetail.url && (
                                <a className="see-events-btn" href={venueDetail.url} target="_blank" rel="noreferrer">
                                    See Events <i className="fas fa-external-link-alt"></i>
                                </a>
                            )}
                        </div>
                        <div className="venue-grid">
                            <div className="venue-left">
                                {Array.isArray(venueDetail.images) && venueDetail.images.length > 0 ? (
                                    <img className="venue-cover" src={venueDetail.images[0].url} alt={venueDetail.name || "Venue"} />
                                ) : (
                                    <div className="venue-cover empty">No Image</div>
                                )}
                            </div>
                            <div className="venue-right">
                                {(() => {
                                    const addressText = makeVenueAddress(venueDetail);
                                    const href = venueAddressHref(venueDetail);
                                    if (!addressText) return null;
                                    return (
                                        <div className="venue-row">
                                            <div className="venue-row-head">Address</div>
                                            <div className="venue-row-body">
                                                {href ? (
                                                    <a className="venue-link" href={href} target="_blank" rel="noreferrer" title="Open in Google Maps">
                                                        {addressText} <i className="fas fa-external-link-alt"></i>
                                                    </a>
                                                ) : (
                                                    addressText
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                                {venueDetail.parkingDetail && (
                                    <div className="venue-row">
                                        <div className="venue-row-head">Parking</div>
                                        <div className="venue-row-body">{venueDetail.parkingDetail}</div>
                                    </div>
                                )}
                                {venueDetail.generalInfo?.generalRule && (
                                    <div className="venue-row">
                                        <div className="venue-row-head">General Rule</div>
                                        <div className="venue-row-body">{venueDetail.generalInfo.generalRule}</div>
                                    </div>
                                )}
                                {venueDetail.generalInfo?.childRule && (
                                    <div className="venue-row">
                                        <div className="venue-row-head">Child Rule</div>
                                        <div className="venue-row-body">{venueDetail.generalInfo.childRule}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}