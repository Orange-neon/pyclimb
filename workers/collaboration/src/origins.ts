export function parseAllowedOrigins(value: string): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const candidate of value.split(",")) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      // Ignore malformed configuration entries instead of weakening checks.
    }
  }
  return origins;
}

export function isAllowedOrigin(origin: string | null, configuredOrigins: string): origin is string {
  if (!origin || origin === "null") return false;
  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    return false;
  }
  return parseAllowedOrigins(configuredOrigins).has(normalized);
}

export function corsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
}
