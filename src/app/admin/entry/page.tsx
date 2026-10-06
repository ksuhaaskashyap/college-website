"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type PassInfo = {
  passId: string;
  entryCode: string;
  eventId: string;
  eventTitle: string;
  attendeeName: string;
  attendeeEmail: string;
  status: "active" | "used";
  source: "registration" | "poll";
  createdAt: string | null;
  scannedAt: string | null;
};

export default function AdminEntryPage() {
  const [checkingAdmin, setCheckingAdmin] =
    useState(true);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [entryCode, setEntryCode] =
    useState("");

  const [pass, setPass] =
    useState<PassInfo | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [marking, setMarking] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            setIsAdmin(false);
            setCheckingAdmin(false);
            return;
          }

          try {
            const adminSnapshot =
              await getDoc(
                doc(
                  db,
                  "admins",
                  user.uid
                )
              );

            setIsAdmin(
              adminSnapshot.exists() &&
                adminSnapshot.data()?.role ===
                  "admin"
            );
          } catch (error) {
            console.error(
              "Admin check failed:",
              error
            );

            setIsAdmin(false);
          } finally {
            setCheckingAdmin(false);
          }
        }
      );

    return () => unsubscribe();
  }, []);

  async function checkEntryCode() {
    const cleanCode =
      entryCode.trim().toUpperCase();

    if (!cleanCode) {
      setError("Enter an entry code.");
      return;
    }

    if (cleanCode.length !== 8) {
      setError(
        "Entry codes are exactly 8 characters."
      );
      return;
    }

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      setError(
        "Please log in as an admin."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setPass(null);

    try {
      const idToken =
        await currentUser.getIdToken();

      const response =
        await fetch(
          `/api/admin/entry-passes?entryCode=${encodeURIComponent(
            cleanCode
          )}`,
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Entry code not found."
        );
      }

      setPass(data.pass);
    } catch (error) {
      console.error(
        "Entry lookup failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Entry code not found."
      );
    } finally {
      setLoading(false);
    }
  }

  async function markEntry() {
    if (
      !pass ||
      pass.status !== "active"
    ) {
      return;
    }

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      setError(
        "Please log in as an admin."
      );
      return;
    }

    setMarking(true);
    setError("");
    setMessage("");

    try {
      const idToken =
        await currentUser.getIdToken();

      const response =
        await fetch(
          "/api/admin/entry-passes",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              entryCode:
                pass.entryCode,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Couldn't mark entry."
        );
      }

      if (data.alreadyUsed) {
        setPass(data.pass);

        setMessage(
          "This attendee has already entered."
        );

        return;
      }

      setPass(
        (current) =>
          current
            ? {
                ...current,
                status: "used",
                scannedAt:
                  data.pass?.scannedAt ||
                  null,
              }
            : current
      );

      setMessage(
        "ATTENDANCE CONFIRMED 🎉"
      );
    } catch (error) {
      console.error(
        "Failed to mark entry:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Couldn't mark entry."
      );
    } finally {
      setMarking(false);
    }
  }

  function reset() {
    setEntryCode("");
    setPass(null);
    setError("");
    setMessage("");
  }

  function formatTime(
    value: string | null
  ) {
    if (!value) {
      return "Unknown time";
    }

    try {
      return new Date(
        value
      ).toLocaleString();
    } catch {
      return "Unknown time";
    }
  }

  if (checkingAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080612] text-white">
        <p className="text-white/50">
          Checking admin access...
        </p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080612] px-6 text-white">
        <div className="text-center">
          <div className="text-6xl">
            🚫
          </div>

          <h1 className="mt-5 text-3xl font-black">
            Admin access required
          </h1>

          <p className="mt-3 text-white/40">
            Only administrators can check
            event attendance.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080612] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-black tracking-[0.25em] text-fuchsia-400">
          CAMPUS VIBE
        </p>

        <h1 className="mt-3 text-4xl font-black">
          Event Entry
        </h1>

        <p className="mt-3 text-sm leading-6 text-white/40">
          Enter the student's 8-character
          entry code to verify attendance.
        </p>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <label
            htmlFor="entry-code"
            className="text-xs font-black uppercase tracking-[0.2em] text-white/40"
          >
            Entry Code
          </label>

          <input
            id="entry-code"
            value={entryCode}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(event) => {
              setEntryCode(
                event.target.value
                  .toUpperCase()
                  .replace(
                    /[^A-Z0-9]/g,
                    ""
                  )
              );

              setError("");
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter"
              ) {
                checkEntryCode();
              }
            }}
            placeholder="K7M4X2QP"
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-5 text-center text-3xl font-black tracking-[0.25em] outline-none transition placeholder:text-white/15 focus:border-fuchsia-400"
          />

          <button
            type="button"
            onClick={checkEntryCode}
            disabled={
              loading ||
              entryCode.length !== 8
            }
            className="mt-4 w-full rounded-2xl bg-fuchsia-500 px-5 py-4 font-black transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading
              ? "CHECKING..."
              : "CHECK ENTRY"}
          </button>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-5">
            <p className="font-black text-red-300">
              ENTRY NOT FOUND
            </p>

            <p className="mt-2 text-sm text-red-200/60">
              {error}
            </p>
          </div>
        )}

        {pass && (
          <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
            <div
              className={`p-6 ${
                pass.status ===
                "active"
                  ? "bg-emerald-500/10"
                  : "bg-yellow-500/10"
              }`}
            >
              <div className="text-5xl">
                {pass.status ===
                "active"
                  ? "✅"
                  : "⚠️"}
              </div>

              <p
                className={`mt-4 text-xs font-black tracking-[0.2em] ${
                  pass.status ===
                  "active"
                    ? "text-emerald-300"
                    : "text-yellow-300"
                }`}
              >
                {pass.status ===
                "active"
                  ? "VALID ENTRY"
                  : "ALREADY USED"}
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {pass.status ===
                "active"
                  ? "Attendee verified"
                  : "Attendance already recorded"}
              </h2>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/30">
                  Attendee
                </p>

                <p className="mt-1 text-xl font-black">
                  {pass.attendeeName}
                </p>

                <p className="mt-1 break-all text-sm text-white/50">
                  {pass.attendeeEmail}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/30">
                  Event
                </p>

                <p className="mt-1 text-lg font-black">
                  {pass.eventTitle}
                </p>
              </div>

              {pass.status ===
                "used" &&
                pass.scannedAt && (
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-yellow-300">
                      Attendance recorded
                    </p>

                    <p className="mt-2 text-sm text-white/60">
                      {formatTime(
                        pass.scannedAt
                      )}
                    </p>
                  </div>
                )}

              {message && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">
                  {message}
                </div>
              )}

              {pass.status ===
                "active" && (
                <button
                  type="button"
                  onClick={markEntry}
                  disabled={marking}
                  className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-base font-black text-black transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {marking
                    ? "RECORDING..."
                    : "✓ MARK ATTENDED"}
                </button>
              )}

              <button
                type="button"
                onClick={reset}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-sm font-black transition hover:bg-white/10"
              >
                CHECK ANOTHER ATTENDEE
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}