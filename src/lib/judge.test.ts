import { describe, expect, it } from "vitest";
import { compareOutput, normalizeOutput } from "./judge";

describe("normalizeOutput", () => {
  it("normalizes Windows and old Mac newlines", () => {
    expect(normalizeOutput("one\r\ntwo\rthree\n")).toBe("one\ntwo\nthree");
  });

  it("ignores only trailing whitespace", () => {
    expect(normalizeOutput("  answer  \n\n")).toBe("  answer");
  });

  it("preserves meaningful internal whitespace", () => {
    expect(normalizeOutput("a  b\nc d")).toBe("a  b\nc d");
  });
});

describe("compareOutput", () => {
  it("accepts equivalent output with trailing newlines", () => {
    expect(compareOutput("42\n", "42").passed).toBe(true);
  });

  it("reports normalized values for a mismatch", () => {
    expect(compareOutput("41\n", "42\n")).toEqual({
      passed: false,
      actual: "41",
      expected: "42",
    });
  });
});
