# Cron Trading – Admin Panel

React + Vite admin panel for the Cron Trading backend (`Trading-App-Server`). Admins sign in with
their Firebase account and can:

- **Signals:** create, edit, go live / take offline, delete, restore, delete forever, and add sample signals
- **News alerts:** upload images or a video, go live / take offline, delete, restore
- **Dashboard:** server status and counts

It only uses the server's existing API, with no server changes.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

The server URL and Firebase web config have defaults in `src/config.ts`. Override them with
`VITE_*` variables (see `.env.example`), for example in a `.env.local` file.

## Make an account an admin

The panel only opens for accounts with the Firebase `admin` claim. In the **server** project run:

```bash
node scripts/set-admin-claim.js <firebase-uid>
```

The panel shows your UID on the "Not an admin yet" screen. Then click **Check again**.

## Deploy on Railway

1. In the same Railway project as the server: **+ Create → GitHub Repo →** this repo, branch `munawar-branch`.
2. Railway detects Vite, runs `npm run build`, and serves the `dist` folder as a single-page app.
3. **Settings → Networking → Generate Domain.**

## Known server-side limits (not fixed here)

- The app caches the signal list for up to 5 minutes, so changes can take that long to show in the app.
- News uploads need real AWS S3 keys on the server.
- The server's admin checks on most `*/admin/*` routes are not enforced (see the hosting report). Keep this panel's URL private.
