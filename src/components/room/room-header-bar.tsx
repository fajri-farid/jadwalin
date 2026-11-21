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
  Lock,
  UserCheck,
  Users,
} from "lucide-react";
import { formatHourOption } from "@/lib/forms/room-form";
import { formatRoomCodeDisplay } from "@/lib/utils/room-code";
import type { Participant, ScheduleEvent } from "@/types/schedule";

interface RoomHeaderBarProps {
  event: ScheduleEvent;
  participants: readonly Participant[];
  filledCount: number;
  activeParticipant: Participant | null;
  onCopyCode: () => void;
  onCopyLink: () => void;
  onOpenIdentityPicker: () => void;
  onOpenSetPin: () => void;
}

export function RoomHeaderBar({
  event,
  participants,
  filledCount,
  activeParticipant,
  onCopyCode,
  onCopyLink,
  onOpenIdentityPicker,
  onOpenSetPin,
}: RoomHeaderBarProps) {
  const totalCount = participants.length;
  const pendingCount = Math.max(0, totalCount - filledCount);
  const progressPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  const canAttachPin =
    Boolean(activeParticipant) && !activeParticipant?.googleUid && !activeParticipant?.pinHash;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/gabung" className="wp-btn wp-btn-secondary !min-h-10 !px-3 !text-xs">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Gabung Room Lain</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {activeParticipant ? (
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
          )}

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
        </div>
      </div>

      <section aria-labelledby="room-title" className="wp-card grid gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-1">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
              Dibuat oleh {event.hostName}
            </span>
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
          </div>
        </div>

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
