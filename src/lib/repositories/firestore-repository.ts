import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { SLOT_INTERVAL_MIN } from "@/lib/engine/slots";
import {
  RepositoryError,
  type ClaimParticipantInput,
  type CreateEventInput,
  type CreateEventResult,
  type EnsureUserProfileInput,
  type ScheduleRepository,
  type UpdateAvailabilityInput,
  type VerifyParticipantAccessInput,
} from "@/lib/repositories/types";
import {
  checkParticipantAccess,
  generateEntityId,
  MAX_ROOM_CODE_ATTEMPTS,
  prepareExistingParticipantUpdate,
  prepareNewWalkInParticipant,
  sanitizeWeeklyRoutine,
  sortParticipants,
  upsertRecentEvents,
  validateCreateEventInput,
} from "@/lib/repositories/validation";
import {
  generateRoomCode,
  generateRoomSlug,
  isValidRoomCode,
  normalizeParticipantName,
} from "@/lib/utils/room-code";
import type {
  AvailabilityMap,
  AvailabilityStatus,
  DateMode,
  Participant,
  ParticipantAuthType,
  ParticipantStatus,
  RoomCodeRecord,
  ScheduleEvent,
  UserEventSummary,
  UserProfile,
} from "@/types/schedule";

class RoomCodeConflictSignal extends Error {
  constructor() {
    super("ROOM_CODE_CONFLICT");
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asAvailabilityMap(value: unknown): AvailabilityMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: AvailabilityMap = {};
  for (const [key, val] of Object.entries(value)) {
    if (val === "free" || val === "tentative") {
      result[key] = val as AvailabilityStatus;
    }
  }
  return result;
}

function parseEventDoc(id: string, data: DocumentData): ScheduleEvent {
  const dateMode: DateMode = data.dateMode === "days_of_week" ? "days_of_week" : "specific_dates";
  return {
    id: asString(data.id, id),
    slug: asString(data.slug),
    roomCode: asString(data.roomCode),
    title: asString(data.title),
    description: asString(data.description),
    dateMode,
    dates: asStringArray(data.dates),
    startHour: asNumber(data.startHour, 8),
    endHour: asNumber(data.endHour, 22),
    slotIntervalMin: SLOT_INTERVAL_MIN,
    timezone: asString(data.timezone, "Asia/Jakarta"),
    hostUid: asNullableString(data.hostUid),
    hostName: asString(data.hostName),
    createdAt: asNumber(data.createdAt, 0),
  };
}

function parseRoomCodeDoc(code: string, data: DocumentData): RoomCodeRecord {
  return {
    code: asString(data.code, code),
    eventId: asString(data.eventId),
    slug: asString(data.slug),
    createdAt: asNumber(data.createdAt, 0),
  };
}

function parseParticipantDoc(id: string, eventId: string, data: DocumentData): Participant {
  const name = asString(data.name);
  const status: ParticipantStatus = data.status === "filled" ? "filled" : "pending";
  const authType: ParticipantAuthType =
    data.authType === "google" ? "google" : data.authType === "guest" ? "guest" : "roster";

  return {
    id: asString(data.id, id),
    eventId: asString(data.eventId, eventId),
    name,
    normalizedName: asString(data.normalizedName, normalizeParticipantName(name)),
    status,
    authType,
    googleUid: asNullableString(data.googleUid),
    pinHash: asNullableString(data.pinHash),
    availabilities: asAvailabilityMap(data.availabilities),
    updatedAt: asNumber(data.updatedAt, 0),
  };
}

function parseRecentEventSummaries(value: unknown): UserEventSummary[] {
  if (!Array.isArray(value)) return [];
  const items: UserEventSummary[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const eventId = asString(obj.eventId);
    const slug = asString(obj.slug);
    if (!eventId || !slug) continue;
    items.push({
      eventId,
      slug,
      roomCode: asString(obj.roomCode),
      title: asString(obj.title),
      role: obj.role === "host" ? "host" : "participant",
      lastVisitedAt: asNumber(obj.lastVisitedAt, 0),
    });
  }
  return items;
}

function parseUserProfileDoc(uid: string, data: DocumentData): UserProfile {
  return {
    uid: asString(data.uid, uid),
    displayName: asString(data.displayName),
    email: asString(data.email),
    weeklyRoutine: asAvailabilityMap(data.weeklyRoutine),
    recentEventSlugs: parseRecentEventSummaries(data.recentEventSlugs),
    updatedAt: asNumber(data.updatedAt, 0),
  };
}

export class FirestoreScheduleRepository implements ScheduleRepository {
  constructor(private readonly db: Firestore) {}

