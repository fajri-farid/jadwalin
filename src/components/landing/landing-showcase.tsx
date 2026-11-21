import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  CalendarSync,
  Check,
  CheckCircle2,
  Clock,
  KeyRound,
  MessageSquare,
  Users,
} from "lucide-react";
import { JadwalinLogo } from "@/components/brand/jadwalin-logo";
import {
  AfterWaCopyBar,
  BentoPaintGridPreview,
  BentoRosterPreview,
  BentoRoutinePreview,
  BentoWaDraftPreview,
  RevealSection,
} from "@/components/landing/landing-interactive-previews";
import { JoinByCodeCard } from "@/components/room/join-by-code-card";
import {
  AFTER_BEST_WINDOW_PREVIEW,
  BEFORE_CHAT_MESSAGES,
  BENTO_FEATURES,
  FAQ_ITEMS,
  HERO_CONTENT,
  HERO_LIVE_PREVIEW,
  HOW_IT_WORKS_STEPS,
} from "@/lib/landing/landing-showcase-data";

type MotionStyle = CSSProperties & {
  "--enter-delay"?: string;
  "--enter-x"?: string;
  "--stagger-base"?: string;
  "--stagger-step"?: string;
  "--sibling-index"?: number;
};

function motionVars(vars: MotionStyle): CSSProperties {
  return vars;
}

