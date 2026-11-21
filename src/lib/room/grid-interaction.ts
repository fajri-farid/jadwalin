import { computeHeatLevel } from "@/lib/engine/heatmap";
import type { AuthUser } from "@/lib/firebase/auth";
import type { RoomSessionRecord } from "@/lib/storage/room-sessions";
import type {
  AvailabilityMap,
  BestTimeWindow,
  HeatmapLevel,
  PaintBrushMode,
  Participant,
} from "@/types/schedule";

export interface AvailabilityStats {
  freeCount: number;
  tentativeCount: number;
  totalMarked: number;
}

export interface TeammateSlotHint {
  freeNames: string[];
  tentativeNames: string[];
  freeCount: number;
  tentativeCount: number;
  totalCount: number;
}

export interface TeammateHintsSummary {
  othersFilledCount: number;
  othersFilledNames: string[];
  hintsBySlotKey: Record<string, TeammateSlotHint>;
}

export interface AutoSessionResolution {
  participant: Participant;
  trustedDevice: boolean;
  viaGoogle: boolean;
}

/**
 * Menerapkan kuas ("free" | "tentative" | "erase") pada satu slotKey secara imutabel.
 * Mengembalikan referensi peta yang sama bila tidak ada perubahan untuk menghindari render ulang.
 */
export function applyPaintToSlot(
  current: AvailabilityMap,
  slotKey: string,
  brush: PaintBrushMode
): AvailabilityMap {
  if (brush === "erase") {
    if (!(slotKey in current)) return current;
    const next = { ...current };
    delete next[slotKey];
    return next;
  }

  if (current[slotKey] === brush) {
    return current;
  }

  return {
    ...current,
    [slotKey]: brush,
  };
}

/**
 * Menerapkan kuas pada banyak slotKey sekaligus (mis. saat drag-paint di grid).
 */
export function applyPaintBatch(
  current: AvailabilityMap,
  slotKeys: readonly string[],
  brush: PaintBrushMode
): AvailabilityMap {
  let changed = false;
  let next: AvailabilityMap | null = null;

  for (const slotKey of slotKeys) {
    const source = next ?? current;
    if (brush === "erase") {
      if (slotKey in source) {
        if (!next) next = { ...current };
        delete next[slotKey];
        changed = true;
      }
    } else if (source[slotKey] !== brush) {
      if (!next) next = { ...current };
      next[slotKey] = brush;
      changed = true;
    }
  }

  return changed && next ? next : current;
}

/**
 * Menentukan kuas efektif saat satu ketukan (tap) atau awal drag:
 * bila sel target sudah memakai status kuas yang sama, tap tunggal menghapusnya (toggle ergonomis).
 */
export function resolveStrokeBrush(
  current: AvailabilityMap,
  slotKey: string,
  activeBrush: PaintBrushMode
): PaintBrushMode {
  if (activeBrush === "erase") return "erase";
  return current[slotKey] === activeBrush ? "erase" : activeBrush;
}

/** Membandingkan dua AvailabilityMap secara deterministik untuk mendeteksi perubahan belum disimpan. */
export function areAvailabilityMapsEqual(a: AvailabilityMap, b: AvailabilityMap): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function countAvailabilityStats(availabilities: AvailabilityMap): AvailabilityStats {
  let freeCount = 0;
  let tentativeCount = 0;

  for (const status of Object.values(availabilities)) {
    if (status === "free") {
      freeCount += 1;
    } else if (status === "tentative") {
      tentativeCount += 1;
    }
  }

  return {
    freeCount,
    tentativeCount,
    totalMarked: freeCount + tentativeCount,
  };
}

/**
 * Mengumpulkan petunjuk pilihan slot milik teman lain (selain peserta aktif)
 * untuk ditampilkan secara real-time pada tab "Isi Jadwalku".
 */
export function computeTeammateSlotHints(
  participants: readonly Participant[],
  activeParticipantId: string | null
): TeammateHintsSummary {
  const others = participants.filter(
    (participant) => participant.status === "filled" && participant.id !== activeParticipantId
  );

  const hintsBySlotKey: Record<string, TeammateSlotHint> = {};

  for (const teammate of others) {
    for (const [slotKey, status] of Object.entries(teammate.availabilities)) {
      if (status !== "free" && status !== "tentative") continue;
      let entry = hintsBySlotKey[slotKey];
      if (!entry) {
        entry = {
          freeNames: [],
          tentativeNames: [],
          freeCount: 0,
          tentativeCount: 0,
          totalCount: 0,
        };
        hintsBySlotKey[slotKey] = entry;
      }

      if (status === "free") {
        entry.freeNames.push(teammate.name);
        entry.freeCount += 1;
      } else {
        entry.tentativeNames.push(teammate.name);
        entry.tentativeCount += 1;
      }
      entry.totalCount += 1;
    }
  }

  return {
    othersFilledCount: others.length,
    othersFilledNames: others.map((member) => member.name),
    hintsBySlotKey,
  };
}

/**
 * Menghitung level intensitas visual heatmap berdasarkan total anggota room (1/n)
 * agar 1 dari 3 anggota tidak tampak penuh 100% hijau gelap sebelum anggota lain mengisi.
 */
export function computeDisplayHeatLevel(
  rawScore: number,
  freeCount: number,
  totalParticipantsCount: number
): HeatmapLevel {
  if (totalParticipantsCount <= 0 || rawScore <= 0) return 0;
  const ratio = Number((rawScore / totalParticipantsCount).toFixed(4));
  return computeHeatLevel(rawScore, ratio, freeCount, totalParticipantsCount);
}

