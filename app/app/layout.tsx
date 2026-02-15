import MobileBottomNav from "@/src/components/MobileBottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto max-w-md px-4 pb-28 pt-6">{children}</div>
      <MobileBottomNav />
    </div>
  );
}
