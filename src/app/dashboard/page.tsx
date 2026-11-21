import type { Metadata } from "next";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Kelola riwayat room penjadwalan kelompok dan Jadwal Rutinku di Jadwalin.",
};

export default function DashboardPage() {
  return <DashboardWorkspace />;
}
