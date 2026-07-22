export const VERIFIED_TICKET_HEADER = "X-Col-Verified-Relay-Ticket";

/** Removes ticket-bearing query data before PartyServer persists request.url. */
export function forwardVerifiedSocketRequest(request: Request, ticket: string): Request {
  const url = new URL(request.url);
  url.searchParams.delete("ticket");
  const headers = new Headers(request.headers);
  // The router overwrites any client-supplied value only after verifying the
  // query ticket. PartyServer persists the sanitized URL, not this header.
  headers.set(VERIFIED_TICKET_HEADER, ticket);
  return new Request(url.toString(), {
    method: request.method,
    headers,
    redirect: request.redirect,
    signal: request.signal,
  });
}
