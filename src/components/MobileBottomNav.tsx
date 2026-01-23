"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

<Link href={it.href} prefetch>

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function isActive(pathname: string, href: string) {
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
      href: "/app/activity",
      label: "Activity",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h4l2-7 4 14 2-7h6" />
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
    <nav
      className={[
        "fixed inset-x-0 bottom-0 z-[1000]",
        "border-t border-white/10 bg-black/80 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
      ].join(" ")}
      "className={[
        ...,
        'active:scale-[0.98] active:bg-white/15',
        'transition-transform'
      ].join(' ')}"
    >
      <div className="mx-auto grid h-20 max-w-md grid-cols-4 gap-2 px-3 py-3">
        {items.map((it) => {
          const active = isActive(pathname, it.href);

          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex flex-col items-center justify-center gap-1",
                "rounded-2xl border",
                active
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:text-white",
                "active:scale-[0.99] transition select-none",
              ].join(" ")}
            >
              <div className={active ? "text-white" : "text-white/80"}>{it.icon}</div>
              <div className="text-[12px] font-medium">{it.label}</div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}