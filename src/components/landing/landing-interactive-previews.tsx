"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CalendarSync, Check, CheckCircle2, Clock, Copy, Lock, Share2 } from "lucide-react";

interface RevealSectionProps {
  ariaLabelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * Pembungkus seksi below-the-fold yang memicu choreographed entrance
 * tepat saat seksi masuk ke viewport dengan durasi konsisten (tidak bergantung kecepatan scroll).
 */
export function RevealSection({ ariaLabelledBy, className, children }: RevealSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [revealState, setRevealState] = useState<"idle" | "pending" | "visible">("idle");

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof window === "undefined") {
      return;
    }

    const prefersMotion = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
    if (!prefersMotion || typeof IntersectionObserver === "undefined") {
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      setRevealState("visible");
      return;
    }

    setRevealState("pending");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealState("visible");
            observer.disconnect();
            break;
          }
        }
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -6% 0px",
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby={ariaLabelledBy}
      data-reveal-state={revealState === "idle" ? undefined : revealState}
      className={className}
    >
      {children}
    </section>
  );
}

export function AfterWaCopyBar({ snippet, style }: { snippet: string; style?: CSSProperties }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = () => {
    setCopied(true);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(snippet).catch(() => undefined);
    }
  };

  return (
    <div
      style={style}
      className="reveal-up flex items-center justify-between gap-3 rounded-xl border-2 border-border-ink bg-surface-canvas px-3.5 py-2.5"
    >
      <p className="line-clamp-1 font-mono text-xs text-text-secondary">{snippet}</p>
      <button
        type="button"
        onClick={handleCopy}
        className={`wp-slot-demo inline-flex shrink-0 items-center gap-1 rounded-lg border-2 border-border-ink px-2.5 py-1 text-xs font-extrabold ${
          copied
            ? "bg-status-free text-status-free-text"
            : "bg-brand-soft text-brand-hover hover:bg-brand-border/60"
        }`}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tersalin!</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Salin WA</span>
          </>
        )}
      </button>
    </div>
  );
}

