import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 30_000,
    include: ["tests/firebase/**/*.emulator.ts"],
    testTimeout: 30_000,
  },
});
