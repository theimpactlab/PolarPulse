export default function SleepLoading() {
  return (
    <div className="animate-pulse space-y-5 px-4 pb-24">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 rounded-full bg-white/10" />
        <div className="h-5 w-24 rounded bg-white/10" />
        <div className="h-8 w-8 rounded-full bg-white/10" />
      </div>

      {/* Sleep Score Ring */}
      <div className="flex flex-col items-center py-4">
        <div className="h-48 w-48 rounded-full border-8 border-white/10" />
        <div className="h-4 w-24 rounded bg-white/10 mt-3" />
      </div>

      {/* Sleep Coach */}
      <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="h-5 w-28 rounded bg-white/10" />
        <div className="h-4 w-32 rounded bg-white/10" />
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-white/10" />
            <div className="h-7 w-20 rounded bg-white/10" />
          </div>
        ))}
      </div>

      {/* Sleep Stages */}
      <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="h-5 w-28 rounded bg-white/10" />
        <div className="h-10 w-full rounded-full bg-white/10" />
        <div className="flex justify-between">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-3 w-12 rounded bg-white/10" />
          ))}
        </div>
      </div>

      {/* HR Line Chart */}
      <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="h-5 w-36 rounded bg-white/10" />
        <div className="h-32 w-full rounded bg-white/10" />
      </div>
    </div>
  );
}

