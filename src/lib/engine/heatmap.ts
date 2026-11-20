import {
  addMinutesToTime,
  buildTimeSlots,
  createSlotKey,
  normalizeColumns,
  SLOT_INTERVAL_MIN,
} from "@/lib/engine/slots";
import type {
  BestTimeWindow,
  HeatmapLevel,
  HeatmapSummary,
  Participant,
  SlotHeatmapCell,
  SlotScheduleConfig,
} from "@/types/schedule";

export const FREE_WEIGHT = 1.0;
export const TENTATIVE_WEIGHT = 0.6;

export interface BestTimeWindowOptions {
  limit?: number;
  minSlots?: number;
}

export function computeHeatLevel(
  rawScore: number,
  ratio: number,
  freeCount: number,
  filledCount: number
): HeatmapLevel {
  if (filledCount <= 0 || rawScore <= 0) return 0;
  if (ratio >= 0.999 && freeCount === filledCount) return 4;
  if (ratio >= 0.65) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

/**
 * Mengagregasi ketersediaan dua status ("free" = 1.0, "tentative" = 0.6) hanya dari peserta
 * berstatus "filled" sehingga anggota "pending" di Roster tidak mengencerkan persentase kecocokan.
 */
export function computeHeatmap(
  config: SlotScheduleConfig,
  participants: readonly Participant[]
): HeatmapSummary {
  const intervalMin = config.slotIntervalMin ?? SLOT_INTERVAL_MIN;
  const columns = normalizeColumns(config.dateMode, config.dates);
  const timeSlots = buildTimeSlots(config.startHour, config.endHour, intervalMin);

  const filledParticipants = participants.filter((participant) => participant.status === "filled");
  const pendingParticipants = participants.filter(
    (participant) => participant.status === "pending"
  );

  const filledCount = filledParticipants.length;
  const pendingCount = pendingParticipants.length;
  const cellsBySlotKey: Record<string, SlotHeatmapCell> = {};

  for (const columnKey of columns) {
    for (const time of timeSlots) {
      const slotKey = createSlotKey(config.dateMode, columnKey, time);
      const freeIds: string[] = [];
      const freeNames: string[] = [];
      const tentativeIds: string[] = [];
      const tentativeNames: string[] = [];
      const unavailableIds: string[] = [];
      const unavailableNames: string[] = [];

      for (const participant of filledParticipants) {
        const availability = participant.availabilities[slotKey];
        if (availability === "free") {
          freeIds.push(participant.id);
          freeNames.push(participant.name);
        } else if (availability === "tentative") {
          tentativeIds.push(participant.id);
          tentativeNames.push(participant.name);
        } else {
          unavailableIds.push(participant.id);
          unavailableNames.push(participant.name);
        }
      }

      const freeCount = freeIds.length;
      const tentativeCount = tentativeIds.length;
      const unavailableCount = unavailableIds.length;
      const rawScore = Number(
        (freeCount * FREE_WEIGHT + tentativeCount * TENTATIVE_WEIGHT).toFixed(4)
      );
      const ratio = filledCount > 0 ? Number((rawScore / filledCount).toFixed(4)) : 0;
      const heatLevel = computeHeatLevel(rawScore, ratio, freeCount, filledCount);

      cellsBySlotKey[slotKey] = {
        slotKey,
        columnKey,
        time,
        freeIds,
        freeNames,
        tentativeIds,
        tentativeNames,
        unavailableIds,
        unavailableNames,
        freeCount,
        tentativeCount,
        unavailableCount,
        rawScore,
        ratio,
        heatLevel,
        isTentativeOnly: freeCount === 0 && tentativeCount > 0,
      };
    }
  }

  return {
    cellsBySlotKey,
    columns,
    timeSlots,
    filledParticipantIds: filledParticipants.map((p) => p.id),
    filledParticipantNames: filledParticipants.map((p) => p.name),
    pendingParticipantIds: pendingParticipants.map((p) => p.id),
    pendingParticipantNames: pendingParticipants.map((p) => p.name),
    filledCount,
    pendingCount,
    totalParticipantsCount: participants.length,
  };
}

function getParticipantSignature(cell: SlotHeatmapCell): string {
  const sortedFree = [...cell.freeIds].sort().join(",");
  const sortedTentative = [...cell.tentativeIds].sort().join(",");
  return `${sortedFree}|${sortedTentative}`;
}

function finalizeWindowRun(
  run: SlotHeatmapCell[],
  intervalMin: number,
  filledCount: number,
  pendingNames: string[]
): BestTimeWindow {
  const first = run[0];
  const last = run[run.length - 1];
  const endTime = addMinutesToTime(last.time, intervalMin);
  const slotCount = run.length;

  return {
    id: `${first.columnKey}_${first.time}_${endTime}`,
    columnKey: first.columnKey,
    startTime: first.time,
    endTime,
    slotKeys: run.map((cell) => cell.slotKey),
    slotCount,
    durationMinutes: slotCount * intervalMin,
    freeCount: first.freeCount,
    tentativeCount: first.tentativeCount,
    unavailableCount: first.unavailableCount,
    freeNames: first.freeNames,
    tentativeNames: first.tentativeNames,
    unavailableNames: first.unavailableNames,
    pendingNames,
    rawScore: first.rawScore,
    ratio: first.ratio,
    isUnanimousFree: filledCount > 0 && first.freeCount === filledCount,
    isTentativeOnly: first.isTentativeOnly,
  };
}

function collectWindowsByMinSlots(
  config: SlotScheduleConfig,
  heatmap: HeatmapSummary,
  minSlots: number,
  intervalMin: number
): BestTimeWindow[] {
  const windows: BestTimeWindow[] = [];

  for (const columnKey of heatmap.columns) {
    let currentRun: SlotHeatmapCell[] = [];
    let currentSignature = "";

    const flush = () => {
      if (currentRun.length >= minSlots) {
        windows.push(
          finalizeWindowRun(
            currentRun,
            intervalMin,
            heatmap.filledCount,
            heatmap.pendingParticipantNames
          )
        );
      }
      currentRun = [];
      currentSignature = "";
    };

    for (const time of heatmap.timeSlots) {
      const slotKey = createSlotKey(config.dateMode, columnKey, time);
      const cell = heatmap.cellsBySlotKey[slotKey];
      if (!cell || cell.rawScore <= 0) {
        flush();
        continue;
      }

      const signature = getParticipantSignature(cell);
      if (currentRun.length > 0 && signature === currentSignature) {
        currentRun.push(cell);
      } else {
        flush();
        currentRun = [cell];
        currentSignature = signature;
      }
    }

    flush();
  }

  return windows;
}

/**
 * Mengekstrak daftar Top Rekomendasi jendela waktu berurutan dari hasil agregasi heatmap.
 * Memakai pengelompokan eksak (minSlots = 2 -> 60 menit) dengan fallback ke minSlots = 1 (30 menit).
 */
export function extractBestTimeWindows(
  config: SlotScheduleConfig,
  heatmap: HeatmapSummary,
  options?: BestTimeWindowOptions
): BestTimeWindow[] {
  if (heatmap.filledCount === 0) return [];

  const intervalMin = config.slotIntervalMin ?? SLOT_INTERVAL_MIN;
  const limit = options?.limit ?? 5;
  const requestedMinSlots = Math.max(1, options?.minSlots ?? 2);

  let windows = collectWindowsByMinSlots(config, heatmap, requestedMinSlots, intervalMin);
  if (windows.length === 0 && requestedMinSlots > 1) {
    windows = collectWindowsByMinSlots(config, heatmap, 1, intervalMin);
  }

  const columnOrder = new Map(heatmap.columns.map((col, idx) => [col, idx]));

  windows.sort((a, b) => {
    if (b.freeCount !== a.freeCount) return b.freeCount - a.freeCount;

    const totalB = b.freeCount + b.tentativeCount;
    const totalA = a.freeCount + a.tentativeCount;
    if (totalB !== totalA) return totalB - totalA;

    if (b.slotCount !== a.slotCount) return b.slotCount - a.slotCount;

    const colDiff = (columnOrder.get(a.columnKey) ?? 0) - (columnOrder.get(b.columnKey) ?? 0);
    if (colDiff !== 0) return colDiff;

    return a.startTime.localeCompare(b.startTime);
  });

  return windows.slice(0, Math.max(0, limit));
}

export function computeBestTimeWindows(
  config: SlotScheduleConfig,
  participants: readonly Participant[],
  options?: BestTimeWindowOptions
): { heatmap: HeatmapSummary; bestWindows: BestTimeWindow[] } {
  const heatmap = computeHeatmap(config, participants);
  const bestWindows = extractBestTimeWindows(config, heatmap, options);
  return { heatmap, bestWindows };
}
