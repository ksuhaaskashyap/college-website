"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  published: boolean;
  createdAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
};

export default function NotificationsPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(
    null
  );

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("announcement");
  const [published, setPublished] = useState(true);

  const [expiry, setExpiry] = useState("never");
  const [customExpiry, setCustomExpiry] = useState("");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );
  const [error, setError] = useState("");

  /*
   * ADMIN CHECK
   */

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

          setIsAdmin(
            adminDoc.exists() &&
              adminDoc.data()?.role === "admin"
          );
        } catch (error) {
          console.error(
            "Admin check failed:",
            error
          );

          setIsAdmin(false);
        }

        setChecking(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /*
   * LOAD NOTIFICATIONS
   */

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "notifications"),
      (snapshot) => {
        const items: NotificationItem[] = snapshot.docs.map(
          (notificationDoc) => {
            const data = notificationDoc.data();

            return {
              id: notificationDoc.id,
              title: data.title || "",
              message: data.message || "",
              type: data.type || "announcement",
              published: data.published === true,
              createdAt: data.createdAt || null,
              expiresAt: data.expiresAt || null,
            };
          }
        );

        items.sort((a, b) => {
          const aTime =
            a.createdAt?.toMillis?.() || 0;

          const bTime =
            b.createdAt?.toMillis?.() || 0;

          return bTime - aTime;
        });

        setNotifications(items);
      },
      (error) => {
        console.error(
          "Failed to load notifications:",
          error
        );

        setError(
          "Couldn't load notifications."
        );
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  /*
   * FORM HELPERS
   */

  function resetForm() {
    setTitle("");
    setMessage("");
    setType("announcement");
    setPublished(true);
    setExpiry("never");
    setCustomExpiry("");
    setEditingId(null);
    setError("");
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  function timestampToLocalInput(
    timestamp?: Timestamp | null
  ) {
    if (!timestamp?.toDate) {
      return "";
    }

    const date = timestamp.toDate();

    const offset =
      date.getTimezoneOffset() * 60 * 1000;

    return new Date(
      date.getTime() - offset
    )
      .toISOString()
      .slice(0, 16);
  }

  function openEditForm(
    notification: NotificationItem
  ) {
    setEditingId(notification.id);

    setTitle(notification.title);
    setMessage(notification.message);
    setType(notification.type);
    setPublished(notification.published);

    if (notification.expiresAt?.toDate) {
      setExpiry("custom");

      setCustomExpiry(
        timestampToLocalInput(
          notification.expiresAt
        )
      );
    } else {
      setExpiry("never");
      setCustomExpiry("");
    }

    setError("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function getExpiryTimestamp() {
    if (expiry === "never") {
      return null;
    }

    if (expiry === "custom") {
      if (!customExpiry) {
        throw new Error(
          "Please choose an expiry date and time."
        );
      }

      const date = new Date(customExpiry);

      if (Number.isNaN(date.getTime())) {
        throw new Error(
          "Please choose a valid expiry date and time."
        );
      }

      if (date.getTime() <= Date.now()) {
        throw new Error(
          "Expiry time must be in the future."
        );
      }

      return Timestamp.fromDate(date);
    }

    const hours = Number(expiry);

    return Timestamp.fromDate(
      new Date(
        Date.now() +
          hours * 60 * 60 * 1000
      )
    );
  }

  /*
   * CREATE / UPDATE
   */

  async function saveNotification(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setSaving(true);
    setError("");

    try {
      const cleanTitle = title.trim();
      const cleanMessage = message.trim();

      if (!cleanTitle) {
        throw new Error(
          "Please enter a notification title."
        );
      }

      if (!cleanMessage) {
        throw new Error(
          "Please enter a notification message."
        );
      }

      const expiresAt =
        getExpiryTimestamp();

      if (editingId) {
        await updateDoc(
          doc(
            db,
            "notifications",
            editingId
          ),
          {
            title: cleanTitle,
            message: cleanMessage,
            type,
            published,
            expiresAt,
          }
        );
      } else {
        await addDoc(
          collection(db, "notifications"),
          {
            title: cleanTitle,
            message: cleanMessage,
            type,
            published,
            createdAt:
              serverTimestamp(),
            expiresAt,
          }
        );
      }

      closeForm();
    } catch (error) {
      console.error(
        "Failed to save notification:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Couldn't save the notification. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * DELETE
   */

  async function deleteNotification(
    notification: NotificationItem
  ) {
    const confirmed = window.confirm(
      `Delete "${notification.title}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(notification.id);
    setError("");

    try {
      await deleteDoc(
        doc(
          db,
          "notifications",
          notification.id
        )
      );
    } catch (error) {
      console.error(
        "Failed to delete notification:",
        error
      );

      setError(
        "Couldn't delete the notification. Please try again."
      );
    } finally {
      setDeletingId(null);
    }
  }

  /*
   * PUBLISH / HIDE
   */

  async function togglePublished(
    notification: NotificationItem
  ) {
    try {
      await updateDoc(
        doc(
          db,
          "notifications",
          notification.id
        ),
        {
          published:
            !notification.published,
        }
      );
    } catch (error) {
      console.error(
        "Failed to update notification:",
        error
      );

      setError(
        "Couldn't update the notification."
      );
    }
  }

  /*
   * FORMATTERS
   */

  function formatDate(
    timestamp?: Timestamp | null
  ) {
    if (!timestamp?.toDate) {
      return "Unknown";
    }

    return timestamp
      .toDate()
      .toLocaleString();
  }

  function isExpired(
    timestamp?: Timestamp | null
  ) {
    if (!timestamp?.toMillis) {
      return false;
    }

    return (
      timestamp.toMillis() <= Date.now()
    );
  }

  /*
   * LOADING
   */

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">
            🔔
          </div>

          <p className="text-white/50">
            Checking admin access...
          </p>
        </div>
      </main>
    );
  }

  /*
   * ACCESS DENIED
   */

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
            You don't have permission to
            manage campus notifications.
          </p>

          <button
            onClick={() =>
              router.push("/")
            }
            className="mt-8 rounded-xl bg-white px-6 py-3 font-black text-black transition hover:scale-105"
          >
            Back to Campus →
          </button>
        </div>
      </main>
    );
  }

  /*
   * ADMIN PAGE
   */

  return (
    <main className="min-h-screen bg-[#08080d] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">

        {/* BACK */}

        <button
          onClick={() =>
            router.push("/admin")
          }
          className="mb-8 text-sm text-white/40 transition hover:text-white"
        >
          ← Back to dashboard
        </button>

        {/* HEADER */}

        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">

          <div>
            <p className="text-xs font-black tracking-[0.3em] text-fuchsia-400">
              SREENIDHI
            </p>

            <h1 className="mt-3 text-5xl font-black">
              Notifications
            </h1>

            <p className="mt-3 text-white/40">
              Create, edit and manage student
              notifications.
            </p>
          </div>

          <button
            onClick={openCreateForm}
            className="rounded-xl bg-white px-6 py-3 font-black text-black transition hover:scale-105"
          >
            + New Notification
          </button>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* FORM */}

        {showForm && (
          <form
            onSubmit={saveNotification}
            className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.25em] text-fuchsia-400">
                  {editingId
                    ? "EDIT MODE"
                    : "NEW"}
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {editingId
                    ? "Edit Notification"
                    : "Create Notification"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/50 transition hover:border-white/20 hover:text-white"
              >
                Cancel
              </button>
            </div>

            {/* TITLE */}

            <div>
              <label className="text-sm font-bold text-white/70">
                Notification title
              </label>

              <input
                required
                maxLength={100}
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                placeholder="Tech Fest registrations are open!"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-fuchsia-400"
              />
            </div>

            {/* MESSAGE */}

            <div>
              <label className="text-sm font-bold text-white/70">
                Message
              </label>

              <textarea
                required
                maxLength={500}
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                placeholder="Tell students what they need to know..."
                rows={5}
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-fuchsia-400"
              />

              <p className="mt-2 text-xs text-white/20">
                {message.length}/500
              </p>
            </div>

            {/* TYPE */}

            <div>
              <label className="text-sm font-bold text-white/70">
                Notification type
              </label>

              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-fuchsia-400"
              >
                <option value="announcement">
                  📢 Announcement
                </option>

                <option value="event">
                  🎉 Event
                </option>

                <option value="reminder">
                  ⏰ Reminder
                </option>
              </select>
            </div>

            {/* EXPIRY */}

            <div>
              <label className="text-sm font-bold text-white/70">
                Notification expiry
              </label>

              <p className="mt-1 text-xs text-white/30">
                Choose when this notification
                should disappear from students'
                notification list.
              </p>

              <select
                value={expiry}
                onChange={(e) =>
                  setExpiry(e.target.value)
                }
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-fuchsia-400"
              >
                <option value="never">
                  ♾️ Never expires
                </option>

                <option value="1">
                  ⏰ After 1 hour
                </option>

                <option value="6">
                  ⏰ After 6 hours
                </option>

                <option value="24">
                  📅 After 1 day
                </option>

                <option value="72">
                  📅 After 3 days
                </option>

                <option value="168">
                  📅 After 7 days
                </option>

                <option value="custom">
                  🗓️ Choose exact date & time
                </option>
              </select>

              {expiry === "custom" && (
                <input
                  type="datetime-local"
                  value={customExpiry}
                  onChange={(e) =>
                    setCustomExpiry(
                      e.target.value
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-fuchsia-400"
                />
              )}
            </div>

            {/* PUBLISH */}

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) =>
                  setPublished(
                    e.target.checked
                  )
                }
                className="h-5 w-5"
              />

              <div>
                <p className="text-sm font-bold text-white/70">
                  Publish immediately
                </p>

                <p className="mt-1 text-xs text-white/30">
                  Students will see this
                  notification as soon as it
                  is published.
                </p>
              </div>
            </label>

            {/* FORM ERROR */}

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* SAVE */}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-white py-4 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes →"
                  : published
                    ? "Publish Notification →"
                    : "Save Notification →"}
            </button>
          </form>
        )}

        {/* NOTIFICATION LIST */}

        <div className="mt-10 space-y-4">

          {notifications.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
              <div className="text-5xl">
                🔔
              </div>

              <h2 className="mt-4 text-2xl font-black">
                No notifications yet
              </h2>

              <p className="mt-2 text-white/40">
                Create your first notification
                for students.
              </p>
            </div>
          ) : (
            notifications.map(
              (notification) => {
                const expired =
                  isExpired(
                    notification.expiresAt
                  );

                return (
                  <div
                    key={notification.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-bold text-fuchsia-300">
                            {notification.type}
                          </span>

                          {notification.published ? (
                            <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs font-bold text-green-300">
                              Published
                            </span>
                          ) : (
                            <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-300">
                              Hidden
                            </span>
                          )}

                          {expired && (
                            <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-bold text-red-300">
                              Expired
                            </span>
                          )}
                        </div>

                        <h2 className="mt-4 break-words text-2xl font-black">
                          {notification.title}
                        </h2>

                        <p className="mt-2 whitespace-pre-wrap break-words text-white/50">
                          {notification.message}
                        </p>

                        <div className="mt-5 space-y-1 text-xs text-white/25">
                          <p>
                            Created:{" "}
                            {formatDate(
                              notification.createdAt
                            )}
                          </p>

                          <p>
                            Expires:{" "}
                            {notification.expiresAt
                              ? formatDate(
                                  notification.expiresAt
                                )
                              : "Never"}
                          </p>
                        </div>

                      </div>

                      {/* ACTIONS */}

                      <div className="flex flex-wrap gap-2 lg:w-48 lg:justify-end">

                        <button
                          onClick={() =>
                            openEditForm(
                              notification
                            )
                          }
                          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-white/20 hover:text-white"
                        >
                          ✏️ Edit
                        </button>

                        <button
                          onClick={() =>
                            togglePublished(
                              notification
                            )
                          }
                          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-white/20 hover:text-white"
                        >
                          {notification.published
                            ? "🙈 Hide"
                            : "👁️ Publish"}
                        </button>

                        <button
                          onClick={() =>
                            deleteNotification(
                              notification
                            )
                          }
                          disabled={
                            deletingId ===
                            notification.id
                          }
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId ===
                          notification.id
                            ? "Deleting..."
                            : "🗑️ Delete"}
                        </button>

                      </div>

                    </div>
                  </div>
                );
              }
            )
          )}

        </div>

      </div>
    </main>
  );
}