import type {
  AvailabilityMap,
  DateMode,
  Participant,
  RoomCodeRecord,
  ScheduleEvent,
  UserEventSummary,
  UserProfile,
} from "@/types/schedule";

export type RepositoryErrorCode =
  | "AUTH_REQUIRED"
  | "ROOM_NOT_FOUND"
  | "INVALID_ROOM_CODE"
  | "ROOM_CODE_COLLISION"
  | "PARTICIPANT_NOT_FOUND"
  | "DUPLICATE_PARTICIPANT_NAME"
  | "INVALID_PIN"
  | "GOOGLE_ACCOUNT_MISMATCH"
  | "VALIDATION_ERROR";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}

export function buildParticipantPinSalt(eventId: string, participantId: string): string {
  return `${eventId}:${participantId}`;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  dateMode: DateMode;
  dates: string[];
  startHour: number;
  endHour: number;
  timezone: string;
  hostUid: string;
  hostName: string;
  rosterNames?: string[];
  /** Dipakai di pengujian deterministik untuk memverifikasi penanganan bentrok kode 6 digit. */
  roomCodeGenerator?: (attempt: number) => string;
}

export interface CreateEventResult {
  event: ScheduleEvent;
  roomCode: RoomCodeRecord;
  participants: Participant[];
}

export interface ClaimParticipantInput {
  eventId: string;
  participantId?: string;
  name?: string;
  googleUid?: string | null;
  pin?: string;
  newPin?: string;
  trustedDevice?: boolean;
  availabilities?: AvailabilityMap;
}

export interface UpdateAvailabilityInput {
  eventId: string;
  participantId: string;
  availabilities: AvailabilityMap;
  googleUid?: string | null;
  pin?: string;
  newPin?: string;
  trustedDevice?: boolean;
}

export interface VerifyParticipantAccessInput {
  eventId: string;
  participantId: string;
  googleUid?: string | null;
  pin?: string;
}

export interface EnsureUserProfileInput {
  uid: string;
  displayName: string;
  email: string;
}

export interface ScheduleRepository {
  createEvent(input: CreateEventInput): Promise<CreateEventResult>;
  resolveRoomCode(code: string): Promise<RoomCodeRecord | null>;
  getEventBySlug(slug: string): Promise<ScheduleEvent | null>;
  getEventById(eventId: string): Promise<ScheduleEvent | null>;
  listParticipants(eventId: string): Promise<Participant[]>;
  subscribeEventParticipants(
    eventId: string,
    onUpdate: (participants: Participant[]) => void,
    onError?: (error: Error) => void
  ): () => void;
  verifyParticipantAccess(input: VerifyParticipantAccessInput): Promise<boolean>;
  claimOrCreateParticipant(input: ClaimParticipantInput): Promise<Participant>;
  updateParticipantAvailability(input: UpdateAvailabilityInput): Promise<Participant>;
  ensureUserProfile(input: EnsureUserProfileInput): Promise<UserProfile>;
  getUserProfile(uid: string): Promise<UserProfile | null>;
  saveWeeklyRoutine(uid: string, weeklyRoutine: AvailabilityMap): Promise<UserProfile>;
  recordUserEventVisit(uid: string, summary: UserEventSummary): Promise<UserProfile>;
}
