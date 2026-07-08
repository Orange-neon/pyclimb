# Authoring Col problems

Published bank versions are immutable because active multiplayer rooms pin their version. To change, add, remove, or reclassify a published problem, create a new bank first:

```powershell
npm.cmd run bank:new -- v2
```

Edit `easy.ts`, `medium.ts`, or `hard.ts` in the new version folder. Each problem needs:

- a permanent kebab-case `id`;
- a beginner-friendly title and topic tags;
- Markdown instructions with `Input` and `Output` sections;
- runnable starter and solution code requiring no imports;
- at least three distinct stdin/stdout test cases.

Difficulty controls points and penalties centrally through `src/data/difficulty.ts`. Moving an object to another tier requires updating its `difficulty` field as well.

The practice selector derives each problem's curriculum topic from its tags. Prefer the canonical structural tags `conditionals`, `loops`, `while-loops`, `strings`, `lists`, `nested-lists`, `dictionaries`, `functions`, `modules`, and `classes` when they apply. Topic order and classification live in `src/data/curriculum.ts`; new structural topics should be added there before publishing a bank.

Run validation and the production build before publishing:

```powershell
npm.cmd run validate:problems
npm.cmd run verify:solutions
npm.cmd run build
```

Use Solo Practice to submit each reference solution against its tests in the Pyodide browser runtime before releasing a new bank.
