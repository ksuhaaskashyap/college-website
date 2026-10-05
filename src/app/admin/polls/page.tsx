"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type PollEvent = {
  id: string;
  title: string;
  category?: string;
  date?: string;
  time?: string;
  venue?: string;
  published?: boolean;
  interactionType?: string;
  poll?: {
    question?: string;
    options?: string[];
  };
};

type PollResult = {
  event: PollEvent;
  totalVotes: number;
  optionCounts: Record<string, number>;
};

export default function AdminPollsPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [pollEvents, setPollEvents] = useState<PollEvent[]>([]);
  const [polls, setPolls] = useState<PollResult[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /*
   * --------------------------------------------------
   * ADMIN AUTHENTICATION
   * --------------------------------------------------
   */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setCheckingAuth(false);
        router.replace("/admin");
        return;
      }

      try {
        const adminDoc = await getDoc(
          doc(db, "admins", user.uid)
        );

        if (!adminDoc.exists()) {
          setIsAdmin(false);
          setCheckingAuth(false);
          router.replace("/");
          return;
        }

        const adminData = adminDoc.data();

        if (adminData.role !== "admin") {
          setIsAdmin(false);
          setCheckingAuth(false);
          router.replace("/");
          return;
        }

        setIsAdmin(true);
        setCheckingAuth(false);
      } catch (err) {
        console.error("Admin verification failed:", err);

        setIsAdmin(false);
        setCheckingAuth(false);
        router.replace("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  /*
   * --------------------------------------------------
   * LIVE POLL EVENTS
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    setLoading(true);
    setError("");

    const eventsRef = collection(db, "events");

    const unsubscribe = onSnapshot(
      eventsRef,
      (snapshot) => {
        const events: PollEvent[] = [];

        snapshot.forEach((eventDoc) => {
          const data = eventDoc.data();

          if (data.interactionType !== "poll") {
            return;
          }

          /*
           * Build the object explicitly.
           *
           * This prevents TypeScript from losing the
           * required title property when spreading
           * Firestore's untyped data.
           */

          const pollEvent: PollEvent = {
            id: eventDoc.id,
            title:
              typeof data.title === "string"
                ? data.title
                : "Untitled Poll",

            category:
              typeof data.category === "string"
                ? data.category
                : undefined,

            date:
              typeof data.date === "string"
                ? data.date
                : undefined,

            time:
              typeof data.time === "string"
                ? data.time
                : undefined,

            venue:
              typeof data.venue === "string"
                ? data.venue
                : undefined,

            published:
              typeof data.published === "boolean"
                ? data.published
                : undefined,

            interactionType:
              typeof data.interactionType === "string"
                ? data.interactionType
                : undefined,

            poll: {
              question:
                typeof data.poll?.question === "string"
                  ? data.poll.question
                  : undefined,

              options: Array.isArray(data.poll?.options)
                ? data.poll.options.filter(
                    (option: unknown): option is string =>
                      typeof option === "string"
                  )
                : [],
            },
          };

          events.push(pollEvent);
        });

        events.sort((a, b) => {
          const dateA = a.date || "";
          const dateB = b.date || "";

          return dateB.localeCompare(dateA);
        });

        setPollEvents(events);
        setLoading(false);
        setLastUpdated(new Date());
      },
      (err) => {
        console.error(
          "Error listening to poll events:",
          err
        );

        setError(
          "We couldn't load poll results. Please try again."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  /*
   * --------------------------------------------------
   * LIVE VOTE LISTENERS
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    if (pollEvents.length === 0) {
      setPolls([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeFunctions: (() => void)[] = [];

    const voteData: Record<
      string,
      {
        totalVotes: number;
        optionCounts: Record<string, number>;
      }
    > = {};

    const loadedPolls = new Set<string>();

    pollEvents.forEach((event) => {
      const votesQuery = query(
        collection(db, "pollVotes"),
        where("eventId", "==", event.id)
      );

      const unsubscribe = onSnapshot(
        votesQuery,
        (snapshot) => {
          const optionCounts: Record<string, number> = {};

          const options = event.poll?.options || [];

          /*
           * Start every option at zero.
           */

          options.forEach((option) => {
            optionCounts[option] = 0;
          });

          /*
           * Count votes.
           */

          snapshot.forEach((voteDoc) => {
            const vote = voteDoc.data();

            if (typeof vote.option === "string") {
              optionCounts[vote.option] =
                (optionCounts[vote.option] || 0) + 1;
            }
          });

          voteData[event.id] = {
            totalVotes: snapshot.size,
            optionCounts,
          };

          loadedPolls.add(event.id);

          /*
           * Build results.
           */

          const results: PollResult[] = pollEvents
            .map((pollEvent) => {
              const data = voteData[pollEvent.id];

              if (!data) {
                return null;
              }

              return {
                event: pollEvent,
                totalVotes: data.totalVotes,
                optionCounts: data.optionCounts,
              };
            })
            .filter(
              (result): result is PollResult =>
                result !== null
            );

          results.sort((a, b) => {
            const dateA = a.event.date || "";
            const dateB = b.event.date || "";

            return dateB.localeCompare(dateA);
          });

          setPolls(results);

          if (
            loadedPolls.size === pollEvents.length
          ) {
            setLoading(false);
          }

          setLastUpdated(new Date());
        },
        (err) => {
          console.error(
            `Error listening to votes for poll ${event.id}:`,
            err
          );

          setError(
            "We couldn't load live poll results. Please try again."
          );

          setLoading(false);
        }
      );

      unsubscribeFunctions.push(unsubscribe);
    });

    return () => {
      unsubscribeFunctions.forEach(
        (unsubscribe) => unsubscribe()
      );
    };
  }, [isAdmin, pollEvents]);

  /*
   * --------------------------------------------------
   * AUTH CHECK LOADING
   * --------------------------------------------------
   */

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-black px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-gray-400">
            Checking admin access...
          </p>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * NOT ADMIN
   * --------------------------------------------------
   */

  if (!isAdmin) {
    return null;
  }

  /*
   * --------------------------------------------------
   * MAIN PAGE
   * --------------------------------------------------
   */

  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="mb-4 text-sm font-semibold text-gray-400 transition hover:text-white"
            >
              ← Back to Admin Dashboard
            </button>

            <p className="mb-2 text-xs font-black uppercase tracking-[0.3em] text-purple-400">
              Campus Vibe · Admin
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Poll Results
              </h1>

              <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-xs font-black text-green-300">
                ● LIVE
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-sm text-gray-400 md:text-base">
              See how students are voting across your campus polls in real time.
            </p>

            {lastUpdated && (
              <p className="mt-2 text-xs text-gray-600">
                Live connection active · Updated{" "}
                {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-green-400/20 bg-green-400/5 px-4 py-3 text-xs font-bold text-green-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              Live results
            </div>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
            <p className="font-bold text-red-300">
              {error}
            </p>

            <button
              onClick={() => {
                setError("");
                setLoading(true);
                window.location.reload();
              }}
              className="mt-3 text-sm font-bold text-red-200 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* LOADING */}

        {loading && polls.length === 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
              />
            ))}
          </div>
        )}

        {/* EMPTY */}

        {!loading &&
          polls.length === 0 &&
          !error && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
              <div className="mb-4 text-5xl">
                📊
              </div>

              <h2 className="text-2xl font-black">
                No polls yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
                Create an event with the interaction type set to Poll and it will appear here automatically.
              </p>

              <button
                onClick={() =>
                  router.push("/admin/events/new")
                }
                className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-gray-200"
              >
                Create a Poll
              </button>
            </div>
          )}

        {/* POLLS */}

        <div className="grid gap-6 md:grid-cols-2">
          {polls.map((result) => {
            const options =
              result.event.poll?.options || [];

            const question =
              result.event.poll?.question ||
              "Untitled poll";

            return (
              <section
                key={result.event.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
              >

                {/* POLL HEADER */}

                <div className="border-b border-white/10 p-6">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                          Poll
                        </p>

                        <span className="rounded-full bg-green-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-green-300">
                          Live
                        </span>
                      </div>

                      <h2 className="text-xl font-black leading-tight md:text-2xl">
                        {result.event.title}
                      </h2>
                    </div>

                    <div className="shrink-0 rounded-full bg-purple-400/10 px-3 py-1.5 text-xs font-bold text-purple-300">
                      {result.totalVotes}{" "}
                      {result.totalVotes === 1
                        ? "vote"
                        : "votes"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Question
                    </p>

                    <p className="mt-1 font-semibold text-gray-200">
                      {question}
                    </p>
                  </div>

                  {(result.event.date ||
                    result.event.time ||
                    result.event.venue) && (
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
                      {result.event.date && (
                        <span className="rounded-full border border-white/10 px-3 py-1.5">
                          📅 {result.event.date}
                        </span>
                      )}

                      {result.event.time && (
                        <span className="rounded-full border border-white/10 px-3 py-1.5">
                          🕐 {result.event.time}
                        </span>
                      )}

                      {result.event.venue && (
                        <span className="rounded-full border border-white/10 px-3 py-1.5">
                          📍 {result.event.venue}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* RESULTS */}

                <div className="p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-gray-400">
                      Results
                    </h3>

                    <span className="text-xs text-gray-500">
                      {result.totalVotes} total
                    </span>
                  </div>

                  {options.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      This poll has no options.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {options.map((option) => {
                        const count =
                          result.optionCounts[option] || 0;

                        const percentage =
                          result.totalVotes > 0
                            ? Math.round(
                                (count /
                                  result.totalVotes) *
                                  100
                              )
                            : 0;

                        return (
                          <div key={option}>
                            <div className="mb-2 flex items-center justify-between gap-4">
                              <span className="min-w-0 truncate text-sm font-bold text-gray-200">
                                {option}
                              </span>

                              <span className="shrink-0 text-sm font-black text-purple-300">
                                {count} · {percentage}%
                              </span>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {result.totalVotes === 0 && (
                    <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-5 text-center">
                      <p className="text-sm font-semibold text-gray-400">
                        No one has voted yet.
                      </p>

                      <p className="mt-1 text-xs text-gray-600">
                        Results will appear here automatically when students vote.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}