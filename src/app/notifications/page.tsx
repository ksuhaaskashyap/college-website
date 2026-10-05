"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";

import { auth, db } from "@/lib/firebase";

type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
};

export default function NotificationsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * AUTH
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /*
   * LIVE NOTIFICATIONS
   */
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const loadedNotifications: NotificationItem[] =
          snapshot.docs.map((notificationDoc) => ({
            id: notificationDoc.id,
            ...(notificationDoc.data() as Omit<
              NotificationItem,
              "id"
            >),
          }));

        setNotifications(loadedNotifications);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error(
          "Notifications listener error:",
          snapshotError
        );

        setError(
          "Unable to load your notifications."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  /*
   * FORMAT DATE
   */
  const formatDate = (
    timestamp?: NotificationItem["createdAt"]
  ) => {
    if (!timestamp) {
      return "Just now";
    }

    const date = new Date(
      timestamp.seconds * 1000
    );

    return date.toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  /*
   * NOTIFICATION ICON
   */
  const getNotificationIcon = (
    type: string
  ) => {
    switch (type) {
      case "like":
        return "❤️";

      case "comment":
        return "💬";

      case "event":
        return "🎉";

      case "announcement":
        return "📢";

      default:
        return "🔔";
    }
  };

  /*
   * AUTH LOADING
   */
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
          className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white"
        />
      </main>
    );
  }

  /*
   * LOGIN REQUIRED
   */
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl"
        >
          <div className="mb-5 text-5xl">
            🔔
          </div>

          <h1 className="text-3xl font-bold">
            Your Notifications
          </h1>

          <p className="mt-3 text-white/60">
            Log in to see your campus
            notifications.
          </p>

          <button
            onClick={() =>
              router.push("/auth")
            }
            className="mt-7 w-full rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:scale-[1.02]"
          >
            Login
          </button>

          <button
            onClick={() =>
              router.push("/")
            }
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white/80 transition hover:bg-white/10"
          >
            Back Home
          </button>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-15%] top-[-10%] h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[120px]" />

        <div className="absolute right-[-15%] top-[20%] h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-[120px]" />

        <div className="absolute bottom-[-10%] left-[30%] h-[350px] w-[350px] rounded-full bg-pink-500/10 blur-[120px]" />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <button
            onClick={() =>
              router.push("/")
            }
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lg font-black text-black">
              CV
            </div>

            <div className="text-left">
              <div className="font-bold">
                Campus Vibe
              </div>

              <div className="text-xs text-white/40">
                Notifications
              </div>
            </div>
          </button>

          <button
            onClick={() =>
              router.push("/")
            }
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
          >
            ← Home
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <div className="relative mx-auto max-w-3xl px-5 py-10">
        {/* TITLE */}
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/40">
            Stay updated
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Notifications 🔔
          </h1>

          <p className="mt-3 text-white/50">
            See what's happening around your
            campus.
          </p>
        </motion.div>

        {/* ERROR */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{
                opacity: 0,
                y: -10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -10,
              }}
              className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* NOTIFICATIONS */}
        <section className="mt-8">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-20 text-center"
            >
              <div className="text-6xl">
                ✨
              </div>

              <h2 className="mt-5 text-2xl font-bold">
                You're all caught up!
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
                When someone interacts with
                your posts or something exciting
                happens on campus, your
                notifications will appear here.
              </p>

              <button
                onClick={() =>
                  router.push(
                    "/community"
                  )
                }
                className="mt-7 rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:scale-[1.02]"
              >
                Explore Community →
              </button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {notifications.map(
                  (
                    notification,
                    index
                  ) => (
                    <motion.div
                      key={
                        notification.id
                      }
                      initial={{
                        opacity: 0,
                        x: -15,
                      }}
                      animate={{
                        opacity: 1,
                        x: 0,
                      }}
                      exit={{
                        opacity: 0,
                        x: 15,
                      }}
                      transition={{
                        delay: Math.min(
                          index * 0.04,
                          0.2
                        ),
                      }}
                      className={`relative overflow-hidden rounded-2xl border p-4 transition ${
                        notification.read
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-white/15 bg-white/[0.07]"
                      }`}
                    >
                      {!notification.read && (
                        <div className="absolute left-0 top-0 h-full w-1 bg-white" />
                      )}

                      <div className="flex gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ${
                            notification.read
                              ? "bg-white/5"
                              : "bg-white/10"
                          }`}
                        >
                          {getNotificationIcon(
                            notification.type
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3
                              className={`text-sm font-bold ${
                                notification.read
                                  ? "text-white/80"
                                  : "text-white"
                              }`}
                            >
                              {
                                notification.title
                              }
                            </h3>

                            {!notification.read && (
                              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider text-black">
                                New
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm leading-6 text-white/50">
                            {
                              notification.message
                            }
                          </p>

                          <p className="mt-2 text-[11px] text-white/25">
                            {formatDate(
                              notification.createdAt
                            )}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}