export function LandingShowcase() {
  const heroFreePct = Math.round(
    (HERO_LIVE_PREVIEW.freeMembers.length / HERO_LIVE_PREVIEW.totalMembers) * 100
  );
  const heroTentativePct = Math.round(
    (HERO_LIVE_PREVIEW.tentativeMembers.length / HERO_LIVE_PREVIEW.totalMembers) * 100
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-14 px-4 py-8 sm:px-6 sm:py-12">
      {/* Seksi 1: Hero Above-the-Fold (Opsi B: Atas Rata Tengah + Bawah 2 Kartu Sejajar) */}
      <section aria-labelledby="hero-heading" className="grid gap-8 sm:gap-10">
        {/* Bagian Atas: Teks Utama, CTA, dan Quick Badges Rata Tengah */}
        <div className="mx-auto grid max-w-3xl justify-items-center gap-5 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span
              style={motionVars({ "--enter-delay": "40ms" })}
              className="enter-pop inline-flex items-center rounded-full border-2 border-border-ink bg-brand-soft px-3.5 py-1 text-xs font-extrabold text-brand-hover shadow-[2px_2px_0_var(--border-ink)]"
            >
              <span>{HERO_CONTENT.eyebrow}</span>
            </span>
          </div>

          <div className="grid gap-3.5">
            <h1
              id="hero-heading"
              className="text-3xl font-extrabold leading-[1.16] tracking-tight text-text-primary sm:text-5xl"
            >
              {HERO_CONTENT.headlineWords.map((word, index) => (
                <span key={`${word}-${index}`}>
                  <span
                    className="enter-word"
                    style={motionVars({ "--enter-delay": `${110 + index * 60}ms` })}
                  >
                    {word}
                  </span>{" "}
                </span>
              ))}
              <span
                style={motionVars({ "--enter-delay": "545ms" })}
                className="enter-word-pop inline-block text-brand"
              >
                {HERO_CONTENT.headlineHighlight}
              </span>
            </h1>
            <p
              style={motionVars({ "--enter-delay": "650ms" })}
              className="enter-up mx-auto max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg"
            >
              {HERO_CONTENT.subheadline}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/buat"
              style={motionVars({ "--enter-delay": "760ms" })}
              className="wp-btn wp-btn-primary enter-up min-h-12 px-6 text-base"
            >
              <CalendarPlus className="h-5 w-5" aria-hidden="true" />
              <span>{HERO_CONTENT.primaryCta}</span>
            </Link>
            <Link
              href="/dashboard"
              style={motionVars({ "--enter-delay": "830ms" })}
              className="wp-btn wp-btn-secondary enter-up min-h-12 px-5 text-base"
            >
              <CalendarSync className="h-5 w-5" aria-hidden="true" />
              <span>{HERO_CONTENT.secondaryCta}</span>
            </Link>
          </div>

          <ul
            style={motionVars({ "--stagger-base": "910ms", "--stagger-step": "75ms" })}
            className="wp-stagger-list flex flex-wrap items-center justify-center gap-2.5 pt-0.5"
            aria-label="Keunggulan utama"
          >
            {HERO_CONTENT.quickBadges.map((badge, index) => (
              <li
                key={badge}
                style={motionVars({ "--sibling-index": index + 1 })}
                className="enter-pop inline-flex items-center gap-1.5 rounded-xl border-2 border-border-ink bg-surface-card px-3 py-1.5 text-xs font-bold text-text-primary shadow-[2px_2px_0_var(--border-ink)]"
              >
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-status-free-border"
                  aria-hidden="true"
                />
                <span>{badge}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bagian Bawah: 2 Kartu Sejajar (Kiri: Input Kode 6 Digit Live, Kanan: Hasil Irisan Waktu) */}
        <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
          <div
            style={motionVars({ "--enter-delay": "1120ms" })}
            className="enter-pop flex [&>*]:w-full"
          >
            <JoinByCodeCard />
          </div>

          <article
            aria-label="Contoh hasil irisan waktu kelompok"
            style={motionVars({ "--enter-delay": "1230ms" })}
            className="wp-card wp-tactile-card enter-pop flex flex-col justify-between gap-4 bg-surface-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="wp-tactile-badge inline-flex h-8 items-center justify-center rounded-xl border-2 border-border-ink bg-emerald-700 px-2.5 font-mono text-xs font-extrabold text-white shadow-[2px_2px_0_var(--border-ink)]">
                  #1 Klop
                </span>
                <span className="text-base font-extrabold text-text-primary sm:text-lg">
                  {HERO_LIVE_PREVIEW.roomTitle}
                </span>
              </div>
              <span className="rounded-full border-2 border-border-ink bg-brand-soft px-3 py-0.5 font-mono text-xs font-extrabold text-brand-hover">
                {HERO_LIVE_PREVIEW.roomCodeDisplay}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border-ink bg-status-free-bg/70 p-3.5">
              <div className="grid gap-0.5">
                <span className="text-xs font-bold text-status-free-text">
                  {HERO_LIVE_PREVIEW.dateLabel} · {HERO_LIVE_PREVIEW.durationLabel}
                </span>
                <span className="font-mono text-lg font-extrabold text-text-primary">
                  {HERO_LIVE_PREVIEW.timeRange}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-status-free-border bg-surface-card px-3 py-1 font-mono text-xs font-extrabold text-status-free-text">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {HERO_LIVE_PREVIEW.freeMembers.length}+{HERO_LIVE_PREVIEW.tentativeMembers.length}
                  /{HERO_LIVE_PREVIEW.totalMembers}
                </span>
              </span>
            </div>

            <div className="grid gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold text-text-secondary">
                <span>Irisan waktu terbaik otomatis</span>
                <span className="text-status-free-text">
                  {heroFreePct}% Bisa · {heroTentativePct}% 50:50
                </span>
              </div>

              {/* Meter Proporsi Dua Segmen: Bisa + 50:50 */}
              <div
                className="flex h-3 w-full overflow-hidden rounded-full border-2 border-border-ink bg-surface-muted"
                aria-hidden="true"
              >
                <div
                  style={{ width: `${heroFreePct}%`, "--enter-delay": "1360ms" } as CSSProperties}
                  className="enter-bar h-full bg-status-free"
                />
                <div
                  style={
                    { width: `${heroTentativePct}%`, "--enter-delay": "1430ms" } as CSSProperties
                  }
                  className="wp-tentative-pattern enter-bar h-full border-l border-border-ink"
                />
              </div>

              <div
                style={motionVars({ "--stagger-base": "1440ms", "--stagger-step": "65ms" })}
                className="wp-stagger-list flex flex-wrap gap-1.5 pt-0.5 text-xs font-bold"
              >
                {HERO_LIVE_PREVIEW.freeMembers.map((name, index) => (
                  <span
                    key={name}
                    style={motionVars({ "--sibling-index": index + 1 })}
                    className="enter-pop inline-flex items-center gap-1 rounded-lg border border-status-free-border bg-status-free-bg px-2.5 py-1 text-status-free-text"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                    <span>{name}</span>
                  </span>
                ))}
                {HERO_LIVE_PREVIEW.tentativeMembers.map((name, index) => (
                  <span
                    key={name}
                    style={motionVars({
                      "--sibling-index": HERO_LIVE_PREVIEW.freeMembers.length + index + 1,
                    })}
                    className="wp-tentative-pattern enter-pop inline-flex items-center gap-1 rounded-lg border border-status-tentative-border px-2.5 py-1 text-status-tentative-text"
                  >
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    <span>{name} (50:50)</span>
                  </span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* Seksi 2: Visual Kontras Before vs After ("Stop Rekap Chat Satu-Satu") */}
      <RevealSection ariaLabelledBy="compare-heading" className="grid gap-5">
        <div
          style={motionVars({ "--enter-delay": "0ms" })}
          className="reveal-up grid gap-1.5 text-center sm:text-left"
        >
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
            Kenapa Pakai Jadwalin?
          </span>
          <h2
            id="compare-heading"
            className="text-2xl font-extrabold text-text-primary sm:text-3xl"
          >
            Berhenti rekap balasan chat satu per satu.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Before: Grup Chat Tenggelam */}
          <article
            style={motionVars({ "--enter-delay": "110ms" })}
            className="wp-card-muted reveal-up grid gap-3.5 p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-extrabold text-text-secondary">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                <span>Cara Lama di Grup Chat</span>
              </span>
              <span className="rounded-full border border-border-ink bg-surface-card px-2.5 py-0.5 text-[11px] font-bold text-text-muted">
                Sering buntu
              </span>
            </div>

            <div
              style={motionVars({ "--stagger-base": "240ms", "--stagger-step": "120ms" })}
              className="wp-stagger-list grid gap-2.5"
            >
              {BEFORE_CHAT_MESSAGES.map((msg, index) => (
                <div
                  key={msg.id}
                  style={motionVars({ "--sibling-index": index + 1 })}
                  className="reveal-pop grid gap-1 rounded-xl border-2 border-border-subtle bg-surface-card px-3.5 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-extrabold text-text-primary">{msg.sender}</span>
                    <span className="font-mono text-[11px] text-text-muted">{msg.time}</span>
                  </div>
                  <p className="text-sm text-text-secondary">{msg.text}</p>
                </div>
              ))}
            </div>
          </article>

          {/* After: Cara Jadwalin */}
          <article
            style={motionVars({ "--enter-delay": "220ms" })}
            className="wp-card wp-tactile-card reveal-pop grid gap-4 bg-surface-card p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-extrabold text-text-primary">
                <CalendarCheck className="h-4 w-4 text-status-free-border" aria-hidden="true" />
                <span>Cara Jadwalin</span>
              </span>
              <span className="wp-tactile-badge inline-flex items-center gap-1 rounded-full border-2 border-border-ink bg-status-free px-2.5 py-0.5 text-[11px] font-extrabold text-status-free-text">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                <span>{AFTER_BEST_WINDOW_PREVIEW.statusBadge}</span>
              </span>
            </div>

            <div
              style={motionVars({ "--enter-delay": "360ms" })}
              className="reveal-up grid gap-2.5 rounded-xl border-2 border-border-ink bg-status-free-bg/65 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-text-primary">
                  <span className="rounded-md border-2 border-border-ink bg-status-free px-1.5 py-0.5 font-mono text-xs text-status-free-text">
                    {AFTER_BEST_WINDOW_PREVIEW.rank}
                  </span>
                  <span>{AFTER_BEST_WINDOW_PREVIEW.dayLabel}</span>
                </span>
                <span className="rounded-full border border-border-ink bg-surface-card px-2.5 py-0.5 font-mono text-xs font-bold text-text-secondary">
                  {AFTER_BEST_WINDOW_PREVIEW.durationLabel}
                </span>
              </div>

              <p className="font-mono text-lg font-extrabold text-text-primary">
                {AFTER_BEST_WINDOW_PREVIEW.timeRange}
              </p>

              <div className="h-2.5 w-full overflow-hidden rounded-full border border-border-ink bg-surface-muted">
                <div
                  style={motionVars({ "--enter-delay": "480ms" })}
                  className="reveal-bar h-full w-full bg-status-free"
                />
              </div>

              <p className="text-xs font-semibold text-status-free-text">
                Bisa dihadiri: {AFTER_BEST_WINDOW_PREVIEW.attendees.join(", ")}
              </p>
            </div>

            <AfterWaCopyBar
              snippet={AFTER_BEST_WINDOW_PREVIEW.waSnippet}
              style={motionVars({ "--enter-delay": "560ms" })}
            />
          </article>
        </div>
      </RevealSection>

      {/* Seksi 3: Bento Grid 4 Senjata Utama (Show, Don't Tell + Interactive Mini-Playgrounds) */}
      <RevealSection ariaLabelledBy="features-heading" className="grid gap-5">
        <div style={motionVars({ "--enter-delay": "0ms" })} className="reveal-up grid gap-1.5">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
            Dirancang untuk Kebiasaan di Indonesia
          </span>
          <h2
            id="features-heading"
            className="text-2xl font-extrabold text-text-primary sm:text-3xl"
          >
            Bukan kalender rumit. Cukup fitur yang benar-benar kepakai.
          </h2>
        </div>

        <div
          style={motionVars({ "--stagger-base": "110ms", "--stagger-step": "115ms" })}
          className="wp-stagger-list grid gap-5 md:grid-cols-2"
        >
          {BENTO_FEATURES.map((feature, index) => (
            <article
              key={feature.id}
              style={motionVars({ "--sibling-index": index + 1 })}
              className="wp-card wp-size-container wp-tactile-card reveal-pop flex flex-col gap-5 p-5 sm:p-6"
            >
              <div className="grid gap-2.5">
                <header className="grid gap-2">
                  <span className="wp-tactile-badge w-fit rounded-full border-2 border-border-ink bg-surface-muted px-3 py-0.5 font-mono text-[11px] font-extrabold text-text-secondary">
                    {feature.badge}
                  </span>
                  <h3 className="text-xl font-extrabold text-text-primary">{feature.title}</h3>
                </header>

                <p className="text-sm leading-relaxed text-text-secondary">{feature.description}</p>
              </div>

              {/* Pratinjau Visual Interaktif Spesifik per Kartu */}
              <div className="mt-auto grid w-full gap-3">
                {feature.id === "roster" ? <BentoRosterPreview /> : null}
                {feature.id === "paint-grid" ? <BentoPaintGridPreview /> : null}
                {feature.id === "routine" ? <BentoRoutinePreview /> : null}
                {feature.id === "wa-draft" ? <BentoWaDraftPreview /> : null}

                {feature.id === "routine" ? (
                  <footer>
                    <Link
                      href="/dashboard#jadwal-rutinku"
                      className="inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-hover underline-offset-4 hover:underline"
                    >
                      <span>Atur Jadwal Rutinku di Dashboard</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </footer>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </RevealSection>

      {/* Seksi 4: Alur 3 Langkah Singkat */}
      <RevealSection ariaLabelledBy="steps-heading" className="grid gap-5">
        <div
          style={motionVars({ "--enter-delay": "0ms" })}
          className="reveal-up grid gap-1.5 text-center sm:text-left"
        >
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
            Alur Singkat
          </span>
          <h2 id="steps-heading" className="text-2xl font-extrabold text-text-primary sm:text-3xl">
            Dari kode 6 angka sampai jadwal ketok palu.
          </h2>
        </div>

        <div
          style={motionVars({ "--stagger-base": "120ms", "--stagger-step": "130ms" })}
          className="wp-stagger-list grid gap-4 md:grid-cols-3"
        >
          {HOW_IT_WORKS_STEPS.map((item, index) => (
            <article
              key={item.step}
              style={motionVars({ "--sibling-index": index + 1 })}
              className="wp-card wp-tactile-card reveal-pop flex flex-col justify-between gap-4 p-5"
            >
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="wp-tactile-badge grid h-9 w-9 place-items-center rounded-xl border-2 border-border-ink bg-brand text-sm font-extrabold text-white shadow-[2px_2px_0_var(--border-ink)]">
                    {item.step}
                  </span>
                  <span className="rounded-full border border-border-ink bg-surface-muted px-2.5 py-0.5 font-mono text-[11px] font-bold text-text-secondary">
                    {item.pill}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-text-primary">{item.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </RevealSection>

      {/* Seksi 5: FAQ Pertanyaan Umum (Native Accordion Warm Playful Pop) */}
      <RevealSection ariaLabelledBy="faq-heading" className="grid gap-5">
        <div
          style={motionVars({ "--enter-delay": "0ms" })}
          className="reveal-up grid gap-1.5 text-center sm:text-left"
        >
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
            Pertanyaan Umum
          </span>
          <h2 id="faq-heading" className="text-2xl font-extrabold text-text-primary sm:text-3xl">
            Yang sering ditanyakan sebelum mulai.
          </h2>
        </div>

        <div
          style={motionVars({ "--stagger-base": "100ms", "--stagger-step": "80ms" })}
          className="wp-stagger-list grid gap-3.5"
        >
          {FAQ_ITEMS.map((item, index) => (
            <details
              key={item.id}
              style={motionVars({ "--sibling-index": index + 1 })}
              className="wp-faq-item reveal-up"
            >
              <summary className="text-sm sm:text-base">{item.question}</summary>
              <div className="wp-faq-answer">
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </RevealSection>

      {/* Seksi 6: Bottom CTA + Footer Ringkas Open-Source */}
      <RevealSection ariaLabelledBy="bottom-cta-heading" className="grid gap-8">
        <div
          style={motionVars({ "--enter-delay": "0ms" })}
          className="wp-card wp-tactile-card reveal-pop grid justify-items-center gap-5 bg-brand-soft/65 p-6 text-center sm:p-8"
        >
          <div
            style={motionVars({ "--enter-delay": "110ms" })}
            className="reveal-up grid max-w-3xl gap-2.5"
          >
            <h2
              id="bottom-cta-heading"
              className="text-2xl font-extrabold text-text-primary sm:text-3xl"
            >
              Ada rencana rapat atau kumpul minggu ini?
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
              Buat room jadwalmu sekarang, bagikan kode 6 angka ke grup chat, dan biarkan Jadwalin
              mencari irisan waktu terbaik untuk kalian.
            </p>
          </div>

          <div
            style={motionVars({ "--enter-delay": "220ms" })}
            className="reveal-up flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/buat" className="wp-btn wp-btn-primary min-h-12 px-5">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              <span>Buat Room Sekarang</span>
            </Link>
            <Link href="/gabung" className="wp-btn wp-btn-secondary min-h-12 px-5">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>Gabung Pakai Kode</span>
            </Link>
          </div>
        </div>

        <footer
          style={motionVars({ "--enter-delay": "320ms" })}
          className="reveal-fade flex flex-wrap items-center justify-between gap-6 border-t-2 border-border-ink pt-6 pb-4"
        >
          <div className="grid gap-3">
            <JadwalinLogo size="sm" showWordmark />
            <p className="text-xs font-medium text-text-muted">
              Platform penjadwalan kelompok open-source yang cepat, gratis, dan ramah layar HP.
            </p>
          </div>

          <nav
            aria-label="Tautan bawah"
            className="flex flex-wrap items-center gap-4 text-sm font-bold"
          >
            <Link
              href="/buat"
              className="text-text-secondary hover:text-brand-hover hover:underline"
            >
              Buat Room
            </Link>
            <Link
              href="/gabung"
              className="text-text-secondary hover:text-brand-hover hover:underline"
            >
              Gabung Kode
            </Link>
            <Link
              href="/dashboard"
              className="text-text-secondary hover:text-brand-hover hover:underline"
            >
              Dashboard
            </Link>
          </nav>
        </footer>
      </RevealSection>
    </div>
  );
}
