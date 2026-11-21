"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle, Info, Trash2, X } from "lucide-react";

export type ConfirmDialogTone = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  eyebrow?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  onConfirm: () => void;
  onCancel?: () => void;
}

const TONE_BADGE_CLASS: Record<ConfirmDialogTone, string> = {
  danger: "bg-status-danger-bg text-status-danger",
  warning: "bg-status-tentative-bg text-status-tentative-text",
  info: "bg-brand-soft text-brand-hover",
};

const TONE_NOTE_CLASS: Record<ConfirmDialogTone, string> = {
  danger: "border border-red-200 bg-status-danger-bg text-status-danger",
  warning: "border border-amber-200 bg-status-tentative-bg text-status-tentative-text",
  info: "border border-indigo-200 bg-brand-soft text-brand-hover",
};

const TONE_CONFIRM_BTN_CLASS: Record<ConfirmDialogTone, string> = {
  danger: "wp-btn wp-btn-danger",
  warning: "wp-btn wp-btn-primary",
  info: "wp-btn wp-btn-primary",
};

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
 * Dialog konfirmasi berbasis elemen native `<dialog>` dengan tampilan Bottom Sheet di HP
 * dan fokus aman otomatis pada tombol batal.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  eyebrow,
  confirmLabel,
  cancelLabel = "Batal",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
    onConfirmRef.current = onConfirm;
    onCancelRef.current = onCancel;
  }, [onOpenChange, onConfirm, onCancel]);

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
      const result = dialog.returnValue;
      dialog.returnValue = "";

      if (result === "confirm") {
        onConfirmRef.current();
      } else {
        onCancelRef.current?.();
      }
      onOpenChangeRef.current(false);
    };

    dialog.addEventListener("close", handleClose);

    // Fallback bounding-box light dismiss untuk browser tanpa `closedBy` native
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

  return (
    <dialog
      ref={dialogRef}
      className="wp-dialog"
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="dialog-sheet-handle" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-border-ink shadow-[2px_2px_0_var(--border-ink)] ${TONE_BADGE_CLASS[tone]}`}
          >
            {tone === "danger" ? (
              <Trash2 className="h-5 w-5" />
            ) : tone === "warning" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Info className="h-5 w-5" />
            )}
          </span>
          <div className="grid gap-1">
            {eyebrow ? (
              <span className="font-mono text-xs font-bold tracking-wider uppercase text-text-muted">
                {eyebrow}
              </span>
            ) : null}
            <h2 id={titleId} className="text-lg font-bold leading-snug text-text-primary">
              {title}
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

      <div
        className={`rounded-xl p-3 text-sm font-medium leading-relaxed ${TONE_NOTE_CLASS[tone]}`}
      >
        {description}
      </div>

      <form method="dialog" className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
        <button
          type="submit"
          value="cancel"
          autoFocus
          className="wp-btn wp-btn-secondary w-full min-h-12 sm:w-auto sm:min-h-11"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          value="confirm"
          className={`${TONE_CONFIRM_BTN_CLASS[tone]} w-full min-h-12 sm:w-auto sm:min-h-11`}
        >
          {tone === "danger" ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : null}
          {confirmLabel}
        </button>
      </form>
    </dialog>
  );
}
