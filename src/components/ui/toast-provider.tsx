"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Clock, Info, Trash2, X } from "lucide-react";

export type ToastVariant = "success" | "warning" | "danger" | "info";

export interface ToastInput {
  title: string;
  message: string;
  variant?: ToastVariant;
}

interface ToastEntry extends Required<ToastInput> {
  id: string;
  invoker: HTMLElement | null;
  closing?: boolean;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const MAX_VISIBLE_TOASTS = 3;

const DEFAULT_TITLES: Record<ToastVariant, string> = {
  success: "Berhasil",
  warning: "Diusahakan (50:50)",
  danger: "Dihapus",
  info: "Informasi",
};

const ICON_BADGE_CLASS: Record<ToastVariant, string> = {
  success: "bg-status-free-bg text-status-free-text",
  warning: "bg-status-tentative-bg text-status-tentative-text",
  danger: "bg-status-danger-bg text-status-danger",
  info: "bg-brand-soft text-brand-hover",
};

const ToastContext = createContext<ToastContextValue | null>(null);

function VariantIcon({ variant }: { variant: ToastVariant }) {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
    case "warning":
      return <Clock className="h-4 w-4" aria-hidden="true" />;
    case "danger":
      return <Trash2 className="h-4 w-4" aria-hidden="true" />;
    default:
      return <Info className="h-4 w-4" aria-hidden="true" />;
  }
}

interface ToastCardItemProps {
  toast: ToastEntry;
  bottomOffsetPx: number;
  forceDismissSignal: number;
  onDismissed: (
    id: string,
    invoker: HTMLElement | null,
    wasFocusedInside: boolean,
    keepInertInDom: boolean
  ) => void;
}

