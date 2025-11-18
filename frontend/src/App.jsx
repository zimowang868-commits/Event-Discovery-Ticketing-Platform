import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import EventDetail from "./pages/EventDetails.jsx";
import FavoritesPage from "./pages/FavoritesPage.jsx";
import { FavoritesProvider } from "./favorites/FavoritesContext.jsx";

export default function App() {
    return (
        <FavoritesProvider>
            <Navbar />
            <Routes>
                <Route path="/" element={<SearchPage />} />
                <Route path="/event/:id" element={<EventDetail />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </FavoritesProvider>
    );
}