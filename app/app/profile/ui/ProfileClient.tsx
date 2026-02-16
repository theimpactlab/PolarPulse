"use client";

import { useState, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface Connection {
  connected_at: string | null;
  last_synced_at: string | null;
  expires_at: string | null;
  scope: string | null;
}

export default function ProfileClient({
  email,
  userId,
  connection,
  profileName = "",
  profileDob = "",
  profileAvatarUrl = "",
}: {
  email: string;
  userId: string;
  connection: Connection | null;
  profileName?: string;
  profileDob?: string;
  profileAvatarUrl?: string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Profile editing state
  const [name, setName] = useState(profileName);
  const [dob, setDob] = useState(profileDob);
  const [avatarUrl, setAvatarUrl] = useState(profileAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Compute current age from DOB if set
  const currentAge = dob
    ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
    : 30;

  // Initials from name or email
  const initials = name
    ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : email ? email.split("@")[0].slice(0, 2).toUpperCase() : "??";

  // Display name
  const displayName = name || (email
    ? email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "User");
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl + "?t=" + Date.now();

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setSaveMsg("");
    try {
      const updates: any = { name };
      if (dob) updates.date_of_birth = dob;
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (error) throw error;
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (err: any) {
      setSaveMsg("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSyncMsg("Not logged in"); return; }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-polar`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        setSyncMsg("Synced successfully!");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const body = await res.text();
        setSyncMsg("Sync failed: " + body.slice(0, 80));
      }
    } catch (e: any) {
      setSyncMsg("Error: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function deleteMyData() {
    if (!confirm("Delete ALL your data? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const tables = ["workout_hr_zones","workout_hr_series","workouts","sleep_stages","sleep_hr_series","sleep_sessions","nightly_recharge","activity_summary","continuous_hr","daily_metrics"];
      for (const t of tables) {
        await supabase.from(t).delete().eq("user_id", session.user.id);
      }
      alert("Data deleted.");
      window.location.reload();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const lastSynced = connection?.last_synced_at
    ? timeAgo(new Date(connection.last_synced_at))
    : null;
  return (
    <div className="min-h-screen bg-black px-4 pt-10 pb-32">
      {/* Profile Header with Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-2xl font-bold text-black overflow-hidden relative group"
            disabled={uploading}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </button>
          {uploading && (
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-black/60 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarUpload}
        />
        <h1 className="text-xl font-semibold text-white mt-3">{displayName}</h1>
        <p className="text-sm text-white/40 mt-0.5">{email}</p>
      </div>

      {/* Personal Info Section */}
      <div className="mb-6">
        <h2 className="text-[11px] uppercase tracking-widest font-medium text-white/40 mb-3 px-1">Personal Info</h2>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 space-y-4">
          <div>
            <label className="text-xs text-white/40 block mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 transition"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition [color-scheme:dark]"
            />
            {dob && (
              <p className="text-[10px] text-white/30 mt-1">
                Age: {currentAge} years — used for biological age calculation
              </p>
            )}
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-500/20 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {saveMsg && <p className="text-xs text-center text-white/50">{saveMsg}</p>}
        </div>
      </div>
      {/* Polar Connection */}
      <div className="mb-6">
        <h2 className="text-[11px] uppercase tracking-widest font-medium text-white/40 mb-3 px-1">Polar Connection</h2>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/70">Status</span>
            {connection ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Disconnected
              </span>
            )}
          </div>
          {connection && (
            <>
              {lastSynced && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-white/40">Last synced</span>
                  <span className="text-xs text-white/60">{lastSynced}</span>
                </div>
              )}
              {connection.connected_at && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-white/40">Connected since</span>
                  <span className="text-xs text-white/60">
                    {new Date(connection.connected_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2">
            <a
              href="/api/polar/connect"
              className="flex-1 text-center py-2.5 rounded-xl bg-white/[0.06] text-sm font-medium text-white/70 hover:bg-white/[0.1] transition"
            >
              {connection ? "Reconnect" : "Connect Polar"}
            </a>
            {connection && (
              <button
                onClick={syncNow}
                disabled={syncing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 transition disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
            )}
          </div>
          {syncMsg && <p className="text-xs text-center mt-2 text-white/50">{syncMsg}</p>}
        </div>
      </div>

      {/* Account */}
      <div className="mb-6">
        <h2 className="text-[11px] uppercase tracking-widest font-medium text-white/40 mb-3 px-1">Account</h2>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl overflow-hidden">
          <button
            onClick={deleteMyData}
            disabled={deleting}
            className="w-full text-left px-4 py-3.5 text-sm text-red-400 hover:bg-white/[0.04] transition border-b border-white/[0.06] disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete My Data"}
          </button>
          <button
            onClick={signOut}
            className="w-full text-left px-4 py-3.5 text-sm text-white/60 hover:bg-white/[0.04] transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  return days + "d ago";
}
