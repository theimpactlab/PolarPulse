export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/70 animate-spin" />
      </div>
      <p className="mt-4 text-white/30 text-xs uppercase tracking-widest">Loading</p>
    </div>
  );
}
