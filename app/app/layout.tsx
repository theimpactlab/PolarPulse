import MobileBottomNav from "@/src/components/MobileBottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 text-white">
      {/* leave room for bigger nav + safe-area */}
      <div className="mx-auto max-w-md px-5 pb-32 pt-8">{children}</div>
      <MobileBottomNav />
    </div>
  );
}