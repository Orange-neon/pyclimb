import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { deleteApp, initializeApp } from "firebase/app";
import {
  deleteUser,
  inMemoryPersistence,
  initializeAuth,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import {
  get,
  getDatabase,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from "firebase/database";

const REQUIRED_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_DATABASE_URL",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function parseEnv(contents) {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function roomCode() {
  return Array.from(randomBytes(6), (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join("");
}

function percentile(values, fraction) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
}

function contestant(uid, nickname, joinedAt) {
  return {
    uid,
    nickname,
    normalizedNickname: nickname.toLowerCase(),
    score: 0,
    correctCount: 0,
    joinedAt,
    lastAcceptedAt: null,
    online: true,
    ready: true,
  };
}

function progress(currentStreak = 0) {
  return {
    score: 0,
    solvedCount: 0,
    currentStreak,
    solved: {},
    challengeAwards: {},
  };
}

async function createClient(config, label) {
  const app = initializeApp(config, `col-live-smoke-${label}-${Date.now()}-${randomBytes(4).toString("hex")}`);
  try {
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    const user = (await signInAnonymously(auth)).user;
    return { app, auth, database: getDatabase(app), label, user };
  } catch (reason) {
    try {
      await deleteApp(app);
    } catch (cleanupReason) {
      throw new AggregateError(
        [reason, cleanupReason],
        `Creating the ${label} client failed, and its Firebase app could not be deleted.`,
      );
    }
    throw reason;
  }
}

function reasonMessage(reason) {
  return reason instanceof Error ? reason.message : String(reason);
}

async function cleanupClient({ app, auth, label, user }) {
  const failures = [];
  const report = {
    label,
    uid: user.uid,
    account: "unknown",
    session: "unknown",
    app: "unknown",
  };

  try {
    await deleteUser(user);
    report.account = "deleted";
  } catch (reason) {
    failures.push(new Error(`${label} account ${user.uid}: ${reasonMessage(reason)}`));
  }

  try {
    await signOut(auth);
    report.session = "signed-out";
  } catch (reason) {
    failures.push(new Error(`${label} sign-out: ${reasonMessage(reason)}`));
  }

  try {
    await deleteApp(app);
    report.app = "deleted";
  } catch (reason) {
    failures.push(new Error(`${label} app deletion: ${reasonMessage(reason)}`));
  }

  if (failures.length > 0) {
    const error = new AggregateError(
      failures,
      `Cleanup failed for the ${label} client (${user.uid}).`,
    );
    error.cleanupReport = report;
    throw error;
  }
  return report;
}

async function cleanupClients(clients) {
  const settled = await Promise.allSettled(clients.map(cleanupClient));
  const reports = [];
  const failures = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      reports.push(result.value);
      return;
    }
    const fallback = {
      label: clients[index].label,
      uid: clients[index].user.uid,
      account: "unknown",
      session: "unknown",
      app: "unknown",
    };
    reports.push(result.reason?.cleanupReport ?? fallback);
    if (result.reason instanceof AggregateError) {
      failures.push(...result.reason.errors);
    } else {
      failures.push(result.reason);
    }
  });

  return { failures, reports };
}

async function cleanupPath(database, path, label, maxAttempts = 2) {
  const attemptFailures = [];
  let residual = "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let removalAcknowledged = false;
    try {
      await remove(ref(database, path));
      removalAcknowledged = true;
      residual = "absent";
    } catch (reason) {
      attemptFailures.push(
        new Error(`${label} removal attempt ${attempt}: ${reasonMessage(reason)}`),
      );
    }

    try {
      residual = (await get(ref(database, path))).exists() ? "present" : "absent";
      if (residual === "absent") {
        return {
          attempts: attempt,
          failures: [],
          label,
          path,
          residual,
          verifiedBy: "read",
        };
      }
      attemptFailures.push(
        new Error(`${label} is still present after cleanup attempt ${attempt}.`),
      );
    } catch (reason) {
      if (removalAcknowledged) {
        return {
          attempts: attempt,
          failures: [],
          label,
          path,
          residual,
          verifiedBy: "delete-acknowledgement",
        };
      }
      residual = "unknown";
      attemptFailures.push(
        new Error(`${label} verification attempt ${attempt}: ${reasonMessage(reason)}`),
      );
    }
  }

  return {
    attempts: maxAttempts,
    failures: attemptFailures,
    label,
    path,
    residual,
    verifiedBy: "read",
  };
}

