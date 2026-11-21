import { formatColumnLabel, formatDurationIndonesian, formatTimeRange } from "@/lib/engine/slots";
import { filterQualifiedBestWindows } from "@/lib/room/grid-interaction";
import { formatRoomCodeDisplay } from "@/lib/utils/room-code";
import type { BestTimeWindow, HeatmapSummary, ScheduleEvent } from "@/types/schedule";

export interface BuildWhatsAppDraftInput {
  event: ScheduleEvent;
  heatmap: HeatmapSummary;
  bestWindows: readonly BestTimeWindow[];
  roomUrl: string;
  maxRecommendations?: number;
  includePendingReminder?: boolean;
}

/**
 * Menghasilkan draf pengumuman grup WhatsApp secara deterministik (non-AI) dengan gaya santai:
 * 1. Kondisi belum fix: mengajak teman mengisi atau memilih dari opsi terbaik (>= 50% sepakat).
 * 2. Kondisi sudah dikunci: sounding hasil jadwal final yang sudah disepakati.
 */
export function buildWhatsAppDraft(input: BuildWhatsAppDraftInput): string {
  const {
    event,
    heatmap,
    bestWindows,
    roomUrl,
    maxRecommendations = 3,
    includePendingReminder = true,
  } = input;

  const totalMembers = Math.max(heatmap.totalParticipantsCount, heatmap.filledCount);
  const formattedCode = formatRoomCodeDisplay(event.roomCode);
  const cleanUrl = roomUrl.trim();
  const cleanDescription = event.description.trim();
  const lines: string[] = [];

  // Kondisi 2: Room sudah dikunci dengan jadwal kesepakatan (Sounding Jadwal Fix)
  if (event.status === "closed" && event.agreedSlot) {
    const agreedDay = formatColumnLabel(event.dateMode, event.agreedSlot.columnKey, "long");
    const agreedRange = formatTimeRange(event.agreedSlot.startTime, event.agreedSlot.endTime);

    lines.push(`Halo semuanya! Jadwal *${event.title}* sudah fix ya:`);
    lines.push("");
    lines.push(`*${agreedDay} · ${agreedRange}*`);
    if (cleanDescription) {
      lines.push(`Catatan: ${cleanDescription}`);
    }
    lines.push("");
    lines.push("Jangan lupa catat waktunya, sampai ketemu!");
    if (cleanUrl) {
      lines.push(`Detail lengkap: ${cleanUrl}`);
    }
    return lines.join("\n");
  }

  // Kondisi 2b: Room ditutup tanpa mengunci satu jam tertentu (Arsip)
  if (event.status === "closed") {
    lines.push(`Halo semuanya! Pengisian jadwal untuk *${event.title}* sudah ditutup ya.`);
    if (totalMembers > 0) {
      lines.push(`Total respon terkumpul: ${heatmap.filledCount}/${totalMembers} orang.`);
    }
    if (cleanUrl) {
      lines.push("");
      lines.push(`Rekap hasil lengkapnya bisa dilihat di sini: ${cleanUrl}`);
    }
    return lines.join("\n");
  }

  // Kondisi 1: Room aktif — mengajak teman mengisi / memilih opsi terbaik
  const qualifiedWindows = filterQualifiedBestWindows(bestWindows, totalMembers);

  if (heatmap.filledCount === 0) {
    lines.push(`Halo teman-teman! Yuk isi waktu luang kalian untuk *${event.title}*`);
    if (cleanDescription) {
      lines.push(`(${cleanDescription})`);
    }
    lines.push("biar kita cepat dapat jadwal yang paling cocok buat semuanya.");

    if (includePendingReminder && heatmap.pendingParticipantNames.length > 0) {
      lines.push("");
      lines.push(`Yang ditunggu isiannya: ${heatmap.pendingParticipantNames.join(", ")}`);
    }
  } else if (qualifiedWindows.length === 0) {
    lines.push(
      `Halo teman-teman! Update *${event.title}* (${heatmap.filledCount}/${totalMembers} sudah isi):`
    );
    lines.push("");
    lines.push("Belum ada irisan jam kosong yang pas bareng-bareng.");
    lines.push('Boleh bantu tambahin opsi "Diusahakan (50:50)" biar kita punya cadangan waktu ya!');

    if (includePendingReminder && heatmap.pendingParticipantNames.length > 0) {
      lines.push("");
      lines.push(
        `Yang belum isi (${heatmap.pendingParticipantNames.length}): ${heatmap.pendingParticipantNames.join(", ")}`
      );
    }
  } else {
    const limit = Math.max(1, maxRecommendations);
    const picked = qualifiedWindows.slice(0, limit);
    const allFilled = totalMembers > 0 && heatmap.pendingParticipantNames.length === 0;

    if (allFilled) {
      lines.push(
        `Halo semuanya! Semua sudah isi jadwal *${event.title}* (${heatmap.filledCount}/${totalMembers}).`
      );
      lines.push(
        picked.length === 1
          ? "Ini waktu yang paling pas buat kita:"
          : "Ini pilihan waktu terbaik buat kita, pilih yang mana nih?"
      );
    } else {
      lines.push(
        `Halo teman-teman! Update sementara *${event.title}* (${heatmap.filledCount}/${totalMembers} sudah isi).`
      );
      lines.push(
        picked.length === 1
          ? "Sementara waktu yang paling cocok:"
          : "Sementara ini pilihan waktu yang paling cocok:"
      );
    }

    lines.push("");
    picked.forEach((win, idx) => {
      const dayLabel = formatColumnLabel(event.dateMode, win.columnKey, "short");
      const timeRange = formatTimeRange(win.startTime, win.endTime);
      const duration = formatDurationIndonesian(win.durationMinutes);
      const isAllFree =
        totalMembers >= 2 && win.pendingNames.length === 0 && win.freeCount === totalMembers;

      lines.push(`${idx + 1}. *${dayLabel}, ${timeRange}* (${duration})`);

      if (isAllFree) {
        lines.push(
          `   - Semua bisa (${win.freeCount}/${totalMembers}): ${win.freeNames.join(", ")}`
        );
      } else if (win.freeNames.length > 0) {
        lines.push(`   - Bisa (${win.freeCount}/${totalMembers}): ${win.freeNames.join(", ")}`);
      }

      if (win.tentativeNames.length > 0) {
        lines.push(
          `   - Diusahakan 50:50 (${win.tentativeCount}): ${win.tentativeNames.join(", ")}`
        );
      }
    });

    if (includePendingReminder && heatmap.pendingParticipantNames.length > 0) {
      lines.push("");
      lines.push(
        `Yang belum isi (${heatmap.pendingParticipantNames.length}): ${heatmap.pendingParticipantNames.join(", ")} — yuk isi juga biar waktunya cepat fix!`
      );
    }
  }

  lines.push("");
  lines.push(`Kode Room: *${formattedCode}*`);
  if (cleanUrl) {
    lines.push(`Link: ${cleanUrl}`);
  }

  return lines.join("\n");
}
