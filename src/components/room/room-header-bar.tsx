"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  Link2,
  Loader2,
  Lock,
  LockOpen,
  Share2,
  UserCheck,
  Users,
} from "lucide-react";
import { formatColumnLabel, formatTimeRange } from "@/lib/engine/slots";
import { formatHourOption } from "@/lib/forms/room-form";
import type { RoomEffectiveStatus } from "@/lib/room/room-lifecycle";
import { formatRoomCodeDisplay } from "@/lib/utils/room-code";
import type { Participant, ScheduleEvent } from "@/types/schedule";

interface RoomHeaderBarProps {
  event: ScheduleEvent;
  participants: readonly Participant[];
  filledCount: number;
  activeParticipant: Participant | null;
  effectiveStatus: RoomEffectiveStatus;
  isHost: boolean;
  isUpdatingStatus: boolean;
  onCopyCode: () => void;
  onCopyLink: () => void;
  onOpenShareWa: () => void;
  onOpenIdentityPicker: () => void;
  onOpenSetPin: () => void;
  onOpenCloseRoom: () => void;
  onReopenRoom: () => void;
}

export function RoomHeaderBar({
  event,
  participants,
  filledCount,
  activeParticipant,
  effectiveStatus,
  isHost,
  isUpdatingStatus,
  onCopyCode,
  onCopyLink,
  onOpenShareWa,
  onOpenIdentityPicker,
  onOpenSetPin,
  onOpenCloseRoom,
  onReopenRoom,
}: RoomHeaderBarProps) {
  const totalCount = participants.length;
  const pendingCount = Math.max(0, totalCount - filledCount);
  const progressPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  const canAttachPin =
    !effectiveStatus.isClosed &&
    Boolean(activeParticipant) &&
    !activeParticipant?.googleUid &&
    !activeParticipant?.pinHash;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/gabung" className="wp-btn wp-btn-secondary !min-h-10 !px-3 !text-xs">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Gabung Room Lain</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {!effectiveStatus.isClosed ? (
            activeParticipant ? (
              <button
                type="button"
                onClick={onOpenIdentityPicker}
                className="wp-btn wp-btn-free !min-h-10 !px-3 !text-xs"
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                <span>{activeParticipant.name}</span>
                {activeParticipant.pinHash ? (
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                <span className="underline underline-offset-2">Ganti</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenIdentityPicker}
                className="wp-btn wp-btn-primary !min-h-10 !px-3.5 !text-xs"
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                <span>Pilih Namamu</span>
              </button>
            )
          ) : null}

          {canAttachPin ? (
            <button
              type="button"
              onClick={onOpenSetPin}
              className="wp-btn wp-btn-secondary !min-h-10 !px-3 !text-xs"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pasang PIN</span>
            </button>
          ) : null}

          {isHost && !effectiveStatus.isClosed ? (
            <button
              type="button"
              disabled={isUpdatingStatus}
              onClick={onOpenCloseRoom}
              className="wp-btn wp-btn-secondary !min-h-10 !px-3 !text-xs"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tutup Room</span>
            </button>
          ) : null}

          {isHost && effectiveStatus.isManualClosed ? (
            <button
              type="button"
              disabled={isUpdatingStatus}
              onClick={onReopenRoom}
              className="wp-btn wp-btn-soft !min-h-10 !px-3 !text-xs"
            >
              {isUpdatingStatus ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Buka Lagi</span>
            </button>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="room-title" className="wp-card grid gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
                Dibuat oleh {event.hostName}
              </span>

              {effectiveStatus.state === "open" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-status-free-border bg-status-free-bg px-2 py-0.5 text-[11px] font-bold text-status-free-text">
                  <span className="h-2 w-2 rounded-full bg-status-free" aria-hidden="true" />
                  <span>Aktif</span>
                </span>
              ) : effectiveStatus.hasAgreedSlot ? (
                <span className="inline-flex items-center gap-1 rounded-full border-2 border-border-ink bg-status-free px-2.5 py-0.5 text-[11px] font-extrabold text-status-free-text">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  <span>Jadwal Fix</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-border-ink bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-text-secondary">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  <span>{effectiveStatus.isAutoExpired ? "Selesai" : "Ditutup"}</span>
                </span>
              )}
            </div>

            <h1 id="room-title" className="text-2xl font-extrabold text-text-primary sm:text-3xl">
              {event.title}
            </h1>
            {event.description ? (
              <p className="text-sm text-text-secondary">{event.description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="wp-code-pill text-base sm:text-lg"
              aria-label={`Kode room ${event.roomCode}`}
            >
              <span>{formatRoomCodeDisplay(event.roomCode)}</span>
            </span>
            <button type="button" onClick={onCopyCode} className="wp-btn wp-btn-soft !min-h-11">
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>Salin Kode</span>
            </button>
            <button
              type="button"
              onClick={onCopyLink}
              className="wp-btn wp-btn-secondary !min-h-11"
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              <span>Salin Link</span>
            </button>
            <button type="button" onClick={onOpenShareWa} className="wp-btn wp-btn-free !min-h-11">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              <span>Draf WA</span>
            </button>
          </div>
        </div>

        {/* Banner Jadwal Final / Room Ditutup / Auto-Expired */}
        {effectiveStatus.isClosed ? (
          <div
            role="status"
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border-ink p-4 shadow-[3px_3px_0_var(--border-ink)] ${
              effectiveStatus.hasAgreedSlot
                ? "bg-status-free-bg text-status-free-text"
                : "bg-surface-muted text-text-primary"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-border-ink ${
                  effectiveStatus.hasAgreedSlot
                    ? "bg-status-free text-status-free-text"
                    : "bg-surface-card text-text-secondary"
                }`}
              >
                {effectiveStatus.hasAgreedSlot ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Lock className="h-5 w-5" />
                )}
              </span>

              <div className="grid gap-0.5">
                {effectiveStatus.hasAgreedSlot && event.agreedSlot ? (
                  <>
                    <span className="text-xs font-extrabold uppercase tracking-wider">
                      Jadwal Sudah Disepakati
                    </span>
                    <span className="font-mono text-base font-extrabold sm:text-lg">
                      {formatColumnLabel(event.dateMode, event.agreedSlot.columnKey, "long")} ·{" "}
                      {formatTimeRange(event.agreedSlot.startTime, event.agreedSlot.endTime)}
                    </span>
                  </>
                ) : effectiveStatus.isAutoExpired ? (
                  <>
                    <span className="text-sm font-extrabold">Room Selesai Otomatis</span>
                    <span className="text-xs font-medium text-text-secondary">
                      Semua tanggal pilihan sudah lewat. Hasil ketersediaan kelompok tersimpan
                      sebagai arsip.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-extrabold">Room Ditutup oleh Pembuat</span>
                    <span className="text-xs font-medium text-text-secondary">
                      Pengisian jadwal sudah dihentikan. Hasil grup tetap bisa dilihat dan
                      dibagikan.
                    </span>
                  </>
                )}
              </div>
            </div>

            {effectiveStatus.hasAgreedSlot ? (
              <button
                type="button"
                onClick={onOpenShareWa}
                className="wp-btn wp-btn-primary !min-h-10 !text-xs"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                <span>Bagikan Jadwal Fix</span>
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs font-semibold text-text-secondary">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-surface-muted px-3 py-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{event.dates.length} hari pilihan</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-surface-muted px-3 py-1 font-mono">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {formatHourOption(event.startHour)} – {formatHourOption(event.endHour)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-surface-muted px-3 py-1">
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{event.timezone}</span>
          </span>
        </div>

        {/* Bar Status Partisipasi: Sudah Isi vs Belum Isi */}
        <div className="wp-card-muted grid gap-3 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-text-primary">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Status Anggota</span>
            </span>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
              <span className="inline-flex items-center gap-1 rounded-full border border-status-free-border bg-status-free-bg px-2.5 py-0.5 text-status-free-text">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{filledCount} sudah isi</span>
              </span>
              {pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-status-tentative-border bg-status-tentative-bg px-2.5 py-0.5 text-status-tentative-text">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{pendingCount} belum</span>
                </span>
              ) : null}
            </div>
          </div>

          {totalCount > 0 ? (
            <>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full border-2 border-border-ink bg-surface-card"
                role="progressbar"
                aria-label="Progres pengisian anggota"
                aria-valuenow={filledCount}
                aria-valuemin={0}
                aria-valuemax={totalCount}
              >
                <div
                  className="h-full bg-status-free transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {participants.map((member) => {
                  const isFilled = member.status === "filled";
                  const isMe = activeParticipant?.id === member.id;
                  return (
                    <span
                      key={member.id}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border-2 px-3 text-xs font-bold ${
                        isFilled
                          ? isMe
                            ? "border-border-ink bg-status-free text-status-free-text shadow-[2px_2px_0_var(--border-ink)]"
                            : "border-border-ink bg-status-free-bg text-status-free-text"
                          : isMe
                            ? "border-border-ink bg-brand-soft text-brand-hover shadow-[2px_2px_0_var(--border-ink)]"
                            : "border-dashed border-border-ink bg-surface-card text-text-secondary"
                      }`}
                    >
                      {isFilled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <Clock
                          className="h-3.5 w-3.5 shrink-0 text-status-tentative-border"
                          aria-hidden="true"
                        />
                      )}
                      <span>{member.name}</span>
                      {member.pinHash ? (
                        <Lock className="h-3 w-3 opacity-75" aria-hidden="true" />
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs font-medium text-text-secondary">
              Belum ada anggota yang masuk. Pilih namamu atau bagikan kode room ke teman kelompok.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
