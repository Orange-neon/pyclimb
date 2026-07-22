import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["workers/collaboration/src/**/*.test.ts"],
  },
});
