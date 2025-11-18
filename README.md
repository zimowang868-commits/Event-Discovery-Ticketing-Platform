# Event Discovery & Ticketing Platform 🎟️🌐

A full-stack, cloud-hosted event discovery platform built with **Node.js**, a modern **React/Angular/Vue frontend**, **Tailwind + shadcn UI**, and integrations with **Ticketmaster**, **Spotify**, **Google Maps**, and **IP-based Geolocation APIs**.

This project provides a seamless end-to-end experience for searching events, viewing event details, managing favorites, and exploring artist/venue information — all backed by a cloud-deployed Node.js server.

---

## 🚀 Features

### 🔍 Event Search Engine
- Location-aware event search (auto-detect or manual address)
- Keyword autocomplete powered by Ticketmaster Suggest API
- Category filtering (Music, Sports, Arts & Theatre, Film, Misc)
- Distance-based radius filtering using geohash conversion
- Fully responsive card-based results grid

### 📄 Event Details
- Complete event metadata: date, artist/team, venue, genres
- Color-coded ticket status (On sale, Off sale, Canceled, Postponed, etc.)
- HD seatmap rendering when available
- Share buttons for X (Twitter) & Facebook
- “Buy Tickets” deep link to Ticketmaster

### 🎵 Artist / Team Info (Music events)
- Integrated with **Spotify API**
- Displays followers, popularity, and direct Spotify profile link
- Album previews using Spotify Web API
- Tab is auto-disabled for non-music events

### 🏟️ Venue Details
- Venue metadata display with image
- Parking / General / Child rules
- Google Maps deep link with coordinates
- “See Events” link for venue’s Ticketmaster page

### ❤️ Favorites System
- Add / remove events from favorites with real-time UI updates
- State preserved across browser reloads
- Stored in **MongoDB Atlas** via backend API
- Toast notifications using `sonner` (added, removed, undo, re-added)
- Dedicated Favorites view with sorted event cards

### 📱 Fully Responsive UI
- Optimized for desktop, tablet, and mobile (tested on iPhone 14 Pro Max)
- Built using **Tailwind CSS** + **shadcn/ui**
- Supports theme-consistent components: cards, tabs, badges, form inputs, etc.

### ☁️ Cloud Deployment
- Backend fully deployed on Google Cloud (Cloud Run / App Engine)
- Frontend served statically from backend domain
- API endpoints proxied under `/api/...` to avoid CORS issues