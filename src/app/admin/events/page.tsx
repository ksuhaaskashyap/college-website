"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type EventItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  category: string;
  registrationLink?: string;
  published: boolean;
};

export default function ManageEventsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const adminDoc = await getDoc(
          doc(db, "admins", user.uid)
        );

        if (!adminDoc.exists() || adminDoc.data()?.role !== "admin") {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);

        const eventsQuery = query(
          collection(db, "events"),
          orderBy("date", "asc")
        );

        const snapshot = await getDocs(eventsQuery);

        const eventList = snapshot.docs.map((eventDoc) => ({
          id: eventDoc.id,
          ...eventDoc.data(),
        })) as EventItem[];

        setEvents(eventList);
      } catch (error) {
        console.error("Failed to load events:", error);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function togglePublished(
    eventId: string,
    currentValue: boolean
  ) {
    try {
      await updateDoc(doc(db, "events", eventId), {
        published: !currentValue,
      });

      setEvents((current) =>
        current.map((event) =>
          event.id === eventId
            ? { ...event, published: !currentValue }
            : event
        )
      );
    } catch (error) {
      console.error("Failed to update event:", error);
    }
  }

  async function deleteEvent(eventId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this event?"
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "events", eventId));

      setEvents((current) =>
        current.filter((event) => event.id !== eventId)
      );
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">⚡</div>
          <p className="text-white/50">
            Loading events...
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] px-6 text-white">
        <div className="text-center">
          <div className="mb-5 text-6xl">🔒</div>

          <h1 className="text-4xl font-black">
            Access denied
          </h1>

          <p className="mt-4 text-white/50">
            You don't have permission to manage events.
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl bg-white px-6 py-3 font-black text-black"
          >
            Back to Campus →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08080d] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="mb-6 text-sm text-white/40 hover:text-white"
            >
              ← Back to dashboard
            </button>

            <p className="text-xs font-black tracking-[0.3em] text-blue-400">
              SREENIDHI
            </p>

            <h1 className="mt-3 text-5xl font-black">
              Manage Events
            </h1>

            <p className="mt-3 text-white/40">
              Edit, publish and manage your campus events.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin/events/new")}
            className="rounded-xl bg-white px-5 py-3 font-black text-black transition hover:scale-105"
          >
            + Create Event
          </button>
        </div>

        {events.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">
            <div className="text-5xl">📅</div>

            <h2 className="mt-5 text-2xl font-black">
              No events yet
            </h2>

            <p className="mt-2 text-white/40">
              Create your first campus event.
            </p>

            <button
              onClick={() => router.push("/admin/events/new")}
              className="mt-6 rounded-xl bg-fuchsia-500 px-6 py-3 font-black"
            >
              Create Event →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
              >
                <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black">
                        {event.title}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          event.published
                            ? "bg-green-500/10 text-green-400"
                            : "bg-yellow-500/10 text-yellow-400"
                        }`}
                      >
                        {event.published
                          ? "Published"
                          : "Unpublished"}
                      </span>
                    </div>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
                      {event.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/50">
                      <span>📅 {event.date}</span>
                      <span>🕐 {event.time}</span>
                      <span>📍 {event.venue}</span>
                      <span>🏷️ {event.category}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() =>
                        togglePublished(
                          event.id,
                          event.published
                        )
                      }
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold hover:bg-white/10"
                    >
                      {event.published
                        ? "Unpublish"
                        : "Publish"}
                    </button>

                    <button
                      onClick={() =>
                        router.push(
                          `/admin/events/${event.id}/edit`
                        )
                      }
                      className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-black text-white"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}