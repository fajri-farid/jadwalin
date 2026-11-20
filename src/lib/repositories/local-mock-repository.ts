import { SLOT_INTERVAL_MIN } from "@/lib/engine/slots";
import type { StorageLike } from "@/lib/storage/room-sessions";
import {
  generateRoomCode,
  generateRoomSlug,
  isValidRoomCode,
  normalizeParticipantName,
} from "@/lib/utils/room-code";
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
import type {
  AvailabilityMap,
  Participant,
  RoomCodeRecord,
  ScheduleEvent,
  UserEventSummary,
  UserProfile,
} from "@/types/schedule";

export const LOCAL_MOCK_DB_STORAGE_KEY = "jadwalin:v1:local-mock-db";

type ParticipantsListener = (participants: Participant[]) => void;

interface MockDatabaseState {
  events: Record<string, ScheduleEvent>;
  roomCodes: Record<string, RoomCodeRecord>;
  participantsByEvent: Record<string, Record<string, Participant>>;
  userProfiles: Record<string, UserProfile>;
}

function createEmptyState(): MockDatabaseState {
  return {
    events: {},
    roomCodes: {},
    participantsByEvent: {},
    userProfiles: {},
  };
}

function cloneParticipant(participant: Participant): Participant {
  return {
    ...participant,
    availabilities: { ...participant.availabilities },
  };
}

function cloneEvent(event: ScheduleEvent): ScheduleEvent {
  return {
    ...event,
    dates: [...event.dates],
  };
}

function cloneUserProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    weeklyRoutine: { ...profile.weeklyRoutine },
    recentEventSlugs: profile.recentEventSlugs.map((item) => ({ ...item })),
  };
}

