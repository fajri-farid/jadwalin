export const ROOM_SESSIONS_STORAGE_KEY = "jadwalin:v1:room-sessions";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface RoomSessionRecord {
  participantId: string;
  participantName: string;
  deviceToken: string;
  updatedAt: number;
}

export interface SaveRoomSessionInput {
  participantId: string;
  participantName: string;
  deviceToken?: string;
}

function getBrowserStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function generateDeviceToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRoomSessionRecord(value: unknown): value is RoomSessionRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.participantId === "string" &&
    candidate.participantId.length > 0 &&
    typeof candidate.participantName === "string" &&
    candidate.participantName.length > 0 &&
    typeof candidate.deviceToken === "string" &&
    candidate.deviceToken.length > 0 &&
    typeof candidate.updatedAt === "number" &&
    Number.isFinite(candidate.updatedAt)
  );
}

export function listRoomSessions(storage?: StorageLike | null): Record<string, RoomSessionRecord> {
  const target = getBrowserStorage(storage);
  if (!target) return {};

  try {
    const raw = target.getItem(ROOM_SESSIONS_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const sessions: Record<string, RoomSessionRecord> = {};
    for (const [eventId, record] of Object.entries(parsed)) {
      if (isRoomSessionRecord(record)) {
        sessions[eventId] = {
          participantId: record.participantId,
          participantName: record.participantName,
          deviceToken: record.deviceToken,
          updatedAt: record.updatedAt,
        };
      }
    }
    return sessions;
  } catch {
    return {};
  }
}

export function getRoomSession(
  eventId: string,
  storage?: StorageLike | null
): RoomSessionRecord | null {
  if (!eventId) return null;
  const sessions = listRoomSessions(storage);
  return sessions[eventId] ?? null;
}

/**
 * Menyimpan identitas sesi peserta pada perangkat tanpa pernah menyimpan PIN atau token sensitif.
 */
export function saveRoomSession(
  eventId: string,
  input: SaveRoomSessionInput,
  storage?: StorageLike | null
): RoomSessionRecord | null {
  const participantId = input.participantId.trim();
  const participantName = input.participantName.trim();
  if (!eventId || !participantId || !participantName) {
    return null;
  }

  const target = getBrowserStorage(storage);
  if (!target) return null;

  const existingAll = listRoomSessions(target);
  const existing = existingAll[eventId];
  const preservedToken =
    existing && existing.participantId === participantId ? existing.deviceToken : undefined;

  const record: RoomSessionRecord = {
    participantId,
    participantName,
    deviceToken: input.deviceToken?.trim() || preservedToken || generateDeviceToken(),
    updatedAt: Date.now(),
  };

  existingAll[eventId] = record;

  try {
    target.setItem(ROOM_SESSIONS_STORAGE_KEY, JSON.stringify(existingAll));
    return record;
  } catch {
    return null;
  }
}

export function clearRoomSession(eventId: string, storage?: StorageLike | null): void {
  if (!eventId) return;
  const target = getBrowserStorage(storage);
  if (!target) return;

  const sessions = listRoomSessions(target);
  if (!(eventId in sessions)) return;

  delete sessions[eventId];

  try {
    if (Object.keys(sessions).length === 0) {
      target.removeItem(ROOM_SESSIONS_STORAGE_KEY);
    } else {
      target.setItem(ROOM_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    }
  } catch {
    // Abaikan kegagalan penulisan storage (mis. private browsing quota)
  }
}
