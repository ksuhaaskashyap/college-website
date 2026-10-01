"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();

  const eventId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [category, setCategory] = useState("Campus");
  const [registrationLink, setRegistrationLink] = useState("");
  const [published, setPublished] = useState(true);

  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Check admin access
        const adminDoc = await getDoc(
          doc(db, "admins", user.uid)
        );

        if (
          !adminDoc.exists() ||
          adminDoc.data()?.role !== "admin"
        ) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);

        // Load event
        const eventDoc = await getDoc(
          doc(db, "events", eventId)
        );

        if (!eventDoc.exists()) {
          setMessage("Event not found.");
          setLoading(false);
          return;
        }

        const event = eventDoc.data();

        setTitle(event.title || "");
        setDescription(event.description || "");
        setDate(event.date || "");
        setTime(event.time || "");
        setVenue(event.venue || "");
        setCategory(event.category || "Campus");
        setRegistrationLink(event.registrationLink || "");
        setPublished(event.published ?? true);
      } catch (error) {
        console.error("Failed to load event:", error);
        setMessage("Couldn't load this event.");
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [eventId]);

  async function saveChanges(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      await updateDoc(doc(db, "events", eventId), {
        title,
        description,
        date,
        time,
        venue,
        category,
        registrationLink,
        published,
      });

      setMessage("Event updated successfully! ✅");

      setTimeout(() => {
        router.push("/admin/events");
      }, 800);
    } catch (error) {
      console.error("Failed to update event:", error);

      setMessage(
        "Couldn't save the changes. Please try again."
      );

      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">⚡</div>

          <p className="text-white/50">
            Loading event...
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
            You don't have permission to edit events.
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
      <div className="mx-auto max-w-3xl">

        <button
          onClick={() => router.push("/admin/events")}
          className="mb-8 text-sm text-white/40 hover:text-white"
        >
          ← Back to events
        </button>

        <p className="text-xs font-black tracking-[0.3em] text-blue-400">
          SREENIDHI
        </p>

        <h1 className="mt-3 text-5xl font-black">
          Edit Event
        </h1>

        <p className="mt-3 text-white/40">
          Update the details of your campus event.
        </p>

        <form
          onSubmit={saveChanges}
          className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-7"
        >

          {/* EVENT NAME */}

          <div>
            <label className="text-sm font-bold text-white/70">
              Event name
            </label>

            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-blue-400"
            />
          </div>


          {/* DESCRIPTION */}

          <div>
            <label className="text-sm font-bold text-white/70">
              Description
            </label>

            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-blue-400"
            />
          </div>


          {/* DATE + TIME */}

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
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-blue-400"
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
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-blue-400"
              />
            </div>

          </div>


          {/* VENUE + CATEGORY */}

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="text-sm font-bold text-white/70">
                Venue
              </label>

              <input
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-white/70">
                Category
              </label>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-blue-400"
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


          {/* REGISTRATION LINK */}

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
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-blue-400"
            />
          </div>


          {/* PUBLISHED */}

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
              Publish this event
            </span>

          </label>


          {/* MESSAGE */}

          {message && (
            <div
              className={`rounded-xl p-4 text-sm ${
                message.includes("successfully")
                  ? "bg-green-500/10 text-green-300"
                  : "bg-red-500/10 text-red-300"
              }`}
            >
              {message}
            </div>
          )}


          {/* BUTTONS */}

          <div className="flex flex-col gap-3 sm:flex-row">

            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-blue-500 py-4 font-black text-white transition hover:scale-[1.01] disabled:opacity-50"
            >
              {saving
                ? "Saving changes..."
                : "Save Changes →"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/events")}
              className="rounded-xl border border-white/10 px-6 py-4 font-bold text-white/60 hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>

          </div>

        </form>

      </div>
    </main>
  );
}