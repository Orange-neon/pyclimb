import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { LATEST_BANK_VERSION } from "../src/data/problemBank";

const requestedVersion = process.argv[2];
if (!requestedVersion || !/^v\d+$/.test(requestedVersion)) {
  throw new Error("Usage: npm run bank:new -- v2");
}
if (Number(requestedVersion.slice(1)) <= Number(LATEST_BANK_VERSION.slice(1))) {
  throw new Error(`New version must be greater than ${LATEST_BANK_VERSION}.`);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src", "data", "banks", LATEST_BANK_VERSION);
const destination = path.join(root, "src", "data", "banks", requestedVersion);

await mkdir(path.dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true, errorOnExist: true, force: false });

const indexPath = path.join(destination, "index.ts");
const indexSource = await readFile(indexPath, "utf8");
await writeFile(
  indexPath,
  indexSource.replace(`version: "${LATEST_BANK_VERSION}"`, `version: "${requestedVersion}"`),
);

const registryPath = path.join(root, "src", "data", "problemBank.ts");
let registry = await readFile(registryPath, "utf8");
registry = registry.replace(
  `LATEST_BANK_VERSION = "${LATEST_BANK_VERSION}"`,
  `LATEST_BANK_VERSION = "${requestedVersion}"`,
);
registry = registry.replace(
  `const bankLoaders: Record<string, () => Promise<ProblemBank>> = {`,
  `const bankLoaders: Record<string, () => Promise<ProblemBank>> = {\n  ${requestedVersion}: async () => (await import("./banks/${requestedVersion}")).problemBank,`,
);
await writeFile(registryPath, registry);

console.log(`Created immutable problem bank ${requestedVersion} from ${LATEST_BANK_VERSION}.`);
