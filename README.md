# Col

Col is a static Vite/React Python learning app. It supports solo practice, competitive rooms, and ephemeral real-time collaborative Python notebooks. Solo Practice works without configuration. Room identity and membership use Firebase Authentication and Realtime Database on the no-cost Spark plan; notebook content is relayed through a Cloudflare Durable Object and is never written to Firebase.

## Local development

```powershell
npm.cmd install
npm.cmd run dev
```

To run the collaboration relay locally in a second terminal after configuring its variables and secret:

```powershell
npm.cmd run collaboration:dev
```

The production site is built for the `/col/` GitHub Pages path:

```powershell
npm.cmd run build
npm.cmd run preview
```

## Enable rooms

1. Create a Firebase project on the Spark plan and register a Web app.
2. Enable Authentication → Sign-in method → Anonymous for timed rooms and collaboration-room guests.
3. Enable Authentication → Sign-in method → Google and choose a project support email for unlimited rooms, collaboration-room creation, and cross-device resume.
4. Create a Realtime Database.
5. Copy `.env.example` to `.env.local` and add the Web app values, including the Realtime Database URL.
6. Add every production hostname under Authentication → Settings → Authorized domains.
7. Deploy `database.rules.json` to that database with the Firebase CLI or paste the rules into the Firebase console.

Firebase Web configuration identifies the project but is not a private server secret. Database access is controlled by Authentication and `database.rules.json`.

For a GitHub Pages build, provide the same `VITE_FIREBASE_*` values as repository variables in the build workflow. Collaborative notebooks remain disabled until `VITE_COLLAB_RELAY_HOST` is also configured.

After pulling changes that modify `database.rules.json`, republish that file from Realtime Database → Rules in the Firebase console.

## Enable collaborative notebooks

The relay is a separate Cloudflare Worker defined under `workers/collaboration`. It uses Yjs and a hibernating Durable Object: browsers hold the working document, the relay synchronizes connected peers, and no persistence hook stores notebook code. The deployed Worker discards its in-memory Yjs generation when the final sync socket closes. Firebase stores only code-free metadata, self-owned member records, and 30 fixed authorization slots. Those authorization records survive transient disconnects and same-user tabs; explicit Leave removes the caller, the final Leave deletes the room metadata, and abnormal empty rooms expire through a short renewable lease.

Authorization and live presence are intentionally separate: a non-final abnormal close keeps its Firebase slot so another tab or device using the same UID stays authorized. Participants should use **Leave** to free a slot. The relay independently caps rooms at 30 live UIDs, and fully abandoned code-free metadata expires with the room lease.

1. Create a Cloudflare account and enable Workers on the free plan.
2. Copy `workers/collaboration/.dev.vars.example` to `.dev.vars` for local relay development.
3. Set `FIREBASE_DATABASE_URL` to the same Realtime Database used by the frontend.
4. Set `ALLOWED_ORIGINS` to a comma-separated list such as `http://localhost:5173,https://<name>.github.io`.
5. Create a random ticket secret containing at least 32 bytes with `npm run collaboration:secret`, then store it locally as `RELAY_TICKET_SECRET` or upload it with `npx wrangler secret put RELAY_TICKET_SECRET --config workers/collaboration/wrangler.jsonc`.
6. Run `npm run collaboration:deploy`, then set `VITE_COLLAB_RELAY_HOST` to the deployed `*.workers.dev` hostname without a path.

For automatic relay deploys, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets, add `COLLAB_ALLOWED_ORIGINS` and `VITE_FIREBASE_DATABASE_URL` as repository variables, and set `COLLAB_RELAY_ENABLED=true`. The signing secret remains a Cloudflare Worker secret and is retained by the deploy workflow.

The relay validates each Firebase ID token against the exact room-member path before issuing a 60-second WebSocket ticket. Do not place Firebase service-account credentials in the Worker.

Free-tier capacity is intentionally bounded: 30 live participants per room, 50 cells, 50 KiB source per cell, 20 KiB shared output, a five-second execution timeout, and a 500 ms run cooldown per user. Quota exhaustion is reported as temporary collaboration unavailability; it never opts the project into paid usage automatically.

## Deploy to GitHub Pages

1. Push this project to a GitHub repository named `col` with `main` as its default branch.
2. Open Settings → Pages and choose **GitHub Actions** as the source.
3. In Settings → Secrets and variables → Actions → Variables, create the five `VITE_FIREBASE_*` values plus `VITE_COLLAB_RELAY_HOST` from `.env.example`.
4. Push to `main` or run **Test and deploy Col** manually from the Actions tab.
5. Add `<your-github-name>.github.io` under Firebase Authentication → Settings → Authorized domains.

The workflow runs problem validation, unit tests, TypeScript, and the production build before deploying `dist`.

## Release checks

```powershell
npm.cmd run check
```

This command runs judging, adaptive selection, ranking, countdown, room/session, notebook-CRDT, relay-policy, Firebase Rules Emulator, and bank tests before building the GitHub Pages export. The Firebase emulator requires Java 21 or newer. Cloudflare configuration can also be validated without deployment using `npm run collaboration:dry-run`.

## Current milestone

- 600 challenges in v5 (244 easy, 178 medium, 178 hard), with every v4 difficulty tier and curriculum topic doubled
- Bomb problems on easier tier content and double-point sprints on harder tier content, with 1:00/1:30/2:00 clocks
- Five-streak multiplayer challenges against the current leader with category selection and head-to-head rewards
- Monaco editor and a pinned Pyodide v0.25.0 Web Worker
- Ordered curriculum topic selection with automatic prerequisite inclusion
- Randomized adaptive progression within each tier, with safe onboarding, stretch challenges, and per-problem difficulty bonuses
- Open-ended solo practice with simulated peers, reset, quit, and local progress
- Timed multiplayer rooms without Google sign-in, plus Google-authenticated unlimited rooms, live standings, results, and rematches
- Google-created collaborative rooms with Yjs-bound Monaco cells, participant cursors, shared runner-attributed output, and sandboxed browser-local Pyodide execution

The v1 through v4 banks remain immutable for active rooms. The current v5 bank adds 300 distinct challenges without changing older rooms, ranging from first-print foundations through graphs and dynamic programming.

Adaptive selection runs entirely in the app—no AI or paid API is used. Solo profiles remain in local storage. Signed-in room players store a small per-difficulty profile in Realtime Database so their level follows them when they resume on another device. Solves and streaks move the challenge window upward; failed submissions and forfeits move it back toward productive practice. The final problem is still randomly sampled from that window, so students following the same topics and difficulty do not receive a fixed identical sequence.

Problem maintainers should follow [docs/AUTHORING_PROBLEMS.md](docs/AUTHORING_PROBLEMS.md). Published banks are versioned so active rooms are not changed by later edits.
