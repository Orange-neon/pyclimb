# Authoring Col problems

Published bank versions are immutable because active multiplayer rooms pin their version. To change, add, remove, or reclassify a published problem, create a new bank first:

```powershell
npm.cmd run bank:new -- v2
```

Edit `easy.ts`, `medium.ts`, or `hard.ts` in the new version folder. Each problem needs:

- a permanent kebab-case `id`;
- a beginner-friendly title and topic tags;
- Markdown instructions with `Input` and `Output` sections;
- runnable starter and solution code; standard-library imports are allowed for module-focused problems;
- at least three distinct stdin/stdout test cases.

For introductory problems, scaffold only concepts the student has already met. Prefer named intermediate variables and explicit `if`, `for`, and conversion steps over nested calls, ternary expressions, comprehensions, `map`, unpacking tricks, or dense formatting. Reference solutions are teaching material: the shortest solution is not automatically the clearest one.

Difficulty controls points and penalties centrally through `src/data/difficulty.ts`. Moving an object to another tier requires updating its `difficulty` field as well.

The practice selector derives each problem's curriculum topic from its tags. Prefer the canonical structural tags `conditionals`, `loops`, `while-loops`, `strings`, `lists`, `nested-lists`, `dictionaries`, `functions`, `modules`, and `classes` when they apply. Topic order and classification live in `src/data/curriculum.ts`; new structural topics should be added there before publishing a bank.

Within each difficulty tier, `src/data/problemProgression.ts` ranks problems by curriculum stage, advanced structural tags, reference-solution length, branching, and nesting. It then assigns the tier's per-problem bonus by progression percentile. Use accurate structural tags and straightforward reference solutions so ordering and rewards remain meaningful.

Starting with v4, progression also assigns bomb events only within the easier 35% of a tier and double-point events only within the harder 35%. Event clocks are centralized in `src/data/timedProblems.ts`; do not hard-code timers in individual problem definitions.

Run validation and the production build before publishing:

```powershell
npm.cmd run validate:problems
npm.cmd run verify:solutions
npm.cmd run build
```

Use Solo Practice to submit each reference solution against its tests in the Pyodide browser runtime before releasing a new bank.
