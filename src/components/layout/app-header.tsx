"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CalendarPlus,
  KeyRound,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  UserCheck,
  X,
} from "lucide-react";
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
  const drawerId = `mobile-drawer-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const drawerRef = useRef<HTMLDialogElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleNavItems = user ? HOST_NAV_ITEMS : GUEST_NAV_ITEMS;

  const openDrawer = useCallback(() => {
    const drawer = drawerRef.current;
    const scroller = scrollerRef.current;
    if (!drawer || !scroller || drawer.open) return;

    drawer.showModal();
    scroller.scrollTo({ left: scroller.scrollWidth, behavior: "auto" });
  }, []);

  const closeDrawer = useCallback(() => {
    const drawer = drawerRef.current;
    const scroller = scrollerRef.current;
    if (!drawer || !scroller || !drawer.open) return;

    scroller.scrollTo({ left: 0, behavior: "auto" });
  }, []);

  // Sinkronisasi IntersectionObserver, klik backdrop, Escape (`cancel`), dan fallback backdrop scroll
  useEffect(() => {
    const drawer = drawerRef.current;
    const scroller = scrollerRef.current;
    const sheet = sheetRef.current;
    if (!drawer || !scroller || !sheet) return;

    const visibleThreshold = Math.min(0.05, 1 / Math.max(window.innerWidth, 320));
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries.at(-1);
        if (!latest || !drawer.open) return;

        if (latest.intersectionRatio < visibleThreshold) {
          drawer.close("");
          setDrawerOpen(false);
        } else if (latest.intersectionRatio >= 0.99) {
          setDrawerOpen(true);
        }
      },
      { root: drawer, threshold: [visibleThreshold, 0.99] }
    );
    observer.observe(sheet);

    const handleClickBackdrop = (event: MouseEvent) => {
      if (!sheet.contains(event.target as Node)) {
        closeDrawer();
      }
    };

    const handleCancel = (event: Event) => {
      if (event.cancelable) {
        event.preventDefault();
        closeDrawer();
      } else {
        setDrawerOpen(false);
      }
    };

    const handleClose = () => {
      drawer.returnValue = "";
      setDrawerOpen(false);
    };

    drawer.addEventListener("click", handleClickBackdrop);
    drawer.addEventListener("cancel", handleCancel);
    drawer.addEventListener("close", handleClose);

    // Fallback fade backdrop untuk browser tanpa scroll-driven animation-timeline
    let cleanupScrollFallback: (() => void) | undefined;
    if (!CSS.supports("animation-timeline: scroll()")) {
      const handleScroll = () => {
        const maxScroll = Math.max(sheet.offsetWidth, 1);
        const ratio = Math.min(1, Math.max(0, scroller.scrollLeft / maxScroll));
        drawer.style.setProperty("--drawer-backdrop", String(ratio));
      };
      scroller.addEventListener("scroll", handleScroll, { passive: true });
      cleanupScrollFallback = () => {
        scroller.removeEventListener("scroll", handleScroll);
      };
    }

    return () => {
      observer.disconnect();
      drawer.removeEventListener("click", handleClickBackdrop);
      drawer.removeEventListener("cancel", handleCancel);
      drawer.removeEventListener("close", handleClose);
      cleanupScrollFallback?.();
    };
  }, [closeDrawer]);

  const handleSignIn = async () => {
    closeDrawer();
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
    closeDrawer();
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
                    className="wp-btn wp-btn-danger"
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

          {/* Tombol Hamburger Mobile */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={openDrawer}
              aria-label="Buka menu navigasi"
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              className="wp-btn wp-btn-secondary !px-3"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              <span>Menu</span>
            </button>

            {/* Mobile Navigation Drawer (<dialog> + Scroll-Snap Swipe-to-Dismiss) */}
            <dialog ref={drawerRef} id={drawerId} aria-label="Menu navigasi" className="wp-drawer">
              <div ref={scrollerRef} className="wp-drawer-scroller">
                <aside ref={sheetRef} className="wp-drawer-sheet">
                  {/* Header Drawer */}
                  <div className="flex items-center justify-between gap-3 border-b-2 border-border-ink px-4 pb-3">
                    <JadwalinLogo size="sm" showWordmark />
                    <button
                      type="button"
                      autoFocus
                      onClick={closeDrawer}
                      aria-label="Tutup menu"
                      className="wp-btn wp-btn-secondary !min-h-11 !min-w-11 !px-2.5"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Info Akun (jika sudah login) */}
                  {!isLoading && user ? (
                    <div className="border-b border-border-subtle bg-status-free-bg/65 px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-border-ink bg-status-free text-status-free-text shadow-[2px_2px_0_var(--border-ink)]"
                        >
                          <UserCheck className="h-5 w-5" />
                        </span>
                        <div className="grid min-w-0">
                          <span className="truncate text-sm font-extrabold text-text-primary">
                            {user.displayName}
                          </span>
                          {user.email ? (
                            <span className="truncate text-xs font-medium text-text-secondary">
                              {user.email}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Daftar Menu Bersih (Tanpa Nested Box Berlebihan) */}
                  <ul className="grid gap-1.5 px-3 py-4">
                    {visibleNavItems.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href || pathname.startsWith(`${href}/`);
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            aria-current={active ? "page" : undefined}
                            onClick={closeDrawer}
                            className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-bold transition-colors ${
                              active
                                ? "border-2 border-border-ink bg-brand text-white shadow-[2px_2px_0_var(--border-ink)]"
                                : "border-2 border-transparent text-text-primary hover:bg-surface-muted"
                            }`}
                          >
                            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span>{label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Footer Aksi Akun (Pinned di Bawah, Jangkauan Ibu Jari) */}
                  {!isLoading ? (
                    <div className="mt-auto border-t-2 border-border-subtle px-4 pt-3.5">
                      {user ? (
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="wp-btn wp-btn-danger w-full !min-h-12"
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                          <span>Keluar dari Akun</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSignIn}
                          className="wp-btn wp-btn-primary w-full !min-h-12"
                        >
                          <LogIn className="h-4 w-4" aria-hidden="true" />
                          <span>Masuk dengan Google</span>
                        </button>
                      )}
                    </div>
                  ) : null}
                </aside>
              </div>
            </dialog>
          </div>
        </nav>
      </div>
    </header>
  );
}
