import { describe, expect, it } from "vitest";
import {
  AFTER_BEST_WINDOW_PREVIEW,
  BEFORE_CHAT_MESSAGES,
  BENTO_FEATURES,
  FAQ_ITEMS,
  HERO_CONTENT,
  HERO_LIVE_PREVIEW,
  HOW_IT_WORKS_STEPS,
} from "@/lib/landing/landing-showcase-data";

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

describe("Landing Showcase Data (Ticket 07)", () => {
  it("menggunakan copywriting Opsi B dan bebas emoji serta klaim fitur AI pada v0.1.0", () => {
    expect(HERO_CONTENT.headline).toBe("Atur jadwal kumpul & rapat kelompok dalam 30 detik.");
    expect([...HERO_CONTENT.headlineWords, HERO_CONTENT.headlineHighlight].join(" ")).toBe(
      HERO_CONTENT.headline
    );
    expect(HERO_CONTENT.quickBadges).toHaveLength(3);

    const allStrings = [
      HERO_CONTENT.eyebrow,
      HERO_CONTENT.headline,
      HERO_CONTENT.subheadline,
      HERO_CONTENT.primaryCta,
      HERO_CONTENT.secondaryCta,
      ...HERO_CONTENT.quickBadges,
      ...BEFORE_CHAT_MESSAGES.map((m) => `${m.sender} ${m.text}`),
      AFTER_BEST_WINDOW_PREVIEW.statusBadge,
      AFTER_BEST_WINDOW_PREVIEW.waSnippet,
      ...BENTO_FEATURES.map((f) => `${f.badge} ${f.title} ${f.description}`),
      ...HOW_IT_WORKS_STEPS.map((s) => `${s.pill} ${s.title} ${s.description}`),
      ...FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`),
    ];

    for (const text of allStrings) {
      expect(EMOJI_REGEX.test(text)).toBe(false);
      expect(text.toLowerCase()).not.toContain("gemini");
      expect(text.toLowerCase()).not.toContain("kecerdasan buatan");
      expect(/\bai\b/i.test(text)).toBe(false);
    }
  });

  it("menyediakan 4 kartu fitur Bento dan 3 langkah alur yang lengkap", () => {
    expect(BEFORE_CHAT_MESSAGES).toHaveLength(3);
    expect(BENTO_FEATURES.map((item) => item.id)).toEqual([
      "roster",
      "paint-grid",
      "routine",
      "wa-draft",
    ]);
    expect(HOW_IT_WORKS_STEPS.map((item) => item.step)).toEqual(["01", "02", "03"]);
    expect(FAQ_ITEMS).toHaveLength(6);
    expect(HERO_LIVE_PREVIEW.totalMembers).toBe(
      HERO_LIVE_PREVIEW.freeMembers.length + HERO_LIVE_PREVIEW.tentativeMembers.length
    );
  });
});
