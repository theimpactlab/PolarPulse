"use client";

import { PullToRefresh } from "./PullToRefresh";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <PullToRefresh>{children}</PullToRefresh>;
}