async function inspectRoomOwnership(database, roomPath, hostUid, maxAttempts = 2) {
  const failures = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const roomSnapshot = await get(ref(database, roomPath));
      if (!roomSnapshot.exists()) {
        return { attempts: attempt, failures: [], ownership: "absent" };
      }
      return {
        attempts: attempt,
        failures: [],
        ownership:
          roomSnapshot.child("meta/hostUid").val() === hostUid
            ? "owned"
            : "foreign",
      };
    } catch (reason) {
      failures.push(
        new Error(
          `Room ownership verification attempt ${attempt}: ${reasonMessage(reason)}`,
        ),
      );
    }
  }
  return { attempts: maxAttempts, failures, ownership: "unknown" };
}

async function cleanupLiveState({
  clients,
  generationPath,
  host,
  reservationAttempted,
  roomPath,
}) {
  const artifacts = [];
  const failures = [];
  let preserveHostClient = false;
  let roomOwnership = reservationAttempted ? "unknown" : "not-attempted";

  // Keep the host app and credential usable for the entire data-cleanup phase.
  if (reservationAttempted && host) {
    const ownership = await inspectRoomOwnership(
      host.database,
      roomPath,
      host.user.uid,
    );
    roomOwnership = ownership.ownership;
    failures.push(...ownership.failures);
  }

  if (roomOwnership === "owned") {
    const activity = await cleanupPath(
      host.database,
      generationPath,
      "Activity path",
    );
    artifacts.push(activity);
    failures.push(...activity.failures);

    if (activity.residual === "absent") {
      const room = await cleanupPath(host.database, roomPath, "Room path");
      artifacts.push(room);
      failures.push(...room.failures);
    } else {
      let roomResidual = "unknown";
      try {
        roomResidual = (await get(ref(host.database, roomPath))).exists()
          ? "present"
          : "absent";
      } catch (reason) {
        failures.push(
          new Error(`Preserved room verification: ${reasonMessage(reason)}`),
        );
      }
      artifacts.push({
        attempts: 0,
        failures: [],
        label: "Room path",
        path: roomPath,
        residual: roomResidual,
      });
      failures.push(
        new Error(
          "Room cleanup was skipped so its host authorization remains available for residual activity cleanup.",
        ),
      );
    }
    preserveHostClient = artifacts.some(({ residual }) =>
      ["present", "unknown"].includes(residual),
    );
  } else if (roomOwnership === "unknown" && reservationAttempted) {
    preserveHostClient = true;
  }

  const clientsToDelete = preserveHostClient
    ? clients.filter(({ label }) => label !== "host")
    : clients;
  const clientCleanup = await cleanupClients(clientsToDelete);
  if (preserveHostClient && host) {
    clientCleanup.reports.unshift({
      label: host.label,
      uid: host.user.uid,
      account: "retained",
      session: "retained",
      app: "retained",
    });
  }
  failures.push(...clientCleanup.failures);
  return {
    artifacts,
    clients: clientCleanup.reports,
    failures,
    roomOwnership,
  };
}