function resolveDefaultStorage(storage?: StorageLike | null): StorageLike | null {
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

export function clearLocalMockDatabase(storage?: StorageLike | null): void {
  const target = resolveDefaultStorage(storage);
  if (!target) return;
  try {
    target.removeItem(LOCAL_MOCK_DB_STORAGE_KEY);
  } catch {
    // Abaikan error akses storage
  }
}

export class LocalMockScheduleRepository implements ScheduleRepository {
  private readonly storage: StorageLike | null;
  private state: MockDatabaseState;
  private readonly listeners = new Map<string, Set<ParticipantsListener>>();

  constructor(options?: { storage?: StorageLike | null }) {
    this.storage = resolveDefaultStorage(options?.storage);
    this.state = this.loadState();
  }

  private loadState(): MockDatabaseState {
    if (!this.storage) {
      return createEmptyState();
    }

    try {
      const raw = this.storage.getItem(LOCAL_MOCK_DB_STORAGE_KEY);
      if (!raw) return createEmptyState();

      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return createEmptyState();
      }

      const candidate = parsed as Partial<MockDatabaseState>;
      return {
        events:
          candidate.events && typeof candidate.events === "object" ? { ...candidate.events } : {},
        roomCodes:
          candidate.roomCodes && typeof candidate.roomCodes === "object"
            ? { ...candidate.roomCodes }
            : {},
        participantsByEvent:
          candidate.participantsByEvent && typeof candidate.participantsByEvent === "object"
            ? { ...candidate.participantsByEvent }
            : {},
        userProfiles:
          candidate.userProfiles && typeof candidate.userProfiles === "object"
            ? { ...candidate.userProfiles }
            : {},
      };
    } catch {
      return createEmptyState();
    }
  }

  private syncFromStorage(): void {
    if (!this.storage) return;
    this.state = this.loadState();
  }

  private persistState(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(LOCAL_MOCK_DB_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Abaikan quota error pada storage mock lokal
    }
  }

  private getSortedParticipantsCopy(eventId: string): Participant[] {
    const map = this.state.participantsByEvent[eventId] ?? {};
    return sortParticipants(Object.values(map).map(cloneParticipant));
  }

  private notifyParticipants(eventId: string): void {
    const subs = this.listeners.get(eventId);
    if (!subs || subs.size === 0) return;

    const snapshot = this.getSortedParticipantsCopy(eventId);
    for (const listener of subs) {
      listener(snapshot.map(cloneParticipant));
    }
  }

  private allocateUniqueRoomCode(generator?: (attempt: number) => string): string {
    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
      const candidate = generator ? generator(attempt) : generateRoomCode();
      if (isValidRoomCode(candidate) && !(candidate in this.state.roomCodes)) {
        return candidate;
      }
    }

    throw new RepositoryError(
      "ROOM_CODE_COLLISION",
      "Gagal mengalokasikan kode room 6 digit yang unik. Silakan coba lagi."
    );
  }

  private allocateUniqueSlug(title: string): string {
    const existingSlugs = new Set(Object.values(this.state.events).map((event) => event.slug));
    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
      const candidate = generateRoomSlug(title);
      if (!existingSlugs.has(candidate)) {
        return candidate;
      }
    }
    return `${generateRoomSlug(title)}-${generateEntityId().slice(0, 4)}`;
  }

  async createEvent(input: CreateEventInput): Promise<CreateEventResult> {
    this.syncFromStorage();
    const normalized = validateCreateEventInput(input);
    const roomCodeValue = this.allocateUniqueRoomCode(input.roomCodeGenerator);
    const eventId = generateEntityId();
    const slug = this.allocateUniqueSlug(normalized.title);
    const now = Date.now();

    const event: ScheduleEvent = {
      id: eventId,
      slug,
      roomCode: roomCodeValue,
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
      code: roomCodeValue,
      eventId,
      slug,
      createdAt: now,
    };

    const participantsMap: Record<string, Participant> = {};
    for (const memberName of normalized.rosterNames) {
      const participantId = generateEntityId();
      participantsMap[participantId] = {
        id: participantId,
        eventId,
        name: memberName,
        normalizedName: normalizeParticipantName(memberName),
        status: "pending",
        authType: "roster",
        googleUid: null,
        pinHash: null,
        availabilities: {},
        updatedAt: now,
      };
    }

    this.state.events[eventId] = event;
    this.state.roomCodes[roomCodeValue] = roomCodeRecord;
    this.state.participantsByEvent[eventId] = participantsMap;

    if (normalized.hostUid) {
      await this.recordUserEventVisitInternal(normalized.hostUid, {
        eventId,
        slug,
        roomCode: roomCodeValue,
        title: normalized.title,
        role: "host",
        lastVisitedAt: now,
      });
    }

    this.persistState();
    this.notifyParticipants(eventId);

    return {
      event: cloneEvent(event),
      roomCode: { ...roomCodeRecord },
      participants: this.getSortedParticipantsCopy(eventId),
    };
  }

  async resolveRoomCode(code: string): Promise<RoomCodeRecord | null> {
    if (!isValidRoomCode(code)) {
      return null;
    }
    this.syncFromStorage();
    const record = this.state.roomCodes[code];
    return record ? { ...record } : null;
  }

  async getEventBySlug(slug: string): Promise<ScheduleEvent | null> {
    if (!slug.trim()) return null;
    this.syncFromStorage();
    const found = Object.values(this.state.events).find((event) => event.slug === slug.trim());
    return found ? cloneEvent(found) : null;
  }

  async getEventById(eventId: string): Promise<ScheduleEvent | null> {
    if (!eventId.trim()) return null;
    this.syncFromStorage();
    const found = this.state.events[eventId];
    return found ? cloneEvent(found) : null;
  }

  async listParticipants(eventId: string): Promise<Participant[]> {
    this.syncFromStorage();
    return this.getSortedParticipantsCopy(eventId);
  }

  subscribeEventParticipants(
    eventId: string,
    onUpdate: (participants: Participant[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      this.syncFromStorage();
      let set = this.listeners.get(eventId);
      if (!set) {
        set = new Set();
        this.listeners.set(eventId, set);
      }
      set.add(onUpdate);
      onUpdate(this.getSortedParticipantsCopy(eventId));
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return () => {
      const current = this.listeners.get(eventId);
      if (!current) return;
      current.delete(onUpdate);
      if (current.size === 0) {
        this.listeners.delete(eventId);
      }
    };
  }

  async verifyParticipantAccess(input: VerifyParticipantAccessInput): Promise<boolean> {
    this.syncFromStorage();
    const participant = this.state.participantsByEvent[input.eventId]?.[input.participantId];
    return checkParticipantAccess(participant, {
      eventId: input.eventId,
      googleUid: input.googleUid,
      pin: input.pin,
    });
  }

  async claimOrCreateParticipant(input: ClaimParticipantInput): Promise<Participant> {
    this.syncFromStorage();
    const event = this.state.events[input.eventId];
    if (!event) {
      throw new RepositoryError("ROOM_NOT_FOUND", "Room jadwal tidak ditemukan.");
    }

    const participantsMap = this.state.participantsByEvent[input.eventId] ?? {};
    this.state.participantsByEvent[input.eventId] = participantsMap;

    let savedParticipant: Participant;

    if (input.participantId) {
      const existing = participantsMap[input.participantId];
      if (!existing) {
        throw new RepositoryError(
          "PARTICIPANT_NOT_FOUND",
          "Peserta tidak ditemukan di daftar kelompok ini."
        );
      }

      savedParticipant = await prepareExistingParticipantUpdate(existing, event, {
        googleUid: input.googleUid,
        pin: input.pin,
        newPin: input.newPin,
        trustedDevice: input.trustedDevice,
        availabilities: input.availabilities,
      });
    } else {
      savedParticipant = await prepareNewWalkInParticipant(event, Object.values(participantsMap), {
        name: input.name,
        googleUid: input.googleUid,
        newPin: input.newPin,
        availabilities: input.availabilities,
      });
    }

    participantsMap[savedParticipant.id] = savedParticipant;
    this.persistState();
    this.notifyParticipants(event.id);
    return cloneParticipant(savedParticipant);
  }

  async updateParticipantAvailability(input: UpdateAvailabilityInput): Promise<Participant> {
    this.syncFromStorage();
    const event = this.state.events[input.eventId];
    if (!event) {
      throw new RepositoryError("ROOM_NOT_FOUND", "Room jadwal tidak ditemukan.");
    }

    const participantsMap = this.state.participantsByEvent[input.eventId] ?? {};
    const existing = participantsMap[input.participantId];
    if (!existing) {
      throw new RepositoryError(
        "PARTICIPANT_NOT_FOUND",
        "Peserta tidak ditemukan di daftar kelompok ini."
      );
    }

    const updated = await prepareExistingParticipantUpdate(existing, event, {
      googleUid: input.googleUid,
      pin: input.pin,
      newPin: input.newPin,
      trustedDevice: input.trustedDevice,
      availabilities: input.availabilities,
      forceFilled: true,
    });

    participantsMap[updated.id] = updated;
    this.persistState();
    this.notifyParticipants(event.id);
    return cloneParticipant(updated);
  }

  async ensureUserProfile(input: EnsureUserProfileInput): Promise<UserProfile> {
    if (!input.uid.trim()) {
      throw new RepositoryError("VALIDATION_ERROR", "UID pengguna tidak boleh kosong.");
    }
    this.syncFromStorage();
    const now = Date.now();
    const existing = this.state.userProfiles[input.uid];

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

    this.state.userProfiles[input.uid] = next;
    this.persistState();
    return cloneUserProfile(next);
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!uid.trim()) return null;
    this.syncFromStorage();
    const found = this.state.userProfiles[uid];
    return found ? cloneUserProfile(found) : null;
  }

  async saveWeeklyRoutine(uid: string, weeklyRoutine: AvailabilityMap): Promise<UserProfile> {
    if (!uid.trim()) {
      throw new RepositoryError("VALIDATION_ERROR", "UID pengguna tidak boleh kosong.");
    }
    this.syncFromStorage();
    const now = Date.now();
    const sanitized = sanitizeWeeklyRoutine(weeklyRoutine);
    const existing = this.state.userProfiles[uid];

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

    this.state.userProfiles[uid] = next;
    this.persistState();
    return cloneUserProfile(next);
  }

  private async recordUserEventVisitInternal(
    uid: string,
    summary: UserEventSummary
  ): Promise<UserProfile> {
    const now = Date.now();
    const existing = this.state.userProfiles[uid];
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

    this.state.userProfiles[uid] = next;
    return cloneUserProfile(next);
  }

  async recordUserEventVisit(uid: string, summary: UserEventSummary): Promise<UserProfile> {
    if (!uid.trim()) {
      throw new RepositoryError("VALIDATION_ERROR", "UID pengguna tidak boleh kosong.");
    }
    this.syncFromStorage();
    const saved = await this.recordUserEventVisitInternal(uid, summary);
    this.persistState();
    return saved;
  }
}

export function createLocalMockScheduleRepository(options?: {
  storage?: StorageLike | null;
}): LocalMockScheduleRepository {
  return new LocalMockScheduleRepository(options);
}
