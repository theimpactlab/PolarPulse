export default function ActivityLoading() {
  return (
    <div className="animate-pulse space-y-4 px-4 pb-24">
      {/* Header */}
      <div className="h-6 w-32 rounded bg-white/10 mb-2" />

      {/* Workout Cards */}
      {[1,2,3].map(i => (
        <div key={i} className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10" />
              <div className="space-y-1">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="h-3 w-32 rounded bg-white/10" />
              </div>
            </div>
            <div className="h-8 w-8 rounded bg-white/10" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(j => (
              <div key={j} className="space-y-1">
                <div className="h-3 w-12 rounded bg-white/10" />
                <div className="h-5 w-16 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

