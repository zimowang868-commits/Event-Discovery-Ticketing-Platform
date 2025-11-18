import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";

const FavCtx = createContext(null);

export function FavoritesProvider({ children }) {
    const [items, setItems] = useState([]);

    const favIds = useMemo(() => new Set(items.map((x) => x.id)), [items]);
    const favMap = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch("/api/favorites");
                const j = await r.json();
                const list = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : []);
                setItems(list);
            } catch {
                setItems([]);
            }
        })();
    }, []);

    const isFav = (id) => favIds.has(id);

    const add = async (ev, { silent = false } = {}) => {
        await fetch(`/api/favorites/${encodeURIComponent(ev.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ev),
        });
        setItems((arr) => {
            const idx = arr.findIndex((x) => x.id === ev.id);
            if (idx >= 0) {
                const clone = [...arr];
                clone[idx] = { ...clone[idx], ...ev };
                return clone;
            }
            return [ev, ...arr];
        });
        if (!silent) {
            toast.success(`${ev.name} added to favorites!`, {
                description: "You can view it in the Favorites page.",
                duration: 1200,
            });
        }
    };

    const remove = async (ev) => {
        await fetch(`/api/favorites/${encodeURIComponent(ev.id)}`, { method: "DELETE" });
        setItems((arr) => arr.filter((x) => x.id !== ev.id));
        toast.info(`${ev.name} removed from favorites!`, {
            action: {
                label: "Undo",
                onClick: async () => {
                    await add(ev, { silent: true });
                    toast.success(`${ev.name} re-added to favorites!`, {
                        description: "You can view it in the Favorites page.",
                        duration: 1200,
                    });
                },
            },
            duration: 1200,
        });
    };

    const toggle = async (ev) => (isFav(ev.id) ? remove(ev) : add(ev));

    const addFavorite = add;
    const removeFavorite = remove;
    const toggleFavorite = toggle;

    const value = {
        items, isFav, add, remove, toggle,
        favIds, favMap, addFavorite, removeFavorite, toggleFavorite,
    };

    return (
        <FavCtx.Provider value={value}>
            <Toaster position="top-right" richColors closeButton />
            {children}
        </FavCtx.Provider>
    );
}

export function useFavorites() {
    const ctx = useContext(FavCtx);
    if (!ctx) throw new Error("useFavorites must be used inside <FavoritesProvider>");
    return ctx;
}