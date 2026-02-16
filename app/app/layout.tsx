import MobileBottomNav from "@/src/components/MobileBottomNav";
import { AppShell } from "@/src/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-black text-white">
      <div
        className="mx-auto max-w-md px-4 pb-28"
        style={{ paddingTop: "max(env(safe-area-inset-top, 1.5rem), 1.5rem)" }}
      >
        <AppShell>{children}</AppShell>
      </div>
      <MobileBottomNav />
    </div>
  );
}
