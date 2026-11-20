import {
  DAYS_OF_WEEK_ORDER,
  filterAvailabilitiesToEvent,
  normalizeColumns,
  SLOT_INTERVAL_MIN,
} from "@/lib/engine/slots";
import { isValidPin, hashParticipantPin, verifyParticipantPin } from "@/lib/security/pin";
import { normalizeParticipantName } from "@/lib/utils/room-code";
import {
  buildParticipantPinSalt,
  RepositoryError,
  type CreateEventInput,
} from "@/lib/repositories/types";
import type {
  AvailabilityMap,
  Participant,
  ScheduleEvent,
  UserEventSummary,
} from "@/types/schedule";

export const MAX_RECENT_EVENTS = 30;
export const MAX_ROOM_CODE_ATTEMPTS = 10;

export interface NormalizedCreateEventInput {
  title: string;
  description: string;
  dateMode: CreateEventInput["dateMode"];
  dates: string[];
  startHour: number;
  endHour: number;
  timezone: string;
  hostUid: string | null;
  hostName: string;
  rosterNames: string[];
}

export function normalizeRosterNames(rawNames: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawName of rawNames) {
    const trimmed = rawName.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    if (trimmed.length > 50) {
      throw new RepositoryError(
        "VALIDATION_ERROR",
        `Nama anggota roster "${trimmed.slice(0, 20)}..." melebihi 50 karakter.`
      );
    }

    const normalized = normalizeParticipantName(trimmed);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(trimmed);

    if (result.length > 60) {
      throw new RepositoryError("VALIDATION_ERROR", "Jumlah anggota roster maksimal 60 orang.");
    }
  }

  return result;
}

export function validateParticipantDisplayName(rawName: string | undefined): {
  name: string;
  normalizedName: string;
} {
  const trimmed = (rawName ?? "").trim().replace(/\s+/g, " ");
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw new RepositoryError(
      "VALIDATION_ERROR",
      "Nama peserta harus berisi 1 hingga 50 karakter."
    );
  }
  return {
    name: trimmed,
    normalizedName: normalizeParticipantName(trimmed),
  };
}

export function validateCreateEventInput(input: CreateEventInput): NormalizedCreateEventInput {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (title.length < 3 || title.length > 100) {
    throw new RepositoryError(
      "VALIDATION_ERROR",
      "Judul jadwal harus terdiri dari 3 hingga 100 karakter."
    );
  }

  const description = (input.description ?? "").trim();
  if (description.length > 300) {
    throw new RepositoryError("VALIDATION_ERROR", "Catatan jadwal maksimal 300 karakter.");
  }

  const hostName = input.hostName.trim().replace(/\s+/g, " ");
  if (hostName.length < 1 || hostName.length > 50) {
    throw new RepositoryError(
      "VALIDATION_ERROR",
      "Nama pembuat jadwal harus berisi 1 hingga 50 karakter."
    );
  }

  if (
    !Number.isInteger(input.startHour) ||
    !Number.isInteger(input.endHour) ||
    input.startHour < 0 ||
    input.startHour > 23 ||
    input.endHour < 1 ||
    input.endHour > 24 ||
    input.endHour <= input.startHour
  ) {
    throw new RepositoryError(
      "VALIDATION_ERROR",
      "Rentang jam room tidak valid (startHour 0..23, endHour 1..24, endHour > startHour)."
    );
  }

  const normalizedDates = normalizeColumns(input.dateMode, input.dates);
  if (normalizedDates.length === 0 || normalizedDates.length > 31) {
    throw new RepositoryError(
      "VALIDATION_ERROR",
      "Pilih 1 hingga 31 tanggal atau hari yang valid."
    );
  }

  const timezone = input.timezone.trim() || "Asia/Jakarta";
  const hostUid = input.hostUid ? input.hostUid.trim() || null : null;
  const rosterNames = normalizeRosterNames(input.rosterNames);

  return {
    title,
    description,
    dateMode: input.dateMode,
    dates: normalizedDates,
    startHour: input.startHour,
    endHour: input.endHour,
    timezone,
    hostUid,
    hostName,
    rosterNames,
  };
}

export function sanitizeWeeklyRoutine(weeklyRoutine: AvailabilityMap): AvailabilityMap {
  return filterAvailabilitiesToEvent(weeklyRoutine, {
    dateMode: "days_of_week",
    dates: [...DAYS_OF_WEEK_ORDER],
    startHour: 0,
    endHour: 24,
    slotIntervalMin: SLOT_INTERVAL_MIN,
  });
}

export function upsertRecentEvents(
  existing: readonly UserEventSummary[],
  summary: UserEventSummary,
  maxItems = MAX_RECENT_EVENTS
): UserEventSummary[] {
  const filtered = existing.filter((item) => item.eventId !== summary.eventId);
  return [summary, ...filtered]
    .sort((a, b) => b.lastVisitedAt - a.lastVisitedAt)
    .slice(0, maxItems);
}

