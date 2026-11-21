"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, type CSSProperties } from "react";
import { CalendarPlus, KeyRound, LayoutGrid, LogIn, LogOut, Menu, UserCheck } from "lucide-react";
import { JadwalinLogo } from "@/components/brand/jadwalin-logo";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/ui/toast-provider";

const HOST_NAV_ITEMS = [
  { href: "/buat", label: "Buat Room", icon: CalendarPlus },
  { href: "/gabung", label: "Gabung Kode", icon: KeyRound },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
] as const;

const GUEST_NAV_ITEMS = [{ href: "/gabung", label: "Gabung Kode", icon: KeyRound }] as const;

export function AppHeader() {
  const pathname = usePathname();
  const { user, isLoading, signIn, signOut } = useAuth();
  const { showToast } = useToast();
  const rawId = useId();
  const menuId = `mobile-nav-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const menuRef = useRef<HTMLUListElement | null>(null);
  const visibleNavItems = user ? HOST_NAV_ITEMS : GUEST_NAV_ITEMS;

  const closeMobileMenu = () => {
    const menuEl = menuRef.current as (HTMLUListElement & { hidePopover?: () => void }) | null;
    if (menuEl && typeof menuEl.hidePopover === "function") {
      try {
        if (menuEl.matches(":popover-open")) {
          menuEl.hidePopover();
        }
      } catch {
        // Abaikan jika popover sudah tertutup
      }
    }
  };

  const handleSignIn = async () => {
    closeMobileMenu();
    const signedIn = await signIn();
    if (signedIn) {
      showToast({
        title: "Berhasil Masuk",
        message: `Halo ${signedIn.displayName}, riwayat room dan Jadwal Rutinmu siap dipakai.`,
        variant: "success",
      });
    } else {
      showToast({
        title: "Gagal Masuk",
        message: "Login Google dibatalkan atau belum tersedia saat ini.",
        variant: "warning",
      });
    }
  };

  const handleSignOut = async () => {
    closeMobileMenu();
    await signOut();
    showToast({
      title: "Berhasil Keluar",
      message: "Kamu keluar dari akun. Kamu tetap bisa mengisi jadwal sebagai tamu.",
      variant: "info",
    });
  };

  return (
    <header className="sticky top-0 z-30 border-b-2 border-border-ink bg-surface-card/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className="inline-flex shrink-0 items-center rounded-xl py-1 pr-2 transition-transform hover:-translate-y-0.5"
        >
          <JadwalinLogo size="sm" showWordmark />
        </Link>

        {/* Navigasi Desktop + Aksi Akun */}
        <nav aria-label="Utama" className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            {visibleNavItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`wp-btn ${active ? "wp-btn-primary" : "wp-btn-secondary"}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}

            {!isLoading ? (
              user ? (
                <div className="flex items-center gap-2 pl-1">
                  <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-border-ink bg-status-free-bg px-3 text-sm font-semibold text-status-free-text">
                    <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="max-w-28 truncate">{user.displayName}</span>
                  </span>
                  <button
                    type="button"
                    className="wp-btn wp-btn-secondary"
                    onClick={handleSignOut}
                    aria-label="Keluar dari akun"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Keluar</span>
                  </button>
                </div>
              ) : (
                <button type="button" className="wp-btn wp-btn-primary" onClick={handleSignIn}>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Masuk Google</span>
                </button>
              )
            ) : null}
          </div>

          {/* Menu Popover Mobile */}
          <div className="md:hidden">
            <button
              type="button"
              popoverTarget={menuId}
              popoverTargetAction="toggle"
              aria-controls={menuId}
              className="wp-btn wp-btn-secondary"
              style={{ anchorName: "--mobile-nav-btn" } as CSSProperties}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
              <span>Menu</span>
            </button>

            <ul ref={menuRef} id={menuId} popover="auto" className="mobile-nav-menu">
              {visibleNavItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={closeMobileMenu}
                      className={`wp-btn w-full justify-start ${
                        active ? "wp-btn-primary" : "wp-btn-secondary"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}

              {!isLoading ? (
                <li className="border-t border-border-subtle pt-2">
                  {user ? (
                    <div className="grid gap-2">
                      <div className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-border-ink bg-status-free-bg px-3 text-sm font-semibold text-status-free-text">
                        <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{user.displayName}</span>
                      </div>
                      <button
                        type="button"
                        className="wp-btn wp-btn-secondary w-full justify-start"
                        onClick={handleSignOut}
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        <span>Keluar</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="wp-btn wp-btn-primary w-full justify-start"
                      onClick={handleSignIn}
                    >
                      <LogIn className="h-4 w-4" aria-hidden="true" />
                      <span>Masuk dengan Google</span>
                    </button>
                  )}
                </li>
              ) : null}
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
}
