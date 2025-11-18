import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useFavorites } from "../favorites/FavoritesContext.jsx";

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

export default function FavoritesPage() {
    const navigate = useNavigate();
    const { items, toggle, isFav } = useFavorites();

    const list = useMemo(() => Array.isArray(items) ? [...items] : [], [items]);

    return (
        <div className="container-down">
            <h2 className="page-title">Favorites</h2>

            {list.length === 0 ? (
                <div className="fav-empty">
                    <div className="fav-empty-title">No favorite events yet.</div>
                    <div className="fav-empty-sub">
                        Add events to your favorites by clicking the heart icon on any event.
                    </div>
                </div>
            ) : (
                <div className="grid-results">
                    {list.map((ev) => {
                        const active = isFav(ev.id);
                        return (
                            <div
                                key={ev.id}
                                className="card"
                                onClick={() => {
                                    sessionStorage.setItem("searchScrollY", String(window.scrollY || 0));
                                    navigate(`/event/${ev.id}`);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => (e.key === "Enter" ? navigate(`/event/${ev.id}`) : null)}
                            >
                                <div className="card-top">
                                    {ev.segment ? <span className="pill">{ev.segment}</span> : <span></span>}
                                    <span className="date-badge">{formatDateBadge(ev.date, ev.time)}</span>
                                </div>

                                <div className="card-cover">
                                    {ev.image ? (
                                        <img src={ev.image} alt={ev.name || "Event"} />
                                    ) : (
                                        <div className="img-fallback">No Image</div>
                                    )}
                                </div>

                                <div className="card-info">
                                    <div className="card-title" title={ev.name}>{ev.name}</div>
                                    <div className="card-venue" title={ev.venue}>{ev.venue}</div>
                                </div>

                                <button
                                    className={`like-btn ${active ? "active" : ""}`}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggle(ev);
                                    }}
                                    aria-label={active ? "Remove from favorites" : "Add to favorites"}
                                    title={active ? "Remove from favorites" : "Add to favorites"}
                                >
                                    <i className={`${active ? "fas" : "far"} fa-heart`}></i>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}