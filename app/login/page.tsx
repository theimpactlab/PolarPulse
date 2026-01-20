import { Suspense } from "react";
import LoginClient from "./ui/LoginClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginClient />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
        Loading…
      </div>
    </div>
  );
}