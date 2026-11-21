"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, RotateCcw, Share2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { buildWhatsAppDraft } from "@/lib/engine/whatsapp-draft";
import type { BestTimeWindow, HeatmapSummary, ScheduleEvent } from "@/types/schedule";

interface ShareWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ScheduleEvent;
  heatmap: HeatmapSummary;
  bestWindows: readonly BestTimeWindow[];
}

function isPointerOutsideDialog(event: PointerEvent, dialog: HTMLDialogElement): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

/**
 * Modal `<dialog>` generator Draf Pengumuman WhatsApp deterministik
 * dengan textarea `field-sizing: content` dan tombol salin berbasis Invoker Commands + fallback.
 */
export function ShareWhatsAppModal({
  open,
  onOpenChange,
  event,
  heatmap,
  bestWindows,
}: ShareWhatsAppModalProps) {
  const { showToast } = useToast();
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `wa-title-${safeId}`;
  const textareaId = `wa-draft-${safeId}`;

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const copyBtnRef = useRef<HTMLButtonElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const lastAnnouncedRef = useRef("");
  const feedbackTimerRef = useRef<number | null>(null);

  const [maxRecommendations, setMaxRecommendations] = useState<1 | 3>(3);
  const [includePendingReminder, setIncludePendingReminder] = useState(true);
  const [customDraft, setCustomDraft] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const [roomUrl, setRoomUrl] = useState("");

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const generatedDraft = useMemo(
    () =>
      buildWhatsAppDraft({
        event,
        heatmap,
        bestWindows,
        roomUrl: roomUrl || `/r/${event.slug}`,
        maxRecommendations,
        includePendingReminder,
      }),
    [event, heatmap, bestWindows, roomUrl, maxRecommendations, includePendingReminder]
  );

  const draftText = customDraft ?? generatedDraft;

  const triggerCopyFeedback = useCallback(
    (ok: boolean) => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }

      setCopyState(ok ? "copied" : "failed");
      let message = ok ? "Draf disalin" : "Gagal menyalin";
      if (message === lastAnnouncedRef.current) {
        message += "\u00A0";
      }
      lastAnnouncedRef.current = message;
      setStatusAnnouncement(message);

      if (ok) {
        showToast({
          title: "Draf WA Disalin",
          message: "Tinggal tempel dan kirim ke grup WhatsApp kalian.",
          variant: "success",
        });
      } else {
        showToast({
          title: "Belum Bisa Menyalin",
          message: "Pilih teks di kotak draf lalu salin secara manual.",
          variant: "warning",
        });
      }

      feedbackTimerRef.current = window.setTimeout(() => {
        setCopyState("idle");
        setStatusAnnouncement("");
        feedbackTimerRef.current = null;
      }, 2200);
    },
    [showToast]
  );

  const performCopyFromTarget = useCallback(
    async (target: HTMLElement | null) => {
      const text =
        target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement
          ? target.value
          : draftText;
      if (!text.trim()) return;

      try {
        await navigator.clipboard.writeText(text);
        triggerCopyFeedback(true);
      } catch {
        triggerCopyFeedback(false);
      }
    },
    [draftText, triggerCopyFeedback]
  );

  // Sinkronkan showModal() / close() dan tangkap URL aktif saat modal dibuka
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      queueMicrotask(() => {
        setRoomUrl(window.location.href);
      });
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close("");
    }
  }, [open]);

  // Listener close + fallback light-dismiss untuk browser tanpa closedBy
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      setCustomDraft(null);
      setCopyState("idle");
      setStatusAnnouncement("");
      onOpenChangeRef.current(false);
    };

    dialog.addEventListener("close", handleClose);

    let cleanupBackdrop: (() => void) | undefined;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;

      const handlePointerDown = (event: PointerEvent) => {
        pressedOutside = isPointerOutsideDialog(event, dialog);
      };

      const handlePointerUp = (event: PointerEvent) => {
        if (pressedOutside && isPointerOutsideDialog(event, dialog)) {
          dialog.close("");
        }
        pressedOutside = false;
      };

      dialog.addEventListener("pointerdown", handlePointerDown);
      dialog.addEventListener("pointerup", handlePointerUp);
      cleanupBackdrop = () => {
        dialog.removeEventListener("pointerdown", handlePointerDown);
        dialog.removeEventListener("pointerup", handlePointerUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupBackdrop?.();
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  // Invoker Commands (`command="--copy"`) dengan fallback click hanya bila CommandEvent tidak tersedia
  useEffect(() => {
    const supportsCommands = "CommandEvent" in window;

    if (supportsCommands) {
      const handleCommand = (event: Event) => {
        const cmdEvent = event as Event & { command?: string; source?: Element | null };
        if (cmdEvent.command !== "--copy") return;
        if (cmdEvent.source !== copyBtnRef.current) return;
        void performCopyFromTarget(event.target as HTMLElement | null);
      };

      document.addEventListener("command", handleCommand, true);
      return () => {
        document.removeEventListener("command", handleCommand, true);
      };
    }

    const button = copyBtnRef.current;
    if (!button) return;

    const handleFallbackClick = () => {
      const targetId = button.getAttribute("commandfor");
      const target = targetId ? document.getElementById(targetId) : null;
      void performCopyFromTarget(target);
    };

    button.addEventListener("click", handleFallbackClick);
    return () => {
      button.removeEventListener("click", handleFallbackClick);
    };
  }, [performCopyFromTarget]);

  const isRoomClosed = event.status === "closed";
  const isFixedAnnouncement = isRoomClosed && Boolean(event.agreedSlot);
  const hasPending = !isRoomClosed && heatmap.pendingParticipantNames.length > 0;
  const showRecommendationToggle = !isRoomClosed && bestWindows.length > 1;
  const waShareHref = `https://wa.me/?text=${encodeURIComponent(draftText)}`;

  return (
    <dialog
      ref={dialogRef}
      className="wp-dialog !w-[min(94vw,36rem)]"
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="dialog-sheet-handle" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-border-ink bg-status-free-bg text-status-free-text shadow-[2px_2px_0_var(--border-ink)]"
          >
            <Share2 className="h-5 w-5" />
          </span>
          <div className="grid gap-0.5">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
              {isFixedAnnouncement
                ? "Jadwal Sudah Fix"
                : isRoomClosed
                  ? "Room Ditutup"
                  : "Bagikan ke Grup"}
            </span>
            <h2 id={titleId} className="text-lg font-extrabold text-text-primary">
              {isFixedAnnouncement
                ? "Pengumuman Jadwal Final"
                : isRoomClosed
                  ? "Bagikan Rekap Hasil"
                  : "Draf Pengumuman WhatsApp"}
            </h2>
          </div>
        </div>

        <button
          type="button"
          className="wp-btn wp-btn-secondary !px-2.5"
          aria-label="Tutup draf WhatsApp"
          onClick={() => dialogRef.current?.close("")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Opsi Ringkas Isi Draf (hanya tampil saat room masih aktif) */}
      {showRecommendationToggle || hasPending ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showRecommendationToggle ? (
            <div
              role="group"
              aria-label="Jumlah rekomendasi waktu"
              className="inline-flex gap-1 rounded-xl border-2 border-border-ink bg-surface-muted p-1"
            >
              <button
                type="button"
                aria-pressed={maxRecommendations === 3}
                onClick={() => {
                  setMaxRecommendations(3);
                  setCustomDraft(null);
                }}
                className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${
                  maxRecommendations === 3
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:bg-surface-card"
                }`}
              >
                Top 3 Opsi
              </button>
              <button
                type="button"
                aria-pressed={maxRecommendations === 1}
                onClick={() => {
                  setMaxRecommendations(1);
                  setCustomDraft(null);
                }}
                className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${
                  maxRecommendations === 1
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:bg-surface-card"
                }`}
              >
                1 Jam Terbaik
              </button>
            </div>
          ) : null}

          {hasPending ? (
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs font-bold text-text-secondary">
              <input
                type="checkbox"
                checked={includePendingReminder}
                onChange={(event) => {
                  setIncludePendingReminder(event.target.checked);
                  setCustomDraft(null);
                }}
                className="h-4 w-4 accent-brand"
              />
              <span>Tag yang belum isi ({heatmap.pendingParticipantNames.length})</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {/* Kotak Teks Draf (field-sizing: content) */}
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={textareaId} className="text-xs font-bold text-text-secondary">
            Pratinjau Pesan (bisa langsung diedit)
          </label>
          {customDraft !== null ? (
            <button
              type="button"
              onClick={() => setCustomDraft(null)}
              className="inline-flex min-h-8 items-center gap-1 text-xs font-bold text-brand-hover hover:underline"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Reset draf</span>
            </button>
          ) : null}
        </div>

        <textarea
          id={textareaId}
          value={draftText}
          onChange={(event) => setCustomDraft(event.target.value)}
          className="wp-wa-textarea"
        />
      </div>

      {/* Tombol Aksi Salin + Live Region Status */}
      <div className="grid gap-2">
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-between">
          <span
            role="status"
            data-visible={statusAnnouncement ? "true" : "false"}
            className="wp-copy-status text-xs font-bold text-status-free-text"
          >
            {statusAnnouncement}
          </span>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
            <a
              href={waShareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="wp-btn wp-btn-secondary w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span>Buka WhatsApp</span>
            </a>

            <button
              ref={copyBtnRef}
              type="button"
              autoFocus
              data-copied={copyState === "copied" ? "" : undefined}
              data-failed={copyState === "failed" ? "" : undefined}
              {...({ command: "--copy", commandfor: textareaId } as Record<string, string>)}
              className="wp-btn wp-btn-primary w-full sm:w-auto"
            >
              {copyState === "copied" ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{copyState === "copied" ? "Tersalin!" : "Salin Draf WA"}</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
