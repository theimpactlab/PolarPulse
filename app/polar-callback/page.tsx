import { Suspense } from "react";
import PolarCallbackClient from "./ui/PolarCallbackClient";

export default function PolarCallbackPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PolarCallbackClient />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
        Connecting to Polar…
      </div>
    </div>
  );
}