function ToastCardItem({
  toast,
  bottomOffsetPx,
  forceDismissSignal,
  onDismissed,
}: ToastCardItemProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const onDismissedRef = useRef(onDismissed);
  const commitRef = useRef<
    ((direction: "left" | "right", ioEntry?: IntersectionObserverEntry) => void) | null
  >(null);
  const dismissedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const deferredHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onDismissedRef.current = onDismissed;
  }, [onDismissed]);

  const clearDismissTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleAutoDismiss = useCallback(
    (delayMs = 4200) => {
      clearDismissTimer();
      if (pausedRef.current || dismissedRef.current) return;
      timerRef.current = setTimeout(() => {
        commitRef.current?.("right");
      }, delayMs);
    },
    [clearDismissTimer]
  );

  useEffect(() => {
    const cardEl = cardRef.current;
    const trackEl = trackRef.current;
    const contentEl = contentRef.current;
    if (!cardEl || !trackEl || !contentEl) return;

    const supportsPopover = Object.hasOwn(HTMLElement.prototype, "popover");
    const needsScrollWorkaround = !CSS.supports("scroll-initial-target", "nearest");

    if (supportsPopover && typeof cardEl.showPopover === "function") {
      try {
        cardEl.showPopover();
      } catch {
        cardEl.classList.add("is-open");
      }
    } else {
      cardEl.classList.add("is-open");
    }

    // Aktifkan CSS Scroll Snap track sebelum membaca clientWidth atau memasang observer
    cardEl.classList.add("is-initialized");
    if (needsScrollWorkaround || trackEl.scrollLeft < trackEl.clientWidth * 0.5) {
      trackEl.scrollLeft = trackEl.clientWidth;
    }

    let resizeObserver: ResizeObserver | null = null;
    if (needsScrollWorkaround) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (!dismissedRef.current && !cardEl.dataset.dragging) {
            entry.target.scrollLeft = entry.target.clientWidth;
          }
        }
      });
      resizeObserver.observe(trackEl);
    }

    const runRemoval = async (direction: "left" | "right", ioEntry?: IntersectionObserverEntry) => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      clearDismissTimer();
      resizeObserver?.unobserve(trackEl);
      resizeObserver?.disconnect();
      innerObserver.disconnect();

      const wasFocusedInside = cardEl.contains(document.activeElement);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const opts: KeyframeAnimationOptions = {
        duration: reduce ? 150 : 280,
        easing: "ease",
        fill: "forwards",
      };

      const itemRect = cardEl.getBoundingClientRect();
      const contentRect = ioEntry?.boundingClientRect ?? contentEl.getBoundingClientRect();
      const rootRect = ioEntry?.rootBounds ?? trackEl.getBoundingClientRect();
      const offsetX = contentRect.x - rootRect.x;
      const translate =
        direction === "left" ? contentRect.width - offsetX : -(offsetX + contentRect.width);

      cardEl.classList.add("is-removing");

      if (typeof cardEl.animate === "function") {
        cardEl.animate(
          [
            { height: `${itemRect.height}px`, opacity: 1 },
            { height: "0px", opacity: 0 },
          ],
          opts
        );
        if (!reduce) {
          contentEl.animate([{ translate: `${translate}px`, opacity: 0 }], opts);
        }
        await Promise.allSettled(
          cardEl.getAnimations({ subtree: true }).map((animation) => animation.finished)
        );
      }

      if (supportsPopover && typeof cardEl.hidePopover === "function") {
        try {
          if (cardEl.matches(":popover-open")) {
            cardEl.hidePopover();
          }
        } catch {
          // Abaikan jika popover sudah tertutup
        }
      }
      cardEl.classList.remove("is-open");

      if ("GestureEvent" in globalThis) {
        // Guard bug scroll-latching Safari setelah swipe dengan defer DOM removal
        cardEl.inert = true;
        onDismissedRef.current(toast.id, toast.invoker, wasFocusedInside, true);
        deferredHideTimerRef.current = setTimeout(() => {
          onDismissedRef.current(toast.id, toast.invoker, false, false);
        }, 5000);
      } else {
        onDismissedRef.current(toast.id, toast.invoker, wasFocusedInside, false);
      }
    };

    commitRef.current = (direction, ioEntry) => {
      void runRemoval(direction, ioEntry);
    };

    const innerObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry || !entry.rootBounds || entry.rootBounds.width === 0) return;
        const direction = entry.boundingClientRect.x - entry.rootBounds.x > 0 ? "left" : "right";
        if (entry.intersectionRatio < 0.25) {
          commitRef.current?.(direction, entry);
        }
      },
      {
        root: trackEl,
        threshold: [0.25],
      }
    );

    innerObserver.observe(contentEl);
    scheduleAutoDismiss(4200);

    // Drag mouse desktop menggerakkan scroll-snap track tanpa animasi transform hack
    let mouseDrag: { pointerId: number; startX: number; startScrollLeft: number } | null = null;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, select, textarea")) return;
      mouseDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: trackEl.scrollLeft,
      };
      cardEl.dataset.dragging = "true";
      trackEl.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!mouseDrag || event.pointerId !== mouseDrag.pointerId) return;
      const deltaX = event.clientX - mouseDrag.startX;
      trackEl.scrollLeft = mouseDrag.startScrollLeft - deltaX;
    };

    const endMouseDrag = (event: PointerEvent) => {
      if (!mouseDrag || event.pointerId !== mouseDrag.pointerId) return;
      mouseDrag = null;
      delete cardEl.dataset.dragging;
      const width = trackEl.clientWidth || 1;
      const offset = trackEl.scrollLeft - width;
      if (Math.abs(offset) > width * 0.35) {
        trackEl.scrollTo({ left: offset < 0 ? 0 : width * 2, behavior: "smooth" });
      } else {
        trackEl.scrollTo({ left: width, behavior: "smooth" });
      }
    };

    trackEl.addEventListener("pointerdown", handlePointerDown);
    trackEl.addEventListener("pointermove", handlePointerMove);
    trackEl.addEventListener("pointerup", endMouseDrag);
    trackEl.addEventListener("pointercancel", endMouseDrag);

    return () => {
      clearDismissTimer();
      if (deferredHideTimerRef.current) clearTimeout(deferredHideTimerRef.current);
      resizeObserver?.disconnect();
      innerObserver.disconnect();
      trackEl.removeEventListener("pointerdown", handlePointerDown);
      trackEl.removeEventListener("pointermove", handlePointerMove);
      trackEl.removeEventListener("pointerup", endMouseDrag);
      trackEl.removeEventListener("pointercancel", endMouseDrag);
    };
  }, [clearDismissTimer, scheduleAutoDismiss, toast.id, toast.invoker]);

  useEffect(() => {
    if (forceDismissSignal > 0) {
      commitRef.current?.("right");
    }
  }, [forceDismissSignal]);

  return (
    <div
      ref={cardRef}
      popover="manual"
      className="toast-card"
      data-variant={toast.variant}
      data-toast-id={toast.id}
      style={{ ["--toast-offset" as string]: `${bottomOffsetPx}px` }}
      onFocusCapture={() => {
        pausedRef.current = true;
        clearDismissTimer();
      }}
      onBlurCapture={(event) => {
        if (!cardRef.current?.contains(event.relatedTarget as Node | null)) {
          pausedRef.current = false;
          scheduleAutoDismiss(2400);
        }
      }}
      onPointerEnter={() => {
        pausedRef.current = true;
        clearDismissTimer();
      }}
      onPointerLeave={() => {
        if (
          !cardRef.current?.contains(document.activeElement) &&
          !cardRef.current?.dataset.dragging
        ) {
          pausedRef.current = false;
          scheduleAutoDismiss(2400);
        }
      }}
    >
      <div
        ref={trackRef}
        className="toast-swipe-track"
        onTouchStart={() => {
          pausedRef.current = true;
          clearDismissTimer();
        }}
        onTouchEnd={() => {
          pausedRef.current = false;
          scheduleAutoDismiss(2400);
        }}
      >
        <div ref={contentRef} className="toast-swipe-content">
          <span
            aria-hidden="true"
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-border-ink ${ICON_BADGE_CLASS[toast.variant]}`}
          >
            <VariantIcon variant={toast.variant} />
          </span>

          <div className="grid min-w-0 gap-0.5">
            <span className="text-sm font-bold leading-snug text-text-primary">{toast.title}</span>
            <span className="text-xs leading-relaxed text-text-secondary">{toast.message}</span>
          </div>

          <button
            type="button"
            className="toast-close-btn"
            aria-label={`Tutup notifikasi ${toast.title}`}
            onClick={() => commitRef.current?.("right")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Penyedia Toast Notification dengan `popover="manual"`, swipe-to-dismiss bersih tanpa ikon tempat sampah,
 * antrean saat `<dialog>` terbuka, dan manajemen fokus sesuai aksesibilitas.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [dismissSignals, setDismissSignals] = useState<Record<string, number>>({});
  const queuedRef = useRef<ToastEntry[]>([]);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const announce = useCallback((spoken: string) => {
    const doc = document as Document & { ariaNotify?: (text: string) => void };
    if (typeof doc.ariaNotify === "function") {
      doc.ariaNotify(spoken);
      return;
    }

    const region = liveRegionRef.current;
    if (!region) return;
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    region.textContent = "";
    liveTimerRef.current = setTimeout(() => {
      region.textContent = spoken;
    }, 50);
  }, []);

  const enqueueEntry = useCallback(
    (entry: ToastEntry) => {
      announce(`${entry.title}. ${entry.message}`);
      setToasts((prev) => {
        if (prev.length >= MAX_VISIBLE_TOASTS) {
          const oldest = prev[0];
          setDismissSignals((signals) => ({
            ...signals,
            [oldest.id]: (signals[oldest.id] ?? 0) + 1,
          }));
        }
        return [...prev, entry];
      });
    },
    [announce]
  );

  const showToast = useCallback(
    (input: ToastInput) => {
      const variant: ToastVariant = input.variant ?? "info";
      const title = input.title.trim() || DEFAULT_TITLES[variant];
      const message = input.message.trim();
      const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const entry: ToastEntry = {
        id: `toast-${++seqRef.current}`,
        variant,
        title,
        message,
        invoker,
      };

      // Tahan toast sementara bila ada <dialog> modal terbuka agar tidak tertutup inert
      if (document.querySelector("dialog[open]")) {
        queuedRef.current.push(entry);
        return;
      }

      enqueueEntry(entry);
    },
    [enqueueEntry]
  );

  useEffect(() => {
    const handleDialogClose = (event: Event) => {
      if (
        event.target instanceof HTMLDialogElement &&
        queuedRef.current.length > 0 &&
        !document.querySelector("dialog[open]")
      ) {
        const pending = queuedRef.current.splice(0, queuedRef.current.length);
        for (const entry of pending) {
          enqueueEntry(entry);
        }
      }
    };

    document.addEventListener("close", handleDialogClose, true);
    return () => {
      document.removeEventListener("close", handleDialogClose, true);
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, [enqueueEntry]);

  const handleDismissed = useCallback(
    (
      id: string,
      invoker: HTMLElement | null,
      wasFocusedInside: boolean,
      keepInertInDom: boolean
    ) => {
      let dismissedTitle = "Notifikasi";

      setToasts((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target) dismissedTitle = target.title;

        const remaining = keepInertInDom
          ? prev.map((item) => (item.id === id ? { ...item, closing: true } : item))
          : prev.filter((item) => item.id !== id);

        if (wasFocusedInside) {
          queueMicrotask(() => {
            const nextBtn = regionRef.current?.querySelector<HTMLButtonElement>(
              ".toast-card:not(.is-removing) .toast-close-btn"
            );
            if (nextBtn) {
              nextBtn.focus();
            } else if (invoker && document.contains(invoker) && !invoker.closest("[inert]")) {
              invoker.focus();
            }
          });
        }

        return remaining;
      });

      if (!keepInertInDom || wasFocusedInside) {
        announce(`${dismissedTitle} ditutup.`);
      }
    },
    [announce]
  );

  const visibleActiveToasts = toasts.filter((item) => !item.closing);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div ref={regionRef} className="toast-region" role="region" aria-label="Notifikasi">
        {toasts.map((toast) => {
          const activeIdx = visibleActiveToasts.findIndex((item) => item.id === toast.id);
          const stackIndexFromBottom =
            activeIdx === -1 ? 0 : visibleActiveToasts.length - 1 - activeIdx;
          return (
            <ToastCardItem
              key={toast.id}
              toast={toast}
              bottomOffsetPx={stackIndexFromBottom * 88}
              forceDismissSignal={dismissSignals[toast.id] ?? 0}
              onDismissed={handleDismissed}
            />
          );
        })}
      </div>
      <div ref={liveRegionRef} className="visually-hidden" aria-live="polite" aria-atomic="true" />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast wajib dipanggil di dalam <ToastProvider>.");
  }
  return context;
}