export function sortParticipants(participants: readonly Participant[]): Participant[] {
  return [...participants].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "id", { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

export function generateEntityId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function assertParticipantAccess(
  participant: Participant,
  options: {
    eventId: string;
    googleUid?: string | null;
    pin?: string;
    trustedDevice?: boolean;
  }
): Promise<void> {
  if (participant.googleUid) {
    if (!options.googleUid || options.googleUid !== participant.googleUid) {
      throw new RepositoryError(
        "GOOGLE_ACCOUNT_MISMATCH",
        "Jadwal peserta ini terikat ke akun Google pemiliknya."
      );
    }
    return;
  }

  if (participant.pinHash && !options.trustedDevice) {
    if (!options.pin || !isValidPin(options.pin)) {
      throw new RepositoryError(
        "INVALID_PIN",
        "Masukkan PIN 4 digit yang benar untuk mengubah jadwal ini."
      );
    }

    const salt = buildParticipantPinSalt(options.eventId, participant.id);
    const valid = await verifyParticipantPin(options.pin, salt, participant.pinHash);
    if (!valid) {
      throw new RepositoryError(
        "INVALID_PIN",
        "PIN 4 digit tidak cocok. Periksa kembali PIN peserta."
      );
    }
  }
}

export function validateOptionalNewPin(newPin: string | undefined): string | undefined {
  if (newPin === undefined || newPin === "") return undefined;
  if (!isValidPin(newPin)) {
    throw new RepositoryError("INVALID_PIN", "PIN baru harus terdiri dari tepat 4 digit angka.");
  }
  return newPin;
}

export async function checkParticipantAccess(
  participant: Participant | null | undefined,
  options: {
    eventId: string;
    googleUid?: string | null;
    pin?: string;
  }
): Promise<boolean> {
  if (!participant) return false;
  if (participant.googleUid) {
    return Boolean(options.googleUid && options.googleUid === participant.googleUid);
  }
  if (participant.pinHash) {
    if (!options.pin || !isValidPin(options.pin)) return false;
    const salt = buildParticipantPinSalt(options.eventId, participant.id);
    return verifyParticipantPin(options.pin, salt, participant.pinHash);
  }
  return true;
}

export async function prepareExistingParticipantUpdate(
  existing: Participant,
  event: ScheduleEvent,
  options: {
    googleUid?: string | null;
    pin?: string;
    newPin?: string;
    trustedDevice?: boolean;
    availabilities?: AvailabilityMap;
    forceFilled?: boolean;
  }
): Promise<Participant> {
  await assertParticipantAccess(existing, {
    eventId: event.id,
    googleUid: options.googleUid,
    pin: options.pin,
    trustedDevice: options.trustedDevice,
  });

  const validNewPin = validateOptionalNewPin(options.newPin);
  let pinHash = existing.pinHash;
  if (!pinHash && validNewPin) {
    pinHash = await hashParticipantPin(validNewPin, buildParticipantPinSalt(event.id, existing.id));
  }

  const nextGoogleUid = existing.googleUid ?? (options.googleUid?.trim() || null);
  const nextAuthType = nextGoogleUid
    ? "google"
    : existing.authType === "roster"
      ? "guest"
      : existing.authType;

  const nextAvailabilities =
    options.availabilities !== undefined
      ? filterAvailabilitiesToEvent(options.availabilities, event)
      : { ...existing.availabilities };

  const nextStatus =
    options.forceFilled || options.availabilities !== undefined || existing.status === "filled"
      ? "filled"
      : "pending";

  return {
    ...existing,
    status: nextStatus,
    authType: nextAuthType,
    googleUid: nextGoogleUid,
    pinHash,
    availabilities: nextAvailabilities,
    updatedAt: Date.now(),
  };
}

export async function prepareNewWalkInParticipant(
  event: ScheduleEvent,
  existingParticipants: readonly Participant[],
  options: {
    name?: string;
    googleUid?: string | null;
    newPin?: string;
    availabilities?: AvailabilityMap;
  }
): Promise<Participant> {
  const { name, normalizedName } = validateParticipantDisplayName(options.name);
  const duplicate = existingParticipants.some(
    (participant) => participant.normalizedName === normalizedName
  );
  if (duplicate) {
    throw new RepositoryError(
      "DUPLICATE_PARTICIPANT_NAME",
      `Nama "${name}" sudah ada di daftar kelompok. Pilih nama tersebut dari daftar Roster.`
    );
  }

  const participantId = generateEntityId();
  const validNewPin = validateOptionalNewPin(options.newPin);
  const pinHash = validNewPin
    ? await hashParticipantPin(validNewPin, buildParticipantPinSalt(event.id, participantId))
    : null;

  const googleUid = options.googleUid?.trim() || null;
  const availabilities =
    options.availabilities !== undefined
      ? filterAvailabilitiesToEvent(options.availabilities, event)
      : {};

  return {
    id: participantId,
    eventId: event.id,
    name,
    normalizedName,
    status: options.availabilities !== undefined ? "filled" : "pending",
    authType: googleUid ? "google" : "guest",
    googleUid,
    pinHash,
    availabilities,
    updatedAt: Date.now(),
  };
}
