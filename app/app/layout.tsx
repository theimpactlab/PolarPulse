import Link from "next/link";

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-1 items-center justify-center py-3 text-sm text-white/70 hover:text-white"
    >
      {label}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900">
      <div className="mx-auto max-w-md px-5 pb-24 pt-8">
        {children}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-md">
          <NavItem href="/app/dashboard" label="Dashboard" />
          <NavItem href="/app/sleep" label="Sleep" />
          <NavItem href="/app/activity" label="Activity" />
          <NavItem href="/app/profile" label="Profile" />
        </div>
      </div>
    </div>
  );
}