# TwoLife Memory

A beautiful, intimate digital space for couples to save their memories together.

## Features
- **Dashboard**: A warm summary of time together, latest photos, and stories.
- **Timeline**: Chronological memory tracking with cover images and mood.
- **Photos**: Upload and view full-res images in a waterfall gallery.
- **Blog**: Write down travel diaries, reflections, or everyday stories.
- **Anniversaries**: Track important dates with live day counters.
- **Theme Support**: Customizable themes (Romantic Pink, Ocean Blue, Lavender Purple, Fresh Green, Warm Beige).

## Tech Stack
- Frontend: React 19, Vite, Tailwind CSS v4, shadcn/ui, React Router, TanStack Query
- Backend: Express.js, SQLite (via `better-sqlite3`), bcryptjs, JWT
- Platform: Built natively for Google AI Studio

## Local Development
1. Clone the repository.
2. Run `npm install`.
3. Set your JWT_SECRET in `.env` (copy from `.env.example`).
4. Run `npm run dev`.

The app will start on port 3000.

## Default Account
- **Username / Email**: `admin` or `admin@example.com`
- **Password**: `123456`
