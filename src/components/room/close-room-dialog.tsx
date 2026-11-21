"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, CheckCircle2, Loader2, Lock, Sparkles, X } from "lucide-react";
import { formatColumnLabel, formatDurationIndonesian, formatTimeRange } from "@/lib/engine/slots";
import type { AgreedTimeSlot, BestTimeWindow, DateMode } from "@/types/schedule";

interface CloseRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTitle: string;
  dateMode: DateMode;
  bestWindows: readonly BestTimeWindow[];
  totalMembers: number;
  onConfirmClose: (agreedSlot: AgreedTimeSlot | null) => Promise<void>;
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
 * Dialog khusus Host untuk mengunci jadwal kesepakatan ("Ketok Palu") dan menutup room.
 */
export function CloseRoomDialog({
  open,
  onOpenChange,
  roomTitle,
  dateMode,
  bestWindows,
  totalMembers,
  onConfirmClose,
}: CloseRoomDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  const topOptions = bestWindows.slice(0, 3);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveSelection =
    selectedOption ?? (topOptions.length > 0 ? topOptions[0].id : "__none__");

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close("");
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      setSelectedOption(null);
      setIsSubmitting(false);
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
    };
  }, []);

  const handleConfirm = async () => {
    const matched = topOptions.find((item) => item.id === effectiveSelection);
    const agreedSlot: AgreedTimeSlot | null = matched
      ? {
          columnKey: matched.columnKey,
          startTime: matched.startTime,
          endTime: matched.endTime,
        }
      : null;

    setIsSubmitting(true);
    try {
      await onConfirmClose(agreedSlot);
      dialogRef.current?.close("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="wp-dialog !w-[min(94vw,33rem)]"
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
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div className="grid gap-0.5">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
              {roomTitle}
            </span>
            <h2 id={titleId} className="text-lg font-extrabold text-text-primary">
              Kunci Jadwal &amp; Tutup Room
            </h2>
          </div>
        </div>

        <button
          type="button"
          className="wp-btn wp-btn-secondary !px-2.5"
          aria-label="Tutup dialog"
          onClick={() => dialogRef.current?.close("")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-sm text-text-secondary">
        Setelah ditutup, anggota tidak bisa mengubah jadwal lagi namun hasil grup tetap bisa
        dilihat. Kamu tetap bisa membukanya kembali kapan saja.
      </p>

      <div className="grid gap-2" role="radiogroup" aria-label="Pilih jadwal final">
        {topOptions.map((win, idx) => {
          const checked = effectiveSelection === win.id;
          return (
            <button
              key={win.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setSelectedOption(win.id)}
              className={`flex items-center justify-between gap-3 rounded-xl border-2 border-border-ink p-3 text-left transition-all ${
                checked
                  ? "bg-status-free-bg shadow-[3px_3px_0_var(--border-ink)]"
                  : "bg-surface-card hover:bg-surface-muted"
              }`}
            >
              <div className="grid gap-0.5">
                <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-text-primary">
                  <Sparkles className="h-3.5 w-3.5 text-status-free-border" aria-hidden="true" />
                  <span>
                    #{idx + 1} · {formatColumnLabel(dateMode, win.columnKey, "short")}
                  </span>
                </span>
                <span className="font-mono text-sm font-bold text-text-primary">
                  {formatTimeRange(win.startTime, win.endTime)} (
                  {formatDurationIndonesian(win.durationMinutes)})
                </span>
                <span className="text-xs font-semibold text-text-secondary">
                  {win.freeCount}/{Math.max(totalMembers, 1)} bisa
                  {win.tentativeCount > 0 ? ` · ${win.tentativeCount} diusahakan` : ""}
                </span>
              </div>

              <span
                aria-hidden="true"
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-border-ink ${
                  checked ? "bg-status-free text-status-free-text" : "bg-surface-card"
                }`}
              >
                {checked ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          role="radio"
          aria-checked={effectiveSelection === "__none__"}
          onClick={() => setSelectedOption("__none__")}
          className={`flex items-center justify-between gap-3 rounded-xl border-2 border-border-ink p-3 text-left transition-all ${
            effectiveSelection === "__none__"
              ? "bg-brand-soft shadow-[3px_3px_0_var(--border-ink)]"
              : "bg-surface-card hover:bg-surface-muted"
          }`}
        >
          <div className="grid gap-0.5">
            <span className="text-sm font-bold text-text-primary">
              Tutup tanpa mengunci jam tertentu
            </span>
            <span className="text-xs text-text-secondary">
              Simpan hasil grup sebagai arsip tanpa memilih satu jadwal final.
            </span>
          </div>

          <span
            aria-hidden="true"
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-border-ink ${
              effectiveSelection === "__none__" ? "bg-brand text-white" : "bg-surface-card"
            }`}
          >
            {effectiveSelection === "__none__" ? (
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            ) : null}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
        <button
          type="button"
          autoFocus
          disabled={isSubmitting}
          onClick={() => dialogRef.current?.close("")}
          className="wp-btn wp-btn-secondary w-full sm:w-auto"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleConfirm}
          className="wp-btn wp-btn-primary w-full sm:w-auto"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Lock className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{effectiveSelection === "__none__" ? "Tutup Room" : "Kunci Jadwal & Tutup"}</span>
        </button>
      </div>
    </dialog>
  );
}