/**
 * Menyaring daftar rekomendasi agar masuk akal bagi kelompok:
 * - Opsi #1 (terbaik) selalu dipertahankan selama ada minimal 1 slot cocok.
 * - Opsi alternatif (#2, #3, dst.) hanya ditampilkan jika minimal 50% anggota bisa/diusahakan
 *   dan melibatkan minimal 2 orang (agar tidak menyarankan jam solo 1 orang sebagai opsi tambahan).
 */
export function filterQualifiedBestWindows(
  bestWindows: readonly BestTimeWindow[],
  totalParticipantsCount: number
): BestTimeWindow[] {
  if (bestWindows.length === 0) return [];

  const denominator = Math.max(totalParticipantsCount, 1);
  const qualified: BestTimeWindow[] = [bestWindows[0]];

  for (let i = 1; i < bestWindows.length; i += 1) {
    const candidate = bestWindows[i];
    const attending = candidate.freeCount + candidate.tentativeCount;
    const meetsMajority = attending / denominator >= 0.5;
    const meetsGroupMinimum = denominator >= 2 ? attending >= 2 : attending >= 1;

    if (meetsMajority && meetsGroupMinimum) {
      qualified.push(candidate);
    }
  }

  return qualified;
}

/**
 * Mengenali peserta aktif secara otomatis saat membuka /r/[slug]:
 * 1. Utamakan peserta yang sudah terikat ke akun Google aktif.
 * 2. Jika tidak ada, cocokkan sesi perangkat (`deviceToken`) yang masih sah dan tidak terikat akun Google lain.
 */
export function resolveAutoSessionParticipant(options: {
  participants: readonly Participant[];
  authUser: AuthUser | null;
  savedSession: RoomSessionRecord | null;
}): AutoSessionResolution | null {
  const { participants, authUser, savedSession } = options;

  if (authUser) {
    const googleMatch = participants.find((item) => item.googleUid === authUser.uid);
    if (googleMatch) {
      return {
        participant: googleMatch,
        trustedDevice: true,
        viaGoogle: true,
      };
    }
  }

  if (savedSession) {
    const sessionMatch = participants.find((item) => item.id === savedSession.participantId);
    if (sessionMatch) {
      if (sessionMatch.googleUid && sessionMatch.googleUid !== authUser?.uid) {
        return null;
      }
      return {
        participant: sessionMatch,
        trustedDevice: true,
        viaGoogle: Boolean(sessionMatch.googleUid && sessionMatch.googleUid === authUser?.uid),
      };
    }
  }

  return null;
}

/**
 * Menemukan kandidat fokus 2D berdasarkan geometri visual aktual (getBoundingClientRect)
 * sesuai panduan Spatial Navigation (edge-based test + preferensi overlap sumbu tegak lurus).
 */
export type SpatialDirection = "up" | "down" | "left" | "right";

export interface SpatialCandidateRect {
  id: string;
  rect: Pick<DOMRect, "top" | "bottom" | "left" | "right" | "width" | "height">;
}

export function pickSpatialNavigationTarget(
  current: SpatialCandidateRect,
  candidates: readonly SpatialCandidateRect[],
  direction: SpatialDirection,
  tolerance = 2
): string | null {
  const curr = current.rect;
  const currCenterX = curr.left + curr.width / 2;
  const currCenterY = curr.top + curr.height / 2;

  let bestAlignedId: string | null = null;
  let bestAlignedGap = Number.POSITIVE_INFINITY;
  let bestAlignedOffset = Number.POSITIVE_INFINITY;

  let bestFallbackId: string | null = null;
  let bestFallbackScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate.id === current.id) continue;
    const r = candidate.rect;
    if (r.width <= 0 || r.height <= 0) continue;

    let gap = -1;
    let overlapsPerp = false;
    let perpOffset = 0;

    if (direction === "right") {
      if (r.left < curr.right - tolerance) continue;
      gap = Math.max(0, r.left - curr.right);
      overlapsPerp = r.bottom > curr.top + tolerance && r.top < curr.bottom - tolerance;
      perpOffset = Math.abs(r.top + r.height / 2 - currCenterY);
    } else if (direction === "left") {
      if (r.right > curr.left + tolerance) continue;
      gap = Math.max(0, curr.left - r.right);
      overlapsPerp = r.bottom > curr.top + tolerance && r.top < curr.bottom - tolerance;
      perpOffset = Math.abs(r.top + r.height / 2 - currCenterY);
    } else if (direction === "down") {
      if (r.top < curr.bottom - tolerance) continue;
      gap = Math.max(0, r.top - curr.bottom);
      overlapsPerp = r.right > curr.left + tolerance && r.left < curr.right - tolerance;
      perpOffset = Math.abs(r.left + r.width / 2 - currCenterX);
    } else {
      if (r.bottom > curr.top + tolerance) continue;
      gap = Math.max(0, curr.top - r.bottom);
      overlapsPerp = r.right > curr.left + tolerance && r.left < curr.right - tolerance;
      perpOffset = Math.abs(r.left + r.width / 2 - currCenterX);
    }

    if (overlapsPerp) {
      if (
        gap < bestAlignedGap - 0.5 ||
        (Math.abs(gap - bestAlignedGap) <= 0.5 && perpOffset < bestAlignedOffset)
      ) {
        bestAlignedId = candidate.id;
        bestAlignedGap = gap;
        bestAlignedOffset = perpOffset;
      }
    } else {
      const score = gap + 2.5 * perpOffset;
      if (score < bestFallbackScore) {
        bestFallbackScore = score;
        bestFallbackId = candidate.id;
      }
    }
  }

  return bestAlignedId ?? bestFallbackId;
}
