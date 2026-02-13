"use client";

import { useState } from "react";
import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
};

const mainTabs: NavItem[] = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
    ),
  },
  {
    href: "/app/sleep",
    label: "Sleep",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    ),
  },
  {
    href: "/app/activity",
    label: "Activity",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
    ),
  },
  {
    href: "/app/journal",
    label: "Journal",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    ),
  },
];

const moreItems: NavItem[] = [
  {
    href: "/app/health",
    label: "Health Monitor",
  },
  {
    href: "/app/trends",
    label: "Trends",
  },
  {
    href: "/app/weekly",
    label: "Weekly Review",
  },
  {
    href: "/app/profile",
    label: "Profile",
  },
];

export default function MobileBottomNav() {
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* More panel overlay */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setShowMore(false)}
        ></div>
      )}

      {/* More slide-up panel */}
      <div
        className={`fixed bottom-24 left-0 right-0 bg-slate-950 border border-white/10 rounded-t-2xl shadow-2xl z-50 transform transition-all duration-300 ${
          showMore ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="p-4 max-w-md mx-auto">
          <div className="text-white/70 text-xs font-semibold mb-4 px-2">MORE OPTIONS</div>
          <div className="space-y-2">
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMore(false)}
                className="block w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-white/90 text-sm font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Main nav bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur border-t border-white/10 z-40">
        <div className="flex items-center justify-between px-2 py-3 max-w-md mx-auto">
          {mainTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-white/5 transition text-white/70 hover:text-white"
              title={tab.label}
            >
              {tab.icon}
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          ))}

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition ${
              showMore
                ? "bg-white/10 text-white"
                : "hover:bg-white/5 text-white/70 hover:text-white"
            }`}
            title="More options"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"></circle>
              <circle cx="12" cy="12" r="2"></circle>
              <circle cx="12" cy="19" r="2"></circle>
            </svg>
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </div>
    </>
  );
}
