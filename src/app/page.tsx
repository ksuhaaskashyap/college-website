"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { motion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import EventCountdown from "@/components/EventCountdown";

type EventItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  category: string;
  registrationLink?: string;
  imageUrl?: string;
  published: boolean;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  published?: boolean;

  recipientId?: string;
  actorId?: string;
  postId?: string;

  read?: boolean;

  createdAt?: any;
};

const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export default function Home() {
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([]);

  const [loadingNotifications, setLoadingNotifications] =
    useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [userEmail, setUserEmail] = useState("");

  const [showNotifications, setShowNotifications] =
    useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [readNotificationIds, setReadNotificationIds] =
    useState<string[]>([]);

  // ============================================================
  // EVENTS
  // ============================================================

  useEffect(() => {
    const eventsQuery = query(
      collection(db, "events"),
      where("published", "==", true)
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const eventList = snapshot.docs.map((eventDoc) => ({
          id: eventDoc.id,
          ...eventDoc.data(),
        })) as EventItem[];

        eventList.sort((a, b) =>
          a.date.localeCompare(b.date)
        );

        setEvents(eventList);
        setLoadingEvents(false);
      },
      (error) => {
        console.error("Failed to load events:", error);
        setLoadingEvents(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ============================================================
  // LOAD LOCALLY READ NOTIFICATIONS
  // ============================================================

  useEffect(() => {
    if (!isLoggedIn) {
      setReadNotificationIds([]);
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      return;
    }

    const storageKey =
      `campus-vibe-read-notifications-${user.uid}`;

    try {
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
          setReadNotificationIds(parsed);
        }
      } else {
        setReadNotificationIds([]);
      }
    } catch (error) {
      console.error(
        "Failed to load notification read state:",
        error
      );

      setReadNotificationIds([]);
    }
  }, [isLoggedIn]);

  // ============================================================
  // AUTH + ADMIN + NOTIFICATIONS
  // ============================================================

  useEffect(() => {
    let unsubscribeAdmin: (() => void) | null = null;

    let unsubscribeGlobalNotifications:
      | (() => void)
      | null = null;

    let unsubscribePersonalNotifications:
      | (() => void)
      | null = null;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        // --------------------------------------------------------
        // LOGGED OUT
        // --------------------------------------------------------

        if (!user) {
          setIsLoggedIn(false);
          setIsAdmin(false);
          setUserEmail("");
          setNotifications([]);
          setLoadingNotifications(false);

          if (unsubscribeAdmin) {
            unsubscribeAdmin();
            unsubscribeAdmin = null;
          }

          if (unsubscribeGlobalNotifications) {
            unsubscribeGlobalNotifications();
            unsubscribeGlobalNotifications = null;
          }

          if (unsubscribePersonalNotifications) {
            unsubscribePersonalNotifications();
            unsubscribePersonalNotifications = null;
          }

          return;
        }

        // --------------------------------------------------------
        // LOGGED IN
        // --------------------------------------------------------

        setIsLoggedIn(true);
        setUserEmail(user.email || "");
        setLoadingNotifications(true);

        // --------------------------------------------------------
        // ADMIN CHECK
        // --------------------------------------------------------

        try {
          const adminRef = doc(
            db,
            "admins",
            user.uid
          );

          unsubscribeAdmin = onSnapshot(
            adminRef,
            (adminSnapshot) => {
              if (!adminSnapshot.exists()) {
                setIsAdmin(false);
                return;
              }

              const adminData = adminSnapshot.data();

              setIsAdmin(
                adminData?.role === "admin"
              );
            },
            (error) => {
              console.error(
                "Failed to check admin status:",
                error
              );

              setIsAdmin(false);
            }
          );
        } catch (error) {
          console.error(
            "Admin check failed:",
            error
          );

          setIsAdmin(false);
        }

        // --------------------------------------------------------
        // GLOBAL NOTIFICATIONS
        // --------------------------------------------------------

        const globalNotificationsQuery = query(
          collection(db, "notifications"),
          where("published", "==", true)
        );

        unsubscribeGlobalNotifications =
          onSnapshot(
            globalNotificationsQuery,
            (snapshot) => {
              const globalNotifications =
                snapshot.docs.map(
                  (notificationDoc) => ({
                    id: notificationDoc.id,
                    ...notificationDoc.data(),
                  })
                ) as NotificationItem[];

              setNotifications((current) => {
                const personalNotifications =
                  current.filter(
                    (notification) =>
                      notification.recipientId ===
                      user.uid
                  );

                const combined = [
                  ...globalNotifications,
                  ...personalNotifications,
                ];

                const uniqueMap = new Map<
                  string,
                  NotificationItem
                >();

                combined.forEach(
                  (notification) => {
                    uniqueMap.set(
                      notification.id,
                      notification
                    );
                  }
                );

                const uniqueNotifications =
                  Array.from(
                    uniqueMap.values()
                  );

                uniqueNotifications.sort(
                  (a, b) => {
                    const aTime =
                      a.createdAt?.toMillis?.() ||
                      0;

                    const bTime =
                      b.createdAt?.toMillis?.() ||
                      0;

                    return bTime - aTime;
                  }
                );

                return uniqueNotifications;
              });

              setLoadingNotifications(false);
            },
            (error) => {
              console.error(
                "Failed to load global notifications:",
                error
              );

              setLoadingNotifications(false);
            }
          );

        // --------------------------------------------------------
        // PERSONAL NOTIFICATIONS
        // --------------------------------------------------------

        const personalNotificationsQuery =
          query(
            collection(db, "notifications"),
            where(
              "recipientId",
              "==",
              user.uid
            )
          );

        unsubscribePersonalNotifications =
          onSnapshot(
            personalNotificationsQuery,
            (snapshot) => {
              const personalNotifications =
                snapshot.docs.map(
                  (notificationDoc) => ({
                    id: notificationDoc.id,
                    ...notificationDoc.data(),
                  })
                ) as NotificationItem[];

              setNotifications((current) => {
                const globalNotifications =
                  current.filter(
                    (notification) =>
                      !notification.recipientId
                  );

                const combined = [
                  ...globalNotifications,
                  ...personalNotifications,
                ];

                const uniqueMap = new Map<
                  string,
                  NotificationItem
                >();

                combined.forEach(
                  (notification) => {
                    uniqueMap.set(
                      notification.id,
                      notification
                    );
                  }
                );

                const uniqueNotifications =
                  Array.from(
                    uniqueMap.values()
                  );

                uniqueNotifications.sort(
                  (a, b) => {
                    const aTime =
                      a.createdAt?.toMillis?.() ||
                      0;

                    const bTime =
                      b.createdAt?.toMillis?.() ||
                      0;

                    return bTime - aTime;
                  }
                );

                return uniqueNotifications;
              });

              setLoadingNotifications(false);
            },
            (error) => {
              console.error(
                "Failed to load personal notifications:",
                error
              );
            }
          );
      }
    );

    return () => {
      unsubscribeAuth();

      if (unsubscribeAdmin) {
        unsubscribeAdmin();
      }

      if (unsubscribeGlobalNotifications) {
        unsubscribeGlobalNotifications();
      }

      if (unsubscribePersonalNotifications) {
        unsubscribePersonalNotifications();
      }
    };
  }, []);

  // ============================================================
  // NOTIFICATION HELPERS
  // ============================================================

  function isNotificationRead(
    notification: NotificationItem
  ) {
    return (
      notification.read === true ||
      readNotificationIds.includes(
        notification.id
      )
    );
  }

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        !isNotificationRead(notification)
    );

  // ============================================================
  // MARK NOTIFICATION AS READ
  // ============================================================

  function markNotificationAsRead(
    notificationId: string
  ) {
    if (
      readNotificationIds.includes(
        notificationId
      )
    ) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      return;
    }

    const nextReadIds = [
      ...readNotificationIds,
      notificationId,
    ];

    setReadNotificationIds(nextReadIds);

    try {
      localStorage.setItem(
        `campus-vibe-read-notifications-${user.uid}`,
        JSON.stringify(nextReadIds)
      );
    } catch (error) {
      console.error(
        "Failed to save notification read state:",
        error
      );
    }
  }

  // ============================================================
  // MARK ALL NOTIFICATIONS AS READ
  // ============================================================

  function markAllNotificationsAsRead() {
    const user = auth.currentUser;

    if (
      !user ||
      notifications.length === 0
    ) {
      return;
    }

    const allIds = notifications.map(
      (notification) =>
        notification.id
    );

    setReadNotificationIds(allIds);

    try {
      localStorage.setItem(
        `campus-vibe-read-notifications-${user.uid}`,
        JSON.stringify(allIds)
      );
    } catch (error) {
      console.error(
        "Failed to save notification read state:",
        error
      );
    }
  }

  // ============================================================
  // NOTIFICATION ICON
  // ============================================================

  function getNotificationIcon(
    type: string
  ) {
    if (type === "event") {
      return "🎉";
    }

    if (type === "reminder") {
      return "⏰";
    }

    if (type === "announcement") {
      return "📢";
    }

    if (type === "like") {
      return "❤️";
    }

    if (type === "comment") {
      return "💬";
    }

    if (type === "poll") {
      return "🗳️";
    }

    return "🔔";
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    try {
      await signOut(auth);

      setIsLoggedIn(false);
      setIsAdmin(false);
      setUserEmail("");
      setNotifications([]);
      setReadNotificationIds([]);
      setShowNotifications(false);
      setMobileMenuOpen(false);

      router.push("/");
    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );
    }
  }

  // ============================================================
  // CLOSE MOBILE MENU
  // ============================================================

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#08080d] text-white">

      {/* ========================================================
          DESKTOP / MOBILE NAVBAR
      ======================================================== */}

      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#08080d]/75 backdrop-blur-xl">

        <div className="mx-auto max-w-7xl px-5 md:px-8">

          <div className="flex min-h-[72px] items-center justify-between">

            {/* BRAND */}

            <button
              onClick={() => {
                router.push("/");
                closeMobileMenu();
              }}
              className="text-left"
            >
              <h1 className="text-xl font-black tracking-tight">
                SREENIDHI
                <span className="text-fuchsia-400">
                  .
                </span>
              </h1>

              <p className="text-[9px] font-bold tracking-[0.35em] text-white/40">
                CAMPUS VIBE
              </p>
            </button>

            {/* DESKTOP NAV */}

            <div className="hidden items-center gap-4 md:flex">

              <a
                href="#events"
                className="px-2 text-sm font-medium text-white/60 transition hover:text-white"
              >
                Events
              </a>

              <a
                href="#clubs"
                className="px-2 text-sm font-medium text-white/60 transition hover:text-white"
              >
                Clubs
              </a>

              <a
                href="#about"
                className="px-2 text-sm font-medium text-white/60 transition hover:text-white"
              >
                About
              </a>

              <button
                onClick={() =>
                  router.push("/community")
                }
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300 transition hover:scale-105 hover:bg-cyan-400/20"
              >
                👥 Community
              </button>

              {isAdmin && (
                <button
                  onClick={() =>
                    router.push("/admin")
                  }
                  className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/20"
                >
                  🛠️ Admin
                </button>
              )}

              {isLoggedIn && (
                <button
                  onClick={() =>
                    setShowNotifications(
                      !showNotifications
                    )
                  }
                  className="relative rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                >
                  🔔 Notifications

                  {unreadNotifications.length >
                    0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-black">
                      {unreadNotifications.length >
                      9
                        ? "9+"
                        : unreadNotifications.length}
                    </span>
                  )}
                </button>
              )}

              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="rounded-full bg-white px-5 py-2 text-sm font-black text-black transition hover:scale-105"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={() =>
                    router.push("/auth")
                  }
                  className="rounded-full bg-white px-5 py-2 text-sm font-black text-black transition hover:scale-105"
                >
                  Login
                </button>
              )}

            </div>

            {/* MOBILE BUTTONS */}

            <div className="flex items-center gap-2 md:hidden">

              {isLoggedIn && (
                <button
                  onClick={() =>
                    setShowNotifications(
                      !showNotifications
                    )
                  }
                  className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5"
                >
                  🔔

                  {unreadNotifications.length >
                    0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-black">
                      {unreadNotifications.length >
                      9
                        ? "9+"
                        : unreadNotifications.length}
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={() =>
                  setMobileMenuOpen(
                    !mobileMenuOpen
                  )
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl"
              >
                {mobileMenuOpen
                  ? "✕"
                  : "☰"}
              </button>

            </div>

          </div>

          {/* MOBILE MENU */}

          {mobileMenuOpen && (
            <motion.div
              initial={{
                opacity: 0,
                height: 0,
              }}
              animate={{
                opacity: 1,
                height: "auto",
              }}
              exit={{
                opacity: 0,
                height: 0,
              }}
              className="border-t border-white/10 py-4 md:hidden"
            >

              <div className="grid gap-2">

                <a
                  href="#events"
                  onClick={
                    closeMobileMenu
                  }
                  className="flex min-h-12 items-center rounded-xl bg-white/[0.04] px-4 font-bold"
                >
                  🎉 Events
                </a>

                <a
                  href="#clubs"
                  onClick={
                    closeMobileMenu
                  }
                  className="flex min-h-12 items-center rounded-xl bg-white/[0.04] px-4 font-bold"
                >
                  👥 Clubs
                </a>

                <a
                  href="#about"
                  onClick={
                    closeMobileMenu
                  }
                  className="flex min-h-12 items-center rounded-xl bg-white/[0.04] px-4 font-bold"
                >
                  ℹ️ About
                </a>

                <button
                  onClick={() => {
                    closeMobileMenu();
                    router.push(
                      "/community"
                    );
                  }}
                  className="flex min-h-12 items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-left font-bold text-cyan-300"
                >
                  👥 Community
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      router.push(
                        "/admin"
                      );
                    }}
                    className="flex min-h-12 items-center rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 text-left font-bold text-fuchsia-300"
                  >
                    🛠️ Admin Dashboard
                  </button>
                )}

                {isLoggedIn ? (
                  <button
                    onClick={
                      handleLogout
                    }
                    className="flex min-h-12 items-center rounded-xl bg-white px-4 text-left font-black text-black"
                  >
                    🚪 Logout
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      router.push(
                        "/auth"
                      );
                    }}
                    className="flex min-h-12 items-center rounded-xl bg-white px-4 text-left font-black text-black"
                  >
                    🔐 Login
                  </button>
                )}

              </div>

              {isLoggedIn &&
                userEmail && (
                  <p className="mt-4 px-2 text-xs text-white/30">
                    Signed in as{" "}
                    {userEmail}
                  </p>
                )}

            </motion.div>
          )}

        </div>

      </nav>

      {/* ========================================================
          NOTIFICATIONS POPUP
      ======================================================== */}

      {showNotifications && (
        <motion.div
          initial={{
            opacity: 0,
            y: -15,
            scale: 0.97,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          className="fixed right-4 top-20 z-[70] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/10 bg-[#15151d]/95 p-5 shadow-2xl backdrop-blur-xl md:right-8"
        >

          <div className="flex items-start justify-between">

            <div>
              <p className="font-bold">
                🔔 Notifications
              </p>

              {notifications.length >
                0 && (
                <p className="mt-1 text-xs text-white/30">
                  {unreadNotifications.length >
                  0
                    ? `${unreadNotifications.length} unread`
                    : "All caught up"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">

              {unreadNotifications.length >
                0 && (
                <button
                  onClick={
                    markAllNotificationsAsRead
                  }
                  className="text-[10px] font-black uppercase tracking-wider text-cyan-400 transition hover:text-cyan-300"
                >
                  Mark all read
                </button>
              )}

              <button
                onClick={() =>
                  setShowNotifications(
                    false
                  )
                }
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>

            </div>

          </div>

          {loadingNotifications ? (
            <div className="py-10 text-center">

              <div className="text-3xl">
                ⚡
              </div>

              <p className="mt-3 text-sm text-white/40">
                Loading notifications...
              </p>

            </div>
          ) : notifications.length ===
            0 ? (
            <div className="py-10 text-center">

              <div className="text-4xl">
                🎉
              </div>

              <p className="mt-3 font-bold">
                You're all caught up!
              </p>

              <p className="mt-2 text-sm text-white/40">
                New campus announcements
                will appear here.
              </p>

            </div>
          ) : (
            <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto">

              {notifications.map(
                (notification) => {
                  const isRead =
                    isNotificationRead(
                      notification
                    );

                  return (
                    <button
                      key={
                        notification.id
                      }
                      onClick={() =>
                        markNotificationAsRead(
                          notification.id
                        )
                      }
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isRead
                          ? "border-white/10 bg-white/[0.02]"
                          : "border-fuchsia-400/20 bg-fuchsia-500/[0.06] hover:bg-fuchsia-500/[0.1]"
                      }`}
                    >

                      <div className="flex gap-3">

                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">

                          {getNotificationIcon(
                            notification.type
                          )}

                          {!isRead && (
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-fuchsia-400" />
                          )}

                        </div>

                        <div className="min-w-0">

                          <div className="flex items-start justify-between gap-3">

                            <p className="font-bold">
                              {
                                notification.title
                              }
                            </p>

                            {!isRead && (
                              <span className="mt-1 shrink-0 text-[9px] font-black uppercase tracking-wider text-fuchsia-400">
                                New
                              </span>
                            )}

                          </div>

                          <p className="mt-1 text-sm leading-6 text-white/45">
                            {
                              notification.message
                            }
                          </p>

                          {notification.createdAt && (
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/20">
                              {notification
                                .createdAt
                                ?.toDate
                                ? notification.createdAt
                                    .toDate()
                                    .toLocaleString()
                                : ""}
                            </p>
                          )}

                        </div>

                      </div>

                    </button>
                  );
                }
              )}

            </div>
          )}

        </motion.div>
      )}

      {/* ========================================================
          HERO
      ======================================================== */}

      <motion.section
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="relative flex min-h-screen items-center px-6 pt-28 md:px-12"
      >

        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="relative mx-auto w-full max-w-7xl">

          <motion.div
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            CAMPUS IS ALIVE
          </motion.div>

          <motion.h2
            variants={fadeUp}
            className="max-w-5xl text-6xl font-black leading-[0.9] tracking-[-0.06em] sm:text-7xl md:text-9xl"
          >
            YOUR CAMPUS.
            <br />

            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              YOUR VIBE.
            </span>
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="mt-8 max-w-2xl text-lg leading-relaxed text-white/50 md:text-xl"
          >
            Discover everything happening at
            Sreenidhi University — events,
            clubs, competitions, concerts,
            workshops and moments you don't
            want to miss.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap gap-4"
          >

            <a
              href="#events"
              className="rounded-full bg-white px-7 py-4 text-sm font-black text-black transition hover:scale-105"
            >
              Explore Events →
            </a>

            <button
              onClick={() =>
                router.push(
                  "/community"
                )
              }
              className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-7 py-4 text-sm font-bold text-cyan-300 backdrop-blur transition hover:scale-105 hover:bg-cyan-400/20"
            >
              👥 Community →
            </button>

            <button
              onClick={() =>
                setShowNotifications(
                  true
                )
              }
              className="rounded-full border border-white/15 bg-white/5 px-7 py-4 text-sm font-bold backdrop-blur transition hover:bg-white/10"
            >
              ✨ What's happening?
            </button>

          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-16 grid max-w-3xl grid-cols-3 gap-4 border-t border-white/10 pt-8"
          >

            <div>
              <p className="text-3xl font-black">
                {events.length}
              </p>

              <p className="mt-1 text-xs text-white/40">
                Upcoming events
              </p>
            </div>

            <div>
              <p className="text-3xl font-black">
                10
              </p>

              <p className="mt-1 text-xs text-white/40">
                Active clubs
              </p>
            </div>

            <div>
              <p className="text-3xl font-black">
                2.4K+
              </p>

              <p className="mt-1 text-xs text-white/40">
                Students vibing
              </p>
            </div>

          </motion.div>

        </div>

      </motion.section>

      {/* ========================================================
          LIVE
      ======================================================== */}

      <section className="border-y border-white/10 bg-white/[0.02] px-6 py-8 md:px-12">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-center">

          <div>

            <div className="mb-2 flex items-center gap-2 text-xs font-black tracking-widest text-red-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              LIVE ON CAMPUS
            </div>

            <h3 className="text-2xl font-black">
              Something is happening right now.
            </h3>

          </div>

          <a
            href="#events"
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-bold transition hover:bg-white/10"
          >
            See Live Events →
          </a>

        </div>

      </section>

      {/* ========================================================
          EVENTS
      ======================================================== */}

      <section
        id="events"
        className="px-6 py-24 md:px-12"
      >

        <div className="mx-auto max-w-7xl">

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{
              once: true,
              amount: 0.2,
            }}
            variants={fadeUp}
            className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end"
          >

            <div>

              <p className="mb-3 text-sm font-black tracking-[0.25em] text-fuchsia-400">
                DON'T MISS OUT
              </p>

              <h3 className="text-5xl font-black tracking-tight md:text-6xl">
                Upcoming events.
              </h3>

            </div>

          </motion.div>

          {loadingEvents && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">

              <div className="text-4xl">
                ⚡
              </div>

              <p className="mt-4 text-white/40">
                Loading campus events...
              </p>

            </div>
          )}

          {!loadingEvents &&
            events.length === 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">

                <div className="text-5xl">
                  📅
                </div>

                <h4 className="mt-5 text-2xl font-black">
                  Nothing scheduled yet
                </h4>

                <p className="mt-2 text-white/40">
                  New campus events will appear
                  here soon.
                </p>

              </div>
            )}

          {!loadingEvents &&
            events.length > 0 && (
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{
                  once: true,
                  amount: 0.1,
                }}
                variants={stagger}
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              >

                {events.map((event) => (
                  <motion.article
                    key={event.id}
                    variants={fadeUp}
                    whileHover={{
                      y: -8,
                    }}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition duration-500 hover:border-white/20 hover:bg-white/[0.07]"
                  >

                    {event.imageUrl ? (
                      <div className="relative h-56 overflow-hidden">

                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        <span className="absolute left-5 top-5 rounded-full bg-black/50 px-3 py-1 text-[10px] font-black tracking-widest backdrop-blur">
                          {event.category}
                        </span>

                      </div>
                    ) : (
                      <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-fuchsia-500/20 via-purple-500/10 to-cyan-500/20">

                        <div className="absolute h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />

                        <span className="relative text-7xl transition duration-500 group-hover:scale-125">
                          {event.category ===
                          "Technical"
                            ? "💻"
                            : event.category ===
                                "Cultural"
                              ? "🎨"
                              : event.category ===
                                  "Sports"
                                ? "🏆"
                                : event.category ===
                                    "Workshop"
                                  ? "🛠️"
                                  : event.category ===
                                      "Competition"
                                    ? "⚡"
                                    : event.category ===
                                        "Club"
                                      ? "👥"
                                      : "🎉"}
                        </span>

                        <span className="absolute left-5 top-5 rounded-full bg-black/40 px-3 py-1 text-[10px] font-black tracking-widest backdrop-blur">
                          {event.category}
                        </span>

                      </div>
                    )}

                    <div className="p-6">

                      <p className="text-xs font-bold text-fuchsia-400">
                        {event.date} ·{" "}
                        {event.time}
                      </p>

                      <h4 className="mt-3 text-2xl font-black">
                        {event.title}
                      </h4>

                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/40">
                        {event.description}
                      </p>

                      {/* EVENT COUNTDOWN */}
                      <EventCountdown
                        date={event.date}
                        time={event.time}
                        compact
                      />

                      <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5">

                        <span className="text-xs text-white/40">
                          📍 {event.venue}
                        </span>

                        <a
                          href={`/events/${event.id}`}
                          className="text-sm font-black transition group-hover:text-fuchsia-400"
                        >
                          View Event →
                        </a>

                      </div>

                    </div>

                  </motion.article>
                ))}

              </motion.div>
            )}

        </div>

      </section>

      {/* ========================================================
          CLUBS
      ======================================================== */}

      <section
        id="clubs"
        className="px-6 pb-24 md:px-12"
      >

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{
            once: true,
            amount: 0.2,
          }}
          variants={fadeUp}
          className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/5 p-8 md:p-16"
        >

          <p className="text-sm font-black tracking-[0.25em] text-cyan-400">
            FIND YOUR PEOPLE
          </p>

          <div className="mt-4 flex flex-col justify-between gap-8 md:flex-row md:items-end">

            <h3 className="max-w-2xl text-5xl font-black tracking-tight md:text-6xl">
              Clubs, communities & chaos.
            </h3>

            <button className="w-fit rounded-full bg-white px-6 py-3 text-sm font-black text-black transition hover:scale-105">
              Explore Clubs →
            </button>

          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">

            {[
              "💻 Coding",
              "🎸 Music",
              "🎨 Arts",
              "🏆 Sports",
            ].map((club) => (
              <motion.div
                key={club}
                whileHover={{
                  y: -5,
                  scale: 1.02,
                }}
                className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm font-bold transition hover:bg-white/10"
              >
                {club}
              </motion.div>
            ))}

          </div>

        </motion.div>

      </section>

      {/* ========================================================
          ABOUT
      ======================================================== */}

      <section
        id="about"
        className="px-6 pb-24 md:px-12"
      >

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{
            once: true,
            amount: 0.2,
          }}
          variants={fadeUp}
          className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-cyan-500/10 p-8 md:p-16"
        >

          <div className="grid gap-12 md:grid-cols-[1.4fr_0.8fr] md:items-center">

            <div>

              <p className="text-sm font-black tracking-[0.25em] text-fuchsia-400">
                ABOUT CAMPUS VIBE
              </p>

              <h3 className="mt-4 max-w-3xl text-5xl font-black tracking-tight md:text-6xl">
                College happens beyond the classroom.
              </h3>

              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/50">
                Campus Vibe is built to bring
                the energy of Sreenidhi University
                events into one place. From technical
                competitions and workshops to cultural
                celebrations, sports, club activities
                and everything in between, Campus Vibe
                makes it easier for students to discover
                what's happening around campus and be
                part of it.
              </p>

              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/50">
                No more missing an event because you
                heard about it too late. Find what's
                happening, check the details, register,
                and show up.
              </p>

            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-7 md:p-8">

              <p className="text-xs font-black tracking-[0.25em] text-cyan-400">
                BUILT BY
              </p>

              <h4 className="mt-4 text-3xl font-black">
                K. Suhaas Kashyap
              </h4>

              <p className="mt-2 text-white/40">
                First Year · Sreenidhi University
              </p>

              <div className="my-7 h-px bg-white/10" />

              <p className="text-sm leading-7 text-white/50">
                Created with the idea that college
                isn't just about classrooms and
                assignments — it's about the people
                you meet, the communities you join,
                the events you experience, and the
                memories you make along the way.
              </p>

              <p className="mt-6 text-lg font-black text-white">
                Your campus.
                <br />
                Your people.
                <br />
                Your vibe.
                <span className="ml-2 text-fuchsia-400">
                  ⚡
                </span>
              </p>

            </div>

          </div>

        </motion.div>

      </section>

      {/* ========================================================
          FOOTER
      ======================================================== */}

      <footer className="border-t border-white/10 px-6 py-10 md:px-12">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-white/40 md:flex-row">

          <p>
            © 2026 Sreenidhi University Campus Vibe
          </p>

          <p>
            Built for the students. ⚡
          </p>

        </div>

      </footer>

    </main>
  );
}