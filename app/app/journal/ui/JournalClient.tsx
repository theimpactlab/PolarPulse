"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";

type JournalBehavior = {
  behavior: string;
  value: boolean;
};

type RecoveryImpact = {
  behavior: string;
  avg_recovery_with: number | null;
  avg_recovery_without: number | null;
  days_with: number | null;
  days_without: number | null;
};

const BEHAVIOR_CATEGORIES = {
  "Sleep Environment": [
    "alcohol",
    "caffeine_after_2pm",
    "screen_before_bed",
    "late_meal",
    "room_temp_cool",
    "blackout_curtains",
  ],
  Nutrition: [
    "hydrated_well",
    "ate_clean",
    "supplements",
    "creatine",
    "protein_shake",
  ],
  Recovery: [
    "stretching",
    "meditation",
    "sauna",
    "cold_exposure",
    "massage",
    "foam_rolling",
  ],
  Lifestyle: ["high_stress", "travel", "sick", "menstrual_cycle"],
  Performance: ["caffeine_before_workout", "pre_workout", "good_warmup"],
};

function formatBehaviorName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function JournalClient({
  date,
  journalBehaviors,
  recoveryImpact,
}: {
  date: string;
  journalBehaviors: JournalBehavior[];
  recoveryImpact: RecoveryImpact[];
}) {
  const supabase = createSupabaseBrowserClient();

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      setUserId(userRes?.user?.id ?? null);
    };
    getUser();
  }, [supabase]);

  // Initialize state from fetched data
  const initialStates = useMemo(() => {
    const map: Record<string, boolean> = {};
    journalBehaviors.forEach((b) => {
      map[b.behavior] = b.value;
    });
    return map;
  }, [journalBehaviors]);

  const [behaviors, setBehaviors] = useState<Record<string, boolean>>(
    initialStates
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  const toggleBehavior = useCallback((behavior: string) => {
    setBehaviors((prev) => ({
      ...prev,
      [behavior]: !prev[behavior],
    }));
    setSaveStatus("idle");
  }, []);

  const saveBehaviors = useCallback(async () => {
    if (!userId) return;

    setIsSaving(true);
    setSaveStatus("idle");

    try {
      // Collect all behaviors to upsert
      const allBehaviors = Object.keys(BEHAVIOR_CATEGORIES).flatMap(
        (category) =>
          BEHAVIOR_CATEGORIES[category as keyof typeof BEHAVIOR_CATEGORIES]
      );

      const upsertData = allBehaviors.map((behavior) => ({
        user_id: userId,
        date: date,
        behavior: behavior,
        value: behaviors[behavior] ?? false,
      }));

      const { error } = await supabase
        .from("journal_behaviors")
        .upsert(upsertData, {
          onConflict: "user_id,date,behavior",
        });

      if (error) {
        console.error("Error saving behaviors:", error);
        setSaveStatus("error");
      } else {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [behaviors, date, userId, supabase]);

  // Process recovery impact data
  const impactSorted = useMemo(() => {
    return recoveryImpact
      .filter((item) => {
        // Filter for items with enough data (at least 5 days each)
        return (
          (item.days_with ?? 0) >= 5 &&
          (item.days_without ?? 0) >= 5 &&
          item.avg_recovery_with !== null &&
          item.avg_recovery_without !== null
        );
      })
      .map((item) => ({
        ...item,
        delta: (item.avg_recovery_with ?? 0) - (item.avg_recovery_without ?? 0),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [recoveryImpact]);

  const displayDate = new Date(date + "T00:00:00Z").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "short", day: "numeric" }
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="text-sm text-white/60">Journal</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Daily Journal
          </h1>
          <p className="mt-2 text-white/60">{displayDate}</p>
        </div>

        {/* Behavior Categories */}
        <div className="space-y-6 mb-8">
          {Object.entries(BEHAVIOR_CATEGORIES).map(([category, items]) => (
            <div
              key={category}
              className="rounded-3xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-sm"
            >
              <h2 className="mb-4 text-lg font-semibold">{category}</h2>
              <div className="flex flex-wrap gap-3">
                {items.map((behavior) => {
                  const isActive = behaviors[behavior] ?? false;
                  return (
                    <button
                      key={behavior}
                      onClick={() => toggleBehavior(behavior)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                          : "border-white/20 bg-zinc-800 text-white/70 hover:bg-zinc-700"
                      }`}
                    >
                      {formatBehaviorName(behavior)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="mb-12 flex items-center gap-4">
          <button
            onClick={saveBehaviors}
            disabled={isSaving}
            className="rounded-2xl bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Journal"}
          </button>
          {saveStatus === "success" && (
            <div className="text-sm text-emerald-400">Saved successfully</div>
          )}
          {saveStatus === "error" && (
            <div className="text-sm text-red-400">Failed to save</div>
          )}
        </div>

        {/* Recovery Impact Section */}
        {impactSorted.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-sm">
            <h2 className="mb-6 text-lg font-semibold">Recovery Impact</h2>
            <div className="space-y-4">
              {impactSorted.map((item) => {
                const isPositive = item.delta > 0;
                return (
                  <div
                    key={item.behavior}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {formatBehaviorName(item.behavior)}
                      </div>
                      <div className="mt-1 text-sm text-white/60">
                        With: {(item.avg_recovery_with ?? 0).toFixed(1)} | Without:{" "}
                        {(item.avg_recovery_without ?? 0).toFixed(1)}
                      </div>
                    </div>
                    <div
                      className={`text-right font-semibold ${
                        isPositive ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {item.delta.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
