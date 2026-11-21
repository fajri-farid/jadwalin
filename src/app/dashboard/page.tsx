import type { Metadata } from "next";
import { DashboardPreview } from "@/components/dashboard/dashboard-preview";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Kelola riwayat room penjadwalan kelompok kamu di Jadwalin.",
};

export default function DashboardPage() {
  return <DashboardPreview />;
}
