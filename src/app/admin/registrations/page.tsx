"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type Registration = {
  id: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  email: string;
  fullName: string;
  department: string;
  year: string;
  registeredAt?: any;
};

type EventItem = {
  id: string;
  title: string;
};

export default function RegistrationsPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [registrations, setRegistrations] = useState<
    Registration[]
  >([]);

  const [events, setEvents] = useState<EventItem[]>(
    []
  );

  const [selectedEvent, setSelectedEvent] =
    useState("all");

  const [loading, setLoading] = useState(true);

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

          const admin =
            adminDoc.exists() &&
            adminDoc.data()?.role === "admin";

          setIsAdmin(admin);

          if (admin) {
            await loadData();
          }
        } catch (error) {
          console.error(
            "Admin check failed:",
            error
          );

          setIsAdmin(false);
        }

        setChecking(false);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  async function loadData() {
    try {
      const [
        registrationsSnapshot,
        eventsSnapshot,
      ] = await Promise.all([
        getDocs(collection(db, "registrations")),
        getDocs(collection(db, "events")),
      ]);

      const registrationList =
        registrationsSnapshot.docs.map(
          (registrationDoc) => ({
            id: registrationDoc.id,
            ...registrationDoc.data(),
          })
        ) as Registration[];

      const eventList =
        eventsSnapshot.docs.map((eventDoc) => ({
          id: eventDoc.id,
          title: eventDoc.data().title || "Untitled Event",
        })) as EventItem[];

      registrationList.sort((a, b) => {
        const aTime =
          a.registeredAt?.toMillis?.() || 0;

        const bTime =
          b.registeredAt?.toMillis?.() || 0;

        return bTime - aTime;
      });

      setRegistrations(registrationList);
      setEvents(eventList);
    } catch (error) {
      console.error(
        "Failed to load registrations:",
        error
      );
    }
  }

  async function deleteRegistration(
    registrationId: string
  ) {
    const confirmed = window.confirm(
      "Delete this registration?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDoc(
        doc(
          db,
          "registrations",
          registrationId
        )
      );

      setRegistrations((current) =>
        current.filter(
          (registration) =>
            registration.id !== registrationId
        )
      );
    } catch (error) {
      console.error(
        "Failed to delete registration:",
        error
      );

      alert(
        "Couldn't delete the registration."
      );
    }
  }

  const filteredRegistrations =
    selectedEvent === "all"
      ? registrations
      : registrations.filter(
          (registration) =>
            registration.eventId ===
            selectedEvent
        );

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">

          <div className="mb-4 text-4xl">
            👥
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

        <div className="text-center">

          <div className="text-6xl">
            🔒
          </div>

          <h1 className="mt-5 text-4xl font-black">
            Access denied
          </h1>

          <p className="mt-3 text-white/40">
            Only administrators can view registrations.
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-7 rounded-xl bg-white px-6 py-3 font-black text-black"
          >
            Back to Campus
          </button>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08080d] px-6 py-10 text-white">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <header className="mb-10">

          <button
            onClick={() => router.push("/admin")}
            className="mb-8 text-sm text-white/40 transition hover:text-white"
          >
            ← Back to dashboard
          </button>

          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">

            <div>

              <p className="text-xs font-black tracking-[0.3em] text-green-400">
                SREENIDHI
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight">
                Registrations
              </h1>

              <p className="mt-3 text-white/40">
                See who is joining your campus events.
              </p>

            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4">

              <p className="text-xs text-white/40">
                Total registrations
              </p>

              <p className="mt-1 text-3xl font-black">
                {registrations.length}
              </p>

            </div>

          </div>

        </header>


        {/* FILTER */}

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">

          <label className="text-sm font-bold text-white/60">
            Filter by event
          </label>

          <select
            value={selectedEvent}
            onChange={(e) =>
              setSelectedEvent(e.target.value)
            }
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-green-400 md:max-w-md"
          >

            <option value="all">
              All Events
            </option>

            {events.map((event) => (
              <option
                key={event.id}
                value={event.id}
              >
                {event.title}
              </option>
            ))}

          </select>

        </section>


        {/* LOADING */}

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">

            <div className="text-4xl">
              ⚡
            </div>

            <p className="mt-4 text-white/40">
              Loading registrations...
            </p>

          </div>
        )}


        {/* EMPTY */}

        {!loading &&
          filteredRegistrations.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">

              <div className="text-5xl">
                👥
              </div>

              <h2 className="mt-5 text-2xl font-black">
                No registrations yet
              </h2>

              <p className="mt-2 text-white/40">
                Registrations will appear here when students sign up.
              </p>

            </div>
          )}


        {/* REGISTRATIONS */}

        {!loading &&
          filteredRegistrations.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">

              <div className="overflow-x-auto">

                <table className="w-full min-w-[900px]">

                  <thead className="border-b border-white/10 bg-white/[0.03]">

                    <tr className="text-left text-xs uppercase tracking-wider text-white/30">

                      <th className="px-6 py-5">
                        Student
                      </th>

                      <th className="px-6 py-5">
                        Event
                      </th>

                      <th className="px-6 py-5">
                        Department
                      </th>

                      <th className="px-6 py-5">
                        Year
                      </th>

                      <th className="px-6 py-5">
                        Email
                      </th>

                      <th className="px-6 py-5">
                        Action
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {filteredRegistrations.map(
                      (registration) => (

                        <tr
                          key={registration.id}
                          className="border-b border-white/5 transition hover:bg-white/[0.03]"
                        >

                          <td className="px-6 py-5">

                            <p className="font-bold">
                              {registration.fullName}
                            </p>

                          </td>


                          <td className="max-w-[220px] px-6 py-5">

                            <p className="truncate text-sm text-white/60">
                              {registration.eventTitle}
                            </p>

                          </td>


                          <td className="px-6 py-5">

                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">
                              {registration.department ||
                                "—"}
                            </span>

                          </td>


                          <td className="px-6 py-5 text-sm text-white/60">

                            {registration.year ||
                              "—"}

                          </td>


                          <td className="px-6 py-5 text-sm text-white/50">

                            {registration.email}

                          </td>


                          <td className="px-6 py-5">

                            <button
                              onClick={() =>
                                deleteRegistration(
                                  registration.id
                                )
                              }
                              className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10"
                            >
                              Delete
                            </button>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>
          )}

      </div>

    </main>
  );
}