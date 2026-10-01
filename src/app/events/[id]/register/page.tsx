"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();

  const eventId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [event, setEvent] = useState<any>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");

  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        try {
          setUser(currentUser);

          // Load event
          const eventDoc = await getDoc(
            doc(db, "events", eventId)
          );

          if (!eventDoc.exists()) {
            setMessage("This event doesn't exist.");
            setLoading(false);
            return;
          }

          const eventData = eventDoc.data();

          setEvent({
            id: eventDoc.id,
            ...eventData,
          });

          // Check existing registration
          if (currentUser) {
            const registrationDoc = await getDoc(
              doc(
                db,
                "registrations",
                `${eventId}_${currentUser.uid}`
              )
            );

            if (registrationDoc.exists()) {
              setAlreadyRegistered(true);

              const registration =
                registrationDoc.data();

              setFullName(
                registration.fullName || ""
              );

              setDepartment(
                registration.department || ""
              );

              setYear(
                registration.year || ""
              );
            }
          }
        } catch (error) {
          console.error(
            "Failed to load registration:",
            error
          );

          setMessage(
            "Couldn't load this event."
          );
        }

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  async function registerForEvent(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!user) {
      setMessage(
        "Please sign in before registering."
      );
      return;
    }

    if (!fullName.trim()) {
      setMessage("Please enter your name.");
      return;
    }

    if (alreadyRegistered) {
      setMessage(
        "You are already registered for this event."
      );
      return;
    }

    setRegistering(true);
    setMessage("");

    try {
      const registrationId =
        `${eventId}_${user.uid}`;

      const registrationRef = doc(
        db,
        "registrations",
        registrationId
      );

      // Check one more time immediately before writing.
      // This protects against duplicate clicks or multiple tabs.
      const existingRegistration =
        await getDoc(registrationRef);

      if (existingRegistration.exists()) {
        setAlreadyRegistered(true);

        const registration =
          existingRegistration.data();

        setFullName(
          registration.fullName || ""
        );

        setDepartment(
          registration.department || ""
        );

        setYear(
          registration.year || ""
        );

        setMessage(
          "You are already registered for this event."
        );

        setRegistering(false);
        return;
      }

      await setDoc(
        registrationRef,
        {
          eventId,
          eventTitle: event.title,
          userId: user.uid,
          email: user.email || "",
          fullName: fullName.trim(),
          department,
          year,
          registeredAt: serverTimestamp(),
        }
      );

      setAlreadyRegistered(true);

      setMessage(
        "You're registered successfully! 🎉"
      );
    } catch (error) {
      console.error(
        "Registration failed:",
        error
      );

      setMessage(
        "Registration failed. Please try again."
      );
    }

    setRegistering(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">
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
        <div className="text-center">
          <div className="text-6xl">
            😕
          </div>

          <h1 className="mt-5 text-3xl font-black">
            Event not found
          </h1>

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

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] px-6 text-white">
        <div className="max-w-lg text-center">

          <div className="text-6xl">
            🎟️
          </div>

          <h1 className="mt-6 text-4xl font-black">
            Register for {event.title}
          </h1>

          <p className="mt-4 text-white/40">
            Sign in to register for this campus event.
          </p>

          <button
            onClick={() => router.push("/auth")}
            className="mt-8 rounded-xl bg-fuchsia-500 px-7 py-4 font-black text-white transition hover:scale-105"
          >
            Sign In to Register →
          </button>

          <button
            onClick={() => router.push("/")}
            className="ml-3 rounded-xl border border-white/10 px-7 py-4 font-bold text-white/60 hover:bg-white/5"
          >
            Back
          </button>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08080d] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">

        <button
          onClick={() => router.push("/")}
          className="mb-8 text-sm text-white/40 hover:text-white"
        >
          ← Back to campus
        </button>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 md:p-10">

          <p className="text-xs font-black tracking-[0.3em] text-fuchsia-400">
            EVENT REGISTRATION
          </p>

          <h1 className="mt-4 text-4xl font-black">
            {event.title}
          </h1>

          <p className="mt-4 leading-7 text-white/50">
            {event.description}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">

            <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-white/60">
              📅 {event.date}
            </span>

            <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-white/60">
              🕐 {event.time}
            </span>

            <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-white/60">
              📍 {event.venue}
            </span>

          </div>

          <div className="my-8 border-t border-white/10" />

          {alreadyRegistered ? (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-6">

              <div className="text-4xl">
                🎉
              </div>

              <h2 className="mt-4 text-2xl font-black text-green-300">
                You're registered!
              </h2>

              <p className="mt-2 text-sm text-green-200/60">
                Your registration for this event has been saved.
              </p>

              <div className="mt-5 space-y-2 text-sm text-white/60">
                <p>
                  <strong>Name:</strong>{" "}
                  {fullName}
                </p>

                <p>
                  <strong>Email:</strong>{" "}
                  {user.email}
                </p>

                {department && (
                  <p>
                    <strong>Department:</strong>{" "}
                    {department}
                  </p>
                )}

                {year && (
                  <p>
                    <strong>Year:</strong>{" "}
                    {year}
                  </p>
                )}
              </div>

              <button
                onClick={() => router.push("/")}
                className="mt-7 rounded-xl bg-white px-6 py-3 font-black text-black"
              >
                Back to Campus →
              </button>

            </div>
          ) : (
            <form
              onSubmit={registerForEvent}
              className="space-y-6"
            >

              <div>
                <label className="text-sm font-bold text-white/70">
                  Full name
                </label>

                <input
                  required
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  placeholder="Your full name"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-white/70">
                  Email
                </label>

                <input
                  value={user.email || ""}
                  disabled
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/40 outline-none"
                />

                <p className="mt-2 text-xs text-white/30">
                  This is the email associated with your account.
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-white/70">
                  Department
                </label>

                <input
                  value={department}
                  onChange={(e) =>
                    setDepartment(e.target.value)
                  }
                  placeholder="e.g. CSE"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-white/70">
                  Year
                </label>

                <select
                  value={year}
                  onChange={(e) =>
                    setYear(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-fuchsia-400"
                >
                  <option value="">
                    Select your year
                  </option>

                  <option value="1st Year">
                    1st Year
                  </option>

                  <option value="2nd Year">
                    2nd Year
                  </option>

                  <option value="3rd Year">
                    3rd Year
                  </option>

                  <option value="4th Year">
                    4th Year
                  </option>
                </select>
              </div>

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

              <button
                type="submit"
                disabled={registering}
                className="w-full rounded-xl bg-fuchsia-500 py-4 font-black text-white transition hover:scale-[1.01] disabled:opacity-50"
              >
                {registering
                  ? "Registering..."
                  : "Register for Event →"}
              </button>

            </form>
          )}

        </div>

      </div>
    </main>
  );
}