  async createEvent(input: CreateEventInput): Promise<CreateEventResult> {
    const normalized = validateCreateEventInput(input);
    const eventId = generateEntityId();
    const slug = generateRoomSlug(normalized.title);
    const now = Date.now();

    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
      const candidateCode = input.roomCodeGenerator
        ? input.roomCodeGenerator(attempt)
        : generateRoomCode();
      if (!isValidRoomCode(candidateCode)) {
        continue;
      }

      const event: ScheduleEvent = {
        id: eventId,
        slug,
        roomCode: candidateCode,
        title: normalized.title,
        description: normalized.description,
        dateMode: normalized.dateMode,
        dates: normalized.dates,
        startHour: normalized.startHour,
        endHour: normalized.endHour,
        slotIntervalMin: SLOT_INTERVAL_MIN,
        timezone: normalized.timezone,
        hostUid: normalized.hostUid,
        hostName: normalized.hostName,
        createdAt: now,
      };

      const roomCodeRecord: RoomCodeRecord = {
        code: candidateCode,
        eventId,
        slug,
        createdAt: now,
      };

      const participants: Participant[] = normalized.rosterNames.map((memberName) => ({
        id: generateEntityId(),
        eventId,
        name: memberName,
        normalizedName: normalizeParticipantName(memberName),
        status: "pending",
        authType: "roster",
        googleUid: null,
        pinHash: null,
        availabilities: {},
        updatedAt: now,
      }));

      try {
        await runTransaction(this.db, async (tx) => {
          const codeRef = doc(this.db, "roomCodes", candidateCode);
          const existingCodeSnap = await tx.get(codeRef);
          if (existingCodeSnap.exists()) {
            throw new RoomCodeConflictSignal();
          }

          tx.set(doc(this.db, "events", eventId), event);
          tx.set(codeRef, roomCodeRecord);
          for (const participant of participants) {
            tx.set(doc(this.db, "events", eventId, "participants", participant.id), participant);
          }
        });

        if (normalized.hostUid) {
          try {
            await this.recordUserEventVisit(normalized.hostUid, {
              eventId,
              slug,
              roomCode: candidateCode,
              title: normalized.title,
              role: "host",
              lastVisitedAt: now,
            });
          } catch {
            // Pembuatan room tetap dianggap berhasil meski riwayat profil gagal diperbarui
          }
        }

        return {
          event,
          roomCode: roomCodeRecord,
          participants: sortParticipants(participants),
        };
      } catch (error) {
        if (error instanceof RoomCodeConflictSignal) {
          continue;
        }
        throw error;
      }
    }

    throw new RepositoryError(
      "ROOM_CODE_COLLISION",
      "Gagal mengalokasikan kode room 6 digit yang unik. Silakan coba lagi."
    );
  }

  async resolveRoomCode(code: string): Promise<RoomCodeRecord | null> {
    if (!isValidRoomCode(code)) {
      return null;
    }

    const snap = await getDoc(doc(this.db, "roomCodes", code));
    if (!snap.exists()) return null;
    return parseRoomCodeDoc(snap.id, snap.data());
  }

  async getEventBySlug(slug: string): Promise<ScheduleEvent | null> {
    const trimmed = slug.trim();
    if (!trimmed) return null;

    const snap = await getDocs(
      query(collection(this.db, "events"), where("slug", "==", trimmed), limit(1))
    );
    const first = snap.docs[0];
    return first ? parseEventDoc(first.id, first.data()) : null;
  }

