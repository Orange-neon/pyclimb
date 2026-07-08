# Col

Col is a static Vite/React Python race. Solo Practice works without configuration. Multiplayer rooms use Firebase Google Authentication and Realtime Database on the no-cost Spark plan.

## Local development

```powershell
npm.cmd install
npm.cmd run dev
```

The production site is built for the `/col/` GitHub Pages path:

```powershell
npm.cmd run build
npm.cmd run preview
```

## Enable multiplayer

1. Create a Firebase project on the Spark plan and register a Web app.
2. Enable Authentication → Sign-in method → Google and choose a project support email.
3. Create a Realtime Database.
4. Copy `.env.example` to `.env.local` and add the Web app values, including the Realtime Database URL.
5. Add every production hostname under Authentication → Settings → Authorized domains.
6. Deploy `database.rules.json` to that database with the Firebase CLI or paste the rules into the Firebase console.

Firebase Web configuration identifies the project but is not a private server secret. Database access is controlled by Authentication and `database.rules.json`.

For a GitHub Pages build, provide the same `VITE_FIREBASE_*` values as repository variables in the build workflow.

After pulling changes that modify `database.rules.json`, republish that file from Realtime Database → Rules in the Firebase console.

## Deploy to GitHub Pages

1. Push this project to a GitHub repository named `col` with `main` as its default branch.
2. Open Settings → Pages and choose **GitHub Actions** as the source.
3. In Settings → Secrets and variables → Actions → Variables, create the five `VITE_FIREBASE_*` repository variables listed in `.env.example`.
4. Push to `main` or run **Test and deploy Col** manually from the Actions tab.
5. Add `<your-github-name>.github.io` under Firebase Authentication → Settings → Authorized domains.

The workflow runs problem validation, unit tests, TypeScript, and the production build before deploying `dist`.

## Release checks

```powershell
npm.cmd run check
```

This command runs judging, adaptive selection, ranking, countdown, and bank tests before building the GitHub Pages export.

## Current milestone

- 300 challenges in v4 (122 easy, 89 medium, 89 hard), ranging from first-print foundations through graphs and dynamic programming
- Bomb problems on easier tier content and double-point sprints on harder tier content, with 1:00/1:30/2:00 clocks
- Five-streak multiplayer challenges against the current leader with category selection and head-to-head rewards
- Monaco editor and a pinned Pyodide v0.25.0 Web Worker
- Ordered curriculum topic selection with automatic prerequisite inclusion
- Randomized adaptive progression within each tier, with safe onboarding, stretch challenges, and per-problem difficulty bonuses
- Five-minute solo sprints with simulated peers, persistent countdown, and frozen results
- Google-authenticated multiplayer with cross-device resume, timed or unlimited rooms, live standings, results, and rematches

The v1, v2, and v3 banks remain immutable for active rooms. The current v4 bank adds 58 distinct challenges and the timed-event metadata without changing older rooms.

Adaptive selection runs entirely in the app—no AI or paid API is used. Solo profiles remain in local storage. Signed-in room players store a small per-difficulty profile in Realtime Database so their level follows them when they resume on another device. Solves and streaks move the challenge window upward; failed submissions and forfeits move it back toward productive practice. The final problem is still randomly sampled from that window, so students following the same topics and difficulty do not receive a fixed identical sequence.

Problem maintainers should follow [docs/AUTHORING_PROBLEMS.md](docs/AUTHORING_PROBLEMS.md). Published banks are versioned so active rooms are not changed by later edits.
