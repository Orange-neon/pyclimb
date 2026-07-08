# Col

Col is a static Vite/React Python race. Solo Practice works without configuration. Multiplayer rooms use Firebase Anonymous Authentication and Realtime Database on the no-cost Spark plan.

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
2. Enable Authentication → Sign-in method → Anonymous.
3. Create a Realtime Database.
4. Copy `.env.example` to `.env.local` and add the Web app values, including the Realtime Database URL.
5. Deploy `database.rules.json` to that database with the Firebase CLI or paste the rules into the Firebase console.

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

This command runs the deterministic judging, selection, ranking, countdown, and bank tests before building the GitHub Pages export.

## Current milestone

- 90 beginner challenges in the first release bank, v1 (30 per difficulty)
- Monaco editor and a pinned Pyodide v0.25.0 Web Worker
- Solo race with simulated peers and browser persistence
- Multiplayer create/join lobby, readiness, shared timer, live standings, stop, results, and rematch

The planned 90-problem bank is complete. New revisions should be created as another immutable bank version.

Problem maintainers should follow [docs/AUTHORING_PROBLEMS.md](docs/AUTHORING_PROBLEMS.md). Published banks are versioned so active rooms are not changed by later edits.
