import { describe, expect, it } from "vitest";

import { isAllowedOrigin, parseAllowedOrigins } from "./origins";

describe("relay origin policy", () => {
  it("uses exact normalized origins", () => {
    const configured = "http://localhost:5173, https://example.github.io/path";
    expect(parseAllowedOrigins(configured)).toEqual(
      new Set(["http://localhost:5173", "https://example.github.io"]),
    );
    expect(isAllowedOrigin("https://example.github.io", configured)).toBe(true);
    expect(isAllowedOrigin("https://evil.example.github.io", configured)).toBe(false);
    expect(isAllowedOrigin("null", configured)).toBe(false);
  });
});
