"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

export default function NewEventPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [category, setCategory] = useState("Campus");
  const [registrationLink, setRegistrationLink] = useState("");
  const [published, setPublished] = useState(true);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      try {
        const adminDoc = await getDoc(
          doc(db, "admins", user.uid)
        );

        const admin =
          adminDoc.exists() &&
          adminDoc.data()?.role === "admin";

        setIsAdmin(admin);
      } catch (error) {
        console.error("Admin check failed:", error);
        setIsAdmin(false);
      }

      setChecking(false);
    });

    return () => unsubscribe();
  }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      await addDoc(collection(db, "events"), {
        title,
        description,
        date,
        time,
        venue,
        category,
        registrationLink,
        published,
        createdAt: serverTimestamp(),
      });

      router.push("/admin/events");
    } catch (error) {
      console.error("Failed to create event:", error);

      setMessage(
        "Couldn't create the event. Please try again."
      );

      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">⚡</div>

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
            Only administrators can manage events.
          </p>

          <button
            onClick={() => router.push("/admin")}
            className="mt-8 rounded-xl bg-white px-6 py-3 font-black text-black transition hover:scale-105"
          >
            Back to Dashboard →
          </button>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08080d] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">

        <button
          onClick={() => router.push("/admin")}
          className="mb-8 text-sm text-white/40 hover:text-white"
        >
          ← Back to dashboard
        </button>

        <p className="text-xs font-black tracking-[0.3em] text-fuchsia-400">
          SREENIDHI
        </p>

        <h1 className="mt-3 text-5xl font-black">
          Create Event
        </h1>

        <p className="mt-3 text-white/40">
          Add something exciting to campus.
        </p>

        <form
          onSubmit={createEvent}
          className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-7"
        >

          <div>
            <label className="text-sm font-bold text-white/70">
              Event name
            </label>

            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sreenidhi Tech Fest 2026"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-white/70">
              Description
            </label>

            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell students what this event is about..."
              rows={5}
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="text-sm font-bold text-white/70">
                Date
              </label>

              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-white/70">
                Time
              </label>

              <input
                required
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
              />
            </div>

          </div>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="text-sm font-bold text-white/70">
                Venue
              </label>

              <input
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Main Auditorium"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-white/70">
                Category
              </label>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
              >
                <option>Campus</option>
                <option>Technical</option>
                <option>Cultural</option>
                <option>Sports</option>
                <option>Workshop</option>
                <option>Competition</option>
                <option>Club</option>
              </select>
            </div>

          </div>

          <div>
            <label className="text-sm font-bold text-white/70">
              Registration link
            </label>

            <input
              type="url"
              value={registrationLink}
              onChange={(e) =>
                setRegistrationLink(e.target.value)
              }
              placeholder="https://..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) =>
                setPublished(e.target.checked)
              }
              className="h-5 w-5"
            />

            <span className="text-sm text-white/70">
              Publish this event immediately
            </span>
          </label>

          {message && (
            <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-white py-4 font-black text-black transition hover:scale-[1.01] disabled:opacity-50"
          >
            {saving ? "Creating event..." : "Create Event →"}
          </button>

        </form>
      </div>
    </main>
  );
}