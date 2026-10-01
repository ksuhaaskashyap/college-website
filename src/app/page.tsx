"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "@/lib/firebase";

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

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  published: boolean;
  createdAt?: Timestamp;
  expiresAt?: Timestamp | null;
};

export default function Home() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // EVENT LOADING / ERROR
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [eventsRetry, setEventsRetry] = useState(0);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // -----------------------------------------
  // AUTH
  // -----------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);

      if (!user) {
        setNotifications([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // -----------------------------------------
  // CLOCK
  // -----------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // -----------------------------------------
  // EVENTS
  // -----------------------------------------
  useEffect(() => {
    setLoadingEvents(true);
    setEventsError(false);

    const eventsQuery = query(
      collection(db, "events"),
      where("published", "==", true)
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const eventData: EventItem[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<EventItem, "id">),
        }));

        eventData.sort((a, b) => {
          return a.date.localeCompare(b.date);
        });

        setEvents(eventData);
        setLoadingEvents(false);
        setEventsError(false);
      },
      (error) => {
        console.error("Error loading events:", error);

        setEvents([]);
        setLoadingEvents(false);
        setEventsError(true);
      }
    );

    return () => unsubscribe();
  }, [eventsRetry]);

  // -----------------------------------------
  // NOTIFICATIONS
  // -----------------------------------------
  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([]);
      return;
    }

    const neverExpiresQuery = query(
      collection(db, "notifications"),
      where("published", "==", true),
      where("expiresAt", "==", null)
    );

    const activeExpiryQuery = query(
      collection(db, "notifications"),
      where("published", "==", true),
      where("expiresAt", ">", Timestamp.now())
    );

    let neverExpires: NotificationItem[] = [];
    let activeExpiry: NotificationItem[] = [];

    const updateNotifications = () => {
      const combined = [...neverExpires, ...activeExpiry];

      const uniqueNotifications = Array.from(
        new Map(combined.map((item) => [item.id, item])).values()
      );

      uniqueNotifications.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() ?? 0;
        const bTime = b.createdAt?.toMillis() ?? 0;

        return bTime - aTime;
      });

      setNotifications(uniqueNotifications);
    };

    const unsubscribeNever = onSnapshot(
      neverExpiresQuery,
      (snapshot) => {
        neverExpires = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<NotificationItem, "id">),
        }));

        updateNotifications();
      },
      (error) => {
        console.error("Error loading notifications:", error);
      }
    );

    const unsubscribeActive = onSnapshot(
      activeExpiryQuery,
      (snapshot) => {
        activeExpiry = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<NotificationItem, "id">),
        }));

        updateNotifications();
      },
      (error) => {
        console.error("Error loading active notifications:", error);
      }
    );

    return () => {
      unsubscribeNever();
      unsubscribeActive();
    };
  }, [isLoggedIn, currentTime]);

  // -----------------------------------------
  // HELPERS
  // -----------------------------------------
  const formatDate = (date: string) => {
    if (!date) return "Date TBA";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      {/* =========================================
          NAVBAR
      ========================================== */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
          <a href="/" className="flex min-w-0 items-center">
            <img
              src="/suh.jpg"
              alt="Sreenidhi University"
              className="h-10 w-auto rounded-lg object-contain sm:h-12 md:h-14"
            />
          </a>

          <div className="hidden items-center gap-6 md:flex lg:gap-8">
            <a
              href="#events"
              className="text-sm font-semibold text-white/70 transition hover:text-white"
            >
              Events
            </a>

            <a
              href="#clubs"
              className="text-sm font-semibold text-white/70 transition hover:text-white"
            >
              Clubs
            </a>

            <a
              href="#about"
              className="text-sm font-semibold text-white/70 transition hover:text-white"
            >
              About
            </a>

            {isLoggedIn && (
              <button
                onClick={() => setShowNotifications(true)}
                className="relative rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
              >
                🔔 Notifications

                {notifications.length > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-black text-white">
                    {notifications.length}
                  </span>
                )}
              </button>
            )}

            {isLoggedIn && (
              <div className="flex items-center gap-2">
                <a
                  href="/admin"
                  className="rounded-full bg-white px-4 py-2 text-sm font-black text-black transition hover:bg-fuchsia-400"
                >
                  Admin
                </a>

                <button
                  onClick={handleLogout}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Logout
                </button>
              </div>
            )}

            {!isLoggedIn && (
              <a
                href="/auth"
                className="rounded-full bg-white px-4 py-2 text-sm font-black text-black transition hover:bg-fuchsia-400"
              >
                Login
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {isLoggedIn && (
              <button
                onClick={() => setShowNotifications(true)}
                aria-label="Open notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg transition active:scale-95"
              >
                🔔

                {notifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-black">
                    {notifications.length}
                  </span>
                )}
              </button>
            )}

            {!isLoggedIn && (
              <a
                href="/auth"
                className="rounded-full bg-white px-4 py-2 text-sm font-black text-black transition active:scale-95"
              >
                Login
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* =========================================
          HERO
      ========================================== */}
      <section className="relative overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[100px] sm:h-[400px] sm:w-[400px] md:h-[500px] md:w-[500px] md:blur-[140px]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:pb-24 sm:pt-20 md:px-5 md:pb-32 md:pt-32">
          <div className="max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300 sm:mb-6 sm:px-4 sm:text-xs sm:tracking-widest">
              ⚡ Sreenidhi University
            </div>

            <h1 className="text-[3.3rem] font-black leading-[0.9] tracking-[-0.05em] sm:text-6xl md:text-8xl">
              YOUR CAMPUS.
              <br />
              <span className="text-fuchsia-400">YOUR VIBE.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-white/60 sm:mt-8 sm:text-lg sm:leading-8 md:text-xl">
              Discover events, clubs, competitions, workshops and everything
              happening around campus — all in one place.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4">
              <a
                href="#events"
                className="flex min-h-12 items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-black text-black transition hover:scale-105 hover:bg-fuchsia-400 active:scale-95 sm:min-h-0 sm:py-4"
              >
                Explore Events →
              </a>

              <a
                href="#about"
                className="flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3 text-sm font-black transition hover:bg-white/10 active:scale-95 sm:min-h-0 sm:py-4"
              >
                About Campus Vibe
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================
          LIVE BAR
      ========================================== */}
      <section className="border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-400" />
            </span>

            <span className="text-xs font-black uppercase tracking-[0.18em] text-white/70 sm:text-sm sm:tracking-widest">
              Campus is live
            </span>
          </div>

          <span className="text-xs font-semibold text-white/40 sm:text-sm">
            {loadingEvents
              ? "Loading events..."
              : eventsError
                ? "Events unavailable"
                : `${events.length} upcoming event${
                    events.length === 1 ? "" : "s"
                  }`}
          </span>
        </div>
      </section>

      {/* =========================================
          EVENTS
      ========================================== */}
      <section
        id="events"
        className="mx-auto max-w-7xl px-5 py-16 sm:py-20 md:py-24"
      >
        <div className="mb-9 flex flex-col justify-between gap-5 sm:mb-12 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-400 sm:text-xs sm:tracking-[0.3em]">
              What&apos;s happening
            </p>

            <h2 className="text-4xl font-black tracking-[-0.03em] sm:text-5xl md:text-6xl">
              UPCOMING EVENTS
            </h2>
          </div>

          <p className="max-w-md text-sm leading-6 text-white/50">
            Find something you love, meet people, and make your campus life
            memorable.
          </p>
        </div>

        {/* LOADING */}
        {loadingEvents && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center sm:p-14">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/10 border-t-fuchsia-400 text-xl animate-spin">
              ⚡
            </div>

            <h3 className="mt-6 text-xl font-black">
              Loading campus events...
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/40">
              Give us a second while we fetch the latest events.
            </p>
          </div>
        )}

        {/* ERROR */}
        {!loadingEvents && eventsError && (
          <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-10 text-center sm:p-14">
            <div className="text-5xl">⚠️</div>

            <h3 className="mt-5 text-xl font-black">
              Couldn&apos;t load events
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
              Something went wrong while connecting to Campus Vibe. Please try
              again.
            </p>

            <button
              onClick={() => setEventsRetry((value) => value + 1)}
              className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-fuchsia-400 active:scale-95"
            >
              Try Again ↻
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!loadingEvents && !eventsError && events.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-12">
            <div className="text-4xl">📅</div>

            <h3 className="mt-5 text-xl font-black">
              No events published yet
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/50">
              Check back soon. Something exciting is probably coming.
            </p>
          </div>
        )}

        {/* EVENTS */}
        {!loadingEvents && !eventsError && events.length > 0 && (
          <div className="grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <article
                key={event.id}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-2 hover:border-fuchsia-400/40 hover:bg-white/[0.06] sm:p-6"
              >
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-fuchsia-500/10 blur-3xl transition group-hover:bg-fuchsia-500/20" />

                <div className="relative">
                  <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
                    <span className="max-w-[55%] rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-fuchsia-300 sm:text-[10px]">
                      {event.category || "Event"}
                    </span>

                    <span className="text-right text-[11px] font-bold text-white/40 sm:text-xs">
                      {formatDate(event.date)}
                    </span>
                  </div>

                  <h3 className="text-xl font-black leading-tight transition group-hover:text-fuchsia-300 sm:text-2xl">
                    {event.title}
                  </h3>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/50 sm:mt-4">
                    {event.description}
                  </p>

                  <div className="mt-5 space-y-2 text-sm text-white/60 sm:mt-6">
                    <div className="flex items-start gap-2">
                      <span>🕒</span>
                      <span>{event.time || "Time TBA"}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span>📍</span>
                      <span>{event.venue || "Venue TBA"}</span>
                    </div>
                  </div>

                  <div className="mt-7 flex items-center justify-between sm:mt-8">
                    <a
                      href={`/events/${event.id}`}
                      className="inline-flex min-h-10 items-center text-sm font-black transition group-hover:text-fuchsia-400"
                    >
                      View Event →
                    </a>

                    <span className="text-lg transition group-hover:translate-x-1">
                      ↗
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* =========================================
          CLUBS
      ========================================== */}
      <section
        id="clubs"
        className="border-y border-white/10 bg-white/[0.025]"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20 md:py-24">
          <div className="mb-9 sm:mb-12">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-400 sm:text-xs sm:tracking-[0.3em]">
              Find your people
            </p>

            <h2 className="text-4xl font-black tracking-[-0.03em] sm:text-5xl md:text-6xl">
              CAMPUS CLUBS
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {[
              ["💻", "TECH", "Build. Code. Create."],
              ["🎨", "CREATIVE", "Design. Create. Express."],
              ["🎤", "CULTURAL", "Perform. Celebrate. Connect."],
              ["🏆", "SPORTS", "Compete. Train. Win."],
            ].map(([emoji, title, text]) => (
              <div
                key={title}
                className="rounded-3xl border border-white/10 bg-black/30 p-6 transition hover:-translate-y-1 hover:border-white/20 sm:p-7"
              >
                <div className="text-4xl">{emoji}</div>

                <h3 className="mt-5 text-xl font-black sm:mt-6">{title}</h3>

                <p className="mt-2 text-sm text-white/45">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================
          ABOUT
      ========================================== */}
      <section
        id="about"
        className="mx-auto max-w-7xl px-5 py-16 sm:py-20 md:py-24"
      >
        <div className="grid gap-10 sm:gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-400 sm:text-xs sm:tracking-[0.3em]">
              About Campus Vibe
            </p>

            <h2 className="text-4xl font-black tracking-[-0.03em] sm:text-5xl md:text-6xl">
              COLLEGE HAPPENS
              <br />
              <span className="text-fuchsia-400">
                BEYOND THE CLASSROOM.
              </span>
            </h2>
          </div>

          <div className="space-y-6 text-sm leading-7 text-white/55 sm:text-base sm:leading-8">
            <p>
              Campus Vibe brings Sreenidhi University events into one place.
              From technical fests and workshops to cultural programs,
              competitions and club activities, students can discover what is
              happening around campus.
            </p>

            <p>
              The goal is simple: make campus life easier to discover, more
              connected, and more exciting.
            </p>

            <div className="border-l-2 border-fuchsia-400 pl-4 sm:pl-5">
              <p className="font-black text-white">
                BUILT BY K. SUHAAS KASHYAP
              </p>

              <p className="text-sm text-white/40">
                First Year · Sreenidhi University
              </p>
            </div>

            <p className="font-black text-white">
              Your campus. Your people. Your vibe. ⚡
            </p>
          </div>
        </div>
      </section>

      {/* =========================================
          FOOTER
      ========================================== */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 sm:gap-4 sm:py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black">CAMPUS VIBE ⚡</p>

            <p className="mt-1 text-xs text-white/35">
              Sreenidhi University
            </p>
          </div>

          <p className="text-xs text-white/30">
            Built for campus. Built by students.
          </p>
        </div>
      </footer>

      {/* =========================================
          NOTIFICATIONS POPUP
      ========================================== */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-0 backdrop-blur-sm sm:items-center sm:px-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNotifications(false);
            }
          }}
        >
          <div className="max-h-[88vh] w-full overflow-hidden rounded-t-3xl border border-white/10 bg-[#101010] shadow-2xl sm:max-h-[80vh] sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-400 sm:text-xs sm:tracking-[0.25em]">
                  Campus updates
                </p>

                <h2 className="mt-1 text-xl font-black sm:text-2xl">
                  Notifications
                </h2>
              </div>

              <button
                onClick={() => setShowNotifications(false)}
                aria-label="Close notifications"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg transition hover:bg-white/10 active:scale-95"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4 sm:max-h-[60vh] sm:p-5">
              {!isLoggedIn ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center sm:p-8">
                  <div className="text-4xl">🔐</div>

                  <h3 className="mt-4 font-black">
                    Login to see notifications
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-white/40">
                    Sign in to receive campus updates.
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center sm:p-8">
                  <div className="text-4xl">✨</div>

                  <h3 className="mt-4 font-black">
                    You&apos;re all caught up
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-white/40">
                    No new campus notifications right now.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-400 sm:text-[10px]">
                            {notification.type || "Update"}
                          </span>

                          <h3 className="mt-2 break-words text-base font-black sm:text-lg">
                            {notification.title}
                          </h3>
                        </div>

                        <span className="shrink-0 text-lg">🔔</span>
                      </div>

                      <p className="mt-3 break-words text-sm leading-6 text-white/50">
                        {notification.message}
                      </p>

                      {notification.createdAt && (
                        <p className="mt-4 text-[10px] font-semibold text-white/25 sm:text-[11px]">
                          {notification.createdAt
                            .toDate()
                            .toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}