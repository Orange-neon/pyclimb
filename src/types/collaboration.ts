export const COLLABORATION_SCHEMA_VERSION = 1 as const;
export const MAX_COLLABORATION_MEMBERS = 30;

export interface CollaborationRoomMeta {
  creatorUid: string;
  roomInstanceId: string;
  schemaVersion: typeof COLLABORATION_SCHEMA_VERSION;
  status: "open";
  createdAt: number;
  leaseExpiresAt: number;
}

export interface CollaborationMember {
  uid: string;
  nickname: string;
  joinedAt: number;
  slot: string;
}

export interface CollaborationRoomSession {
  kind: "collaboration";
  code: string;
  uid: string;
  nickname: string;
  roomInstanceId: string;
  memberSlot: string;
}

export interface CollaborationRoomRecord {
  meta: CollaborationRoomMeta;
  members: Record<string, CollaborationMember>;
  memberSlots: Record<string, string>;
}