function cleanupSummary(report) {
  const ownership = `Room ownership: ${report.roomOwnership}`;
  const artifacts =
    report.artifacts.length > 0
      ? report.artifacts
          .map(({ label, path, residual }) => `${label} ${path}: ${residual}`)
          .join("; ")
      : "Smoke-owned live paths: none eligible for removal";
  const clients =
    report.clients.length > 0
      ? report.clients
          .map(
            ({ account, app, label, session, uid }) =>
              `${label} ${uid}: account=${account}, session=${session}, app=${app}`,
          )
          .join("; ")
      : "Anonymous clients: none created";
  return `${ownership}. ${artifacts}. ${clients}.`;
}

async function expectDenied(operation, label) {
  try {
    await operation();
  } catch (reason) {
    if (/permission|denied/i.test(reason instanceof Error ? reason.message : String(reason))) return;
    throw reason;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
}

async function waitForActivity(
  database,
  path,
  expectedSource,
  timeoutMs = 5_000,
  signal,
) {
  return new Promise((resolve, reject) => {
    let unsubscribe;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", handleAbort);
      unsubscribe?.();
      callback(value);
    };
    const handleAbort = () => {
      finish(
        reject,
        signal?.reason instanceof Error
          ? signal.reason
          : new Error("Stopped waiting for live activity."),
      );
    };
    const timeout = setTimeout(() => {
      finish(reject, new Error(`Timed out waiting for ${path}.`));
    }, timeoutMs);
    signal?.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    unsubscribe = onValue(
      ref(database, path),
      (snapshot) => {
        if (snapshot.val()?.source !== expectedSource) return;
        finish(resolve);
      },
      (reason) => {
        finish(reject, reason);
      },
    );
    if (settled) unsubscribe();
  });
}

