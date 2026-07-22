import { describe, expect, it } from "vitest";

import { shouldResetEphemeralDocument } from "./room-lifecycle";

describe("ephemeral room lifecycle", () => {
  it("resets only after the final authenticated sync transport leaves", () => {
    expect(shouldResetEphemeralDocument("sync", [])).toBe(true);
    expect(shouldResetEphemeralDocument("sync", ["control", "control"])).toBe(true);
    expect(shouldResetEphemeralDocument("sync", ["control", "sync"])).toBe(false);
  });

  it("does not reset when a control-only transport disconnects", () => {
    expect(shouldResetEphemeralDocument("control", [])).toBe(false);
    expect(shouldResetEphemeralDocument("control", ["sync"])).toBe(false);
    expect(shouldResetEphemeralDocument(undefined, [])).toBe(false);
  });
});
