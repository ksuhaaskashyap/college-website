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
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
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

function getCategoryEmoji(category: string) {
  if (category === "Technical") return "💻";
  if (category === "Cultural") return "🎨";
  if (category === "Sports") return "🏆";
  if (category === "Workshop") return "🛠️";
  if (category === "Competition") return "⚡";
  if (category === "Club") return "👥";
  return "🎉";
}

function getCategoryStyle(category: string) {
  if (category === "Technical") {
    return {
      text: "text-cyan-300",
      border: "border-cyan-300/20",
      bg: "bg-cyan-300/10",
    };
  }

  if (category === "Cultural") {
    return {
      text: "text-pink-300",
      border: "border-pink-300/20",
      bg: "bg-pink-300/10",
    };
  }

  if (category === "Sports") {
    return {
      text: "text-lime-300",
      border: "border-lime-300/20",
      bg: "bg-lime-300/10",
    };
  }

  if (category === "Workshop") {
    return {
      text: "text-yellow-300",
      border: "border-yellow-300/20",
      bg: "bg-yellow-300/10",
    };
  }

  if (category === "Competition") {
    return {
      text: "text-orange-300",
      border: "border-orange-300/20",
      bg: "bg-orange-300/10",
    };
  }

  if (category === "Club") {
    return {
      text: "text-violet-300",
      border: "border-violet-300/20",
      bg: "bg-violet-300/10",
    };
  }

  return {
    text: "text-white",
    border: "border-white/15",
    bg: "bg-white/10",
  };
}

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

        eventList.sort((a, b) => {
          const aTime = Date.parse(
            `${a.date}T${a.time || "00:00"}:00+05:30`
          );

          const bTime = Date.parse(
            `${b.date}T${b.time || "00:00"}:00+05:30`
          );

          return aTime - bTime;
        });

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
  // LOAD READ NOTIFICATIONS
  // ============================================================

  useEffect(() => {
    if (!isLoggedIn) {
      setReadNotificationIds([]);
      return;
    }

    const user = auth.currentUser;

    if (!user) return;

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

        setIsLoggedIn(true);
        setUserEmail(user.email || "");
        setLoadingNotifications(true);

        // ADMIN CHECK
        try {
          const adminRef = doc(db, "admins", user.uid);

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

        // GLOBAL NOTIFICATIONS
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

                combined.forEach((notification) => {
                  uniqueMap.set(
                    notification.id,
                    notification
                  );
                });

                const uniqueNotifications =
                  Array.from(uniqueMap.values());

                uniqueNotifications.sort((a, b) => {
                  const aTime =
                    a.createdAt?.toMillis?.() || 0;

                  const bTime =
                    b.createdAt?.toMillis?.() || 0;

                  return bTime - aTime;
                });

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

        // PERSONAL NOTIFICATIONS
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

                combined.forEach((notification) => {
                  uniqueMap.set(
                    notification.id,
                    notification
                  );
                });

                const uniqueNotifications =
                  Array.from(uniqueMap.values());

                uniqueNotifications.sort((a, b) => {
                  const aTime =
                    a.createdAt?.toMillis?.() || 0;

                  const bTime =
                    b.createdAt?.toMillis?.() || 0;

                  return bTime - aTime;
                });

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
  // NOTIFICATIONS
  // ============================================================

  function isNotificationRead(
    notification: NotificationItem
  ) {
    return (
      notification.read === true ||
      readNotificationIds.includes(notification.id)
    );
  }

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        !isNotificationRead(notification)
    );

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

    if (!user) return;

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

  function getNotificationIcon(type: string) {
    if (type === "event") return "🎉";
    if (type === "reminder") return "⏰";
    if (type === "announcement") return "📢";
    if (type === "like") return "❤️";
    if (type === "comment") return "💬";
    if (type === "poll") return "🗳️";

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

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  // ============================================================
  // UPCOMING EVENTS
  // ============================================================

  const now = Date.now();

  const upcomingEvents = events.filter((event) => {
    const timestamp = Date.parse(
      `${event.date}T${event.time || "00:00"}:00+05:30`
    );

    return (
      !Number.isNaN(timestamp) &&
      timestamp > now
    );
  });

  const featuredEvent =
    upcomingEvents[0] || null;

  const otherUpcomingEvents =
    featuredEvent
      ? upcomingEvents.filter(
          (event) =>
            event.id !== featuredEvent.id
        )
      : [];

  const featuredCategoryStyle =
    featuredEvent
      ? getCategoryStyle(
          featuredEvent.category
        )
      : null;

  return (
    <main className="min-h-screen overflow-hidden bg-[#171321] text-[#fff8f0]">

      {/* ======================================================
          GLOBAL DECORATIVE BACKGROUND
      ====================================================== */}

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">

        <div className="absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-orange-500/15 blur-[140px]" />

        <div className="absolute right-[-180px] top-[10%] h-[500px] w-[500px] rounded-full bg-pink-500/15 blur-[150px]" />

        <div className="absolute left-[35%] top-[45%] h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[150px]" />

        <div className="absolute bottom-[-200px] right-[15%] h-[500px] w-[500px] rounded-full bg-cyan-400/10 blur-[160px]" />

      </div>

      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <nav className="fixed top-0 z-50 w-full border-b border-white/[0.08] bg-[#171321]/75 backdrop-blur-2xl">

        <div className="mx-auto max-w-7xl px-5 md:px-8">

          <div className="flex min-h-[74px] items-center justify-between">

            {/* BRAND */}

            <button
              onClick={() => {
                router.push("/");
                closeMobileMenu();
              }}
              className="group text-left"
            >
              <div className="flex items-center gap-2">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 via-pink-500 to-violet-500 text-sm font-black shadow-[0_0_25px_rgba(255,79,129,0.25)] transition duration-300 group-hover:rotate-6">
                  ⚡
                </div>

                <div>
                  <h1 className="text-lg font-black tracking-tight">
                    SREENIDHI
                    <span className="text-orange-400">
                      .
                    </span>
                  </h1>

                  <p className="text-[8px] font-bold tracking-[0.35em] text-white/35">
                    CAMPUS VIBE
                  </p>
                </div>

              </div>
            </button>

            {/* DESKTOP NAV */}

            <div className="hidden items-center gap-2 md:flex">

              <a
                href="#events"
                className="rounded-full px-4 py-2 text-sm font-semibold text-white/55 transition hover:bg-white/5 hover:text-white"
              >
                Events
              </a>

              <a
                href="#clubs"
                className="rounded-full px-4 py-2 text-sm font-semibold text-white/55 transition hover:bg-white/5 hover:text-white"
              >
                Clubs
              </a>

              <a
                href="#about"
                className="rounded-full px-4 py-2 text-sm font-semibold text-white/55 transition hover:bg-white/5 hover:text-white"
              >
                About
              </a>

              <button
                onClick={() =>
                  router.push("/community")
                }
                className="ml-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-200 transition hover:scale-105 hover:bg-cyan-300/15"
              >
                👥 Community
              </button>

              {isAdmin && (
                <button
                  onClick={() =>
                    router.push("/admin")
                  }
                  className="rounded-full border border-orange-300/20 bg-orange-300/10 px-4 py-2 text-sm font-bold text-orange-200 transition hover:scale-105 hover:bg-orange-300/15"
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
                  className="relative ml-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                >
                  🔔

                  <span className="ml-2">
                    Notifications
                  </span>

                  {unreadNotifications.length >
                    0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-black shadow-lg shadow-pink-500/30">
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
                  className="ml-1 rounded-full bg-[#fff8f0] px-5 py-2.5 text-sm font-black text-[#171321] transition hover:scale-105"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={() =>
                    router.push("/auth")
                  }
                  className="ml-1 rounded-full bg-[#fff8f0] px-5 py-2.5 text-sm font-black text-[#171321] transition hover:scale-105"
                >
                  Login
                </button>
              )}

            </div>

            {/* MOBILE */}

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
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-black">
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
              className="border-t border-white/10 py-4 md:hidden"
            >

              <div className="grid gap-2">

                <a
                  href="#events"
                  onClick={closeMobileMenu}
                  className="flex min-h-12 items-center rounded-2xl bg-white/[0.04] px-4 font-bold"
                >
                  🎉 Events
                </a>

                <a
                  href="#clubs"
                  onClick={closeMobileMenu}
                  className="flex min-h-12 items-center rounded-2xl bg-white/[0.04] px-4 font-bold"
                >
                  👥 Clubs
                </a>

                <a
                  href="#about"
                  onClick={closeMobileMenu}
                  className="flex min-h-12 items-center rounded-2xl bg-white/[0.04] px-4 font-bold"
                >
                  ℹ️ About
                </a>

                <button
                  onClick={() => {
                    closeMobileMenu();
                    router.push("/community");
                  }}
                  className="flex min-h-12 items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-left font-bold text-cyan-200"
                >
                  👥 Community
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      router.push("/admin");
                    }}
                    className="flex min-h-12 items-center rounded-2xl border border-orange-300/20 bg-orange-300/10 px-4 text-left font-bold text-orange-200"
                  >
                    🛠️ Admin Dashboard
                  </button>
                )}

                {isLoggedIn ? (
                  <button
                    onClick={handleLogout}
                    className="flex min-h-12 items-center rounded-2xl bg-[#fff8f0] px-4 text-left font-black text-[#171321]"
                  >
                    🚪 Logout
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      router.push("/auth");
                    }}
                    className="flex min-h-12 items-center rounded-2xl bg-[#fff8f0] px-4 text-left font-black text-[#171321]"
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

      {/* ======================================================
          NOTIFICATIONS
      ====================================================== */}

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
          className="fixed right-4 top-20 z-[70] w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#211b2d]/95 p-5 shadow-2xl backdrop-blur-2xl md:right-8"
        >

          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-pink-500/10 blur-3xl" />

          <div className="relative flex items-start justify-between">

            <div>
              <p className="font-black">
                🔔 Notifications
              </p>

              {notifications.length > 0 && (
                <p className="mt-1 text-xs text-white/35">
                  {unreadNotifications.length > 0
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
                  className="text-[10px] font-black uppercase tracking-wider text-cyan-300"
                >
                  Mark all read
                </button>
              )}

              <button
                onClick={() =>
                  setShowNotifications(false)
                }
                className="text-white/40 transition hover:text-white"
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
          ) : notifications.length === 0 ? (
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
                      key={notification.id}
                      onClick={() =>
                        markNotificationAsRead(
                          notification.id
                        )
                      }
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isRead
                          ? "border-white/10 bg-white/[0.02]"
                          : "border-pink-400/20 bg-pink-400/[0.07] hover:bg-pink-400/[0.12]"
                      }`}
                    >

                      <div className="flex gap-3">

                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                          {getNotificationIcon(
                            notification.type
                          )}

                          {!isRead && (
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-pink-400" />
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
                              <span className="mt-1 shrink-0 text-[9px] font-black uppercase tracking-wider text-pink-400">
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
                              {notification.createdAt
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

      {/* ======================================================
          HERO
      ====================================================== */}

      <section className="relative z-10 flex min-h-screen items-center px-6 pb-20 pt-32 md:px-12 md:pt-28">

        {/* FLOATING DECOR */}

        <motion.div
          animate={{
            y: [0, -18, 0],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="pointer-events-none absolute right-[9%] top-[24%] hidden h-20 w-20 rotate-12 rounded-[1.5rem] border border-yellow-300/20 bg-yellow-300/10 backdrop-blur-xl md:block"
        >
          <div className="flex h-full items-center justify-center text-3xl">
            ✦
          </div>
        </motion.div>

        <motion.div
          animate={{
            y: [0, 15, 0],
            rotate: [0, -7, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="pointer-events-none absolute bottom-[25%] right-[20%] hidden h-14 w-14 rounded-full border border-cyan-300/20 bg-cyan-300/10 backdrop-blur-xl md:block"
        />

        <div className="mx-auto w-full max-w-7xl">

          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
          >

            <motion.div
              variants={fadeUp}
              className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 backdrop-blur-xl"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime-400" />
              </span>

              <span className="text-[10px] font-black tracking-[0.2em] text-white/65">
                CAMPUS IS ALIVE
              </span>

              <span className="text-xs text-white/25">
                ✦
              </span>

              <span className="text-[10px] font-bold text-orange-300">
                2026
              </span>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="max-w-6xl text-[4rem] font-black leading-[0.86] tracking-[-0.075em] sm:text-7xl md:text-[9rem]"
            >
              YOUR
              <br />

              <span className="bg-gradient-to-r from-orange-300 via-pink-400 to-violet-400 bg-clip-text text-transparent">
                CAMPUS.
              </span>

              <br />

              <span className="text-[#fff8f0]">
                YOUR VIBE.
              </span>
            </motion.h2>

            <motion.p
              variants={fadeUp}
              className="mt-9 max-w-2xl text-base leading-7 text-white/45 md:text-xl md:leading-8"
            >
              Discover what's happening at
              Sreenidhi University — events,
              clubs, competitions, concerts,
              workshops and all the moments
              worth showing up for.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-9 flex flex-wrap gap-3"
            >

              <a
                href="#events"
                className="group rounded-full bg-[#fff8f0] px-7 py-4 text-sm font-black text-[#171321] transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(255,248,240,0.15)]"
              >
                Explore Events
                <span className="ml-2 transition group-hover:ml-3">
                  →
                </span>
              </a>

              <button
                onClick={() =>
                  router.push("/community")
                }
                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-7 py-4 text-sm font-bold text-cyan-100 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-cyan-300/15"
              >
                👥 Join Community
              </button>

              <button
                onClick={() =>
                  setShowNotifications(true)
                }
                className="rounded-full border border-white/10 bg-white/[0.04] px-7 py-4 text-sm font-bold text-white/75 backdrop-blur-xl transition hover:bg-white/[0.08]"
              >
                ✨ What's happening?
              </button>

            </motion.div>

            {/* STATS */}

            <motion.div
              variants={fadeUp}
              className="mt-14 flex max-w-3xl flex-wrap gap-8 border-t border-white/10 pt-7"
            >

              <div>
                <p className="text-3xl font-black">
                  {events.length}
                </p>

                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                  Events
                </p>
              </div>

              <div className="h-12 w-px bg-white/10" />

              <div>
                <p className="text-3xl font-black text-orange-300">
                  10
                </p>

                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                  Active clubs
                </p>
              </div>

              <div className="h-12 w-px bg-white/10" />

              <div>
                <p className="text-3xl font-black text-pink-300">
                  2.4K+
                </p>

                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                  Students vibing
                </p>
              </div>

            </motion.div>

          </motion.div>

        </div>
      </section>

      {/* ======================================================
          LIVE STRIP
      ====================================================== */}

      <section className="relative z-10 border-y border-white/[0.08] bg-gradient-to-r from-orange-400/[0.07] via-pink-400/[0.05] to-cyan-400/[0.07] px-6 py-7 md:px-12">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-center">

          <div className="flex items-center gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.8)]" />
            </div>

            <div>
              <p className="text-[10px] font-black tracking-[0.25em] text-red-300">
                LIVE ON CAMPUS
              </p>

              <h3 className="mt-1 text-lg font-black md:text-xl">
                Something is happening right now.
              </h3>
            </div>

          </div>

          <a
            href="#events"
            className="w-fit rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-bold transition hover:bg-white/[0.08]"
          >
            See Events →
          </a>

        </div>

      </section>

      {/* ======================================================
          EVENTS
      ====================================================== */}

      <section
        id="events"
        className="relative z-10 px-6 py-24 md:px-12"
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
            className="mb-12"
          >

            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">

              <div>

                <div className="mb-4 flex items-center gap-3">

                  <span className="h-px w-8 bg-orange-400" />

                  <p className="text-[10px] font-black tracking-[0.3em] text-orange-300">
                    DON'T MISS OUT
                  </p>

                </div>

                <h3 className="text-5xl font-black tracking-[-0.04em] md:text-7xl">
                  What's
                  <span className="text-pink-300">
                    {" "}
                    happening?
                  </span>
                </h3>

              </div>

              {featuredEvent && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30">
                    Next up
                  </p>

                  <p className="mt-1 max-w-[220px] truncate text-sm font-bold">
                    {featuredEvent.title}
                  </p>
                </div>
              )}

            </div>

          </motion.div>

          {loadingEvents && (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-16 text-center">

              <div className="text-4xl">
                ⚡
              </div>

              <p className="mt-4 text-white/40">
                Loading campus events...
              </p>

            </div>
          )}

          {!loadingEvents &&
            upcomingEvents.length === 0 && (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-16 text-center">

                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-orange-300/20 bg-orange-300/10 text-4xl">
                  📅
                </div>

                <h4 className="mt-6 text-2xl font-black">
                  Nothing scheduled yet
                </h4>

                <p className="mt-2 text-white/40">
                  New campus events will appear
                  here soon.
                </p>

              </div>
            )}

          {/* FEATURED EVENT */}

          {!loadingEvents &&
            featuredEvent && (
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{
                  once: true,
                  amount: 0.1,
                }}
                variants={fadeUp}
              >

                <motion.article
                  whileHover={{
                    y: -8,
                  }}
                  className="group relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#211b2d]/80 shadow-2xl shadow-black/20 transition duration-500 hover:border-pink-300/25"
                >

                  {/* TOP COLOR LINE */}

                  <div className="absolute left-0 right-0 top-0 z-20 h-1 bg-gradient-to-r from-orange-400 via-pink-400 to-violet-400" />

                  <div className="grid lg:grid-cols-[1.15fr_0.85fr]">

                    {/* IMAGE */}

                    {featuredEvent.imageUrl ? (
                      <div className="relative min-h-[360px] overflow-hidden lg:min-h-[500px]">

                        <img
                          src={featuredEvent.imageUrl}
                          alt={featuredEvent.title}
                          className="h-full w-full object-cover transition duration-1000 group-hover:scale-105"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-[#171321] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#211b2d]" />

                        <div className="absolute left-6 top-7 flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 backdrop-blur-xl">

                          <span className="h-2 w-2 rounded-full bg-orange-300" />

                          <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                            Featured
                          </span>

                        </div>

                      </div>
                    ) : (
                      <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-gradient-to-br from-orange-400/20 via-pink-500/10 to-violet-500/20 lg:min-h-[500px]">

                        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/20 blur-[100px]" />

                        <div className="absolute left-8 top-8 h-24 w-24 rounded-full border border-orange-300/20 bg-orange-300/10 blur-sm" />

                        <span className="relative text-[8rem] drop-shadow-2xl transition duration-500 group-hover:scale-110">
                          {getCategoryEmoji(
                            featuredEvent.category
                          )}
                        </span>

                        <div className="absolute left-6 top-7 flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-2 backdrop-blur-xl">

                          <span className="h-2 w-2 rounded-full bg-orange-300" />

                          <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                            Featured
                          </span>

                        </div>

                      </div>
                    )}

                    {/* DETAILS */}

                    <div className="relative flex flex-col justify-center p-7 md:p-10 lg:p-12">

                      <div className="absolute right-8 top-8 text-5xl text-white/[0.035]">
                        ✦
                      </div>

                      {featuredCategoryStyle && (
                        <span
                          className={`w-fit rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] ${featuredCategoryStyle.border} ${featuredCategoryStyle.bg} ${featuredCategoryStyle.text}`}
                        >
                          {featuredEvent.category}
                        </span>
                      )}

                      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.25em] text-orange-300">
                        Next on campus
                      </p>

                      <p className="mt-3 text-sm font-bold text-white/35">
                        {featuredEvent.date}
                        {" · "}
                        {featuredEvent.time}
                      </p>

                      <h4 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.035em] md:text-5xl">
                        {featuredEvent.title}
                      </h4>

                      <p className="mt-5 text-sm leading-7 text-white/45 md:text-base">
                        {featuredEvent.description}
                      </p>

                      <div className="mt-6">
                        <EventCountdown
                          date={featuredEvent.date}
                          time={featuredEvent.time}
                          compact
                        />
                      </div>

                      <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">

                        <span className="text-sm text-white/40">
                          📍 {featuredEvent.venue}
                        </span>

                        <a
                          href={`/events/${featuredEvent.id}`}
                          className="group/button rounded-full bg-[#fff8f0] px-6 py-3 text-center text-sm font-black text-[#171321] transition hover:-translate-y-1"
                        >
                          View Event
                          <span className="ml-2 transition group-hover/button:ml-3">
                            →
                          </span>
                        </a>

                      </div>

                    </div>

                  </div>

                </motion.article>

                {/* OTHER EVENTS */}

                {otherUpcomingEvents.length > 0 && (
                  <div className="mt-16">

                    <div className="mb-7 flex items-end justify-between">

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/25">
                          KEEP SCROLLING
                        </p>

                        <h4 className="mt-2 text-3xl font-black">
                          More events.
                        </h4>
                      </div>

                      <span className="hidden text-xs font-bold text-white/25 sm:block">
                        {otherUpcomingEvents.length} more
                      </span>

                    </div>

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

                      {otherUpcomingEvents.map(
                        (event) => {
                          const categoryStyle =
                            getCategoryStyle(
                              event.category
                            );

                          return (
                            <motion.article
                              key={event.id}
                              variants={fadeUp}
                              whileHover={{
                                y: -7,
                              }}
                              className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#211b2d]/75 transition duration-500 hover:border-white/20"
                            >

                              {event.imageUrl ? (
                                <div className="relative h-56 overflow-hidden">

                                  <img
                                    src={event.imageUrl}
                                    alt={event.title}
                                    className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                                  />

                                  <div className="absolute inset-0 bg-gradient-to-t from-[#211b2d] via-black/10 to-transparent" />

                                  <span
                                    className={`absolute left-5 top-5 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest backdrop-blur-xl ${categoryStyle.border} ${categoryStyle.bg} ${categoryStyle.text}`}
                                  >
                                    {event.category}
                                  </span>

                                </div>
                              ) : (
                                <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-orange-400/15 via-pink-400/10 to-violet-500/15">

                                  <div className="absolute h-40 w-40 rounded-full bg-pink-500/15 blur-3xl" />

                                  <span className="relative text-7xl transition duration-500 group-hover:scale-125">
                                    {getCategoryEmoji(
                                      event.category
                                    )}
                                  </span>

                                  <span
                                    className={`absolute left-5 top-5 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${categoryStyle.border} ${categoryStyle.bg} ${categoryStyle.text}`}
                                  >
                                    {event.category}
                                  </span>

                                </div>
                              )}

                              <div className="p-6">

                                <p className="text-[10px] font-black uppercase tracking-wider text-orange-300">
                                  {event.date}
                                  {" · "}
                                  {event.time}
                                </p>

                                <h4 className="mt-3 text-2xl font-black leading-tight">
                                  {event.title}
                                </h4>

                                <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/40">
                                  {event.description}
                                </p>

                                <EventCountdown
                                  date={event.date}
                                  time={event.time}
                                  compact
                                />

                                <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-5">

                                  <span className="max-w-[150px] truncate text-xs text-white/35">
                                    📍 {event.venue}
                                  </span>

                                  <a
                                    href={`/events/${event.id}`}
                                    className="text-sm font-black text-white transition group-hover:text-orange-300"
                                  >
                                    Open →
                                  </a>

                                </div>

                              </div>

                            </motion.article>
                          );
                        }
                      )}

                    </motion.div>
                  </div>
                )}

              </motion.div>
            )}

        </div>
      </section>

      {/* ======================================================
          CLUBS
      ====================================================== */}

      <section
        id="clubs"
        className="relative z-10 px-6 pb-24 md:px-12"
      >

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{
            once: true,
            amount: 0.2,
          }}
          variants={fadeUp}
          className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-orange-400/[0.13] via-pink-400/[0.08] to-violet-400/[0.12] p-8 md:p-16"
        >

          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orange-400/10 blur-[100px]" />

          <div className="relative">

            <div className="flex items-center gap-3">

              <span className="text-2xl">
                🪩
              </span>

              <p className="text-[10px] font-black tracking-[0.3em] text-orange-200">
                FIND YOUR PEOPLE
              </p>

            </div>

            <div className="mt-5 flex flex-col justify-between gap-8 md:flex-row md:items-end">

              <h3 className="max-w-2xl text-5xl font-black tracking-[-0.04em] md:text-7xl">
                Clubs,
                <br />
                communities &
                <span className="text-orange-300">
                  {" "}
                  chaos.
                </span>
              </h3>

              <button className="w-fit rounded-full bg-[#fff8f0] px-6 py-3 text-sm font-black text-[#171321] transition hover:-translate-y-1">
                Explore Clubs →
              </button>

            </div>

            <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">

              {[
                {
                  name: "Coding",
                  emoji: "💻",
                  color: "cyan",
                },
                {
                  name: "Music",
                  emoji: "🎸",
                  color: "pink",
                },
                {
                  name: "Arts",
                  emoji: "🎨",
                  color: "orange",
                },
                {
                  name: "Sports",
                  emoji: "🏆",
                  color: "lime",
                },
              ].map((club) => (
                <motion.div
                  key={club.name}
                  whileHover={{
                    y: -5,
                    scale: 1.02,
                  }}
                  className="group rounded-2xl border border-white/10 bg-[#171321]/40 p-5 backdrop-blur-xl transition hover:bg-white/[0.08]"
                >

                  <div className="mb-5 text-3xl transition duration-300 group-hover:scale-110">
                    {club.emoji}
                  </div>

                  <p className="text-sm font-black">
                    {club.name}
                  </p>

                  <p className="mt-1 text-xs text-white/30">
                    Find your people
                  </p>

                </motion.div>
              ))}

            </div>

          </div>

        </motion.div>

      </section>

      {/* ======================================================
          ABOUT
      ====================================================== */}

      <section
        id="about"
        className="relative z-10 px-6 pb-24 md:px-12"
      >

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{
            once: true,
            amount: 0.2,
          }}
          variants={fadeUp}
          className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#211b2d]/75 p-8 backdrop-blur-xl md:p-16"
        >

          <div className="absolute right-[-100px] top-[-100px] h-72 w-72 rounded-full bg-cyan-400/10 blur-[100px]" />

          <div className="relative grid gap-12 md:grid-cols-[1.4fr_0.8fr] md:items-center">

            <div>

              <div className="flex items-center gap-3">

                <span className="h-px w-8 bg-cyan-300" />

                <p className="text-[10px] font-black tracking-[0.3em] text-cyan-200">
                  ABOUT CAMPUS VIBE
                </p>

              </div>

              <h3 className="mt-5 max-w-3xl text-5xl font-black tracking-[-0.04em] md:text-6xl">
                College happens
                <span className="text-cyan-300">
                  {" "}
                  beyond
                </span>{" "}
                the classroom.
              </h3>

              <p className="mt-7 max-w-3xl text-base leading-8 text-white/45">
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

              <p className="mt-5 max-w-3xl text-base leading-8 text-white/45">
                No more missing an event because you
                heard about it too late. Find what's
                happening, check the details, register,
                and show up.
              </p>

            </div>

            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-cyan-300/[0.08] to-violet-400/[0.08] p-7 md:p-8">

              <div className="absolute -right-10 -top-10 text-8xl text-white/[0.025]">
                ⚡
              </div>

              <p className="relative text-[10px] font-black tracking-[0.3em] text-cyan-300">
                BUILT BY
              </p>

              <h4 className="relative mt-4 text-3xl font-black">
                K. Suhaas Kashyap
              </h4>

              <p className="relative mt-2 text-sm text-white/35">
                First Year · Sreenidhi University
              </p>

              <div className="my-7 h-px bg-white/10" />

              <p className="text-sm leading-7 text-white/45">
                Created with the idea that college
                isn't just about classrooms and
                assignments — it's about the people
                you meet, the communities you join,
                the events you experience, and the
                memories you make along the way.
              </p>

              <p className="mt-6 text-lg font-black leading-7">
                Your campus.
                <br />
                <span className="text-orange-300">
                  Your people.
                </span>
                <br />
                <span className="text-pink-300">
                  Your vibe.
                </span>

                <span className="ml-2">
                  ⚡
                </span>
              </p>

            </div>

          </div>

        </motion.div>

      </section>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="relative z-10 border-t border-white/10 px-6 py-10 md:px-12">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-center">

          <div>

            <div className="flex items-center gap-2">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 text-xs">
                ⚡
              </div>

              <p className="font-black">
                Campus Vibe
              </p>

            </div>

            <p className="mt-2 text-xs text-white/25">
              Sreenidhi University
            </p>

          </div>

          <p className="text-xs font-medium text-white/30">
            © 2026 Sreenidhi University Campus Vibe
          </p>

          <p className="text-sm font-bold text-white/35">
            Built for the students.{" "}
            <span className="text-orange-300">
              ⚡
            </span>
          </p>

        </div>

      </footer>

    </main>
  );
}