import Link from "next/link";

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={[
        "flex flex-1 flex-col items-center justify-center",
        "gap-1",
        "px-2",
        "py-4",                 // bigger tap target
        "text-[13px] font-medium", // slightly larger
        "text-white/70 hover:text-white",
        "active:bg-white/10",   // nicer touch feedback on mobile
        "select-none",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900">
      {/* leave room for bigger nav + safe-area */}
      <div className="mx-auto max-w-md px-5 pb-32 pt-8">{children}</div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/50 backdrop-blur">
        <div
          className={[
            "mx-auto flex max-w-md",
            "h-16",              // fixed height that feels “app-like”
            "px-2",
            "pb-[env(safe-area-inset-bottom)]", // iOS safe area
          ].join(" ")}
        >
          <NavItem href="/app/dashboard" label="Dashboard" />
          <NavItem href="/app/sleep" label="Sleep" />
          <NavItem href="/app/activity" label="Activity" />
          <NavItem href="/app/profile" label="Profile" />
        </div>
      </div>
    </div>
  );
}