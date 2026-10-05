"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

export default function AdminPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setIsAdmin(false);
          setChecking(false);
          return;
        }

        try {
          const adminDoc = await getDoc(
            doc(db, "admins", user.uid)
          );

          setIsAdmin(
            adminDoc.exists() &&
              adminDoc.data()?.role === "admin"
          );
        } catch (error) {
          console.error(
            "Admin check failed:",
            error
          );

          setIsAdmin(false);
        }

        setChecking(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">
            ⚡
          </div>

          <p className="text-white/50">
            Checking admin access...
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] px-6 text-white">

        <div className="max-w-md text-center">

          <div className="mb-5 text-6xl">
            🔒
          </div>

          <h1 className="text-4xl font-black">
            Access denied
          </h1>

          <p className="mt-4 text-white/50">
            You don't have permission to access
            the Sreenidhi admin dashboard.
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl bg-white px-6 py-3 font-black text-black transition hover:scale-105"
          >
            Back to Campus →
          </button>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08080d] px-6 py-10 text-white">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <header className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">

          <div>

            <p className="text-xs font-black tracking-[0.3em] text-fuchsia-400">
              SREENIDHI
            </p>

            <h1 className="mt-3 text-5xl font-black tracking-tight">
              Admin Dashboard
            </h1>

            <p className="mt-3 max-w-xl text-white/40">
              Manage campus events, registrations,
              notifications and announcements from one place.
            </p>

          </div>

          <button
            onClick={() => router.push("/")}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            ← View Website
          </button>

        </header>


        {/* MAIN DASHBOARD CARDS */}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

          {/* CREATE EVENT */}

          <button
            onClick={() =>
              router.push("/admin/events/new")
            }
            className="group rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-left transition hover:-translate-y-1 hover:bg-white/[0.08]"
          >

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-3xl">
              ➕
            </div>

            <h2 className="mt-6 text-xl font-black">
              Create Event
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/40">
              Add a new campus event with its date,
              venue, category and registration details.
            </p>

            <p className="mt-6 text-sm font-bold text-fuchsia-400">
              Create one →
            </p>

          </button>


          {/* MANAGE EVENTS */}

          <button
            onClick={() =>
              router.push("/admin/events")
            }
            className="group rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-left transition hover:-translate-y-1 hover:bg-white/[0.08]"
          >

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl">
              ✏️
            </div>

            <h2 className="mt-6 text-xl font-black">
              Manage Events
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/40">
              Edit, publish, unpublish or delete events
              that are already on the platform.
            </p>

            <p className="mt-6 text-sm font-bold text-blue-400">
              Manage events →
            </p>

          </button>


          {/* REGISTRATIONS */}

          <button
            onClick={() =>
              router.push("/admin/registrations")
            }
            className="group rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-left transition hover:-translate-y-1 hover:bg-white/[0.08]"
          >

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-3xl">
              👥
            </div>

            <h2 className="mt-6 text-xl font-black">
              Registrations
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/40">
              See who has registered for your campus
              events and manage attendance.
            </p>

            <p className="mt-6 text-sm font-bold text-green-400">
              View registrations →
            </p>

          </button>


          {/* POLLS */}

          <button
            onClick={() =>
              router.push("/admin/polls")
            }
            className="group rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-left transition hover:-translate-y-1 hover:bg-white/[0.08]"
          >

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl">
              📊
            </div>

            <h2 className="mt-6 text-xl font-black">
              Polls
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/40">
              View poll results, vote counts and
              see what students are choosing.
            </p>

            <p className="mt-6 text-sm font-bold text-purple-400">
              View poll results →
            </p>

          </button>


          {/* NOTIFICATIONS */}

          <button
            onClick={() =>
              router.push("/admin/notifications")
            }
            className="group rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-left transition hover:-translate-y-1 hover:bg-white/[0.08]"
          >

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-3xl">
              🔔
            </div>

            <h2 className="mt-6 text-xl font-black">
              Notifications
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/40">
              Send announcements, event alerts and
              reminders directly to students.
            </p>

            <p className="mt-6 text-sm font-bold text-cyan-400">
              Create notification →
            </p>

          </button>

        </section>


        {/* QUICK ACTIONS */}

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-7">

          <h2 className="text-lg font-black">
            Quick Actions
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">

            <button
              onClick={() =>
                router.push("/admin/events/new")
              }
              className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:scale-105"
            >
              + New Event
            </button>

            <button
              onClick={() =>
                router.push("/admin/notifications")
              }
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-black transition hover:scale-105"
            >
              🔔 New Notification
            </button>

            <button
              onClick={() =>
                router.push("/admin/registrations")
              }
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              👥 Registrations
            </button>

            <button
              onClick={() =>
                router.push("/admin/polls")
              }
              className="rounded-xl border border-purple-400/20 px-5 py-3 text-sm font-bold text-purple-300 transition hover:bg-purple-400/10 hover:text-purple-200"
            >
              📊 Poll Results
            </button>

            <button
              onClick={() =>
                router.push("/")
              }
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              Open Campus Website
            </button>

          </div>

        </section>


        {/* FOOTER */}

        <footer className="mt-12 border-t border-white/10 pt-6 text-sm text-white/30">
          Sreenidhi Campus Vibe · Admin Area
        </footer>

      </div>

    </main>
  );
}