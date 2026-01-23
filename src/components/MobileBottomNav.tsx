"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  const items: Item[] = [
    {
      href: "/app/dashboard",
      label: "Dashboard",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 13h8V3H3v10zM13 21h8V11h-8v10zM13 3h8v6h-8V3zM3 17h8v4H3v-4z" />
        </svg>
      ),
    },
    {
      href: "/app/sleep",
      label: "Sleep",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 3h10v6H7z" />
          <path d="M5 9h14a2 2 0 0 1 2 2v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-6a2 2 0 0 1 2-2z" />
          <path d="M8 13h.01M12 13h.01M16 13h.01" />
        </svg>
      ),
    },
    {
      href: "/app/profile",
      label: "Profile",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21a8 8 0 1 0-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Spacer so content doesn’t sit under the fixed bar */}
      <div className="h-[88px] md:hidden" />

      <nav
        className={[
          "fixed bottom-0 left-0 right-0 z-50 md:hidden",
          "border-t border-white/10 bg-black/75 backdrop-blur",
          "px-3",
          // iOS safe-area support
          "pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3",
        ].join(" ")}
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          {items.map((it) => {
            const active = isActive(pathname, it.href);

            return (
              <Link
                key={it.href}
                href={it.href}
                className={[
                  "flex h-14 flex-col items-center justify-center gap-1",
                  "rounded-2xl border",
                  active
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:text-white",
                  "active:scale-[0.99] transition",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <div className={active ? "text-white" : "text-white/80"}>{it.icon}</div>
                <div className="text-[11px] font-medium">{it.label}</div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}