"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();

  const eventId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvent() {
      try {
        const eventDoc = await getDoc(
          doc(db, "events", eventId)
        );

        if (!eventDoc.exists()) {
          setError("This event doesn't exist.");
          setLoading(false);
          return;
        }

        const eventData = eventDoc.data();

        // Only published events are visible
        // on the public event detail page.
        if (eventData.published !== true) {
          setError("This event is not currently available.");
          setLoading(false);
          return;
        }

        setEvent({
          id: eventDoc.id,
          ...eventData,
        });
      } catch (error) {
        console.error(
          "Failed to load event:",
          error
        );

        setError(
          "Couldn't load this event."
        );
      }

      setLoading(false);
    }

    loadEvent();
  }, [eventId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">
            ⚡
          </div>

          <p className="text-white/50">
            Loading event...
          </p>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] px-6 text-white">
        <div className="max-w-lg text-center">
          <div className="text-6xl">
            😕
          </div>

          <h1 className="mt-6 text-3xl font-black">
            Event not found
          </h1>

          <p className="mt-3 text-white/40">
            {error || "This event could not be found."}
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl bg-white px-7 py-3 font-black text-black transition hover:scale-105"
          >
            Back to Campus
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08080d] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">

        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="mb-8 text-sm font-bold text-white/40 transition hover:text-white"
        >
          ← Back to Campus
        </button>

        {/* Event card */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">

          {/* Hero section */}
          <div className="relative overflow-hidden bg-gradient-to-br from-fuchsia-500/20 via-purple-500/10 to-cyan-500/10 px-7 py-12 md:px-12 md:py-16">

            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="relative">

              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-black tracking-[0.2em] text-fuchsia-300">
                  CAMPUS EVENT
                </span>

                {event.category && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/60">
                    {event.category}
                  </span>
                )}
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight md:text-6xl">
                {event.title}
              </h1>

              {event.description && (
                <p className="mt-6 max-w-2xl text-base leading-8 text-white/50 md:text-lg">
                  {event.description}
                </p>
              )}

            </div>
          </div>

          {/* Event information */}
          <div className="p-7 md:p-12">

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-black tracking-[0.2em] text-white/30">
                  DATE
                </p>

                <p className="mt-3 text-lg font-black">
                  📅 {event.date || "TBA"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-black tracking-[0.2em] text-white/30">
                  TIME
                </p>

                <p className="mt-3 text-lg font-black">
                  🕐 {event.time || "TBA"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2 lg:col-span-1">
                <p className="text-xs font-black tracking-[0.2em] text-white/30">
                  VENUE
                </p>

                <p className="mt-3 text-lg font-black">
                  📍 {event.venue || "TBA"}
                </p>
              </div>

            </div>

            {/* Full description */}
            <div className="mt-10">

              <p className="text-xs font-black tracking-[0.3em] text-fuchsia-400">
                ABOUT THIS EVENT
              </p>

              <h2 className="mt-3 text-2xl font-black">
                What's happening?
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-white/50">
                {event.description ||
                  "More information about this event will be available soon."}
              </p>

            </div>

            {/* Registration */}
            <div className="mt-12 rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-7 md:p-8">

              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

                <div>
                  <p className="text-xs font-black tracking-[0.25em] text-fuchsia-400">
                    READY TO JOIN?
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Save your spot.
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/40">
                    Register for this event and be part of the campus experience.
                  </p>
                </div>

                <button
                  onClick={() =>
                    router.push(
                      `/events/${event.id}/register`
                    )
                  }
                  className="shrink-0 rounded-2xl bg-fuchsia-500 px-8 py-4 font-black text-white shadow-lg shadow-fuchsia-500/20 transition hover:scale-105 hover:bg-fuchsia-400"
                >
                  Register Now →
                </button>

              </div>

            </div>

          </div>
        </div>

        {/* Bottom navigation */}
        <div className="mt-8 flex flex-wrap gap-3">

          <button
            onClick={() => router.push("/")}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            ← All Events
          </button>

          <button
            onClick={() =>
              router.push(
                `/events/${event.id}/register`
              )
            }
            className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:scale-105"
          >
            Register →
          </button>

        </div>

      </div>
    </main>
  );
}