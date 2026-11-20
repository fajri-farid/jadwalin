export type AvailabilityStatus = "free" | "tentative";

export type PaintBrushMode = AvailabilityStatus | "erase";

export type DateMode = "specific_dates" | "days_of_week";

export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export type ParticipantStatus = "pending" | "filled";

export type ParticipantAuthType = "roster" | "guest" | "google";

/**
 * Peta slotKey ("YYYY-MM-DDTHH:mm" atau "DAY-HH:mm") ke status ketersediaan peserta.
 * Slot yang tidak tercatat di peta berarti belum tersedia / belum ditandai.
 */
export type AvailabilityMap = Record<string, AvailabilityStatus>;

export interface SlotScheduleConfig {
  dateMode: DateMode;
  dates: string[];
  startHour: number;
  endHour: number;
  slotIntervalMin?: number;
}

export interface ScheduleEvent extends SlotScheduleConfig {
  id: string;
  slug: string;
  roomCode: string;
  title: string;
  description: string;
  slotIntervalMin: 30;
  timezone: string;
  hostUid: string | null;
  hostName: string;
  createdAt: number;
}

export interface RoomCodeRecord {
  code: string;
  eventId: string;
  slug: string;
  createdAt: number;
}

export interface Participant {
  id: string;
  eventId: string;
  name: string;
  normalizedName: string;
  status: ParticipantStatus;
  authType: ParticipantAuthType;
  googleUid: string | null;
  pinHash: string | null;
  availabilities: AvailabilityMap;
  updatedAt: number;
}

export interface UserEventSummary {
  eventId: string;
  slug: string;
  roomCode: string;
  title: string;
  role: "host" | "participant";
  lastVisitedAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  weeklyRoutine: AvailabilityMap;
  recentEventSlugs: UserEventSummary[];
  updatedAt: number;
}

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export interface SlotHeatmapCell {
  slotKey: string;
  columnKey: string;
  time: string;
  freeIds: string[];
  freeNames: string[];
  tentativeIds: string[];
  tentativeNames: string[];
  unavailableIds: string[];
  unavailableNames: string[];
  freeCount: number;
  tentativeCount: number;
  unavailableCount: number;
  rawScore: number;
  ratio: number;
  heatLevel: HeatmapLevel;
  isTentativeOnly: boolean;
}

export interface HeatmapSummary {
  cellsBySlotKey: Record<string, SlotHeatmapCell>;
  columns: string[];
  timeSlots: string[];
  filledParticipantIds: string[];
  filledParticipantNames: string[];
  pendingParticipantIds: string[];
  pendingParticipantNames: string[];
  filledCount: number;
  pendingCount: number;
  totalParticipantsCount: number;
}

export interface BestTimeWindow {
  id: string;
  columnKey: string;
  startTime: string;
  endTime: string;
  slotKeys: string[];
  slotCount: number;
  durationMinutes: number;
  freeCount: number;
  tentativeCount: number;
  unavailableCount: number;
  freeNames: string[];
  tentativeNames: string[];
  unavailableNames: string[];
  pendingNames: string[];
  rawScore: number;
  ratio: number;
  isUnanimousFree: boolean;
  isTentativeOnly: boolean;
}
