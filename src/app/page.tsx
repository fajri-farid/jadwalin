import type { Metadata } from "next";
import { LandingShowcase } from "@/components/landing/landing-showcase";

export const metadata: Metadata = {
  title: "Jadwalin — Atur Jadwal Kumpul & Rapat Kelompok dalam 30 Detik",
  description:
    "Masuk pakai kode 6 angka ala Quizizz, tandai jam Bisa atau Diusahakan 50:50 dengan nyaman di HP, lalu salin hasilnya ke grup WhatsApp.",
};

export default function HomePage() {
  return <LandingShowcase />;
}
