import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import registerSuggestRoute from "./routes/suggest.js";
import registerGeocodeRoute from "./routes/geocode.js";
import registerSearchRoute from "./routes/search.js";
import registerEventRoute from "./routes/event.js";
import registerFavoritesRoute from "./routes/favorites.js";
import registerSpotifyRoutes from "./routes/spotify.js";
import registerVenueRoute from "./routes/venue.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, "public")));

registerSuggestRoute(app);
registerGeocodeRoute(app);
registerSearchRoute(app);
registerEventRoute(app);
registerFavoritesRoute(app);
registerSpotifyRoutes(app);
registerVenueRoute(app);

app.use(express.static(path.join(__dirname, "public")));

app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));