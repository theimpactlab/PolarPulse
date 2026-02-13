export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-5 px-4 pb-24">
      {/* Header */}
      <div>
        <div className="h-4 w-20 rounded bg-white/10 mb-1" />
        <div className="h-7 w-28 rounded bg-white/10 mb-1" />
        <div className="h-4 w-36 rounded bg-white/10" />
      </div>

      {/* Recovery Ring */}
      <div className="rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col items-center">
        <div className="h-44 w-44 rounded-full border-8 border-white/10" />
        <div className="h-5 w-32 rounded bg-white/10 mt-3" />
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
            <div className="h-3 w-10 rounded bg-white/10" />
            <div className="h-7 w-14 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
        ))}
      </div>

      {/* Strain Coach */}
      <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="h-5 w-28 rounded bg-white/10" />
        <div className="h-4 w-20 rounded bg-white/10" />
        <div className="h-8 w-full rounded-full bg-white/10" />
        <div className="h-4 w-48 rounded bg-white/10" />
      </div>

      {/* Sleep Coach */}
      <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="h-5 w-28 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-white/10" />
            <div className="h-6 w-20 rounded bg-white/10" />
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="h-6 w-16 rounded bg-white/10" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[1,2].map(i => (
          <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
            <div className="h-3 w-14 rounded bg-white/10" />
            <div className="h-7 w-16 rounded bg-white/10" />
          </div>
        ))}
      </div>

      {/* 14-day Chart */}
      <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="h-5 w-36 rounded bg-white/10" />
        <div className="h-40 w-full rounded bg-white/10" />
      </div>
    </div>
  );
}

