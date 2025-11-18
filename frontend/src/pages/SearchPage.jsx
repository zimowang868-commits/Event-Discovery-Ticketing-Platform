import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFavorites } from "../favorites/FavoritesContext.jsx";

export default function SearchPage() {
    const [keyword, setKeyword] = useState("");
    const [category, setCategory] = useState("all");
    const [autoDetect, setAutoDetect] = useState(false);
    const [location, setLocation] = useState("");
    const [distance, setDistance] = useState(10);
    const [errors, setErrors] = useState({ keyword: "", location: "", distance: "" });

    const [kwLoading, setKwLoading] = useState(false);
    const [kwOpen, setKwOpen] = useState(false);
    const [kwItems, setKwItems] = useState([]);
    const [kwActiveIdx, setKwActiveIdx] = useState(-1);

    const [results, setResults] = useState([]);
    const [resLoading, setResLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const { favIds = new Set(), addFavorite, removeFavorite } = useFavorites();

    const kwInputRef = useRef(null);
    const kwDebounceRef = useRef(null);
    const kwAbortRef = useRef(null);

    const navigate = useNavigate();

    const kwRootRef = useRef(null);

    const [kwHasFocus, setKwHasFocus] = useState(false);

    const PLACEHOLDER_FREE = "Enter city, district or street...";
    const PLACEHOLDER_AUTO = "Location will be autodetected";

    const validate = () => {
        const next = { keyword: "", location: "", distance: "" };
        if (!keyword.trim()) next.keyword = "Please enter some keywords";
        if (!autoDetect && !location.trim())
            next.location = "Location is required when auto-detect is disabled";
        next.distance = getDistanceError(distance);
        setErrors(next);
        return !next.keyword && !next.location && !next.distance;
    };

    const getDistanceError = (v) => {
        if (v === "") return "Distance must be a number";
        if (!/^\d+$/.test(v)) return "Distance must be a number";
        if (Number(v) > 100) return "Distance cannot exceed 100 miles";
        return "";
    };

    const onDistanceInput = (raw) => {
        let v = raw.replace(/[^\d]/g, "");
        v = v.replace(/^0+(?=\d)/, "");
        setDistance(v);
        const msg = getDistanceError(v);
        setErrors((e) => ({ ...e, distance: msg }));
    };

    const fetchKeywordSuggest = async (q) => {
        if (kwAbortRef.current) kwAbortRef.current.abort();
        const controller = new AbortController();
        kwAbortRef.current = controller;

        setKwLoading(true);
        try {
            const resp = await fetch(`/api/suggest?keyword=${encodeURIComponent(q)}`, {
                signal: controller.signal,
            });
            const data = await resp.json();

            let arr = Array.isArray(data?.suggestions) ? data.suggestions : [];
            arr = [q, ...arr.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 10);

            setKwItems(arr);
            setKwOpen(true);
            setKwActiveIdx(0);
        } catch (e) {
            if (e.name !== "AbortError") {
                setKwItems([]);
                setKwOpen(true);
                setKwActiveIdx(-1);
            }
        } finally {
            setKwLoading(false);
        }
    };

    const onKeywordChange = (v) => {
        setKeyword(v);
        if (errors.keyword && v.trim()) setErrors((e) => ({ ...e, keyword: "" }));

        if (!v.trim()) {
            setKwItems([]);
            setKwLoading(false);
            if (kwAbortRef.current) kwAbortRef.current.abort();
            if (kwDebounceRef.current) clearTimeout(kwDebounceRef.current);
            setKwActiveIdx(-1);
            setKwOpen(kwHasFocus);
            return;
        }

        if (kwDebounceRef.current) clearTimeout(kwDebounceRef.current);
        kwDebounceRef.current = setTimeout(() => {
            fetchKeywordSuggest(v.trim());
        }, 300);
    };

    const onKeywordSelect = (val) => {
        setKeyword(val);
        setKwOpen(false);
        setKwItems([]);
        setKwActiveIdx(-1);
    };

    const onKeywordClear = () => {
        setKeyword("");
        setKwItems([]);
        setKwHasFocus(true);
        setKwOpen(false);
        setKwActiveIdx(-1);
        kwInputRef.current?.focus();
    };

    const onKeywordKeyDown = (e) => {
        if (!kwOpen || kwItems.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setKwActiveIdx((idx) => (idx + 1) % kwItems.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setKwActiveIdx((idx) => (idx - 1 < 0 ? kwItems.length - 1 : idx - 1));
        } else if (e.key === "Enter") {
            if (kwActiveIdx >= 0 && kwActiveIdx < kwItems.length) {
                e.preventDefault();
                onKeywordSelect(kwItems[kwActiveIdx]);
            }
        } else if (e.key === "Escape") {
            setKwOpen(false);
        }
    };

    useEffect(() => {
        const onDocPointer = (e) => {
            const root = kwRootRef.current;
            if (root && !root.contains(e.target)) {
                setKwOpen(false);
                setKwHasFocus(false);
            }
        };
        document.addEventListener("mousedown", onDocPointer);
        document.addEventListener("touchstart", onDocPointer, { passive: true });
        return () => {
            document.removeEventListener("mousedown", onDocPointer);
            document.removeEventListener("touchstart", onDocPointer);
        };
    }, []);

    useEffect(() => {
        const raw = sessionStorage.getItem("SEARCH_STATE");
        if (raw) {
            try {
                const s = JSON.parse(raw);
                setKeyword(s.keyword || "");
                setCategory(s.category || "all");
                setAutoDetect(!!s.autoDetect);
                setLocation(s.location || "");
                setDistance(s.distance ?? 10);
                setResults(Array.isArray(s.results) ? s.results : []);
                setHasSearched(!!s.results);
                setTimeout(() => window.scrollTo(0, s.scrollY || 0), 0);
            } catch {}
        }
    }, []);

    useEffect(() => {
        const saved = sessionStorage.getItem("searchScrollY");
        if (saved == null) return;

        const y = parseInt(saved, 10);
        if (!Number.isFinite(y)) {
            sessionStorage.removeItem("searchScrollY");
            return;
        }

        const doScroll = () => {
            window.scrollTo({ top: y, behavior: "instant" });
            setTimeout(() => window.scrollTo({ top: y, behavior: "instant" }), 120);
            setTimeout(() => window.scrollTo({ top: y, behavior: "instant" }), 300);
            sessionStorage.removeItem("searchScrollY");
        };

        const imgs = Array.from(document.querySelectorAll(".results-grid img"));
        if (imgs.length === 0) {
            requestAnimationFrame(doScroll);
            return;
        }

        let remain = imgs.length;
        const onOneSettled = () => {
            remain -= 1;
            if (remain <= 0) doScroll();
        };

        imgs.forEach((img) => {
            if (img.complete) {
                onOneSettled();
            } else {
                img.addEventListener("load", onOneSettled, { once: true });
                img.addEventListener("error", onOneSettled, { once: true });
            }
        });
    }, [results]);

    const onSearch = async () => {
        if (!validate()) {
            setResults([]);
            setHasSearched(false);
            return;
        }
        try {
            setResLoading(true);

            let lat = null,
                lng = null;
            if (autoDetect) {
                const r = await fetch(
                    `https://ipinfo.io/json?token=${import.meta.env.VITE_IPINFO_TOKEN}`
                );
                const j = await r.json();
                const [latStr, lngStr] = (j.loc || "").split(",");
                lat = Number(latStr);
                lng = Number(lngStr);
            } else {
                const resp = await fetch(
                    `/api/geocode?address=${encodeURIComponent(location)}`
                );
                if (!resp.ok) {
                    setErrors((e) => ({
                        ...e,
                        location: "Failed to geocode the address",
                    }));
                    setResults([]);
                    setHasSearched(false);
                    setResLoading(false);
                    return;
                }
                const g = await resp.json();
                lat = g.lat;
                lng = g.lng;
            }

            const params = new URLSearchParams({
                keyword: keyword.trim(),
                category,
                lat: String(lat),
                lng: String(lng),
                radius: String(distance || 10),
            });

            const r2 = await fetch(`/api/search?${params.toString()}`);
            const data = await r2.json();

            const list = Array.isArray(data?.events) ? data.events : [];
            setResults(list);
            setHasSearched(true);
        } catch (err) {
            console.error(err);
            setResults([]);
            setHasSearched(true);
        } finally {
            setResLoading(false);
        }
    };

    const onLocationInput = (v) => {
        setLocation(v);
        if (errors.location && v.trim()) setErrors((e) => ({ ...e, location: "" }));
    };

    const onToggleAuto = (checked) => {
        setAutoDetect(checked);
        if (checked) {
            setLocation("");
            if (errors.location) setErrors((e) => ({ ...e, location: "" }));
        }
    };

    const toggleKwPanel = () => {
        setKwHasFocus(true);
        setKwOpen((open) => {
            const next = !open;
            if (next && !keyword.trim()) {
                setKwItems([]);
                setKwActiveIdx(-1);
            }
            return next;
        });
    };

    function formatDateBadge(d, t) {
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

    const toggleFavorite = (ev) => {
        if (favIds.has(ev.id)) {
            removeFavorite(ev);
        } else {
            addFavorite(ev);
        }
    };

    return (
        <div className="container-down">
            <div className="search-section">
                <div className="search-row" role="form" aria-label="Search events form">
                    {/* KEYWORDS */}
                    <div className={`form-group ${errors.keyword ? "has-error" : ""}`} id="keywordsGroup">
                        <label htmlFor="keywordInput">
                            Keywords <span className="required">*</span>
                        </label>
                        <div className="input-with-icons" ref={kwRootRef}>
                            <input
                                id="keywordInput"
                                ref={kwInputRef}
                                type="text"
                                className="form-control"
                                placeholder="Search for events..."
                                aria-required="true"
                                aria-describedby="keywordsError"
                                value={keyword}
                                onChange={(e) => onKeywordChange(e.target.value)}
                                onMouseDown={toggleKwPanel}
                                onFocus={() => setKwHasFocus(true)}
                                onKeyDown={onKeywordKeyDown}
                                autoComplete="off"
                            />
                            <div className="input-right-icon">
                                {kwLoading && <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>}
                                {keyword && !kwLoading && (
                                    <button
                                        type="button"
                                        className="clear-btn"
                                        aria-label="Clear keywords"
                                        onClick={onKeywordClear}
                                        title="Clear"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="caret-btn"
                                    aria-label={kwOpen ? "Collapse suggestions" : "Expand suggestions"}
                                    onClick={toggleKwPanel}
                                    title={kwOpen ? "Collapse" : "Expand"}
                                >
                                    <i className={`fas fa-chevron-${kwOpen ? "up" : "down"}`}></i>
                                </button>
                            </div>
                            {kwOpen && (
                                <div className="suggest-panel" role="listbox" aria-label="Keyword suggestions">
                                    {!keyword.trim() ? (
                                        <div className="suggest-empty">Start typing to see options</div>
                                    ) : (
                                        kwItems.length > 0 &&
                                        kwItems.map((s, idx) => (
                                            <div
                                                key={s + idx}
                                                className={`suggest-item ${idx === kwActiveIdx ? "active" : ""}`}
                                                role="option"
                                                aria-selected={idx === kwActiveIdx}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    onKeywordSelect(s);
                                                }}
                                            >
                                                <i className="fas fa-search" aria-hidden="true"></i>
                                                <span>{s}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        <div id="keywordsError" className="error-msg" aria-live="polite">
                            {errors.keyword}
                        </div>
                    </div>

                    {/* CATEGORY */}
                    <div className="form-group" id="categoryGroup">
                        <label htmlFor="categorySelect">Category <span className="required">*</span></label>
                        <select
                            id="categorySelect"
                            className="form-control"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="music">Music</option>
                            <option value="sports">Sports</option>
                            <option value="arts_theatre">Arts &amp; Theatre</option>
                            <option value="film">Film</option>
                            <option value="misc">Miscellaneous</option>
                        </select>
                        <div className="error-msg" aria-hidden="true"></div>
                    </div>

                    {/* LOCATION + AUTO-DETECT */}
                    <div className={`form-group location-group ${errors.location ? "has-error" : ""}`} id="locationGroup">
                        <div className="location-header">
                            <div className="location-input-container">
                                <label className="locaInput" htmlFor="locationInput">Location<span className="required">*</span></label>
                            </div>
                            <div className="auto-detect">
                                <span className="auto-detect-label">Auto-detect Location</span>
                                <label className="toggle-switch">
                                    <input
                                        id="autoDetectCheckbox"
                                        type="checkbox"
                                        checked={autoDetect}
                                        onChange={(e) => onToggleAuto(e.target.checked)}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        </div>
                        <input
                            id="locationInput"
                            type="text"
                            className="form-control"
                            placeholder={autoDetect ? PLACEHOLDER_AUTO : PLACEHOLDER_FREE}
                            aria-describedby="locationError"
                            value={location}
                            onChange={(e) => onLocationInput(e.target.value)}
                            disabled={autoDetect}
                        />
                        <div id="locationError" className="error-msg" aria-live="polite">
                            {errors.location}
                        </div>
                    </div>

                    {/* DISTANCE */}
                    <div className={`form-group distance-group ${errors.distance ? "has-error" : ""}`} id="distanceGroup">
                        <label htmlFor="distanceNumber">
                            Distance <span className="required">*</span>
                        </label>
                        <div className="distance-input-combined">
                            <input
                                id="distanceNumber"
                                type="number"
                                step="1"
                                min="1"
                                className="form-control distance-number"
                                value={distance}
                                placeholder="10"
                                onChange={(e) => onDistanceInput(e.target.value)}
                                inputMode="numeric"
                                aria-describedby="distanceError"
                            />
                            <span className="distance-unit-text">miles</span>
                        </div>
                        <div id="distanceError" className="error-msg" aria-live="polite">
                            {errors.distance}
                        </div>
                    </div>

                    {/* SEARCH BUTTON */}
                    <button
                        id="searchBtn"
                        className="search-btn"
                        type="button"
                        aria-label="Search Events"
                        onClick={onSearch}
                    >
                        <i className="fas fa-search"></i>
                        Search Events
                    </button>
                </div>
            </div>

            {/* RESULT SECTION */}
            <div className="results-section">
                {resLoading ? (
                    <div className="results-loading">
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Searching events…</span>
                    </div>
                ) : !hasSearched ? (
                    <>
                        <div className="search-icon-container">
                            <i className="fas fa-search search-icon-large"></i>
                        </div>
                        <p className="search-message">Enter search criteria and click the Search button to find events.</p>
                    </>
                ) : results.length === 0 ? (
                    <div className="no-results">
                        <i className="fas fa-search"></i>
                        <div className="no-results-title">Nothing found</div>
                        <div className="no-results-sub">Update the query to find events near you</div>
                    </div>
                ) : (
                    <div className="grid-results results-grid">
                        {results.map((ev) => {
                            const isFav = favIds.has(ev.id);
                            return (
                                <div
                                    key={ev.id}
                                    className="card"
                                    onClick={() => {
                                        sessionStorage.setItem("searchScrollY", String(window.scrollY));
                                        sessionStorage.setItem(
                                            "SEARCH_STATE",
                                            JSON.stringify({
                                                keyword,
                                                category,
                                                autoDetect,
                                                location,
                                                distance,
                                                results,
                                                scrollY: window.scrollY,
                                            })
                                        );
                                        navigate(`/event/${ev.id}`);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => (e.key === "Enter" ? navigate(`/event/${ev.id}`) : null)}
                                >
                                    <div className="card-top">
                                        <span className="pill">{ev.segment}</span>
                                        <span className="date-badge">{formatDateBadge(ev.date, ev.time)}</span>
                                    </div>
                                    <div className="card-cover">
                                        {ev.image ? (
                                            <img src={ev.image} alt={ev.name} />
                                        ) : (
                                            <div className="img-fallback">No Image</div>
                                        )}
                                    </div>
                                    <div className="card-info">
                                        <div className="card-title" title={ev.name}>
                                            {ev.name}
                                        </div>
                                        <div className="card-venue" title={ev.venue}>
                                            {ev.venue}
                                        </div>
                                    </div>
                                    <button
                                        className={`like-btn ${isFav ? "is-fav" : ""}`}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFavorite(ev);
                                        }}
                                        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <i className={isFav ? "fas fa-heart" : "far fa-heart"}></i>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}