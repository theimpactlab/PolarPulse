export default function Loading() {
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          <div className="text-sm text-white/70">Loading…</div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="h-16 w-full rounded-2xl bg-white/5" />
          <div className="h-28 w-full rounded-2xl bg-white/5" />
          <div className="h-28 w-full rounded-2xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}