export function BentoRosterPreview() {
  const [members, setMembers] = useState([
    { name: "Fajri", filled: true },
    { name: "Citra", filled: true },
    { name: "Budi", filled: false },
  ]);

  const filledCount = members.filter((m) => m.filled).length;
  const pct = Math.round((filledCount / members.length) * 100);

  const toggleMember = (targetName: string) => {
    setMembers((prev) =>
      prev.map((item) => (item.name === targetName ? { ...item, filled: !item.filled } : item))
    );
  };

  return (
    <div className="wp-card-muted grid gap-2.5 p-3.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Simulasi daftar anggota">
        {members.map((member) => (
          <button
            key={member.name}
            type="button"
            aria-pressed={member.filled}
            onClick={() => toggleMember(member.name)}
            className={`wp-slot-demo inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
              member.filled
                ? "border border-border-ink bg-status-free-bg text-status-free-text"
                : "border border-dashed border-border-ink bg-surface-card text-text-muted"
            }`}
          >
            {member.filled ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-status-tentative-border" aria-hidden="true" />
            )}
            <span>{member.filled ? member.name : `${member.name} · Belum`}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold text-text-secondary">
        <span>Ketuk nama untuk coba absen</span>
        <span>
          {filledCount}/{members.length} isi
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full border border-border-ink bg-surface-card">
        <div
          className="h-full bg-status-free transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type DemoSlotState = "free" | "tentative" | "empty";

const NEXT_SLOT_STATE: Record<DemoSlotState, DemoSlotState> = {
  free: "tentative",
  tentative: "empty",
  empty: "free",
};

export function BentoPaintGridPreview() {
  const [slots, setSlots] = useState<Record<string, DemoSlotState>>({
    "sen-19": "free",
    "sel-19": "tentative",
    "sen-20": "free",
    "sel-20": "empty",
  });

  const cycleSlot = (key: string) => {
    setSlots((prev) => ({
      ...prev,
      [key]: NEXT_SLOT_STATE[prev[key] ?? "empty"],
    }));
  };

  const renderSlotButton = (slotKey: string, label: string, peerCount?: string) => {
    const state = slots[slotKey] ?? "empty";

    if (state === "free") {
      return (
        <button
          type="button"
          onClick={() => cycleSlot(slotKey)}
          aria-label={`${label}: Bisa (ketuk untuk ganti ke 50:50)`}
          className="wp-slot-demo flex h-8 items-center justify-center gap-1 rounded-md border-2 border-border-ink bg-status-free text-xs font-extrabold text-status-free-text"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {peerCount ? (
            <span className="rounded-full bg-white/80 px-1 font-mono text-[10px]">{peerCount}</span>
          ) : null}
        </button>
      );
    }

    if (state === "tentative") {
      return (
        <button
          type="button"
          onClick={() => cycleSlot(slotKey)}
          aria-label={`${label}: Diusahakan 50:50 (ketuk untuk hapus)`}
          className="wp-slot-demo wp-tentative-pattern flex h-8 items-center justify-center gap-1 rounded-md border-2 border-status-tentative-border text-xs font-extrabold text-status-tentative-text"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-mono text-[10px]">50:50</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => cycleSlot(slotKey)}
        aria-label={`${label}: Kosong (ketuk untuk tandai Bisa)`}
        className="wp-slot-demo flex h-8 items-center justify-center rounded-md border border-dashed border-status-free-border bg-status-free-bg px-1 font-mono text-[11px] font-bold text-status-free-text"
      >
        <span>2 teman</span>
      </button>
    );
  };

  return (
    <div className="wp-card-muted grid gap-1.5 p-3.5">
      <div className="grid grid-cols-[2.75rem_1fr_1fr] gap-1.5 text-center font-mono text-[11px] font-extrabold text-text-secondary">
        <span className="pr-1 text-right text-text-muted">JAM</span>
        <span className="rounded border border-border-ink bg-surface-card py-0.5">Sen 23</span>
        <span className="rounded border border-border-ink bg-surface-card py-0.5">Sel 24</span>
      </div>
      <div className="grid grid-cols-[2.75rem_1fr_1fr] items-center gap-1.5">
        <span className="pr-1 text-right font-mono text-[11px] font-bold text-text-primary">
          19:00
        </span>
        {renderSlotButton("sen-19", "Senin 19:00", "+2")}
        {renderSlotButton("sel-19", "Selasa 19:00")}
      </div>
      <div className="grid grid-cols-[2.75rem_1fr_1fr] items-center gap-1.5">
        <span className="pr-1 text-right font-mono text-[11px] font-bold text-text-primary">
          20:00
        </span>
        {renderSlotButton("sen-20", "Senin 20:00")}
        {renderSlotButton("sel-20", "Selasa 20:00")}
      </div>
    </div>
  );
}

export function BentoRoutinePreview() {
  const [applied, setApplied] = useState(true);

  return (
    <div className="wp-card-muted grid gap-2.5 p-3.5">
      <button
        type="button"
        aria-pressed={applied}
        onClick={() => setApplied((prev) => !prev)}
        className={`wp-slot-demo inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-border-ink px-3 py-2 text-xs font-extrabold shadow-[2px_2px_0_var(--border-ink)] ${
          applied
            ? "bg-brand-soft text-brand-hover"
            : "bg-surface-card text-text-primary hover:bg-surface-muted"
        }`}
      >
        <CalendarSync className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{applied ? "Terapkan Jadwal Rutinku" : "Ketuk untuk Terapkan Rutinku"}</span>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold text-status-free-text">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{applied ? "14 slot terisi otomatis" : "Template mingguan siap pakai"}</span>
        </span>
        <span>24 jam</span>
      </div>
    </div>
  );
}

export function BentoWaDraftPreview() {
  const [copied, setCopied] = useState(false);
  const sampleText = "Halo semuanya! Jadwal sudah fix ya: Selasa, 19:00 - 21:00.";

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = () => {
    setCopied(true);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(sampleText).catch(() => undefined);
    }
  };

  return (
    <div className="wp-card-muted grid gap-2.5 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-border-ink bg-status-free px-2 py-0.5 text-[11px] font-extrabold text-status-free-text">
          <Lock className="h-3 w-3" aria-hidden="true" />
          <span>Jadwal Fix</span>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="wp-slot-demo inline-flex items-center gap-1 rounded-md border border-border-ink bg-surface-card px-2 py-0.5 text-[11px] font-extrabold text-brand-hover"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-status-free-border" aria-hidden="true" />
              <span>Tersalin!</span>
            </>
          ) : (
            <>
              <Share2 className="h-3 w-3" aria-hidden="true" />
              <span>Coba Salin</span>
            </>
          )}
        </button>
      </div>
      <p className="rounded-lg border border-border-ink bg-surface-card p-2.5 font-mono text-[11px] leading-snug text-text-secondary">
        {sampleText}
      </p>
    </div>
  );
}