async function waitForChallengeStatus(
  database,
  path,
  expectedStatus,
  timeoutMs = 5_000,
) {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => undefined;
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${path} to become ${expectedStatus}.`));
    }, timeoutMs);
    unsubscribe = onValue(
      ref(database, path),
      (snapshot) => {
        if (snapshot.val()?.status !== expectedStatus) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      },
      (reason) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(reason);
      },
    );
  });
}

async function main() {
  if (!process.argv.includes("--live")) {
    throw new Error("Refusing to touch a live Firebase project without the explicit --live flag.");
  }

  const fileEnv = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
  const env = { ...fileEnv, ...process.env };
  for (const key of REQUIRED_ENV) {
    if (!env[key]) throw new Error(`${key} is not configured.`);
  }

  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  const clients = [];
  const code = roomCode();
  const createdAt = Date.now();
  const roomPath = `rooms/${code}`;
  const generationPath = `raceActivity/${code}/${createdAt}`;
  let host;
  let reservationAttempted = false;
  let cleanupPromise;
  let interruptedSignal;
  const handleSignal = (signal) => {
    if (interruptedSignal) return;
    interruptedSignal = signal;
    console.error(
      `Received ${signal}; the current Firebase operation will settle before shared cleanup runs.`,
    );
  };
  const throwIfInterrupted = () => {
    if (interruptedSignal) {
      throw new Error(`Live smoke interrupted by ${interruptedSignal}.`);
    }
  };
  const cleanupOnce = () => {
    cleanupPromise ??= cleanupLiveState({
      clients,
      generationPath,
      host,
      reservationAttempted,
      roomPath,
    });
    return cleanupPromise;
  };
  const removeSignalHandlers = () => {
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
  };
  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  try {
    for (const label of ["host", "leader", "challenger"]) {
      clients.push(await createClient(config, label));
      throwIfInterrupted();
    }
  } catch (reason) {
    const cleanupReport = await cleanupOnce();
    removeSignalHandlers();
    if (cleanupReport.failures.length > 0) {
      throw new Error(
        [
          `Live smoke client setup and cleanup failed for project ${config.projectId}.`,
          `Setup failure: ${reasonMessage(reason)}.`,
          `Cleanup failures: ${cleanupReport.failures.map(reasonMessage).join(" | ")}.`,
          `Verified cleanup state: ${cleanupSummary(cleanupReport)}`,
        ].join(" "),
      );
    }
    throw reason;
  }
  [host] = clients;
  const [, leader, challenger] = clients;

  let report;
  let operationError;

  try {
    throwIfInterrupted();
    reservationAttempted = true;
    const reservation = await runTransaction(
      ref(host.database, roomPath),
      (current) =>
        current === null
          ? {
              meta: {
                hostUid: host.user.uid,
                hostOnline: true,
                status: "lobby",
                bankVersion: "v5",
                problemCount: 10,
                durationSeconds: 600,
                unlimited: false,
                createdAt,
                startedAt: null,
                endsAt: null,
                endedAt: null,
                endReason: null,
              },
            }
          : undefined,
      { applyLocally: false },
    );
    throwIfInterrupted();
    if (!reservation.committed) {
      throw new Error(`Generated room ${code} already exists; no live data was changed.`);
    }

    const joinedAt = createdAt + 1;
    const leaderRecord = contestant(leader.user.uid, "Live Leader", joinedAt);
    const challengerRecord = contestant(challenger.user.uid, "Live Challenger", joinedAt + 1);
    await update(ref(leader.database, roomPath), {
      [`leaderboard/${leader.user.uid}`]: leaderRecord,
      [`progress/${leader.user.uid}`]: progress(5),
    });
    await update(ref(challenger.database, roomPath), {
      [`leaderboard/${challenger.user.uid}`]: challengerRecord,
      [`progress/${challenger.user.uid}`]: progress(5),
    });

    await update(ref(host.database, `${roomPath}/meta`), {
      status: "active",
      startedAt: createdAt + 10,
      endsAt: createdAt + 600_010,
    });

    await update(ref(leader.database, `${roomPath}/leaderboard/${leader.user.uid}`), {
      score: 500,
      correctCount: 5,
    });
    await update(ref(leader.database, `${roomPath}/progress/${leader.user.uid}`), {
      score: 500,
      solvedCount: 5,
      currentStreak: 5,
    });
    await update(ref(challenger.database, `${roomPath}/leaderboard/${challenger.user.uid}`), {
      score: 400,
      correctCount: 4,
    });
    await update(ref(challenger.database, `${roomPath}/progress/${challenger.user.uid}`), {
      score: 400,
      solvedCount: 4,
      currentStreak: 5,
    });
    throwIfInterrupted();

    const leaderActivityPath = `${generationPath}/${leader.user.uid}`;
    await set(ref(leader.database, leaderActivityPath), {
      problemId: "v5-live-smoke",
      phase: "active",
      source: "print('ready')",
      updatedAt: Date.now(),
    });
    const hostActivity = await get(ref(host.database, leaderActivityPath));
    if (hostActivity.val()?.source !== "print('ready')") {
      throw new Error("Host did not receive the leader's live source.");
    }
    await expectDenied(
      () => get(ref(challenger.database, generationPath)),
      "Contestant live-activity read",
    );
    throwIfInterrupted();

    const assignedAt = Date.now();
    await update(ref(host.database), {
      [`${roomPath}/spectators/${challenger.user.uid}`]: {
        uid: challenger.user.uid,
        nickname: challengerRecord.nickname,
        normalizedNickname: challengerRecord.normalizedNickname,
        joinedAt: challengerRecord.joinedAt,
        assignedAt,
        online: true,
      },
      [`${roomPath}/leaderboard/${challenger.user.uid}`]: null,
      [`${roomPath}/progress/${challenger.user.uid}`]: null,
      [`${generationPath}/${challenger.user.uid}`]: null,
    });
    const spectatorView = await get(ref(challenger.database, leaderActivityPath));
    if (spectatorView.val()?.problemId !== "v5-live-smoke") {
      throw new Error("Assigned spectator could not inspect the active problem.");
    }
    await expectDenied(
      () =>
        set(ref(challenger.database, `${generationPath}/${challenger.user.uid}`), {
          problemId: "forbidden",
          phase: "active",
          source: "print('forbidden')",
          updatedAt: Date.now(),
        }),
      "Spectator activity write",
    );
    throwIfInterrupted();

    await update(ref(host.database), {
      [`${roomPath}/leaderboard/${challenger.user.uid}`]: {
        ...challengerRecord,
        score: 0,
        correctCount: 0,
        lastAcceptedAt: null,
        ready: false,
      },
      [`${roomPath}/progress/${challenger.user.uid}`]: progress(),
      [`${roomPath}/spectators/${challenger.user.uid}`]: null,
      [`${generationPath}/${challenger.user.uid}`]: null,
    });
    await set(ref(challenger.database, `${generationPath}/${challenger.user.uid}`), {
      problemId: "v5-promoted",
      phase: "active",
      source: "print('promoted')",
      updatedAt: Date.now(),
    });
    await expectDenied(
      () => get(ref(challenger.database, generationPath)),
      "Promoted contestant aggregate activity read",
    );
    throwIfInterrupted();

    await update(ref(challenger.database, `${roomPath}/progress/${challenger.user.uid}`), {
      score: 400,
      solvedCount: 4,
      currentStreak: 5,
    });
    throwIfInterrupted();
    await update(ref(challenger.database, `${roomPath}/leaderboard/${challenger.user.uid}`), {
      score: 400,
      correctCount: 4,
    });

    const challenge = {
      id: `live-${randomBytes(6).toString("hex")}`,
      status: "waiting",
      challengerUid: challenger.user.uid,
      challengerName: challengerRecord.nickname,
      championUid: leader.user.uid,
      championName: leaderRecord.nickname,
      difficulty: "easy",
      problemId: "v5-live-challenge",
      problemReward: 100,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      winnerUid: null,
    };
    const challengeRef = ref(challenger.database, `${roomPath}/challenge`);
    const leaderChallengeRef = ref(leader.database, `${roomPath}/challenge`);
    await set(challengeRef, challenge);
    await set(leaderChallengeRef, {
      ...challenge,
      status: "active",
      startedAt: Date.now(),
    });
    await Promise.all([
      waitForChallengeStatus(
        challenger.database,
        `${roomPath}/challenge`,
        "active",
      ),
      waitForChallengeStatus(
        leader.database,
        `${roomPath}/challenge`,
        "active",
      ),
    ]);
    throwIfInterrupted();
    const finishChallenge = (winnerUid) => (current) => {
      if (!current || current.status !== "active") return undefined;
      return {
        ...current,
        status: "finished",
        finishedAt: Date.now(),
        winnerUid,
      };
    };
    const challengeResults = await Promise.all([
      runTransaction(
        challengeRef,
        finishChallenge(challenger.user.uid),
        { applyLocally: false },
      ),
      runTransaction(
        leaderChallengeRef,
        finishChallenge(leader.user.uid),
        { applyLocally: false },
      ),
    ]);
    const finishedChallenge = (await get(ref(host.database, `${roomPath}/challenge`))).val();
    throwIfInterrupted();
    if (
      finishedChallenge?.status !== "finished" ||
      ![challenger.user.uid, leader.user.uid].includes(finishedChallenge?.winnerUid) ||
      challengeResults.filter((result) => result.committed).length !== 1
    ) {
      throw new Error("Leader challenge did not produce exactly one winner.");
    }

    const latencies = [];
    for (let index = 0; index < 12; index += 1) {
      throwIfInterrupted();
      const source = `print(${index}) # ${randomBytes(3).toString("hex")}`;
      const observationController = new AbortController();
      const observed = waitForActivity(
        host.database,
        leaderActivityPath,
        source,
        5_000,
        observationController.signal,
      );
      const started = performance.now();
      try {
        const [observationResult, writeResult] = await Promise.allSettled([
          observed,
          set(ref(leader.database, leaderActivityPath), {
            problemId: "v5-live-latency",
            phase: "active",
            source,
            updatedAt: Date.now(),
          }).catch((reason) => {
            observationController.abort(
              new Error(
                `Latency sample ${index + 1} write failed: ${reasonMessage(reason)}`,
              ),
            );
            throw reason;
          }),
        ]);
        const failure =
          writeResult.status === "rejected" ? writeResult : observationResult;
        if (failure.status === "rejected") throw failure.reason;
      } finally {
        observationController.abort(
          new Error(`Latency sample ${index + 1} stopped before observation completed.`),
        );
      }
      throwIfInterrupted();
      latencies.push(performance.now() - started);
    }

    await update(ref(host.database), {
      [`${roomPath}/meta/status`]: "lobby",
      [`${roomPath}/meta/startedAt`]: null,
      [`${roomPath}/meta/endsAt`]: null,
      [`${roomPath}/meta/endedAt`]: null,
      [`${roomPath}/meta/endReason`]: null,
      [`${roomPath}/challenge`]: null,
      [generationPath]: null,
      [`${roomPath}/leaderboard/${leader.user.uid}/score`]: 0,
      [`${roomPath}/leaderboard/${leader.user.uid}/correctCount`]: 0,
      [`${roomPath}/leaderboard/${leader.user.uid}/ready`]: false,
      [`${roomPath}/progress/${leader.user.uid}`]: progress(),
      [`${roomPath}/leaderboard/${challenger.user.uid}/score`]: 0,
      [`${roomPath}/leaderboard/${challenger.user.uid}/correctCount`]: 0,
      [`${roomPath}/leaderboard/${challenger.user.uid}/ready`]: false,
      [`${roomPath}/progress/${challenger.user.uid}`]: progress(),
    });
    const rematch = (await get(ref(host.database, roomPath))).val();
    throwIfInterrupted();
    if (
      rematch?.meta?.status !== "lobby" ||
      rematch?.leaderboard?.[leader.user.uid]?.score !== 0 ||
      rematch?.leaderboard?.[challenger.user.uid]?.score !== 0
    ) {
      throw new Error("Rematch reset did not preserve both contestants with fresh scores.");
    }

    report = {
      result: "passed",
      roomLifecycle: "create/join/start/rematch/cleanup",
      spectatorLifecycle: "demote/read-only/promote",
      challengeLifecycle: "waiting/active/finished",
      activitySamples: latencies.length,
      activityLatencyMs: {
        median: Number(percentile(latencies, 0.5).toFixed(1)),
        p95: Number(percentile(latencies, 0.95).toFixed(1)),
        max: Number(Math.max(...latencies).toFixed(1)),
      },
    };
  } catch (reason) {
    operationError = reason;
  }

  let cleanupReport;
  try {
    cleanupReport = await cleanupOnce();
  } finally {
    removeSignalHandlers();
  }

  if (cleanupReport.failures.length > 0) {
    const operationMessage = operationError
      ? ` Test failure: ${reasonMessage(operationError)}.`
      : "";
    throw new Error(
      [
        `Live smoke cleanup failed for project ${config.projectId}, room ${code}.`,
        `Room path: ${roomPath}. Activity path: ${generationPath}. Host UID: ${host.user.uid}.`,
        `Cleanup failures: ${cleanupReport.failures.map(reasonMessage).join(" | ")}.`,
        `Verified cleanup state: ${cleanupSummary(cleanupReport)}`,
        "Retained means cleanup was deliberately skipped to preserve host access; an account marked unknown may still exist; a path marked present still contains live data; unknown means verification itself failed.",
        operationMessage,
      ].join(" "),
    );
  }
  if (operationError) throw operationError;
  console.log(JSON.stringify(report));
}

main().catch((reason) => {
  console.error(reason instanceof Error ? reason.message : String(reason));
  process.exitCode = 1;
});