  async getEventById(eventId: string): Promise<ScheduleEvent | null> {
    const trimmed = eventId.trim();
    if (!trimmed) return null;

    const snap = await getDoc(doc(this.db, "events", trimmed));
    return snap.exists() ? parseEventDoc(snap.id, snap.data()) : null;
  }

  async listParticipants(eventId: string): Promise<Participant[]> {
    const snap = await getDocs(collection(this.db, "events", eventId, "participants"));
    const items = snap.docs.map((item) => parseParticipantDoc(item.id, eventId, item.data()));
    return sortParticipants(items);
  }

  subscribeEventParticipants(
    eventId: string,
    onUpdate: (participants: Participant[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const ref = collection(this.db, "events", eventId, "participants");
    return onSnapshot(
      ref,
      (snapshot) => {
        const items = snapshot.docs.map((item) =>
          parseParticipantDoc(item.id, eventId, item.data())
        );
        onUpdate(sortParticipants(items));
      },
      (error) => {
        if (onError) {
          onError(error);
        }
      }
    );
  }

  async verifyParticipantAccess(input: VerifyParticipantAccessInput): Promise<boolean> {
    const snap = await getDoc(
      doc(this.db, "events", input.eventId, "participants", input.participantId)
    );
    if (!snap.exists()) return false;

    const participant = parseParticipantDoc(snap.id, input.eventId, snap.data());
    return checkParticipantAccess(participant, {
      eventId: input.eventId,
      googleUid: input.googleUid,
      pin: input.pin,
    });
  }

  async claimOrCreateParticipant(input: ClaimParticipantInput): Promise<Participant> {
    if (input.participantId) {
      const targetId = input.participantId;
      return runTransaction(this.db, async (tx) => {
        const eventSnap = await tx.get(doc(this.db, "events", input.eventId));
        if (!eventSnap.exists()) {
          throw new RepositoryError("ROOM_NOT_FOUND", "Room jadwal tidak ditemukan.");
        }
        const event = parseEventDoc(eventSnap.id, eventSnap.data());

        const partRef = doc(this.db, "events", input.eventId, "participants", targetId);
        const partSnap = await tx.get(partRef);
        if (!partSnap.exists()) {
          throw new RepositoryError(
            "PARTICIPANT_NOT_FOUND",
            "Peserta tidak ditemukan di daftar kelompok ini."
          );
        }

        const existing = parseParticipantDoc(partSnap.id, input.eventId, partSnap.data());
        const nextParticipant = await prepareExistingParticipantUpdate(existing, event, {
          googleUid: input.googleUid,
          pin: input.pin,
          newPin: input.newPin,
          trustedDevice: input.trustedDevice,
          availabilities: input.availabilities,
        });

        tx.set(partRef, nextParticipant);
        return nextParticipant;
      });
    }

    const event = await this.getEventById(input.eventId);
    if (!event) {
      throw new RepositoryError("ROOM_NOT_FOUND", "Room jadwal tidak ditemukan.");
    }

    const normalizedName = normalizeParticipantName(input.name ?? "");
    const existingSnap = await getDocs(
      query(
        collection(this.db, "events", input.eventId, "participants"),
        where("normalizedName", "==", normalizedName),
        limit(1)
      )
    );
    const existingMatches = existingSnap.docs.map((item) =>
      parseParticipantDoc(item.id, input.eventId, item.data())
    );

    const created = await prepareNewWalkInParticipant(event, existingMatches, {
      name: input.name,
      googleUid: input.googleUid,
      newPin: input.newPin,
      availabilities: input.availabilities,
    });

    await setDoc(doc(this.db, "events", input.eventId, "participants", created.id), created);
    return created;
  }

  async updateParticipantAvailability(input: UpdateAvailabilityInput): Promise<Participant> {
    return runTransaction(this.db, async (tx) => {
      const eventSnap = await tx.get(doc(this.db, "events", input.eventId));
      if (!eventSnap.exists()) {
        throw new RepositoryError("ROOM_NOT_FOUND", "Room jadwal tidak ditemukan.");
      }
      const event = parseEventDoc(eventSnap.id, eventSnap.data());

      const partRef = doc(this.db, "events", input.eventId, "participants", input.participantId);
      const partSnap = await tx.get(partRef);
      if (!partSnap.exists()) {
        throw new RepositoryError(
          "PARTICIPANT_NOT_FOUND",
          "Peserta tidak ditemukan di daftar kelompok ini."
        );
      }

      const existing = parseParticipantDoc(partSnap.id, input.eventId, partSnap.data());
      const updated = await prepareExistingParticipantUpdate(existing, event, {
        googleUid: input.googleUid,
        pin: input.pin,
        newPin: input.newPin,
        trustedDevice: input.trustedDevice,
        availabilities: input.availabilities,
        forceFilled: true,
      });

      tx.set(partRef, updated);
      return updated;
    });
  }

  async ensureUserProfile(input: EnsureUserProfileInput): Promise<UserProfile> {
    if (!input.uid.trim()) {
      throw new RepositoryError("VALIDATION_ERROR", "UID pengguna tidak boleh kosong.");
    }

    const profileRef = doc(this.db, "userProfiles", input.uid);
    return runTransaction(this.db, async (tx) => {
      const snap = await tx.get(profileRef);
      const now = Date.now();
      const existing = snap.exists() ? parseUserProfileDoc(snap.id, snap.data()) : null;

      const next: UserProfile = existing
        ? {
            ...existing,
            displayName: input.displayName.trim() || existing.displayName,
            email: input.email.trim() || existing.email,
            updatedAt: now,
          }
        : {
            uid: input.uid,
            displayName: input.displayName.trim(),
            email: input.email.trim(),
            weeklyRoutine: {},
            recentEventSlugs: [],
            updatedAt: now,
          };

      tx.set(profileRef, next);
      return next;
    });
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!uid.trim()) return null;
    const snap = await getDoc(doc(this.db, "userProfiles", uid));
    return snap.exists() ? parseUserProfileDoc(snap.id, snap.data()) : null;
  }

  async saveWeeklyRoutine(uid: string, weeklyRoutine: AvailabilityMap): Promise<UserProfile> {
    if (!uid.trim()) {
      throw new RepositoryError("VALIDATION_ERROR", "UID pengguna tidak boleh kosong.");
    }

    const profileRef = doc(this.db, "userProfiles", uid);
    const sanitized = sanitizeWeeklyRoutine(weeklyRoutine);

    return runTransaction(this.db, async (tx) => {
      const snap = await tx.get(profileRef);
      const now = Date.now();
      const existing = snap.exists() ? parseUserProfileDoc(snap.id, snap.data()) : null;

      const next: UserProfile = existing
        ? {
            ...existing,
            weeklyRoutine: sanitized,
            updatedAt: now,
          }
        : {
            uid,
            displayName: "",
            email: "",
            weeklyRoutine: sanitized,
            recentEventSlugs: [],
            updatedAt: now,
          };

      tx.set(profileRef, next);
      return next;
    });
  }

  async recordUserEventVisit(uid: string, summary: UserEventSummary): Promise<UserProfile> {
    if (!uid.trim()) {
      throw new RepositoryError("VALIDATION_ERROR", "UID pengguna tidak boleh kosong.");
    }

    const profileRef = doc(this.db, "userProfiles", uid);
    return runTransaction(this.db, async (tx) => {
      const snap = await tx.get(profileRef);
      const now = Date.now();
      const existing = snap.exists() ? parseUserProfileDoc(snap.id, snap.data()) : null;

      const next: UserProfile = existing
        ? {
            ...existing,
            recentEventSlugs: upsertRecentEvents(existing.recentEventSlugs, summary),
            updatedAt: now,
          }
        : {
            uid,
            displayName: "",
            email: "",
            weeklyRoutine: {},
            recentEventSlugs: [summary],
            updatedAt: now,
          };

      tx.set(profileRef, next);
      return next;
    });
  }
}
