"use client";

import { Check, Clock, Sparkles, Users } from "lucide-react";
import { formatColumnLabel, formatDurationIndonesian, formatTimeRange } from "@/lib/engine/slots";
import type { BestTimeWindow, DateMode } from "@/types/schedule";

interface BestTimesPanelProps {
  dateMode: DateMode;
  bestWindows: readonly BestTimeWindow[];
  filledCount: number;
  totalParticipantsCount: number;
  selectedWindowId: string | null;
  onSelectWindow: (windowItem: BestTimeWindow) => void;
}

export function BestTimesPanel({
  dateMode,
  bestWindows,
  filledCount,
  totalParticipantsCount,
  selectedWindowId,
  onSelectWindow,
}: BestTimesPanelProps) {
  const totalMembers = Math.max(totalParticipantsCount, filledCount);

  return (
    <section aria-labelledby="best-times-heading" className="wp-card grid gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-border-ink bg-status-free-bg text-status-free-text shadow-[2px_2px_0_var(--border-ink)]"
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 id="best-times-heading" className="text-base font-extrabold text-text-primary">
            Waktu Terbaik
          </h2>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-surface-muted px-2.5 py-0.5 font-mono text-xs font-bold text-text-secondary">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {filledCount}/{totalMembers} isi
          </span>
        </span>
      </div>

      {filledCount === 0 ? (
        <div className="wp-card-muted grid gap-1.5 p-4 text-center">
          <p className="text-sm font-bold text-text-primary">Belum ada jadwal yang masuk</p>
          <p className="text-xs text-text-secondary">
            Tandai jam luangmu dulu, lalu rekomendasi waktu paling klop akan muncul otomatis di
            sini.
          </p>
        </div>
      ) : bestWindows.length === 0 ? (
        <div className="wp-card-muted grid gap-1.5 p-4 text-center">
          <p className="text-sm font-bold text-text-primary">Belum ada irisan jam kosong</p>
          <p className="text-xs text-text-secondary">
            Coba tandai beberapa slot <strong>Diusahakan (50:50)</strong> agar kelompok punya opsi
            cadangan.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {bestWindows.map((win, idx) => {
            const isTop = idx === 0;
            const isSelected = selectedWindowId === win.id;
            const denominator = Math.max(totalMembers, 1);
            const freePct = Math.round((win.freeCount / denominator) * 100);
            const tentativePct = Math.round((win.tentativeCount / denominator) * 100);
            const isTrulyAllFree =
              totalMembers >= 2 && win.pendingNames.length === 0 && win.freeCount === totalMembers;

            return (
              <button
                key={win.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectWindow(win)}
                className={`grid gap-2.5 rounded-xl border-2 border-border-ink p-3.5 text-left transition-all ${
                  isSelected
                    ? "bg-brand-soft shadow-[3px_3px_0_var(--border-ink)]"
                    : isTop
                      ? "bg-status-free-bg/65 shadow-[3px_3px_0_var(--border-ink)] hover:bg-status-free-bg"
                      : "bg-surface-card shadow-[2px_2px_0_var(--border-ink)] hover:bg-surface-muted/70"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border-2 border-border-ink px-1.5 font-mono text-xs font-extrabold ${
                        isTop
                          ? "bg-status-free text-status-free-text"
                          : "bg-surface-muted text-text-primary"
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <span className="text-sm font-extrabold text-text-primary">
                      {formatColumnLabel(dateMode, win.columnKey, "short")}
                    </span>
                  </div>

                  <span className="inline-flex items-center rounded-full border border-border-ink bg-surface-card px-2 py-0.5 font-mono text-xs font-bold text-text-secondary">
                    {formatDurationIndonesian(win.durationMinutes)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-base font-extrabold text-text-primary">
                    {formatTimeRange(win.startTime, win.endTime)}
                  </span>

                  {isTrulyAllFree ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-status-free-border bg-status-free-bg px-2 py-0.5 font-mono text-xs font-bold text-status-free-text">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        Semua bisa ({win.freeCount}/{totalMembers})
                      </span>
                    </span>
                  ) : win.isTentativeOnly ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-status-tentative-border bg-status-tentative-bg px-2 py-0.5 font-mono text-xs font-bold text-status-tentative-text">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {win.tentativeCount}/{totalMembers} · 50:50
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-status-free-border bg-status-free-bg px-2 py-0.5 font-mono text-xs font-bold text-status-free-text">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {win.freeCount}/{totalMembers} bisa
                        {win.tentativeCount > 0 ? ` +${win.tentativeCount}` : ""}
                      </span>
                    </span>
                  )}
                </div>

                {/* Progress Bar Dua Segmen terhadap total anggota (1/n) */}
                <div
                  className="flex h-2.5 w-full overflow-hidden rounded-full border border-border-ink bg-surface-muted"
                  aria-hidden="true"
                >
                  {freePct > 0 ? (
                    <div
                      className="h-full bg-status-free"
                      style={{ width: `${Math.min(100, freePct)}%` }}
                    />
                  ) : null}
                  {tentativePct > 0 ? (
                    <div
                      className="h-full bg-status-tentative"
                      style={{ width: `${Math.min(100 - freePct, tentativePct)}%` }}
                    />
                  ) : null}
                </div>

                <div className="grid gap-1 text-xs text-text-secondary">
                  {win.freeNames.length > 0 ? (
                    <div className="flex items-start gap-1.5">
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-free-border"
                        aria-hidden="true"
                      />
                      <span>
                        <strong className="text-text-primary">{win.freeCount} bisa:</strong>{" "}
                        {win.freeNames.join(", ")}
                      </span>
                    </div>
                  ) : null}

                  {win.tentativeNames.length > 0 ? (
                    <div className="flex items-start gap-1.5">
                      <Clock
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-tentative-border"
                        aria-hidden="true"
                      />
                      <span>
                        <strong className="text-text-primary">
                          {win.tentativeCount} diusahakan:
                        </strong>{" "}
                        {win.tentativeNames.join(", ")}
                      </span>
                    </div>
                  ) : null}

                  {win.pendingNames.length > 0 ? (
                    <span className="text-[11px] font-medium text-text-muted">
                      Belum isi: {win.pendingNames.join(", ")}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
