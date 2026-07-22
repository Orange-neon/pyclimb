import type { RelayTicketPayload } from "./protocol";

/** Minimal verified capability retained in a hibernating socket attachment. */
export type RelayConnectionTicket = Pick<
  RelayTicketPayload,
  "uid" | "nickname" | "channel" | "expiresAt"
>;

export function compactConnectionTicket(ticket: RelayTicketPayload): RelayConnectionTicket {
  return {
    uid: ticket.uid,
    nickname: ticket.nickname,
    channel: ticket.channel,
    expiresAt: ticket.expiresAt,
  };
}
