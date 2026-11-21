"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Clock,
  Copy,
  Globe,
  KeyRound,
  Link2,
  Users,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { formatColumnLabel } from "@/lib/engine/slots";
import { formatHourOption } from "@/lib/forms/room-form";
import { getScheduleRepository } from "@/lib/repositories/schedule-repository";
import { formatRoomCodeDisplay } from "@/lib/utils/room-code";
import type { Participant, ScheduleEvent } from "@/types/schedule";

interface RoomReceiptPreviewProps {
  slug: string;
}

export function RoomReceiptPreview({ slug }: RoomReceiptPreviewProps) {
  const { showToast } = useToast();
  const [event, setEvent] = useState<ScheduleEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const repo = getScheduleRepository();

    void (async () => {
      try {
        const foundEvent = await repo.getEventBySlug(slug);
        if (!active) return;

        setEvent(foundEvent);
        if (foundEvent) {
          const list = await repo.listParticipants(foundEvent.id);
          if (active) setParticipants(list);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  const copyRoomCode = async (roomCode: string) => {
    try {
      await navigator.clipboard.writeText(roomCode);
      showToast({
        title: "Kode Disalin",
        message: `Kode ${formatRoomCodeDisplay(roomCode)} siap dibagikan ke grup.`,
        variant: "success",
      });
    } catch {
      showToast({
        title: "Kode Room",
        message: `Bagikan kode ${formatRoomCodeDisplay(roomCode)} ke temanmu.`,
        variant: "info",
      });
    }
  };

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast({
        title: "Link Room Disalin",
        message: "Tinggal tempel di grup WhatsApp untuk undang temanmu.",
        variant: "success",
      });
    } catch {
      showToast({
        title: "Salin Link",
        message: "Salin alamat halaman dari bilah browser kamu.",
        variant: "info",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-8 sm:px-6">
        <div className="wp-card h-44 animate-pulse bg-surface-card p-6" />
        <div className="wp-card h-36 animate-pulse bg-surface-card p-6" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto grid w-full max-w-xl gap-5 px-4 py-10 sm:px-6">
        <section className="wp-card grid gap-4 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border-2 border-border-ink bg-status-tentative-bg text-status-tentative-text">
            <KeyRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold text-text-primary">Room Tidak Ditemukan</h1>
          <p className="mx-auto text-sm text-text-secondary">
            Periksa kembali link undangan atau masukkan ulang 6 angka kode room dari temanmu.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/gabung" className="wp-btn wp-btn-primary">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>Masukkan Kode 6 Digit</span>
            </Link>
            <Link href="/buat" className="wp-btn wp-btn-secondary">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              <span>Buat Room Baru</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="wp-btn wp-btn-secondary !min-h-10 !px-3 !text-xs">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Kembali</span>
        </Link>
      </div>

      <section aria-labelledby="room-title" className="wp-card grid gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1.5">
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
            <span className="wp-code-pill text-lg">
              <span>{formatRoomCodeDisplay(event.roomCode)}</span>
            </span>
            <button
              type="button"
              onClick={() => copyRoomCode(event.roomCode)}
              className="wp-btn wp-btn-soft"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>Salin Kode</span>
            </button>
            <button type="button" onClick={copyRoomLink} className="wp-btn wp-btn-secondary">
              <Link2 className="h-4 w-4" aria-hidden="true" />
              <span>Salin Link</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs font-semibold text-text-secondary">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-surface-muted px-3 py-1.5">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            <span>{event.dates.length} hari pilihan</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-surface-muted px-3 py-1.5 font-mono">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>
              {formatHourOption(event.startHour)} – {formatHourOption(event.endHour)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-surface-muted px-3 py-1.5">
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>{event.timezone}</span>
          </span>
        </div>

        <div className="grid gap-2">
          <h2 className="text-sm font-bold text-text-primary">Daftar Hari / Tanggal</h2>
          <div className="flex flex-wrap gap-2">
            {event.dates.map((col) => (
              <span
                key={col}
                className="inline-flex min-h-9 items-center rounded-lg border-2 border-border-ink bg-surface-canvas px-3 font-mono text-xs font-bold text-text-primary"
              >
                {formatColumnLabel(event.dateMode, col, "short")}
              </span>
            ))}
          </div>
        </div>

        <div className="wp-card-muted grid gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-text-primary">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Anggota Kelompok</span>
            </span>
            <span className="font-mono text-xs font-bold text-text-muted">
              {participants.length} terdaftar
            </span>
          </div>

          {participants.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {participants.map((member) => (
                <span
                  key={member.id}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-dashed border-border-ink bg-surface-card px-3 text-sm font-semibold text-text-secondary"
                >
                  <Clock className="h-3.5 w-3.5 text-status-tentative-text" aria-hidden="true" />
                  <span>{member.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Belum ada daftar anggota awal. Temanmu tetap bisa mengetik namanya sendiri saat
              bergabung.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
