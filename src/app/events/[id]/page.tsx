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
import {
  motion,
  type Variants,
} from "framer-motion";
import { auth, db } from "@/lib/firebase";

type InteractionType = "none" | "registration" | "poll";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 25 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: "easeOut",
    },
  },
};

const stagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();

  const eventId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState<any>(null);

  const [selectedOption, setSelectedOption] = useState("");
  const [savedVote, setSavedVote] = useState("");
  const [voting, setVoting] = useState(false);
  const [voteMessage, setVoteMessage] = useState("");

  /*
   * Auth + existing poll vote
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        setSavedVote("");
        setSelectedOption("");
        return;
      }

      try {
        const voteDoc = await getDoc(
          doc(db, "pollVotes", `${eventId}_${user.uid}`)
        );

        if (voteDoc.exists()) {
          const option = voteDoc.data()?.option || "";

          setSavedVote(option);
          setSelectedOption(option);
        } else {
          setSavedVote("");
          setSelectedOption("");
        }
      } catch (error) {
        /*
         * A missing vote document can be rejected by the current
         * Firestore read rule. That is okay — it simply means
         * the student has not voted yet.
         */
        console.error("Failed to check existing vote:", error);

        setSavedVote("");
        setSelectedOption("");
      }
    });

    return () => unsubscribe();
  }, [eventId]);

  /*
   * Load event
   */
  useEffect(() => {
    async function loadEvent() {
      try {
        const eventDoc = await getDoc(doc(db, "events", eventId));

        if (!eventDoc.exists()) {
          setError("This event doesn't exist.");
          setLoading(false);
          return;
        }

        const eventData = eventDoc.data();

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
        console.error("Failed to load event:", error);
        setError("Couldn't load this event.");
      }

      setLoading(false);
    }

    loadEvent();
  }, [eventId]);

  /*
   * Submit poll vote
   */
  async function submitVote() {
    if (!currentUser) {
      setVoteMessage("Please log in to vote.");
      return;
    }

    if (!selectedOption) {
      setVoteMessage("Please select an option first.");
      return;
    }

    if (savedVote) {
      setVoteMessage("You have already voted in this poll.");
      return;
    }

    if (!event || event.interactionType !== "poll") {
      return;
    }

    const pollOptions: string[] = Array.isArray(event.poll?.options)
      ? event.poll.options
      : [];

    if (pollOptions.length < 2) {
      setVoteMessage(
        "This poll doesn't have enough valid options."
      );
      return;
    }

    if (!pollOptions.includes(selectedOption)) {
      setVoteMessage("That option is not available.");
      return;
    }

    setVoting(true);
    setVoteMessage("");

    try {
      const voteRef = doc(
        db,
        "pollVotes",
        `${eventId}_${currentUser.uid}`
      );

      /*
       * IMPORTANT:
       *
       * Do not perform another getDoc() here.
       *
       * A student who has not voted yet may not be allowed
       * to read a non-existent pollVotes document by the
       * current Firestore rules.
       *
       * Firestore security rules already guarantee that:
       *
       * - the document belongs to the signed-in user
       * - the eventId is valid
       * - the vote document ID is eventId_userId
       * - the vote is created only once
       * - updates are not allowed
       */
      await setDoc(voteRef, {
        eventId,
        userId: currentUser.uid,
        userEmail: currentUser.email || "",
        option: selectedOption,
        votedAt: serverTimestamp(),
      });

      setSavedVote(selectedOption);

      setVoteMessage(
        "Your response has been recorded! 🎉"
      );
    } catch (error: any) {
      console.error("Failed to submit vote:", error);

      /*
       * If the document already exists, Firestore will reject
       * the second write because our rules do not allow updates.
       */
      if (error?.code === "permission-denied") {
        setVoteMessage(
          "You may have already voted in this poll."
        );
      } else {
        setVoteMessage(
          "Couldn't save your vote. Please try again."
        );
      }
    } finally {
      setVoting(false);
    }
  }

  /*
   * Loading screen
   */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
            className="mb-4 text-5xl"
          >
            ⚡
          </motion.div>

          <p className="text-white/50">
            Loading event...
          </p>
        </motion.div>
      </main>
    );
  }

  /*
   * Event not found
   */
  if (!event) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] px-6 text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg text-center"
        >
          <div className="text-6xl">😕</div>

          <h1 className="mt-6 text-3xl font-black">
            Event not found
          </h1>

          <p className="mt-3 text-white/40">
            {error || "This event could not be found."}
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl bg-white px-7 py-3 font-black text-black"
          >
            Back to Campus
          </motion.button>
        </motion.div>
      </main>
    );
  }

  /*
   * Existing events without interactionType
   * are treated as registration events.
   */
  const interactionType: InteractionType =
    event.interactionType === "none" ||
    event.interactionType === "poll" ||
    event.interactionType === "registration"
      ? event.interactionType
      : "registration";

  const pollQuestion = event.poll?.question || "";

  const pollOptions: string[] = Array.isArray(
    event.poll?.options
  )
    ? event.poll.options.filter(
        (option: unknown): option is string =>
          typeof option === "string" &&
          option.trim().length > 0
      )
    : [];

  const validPoll =
    interactionType === "poll" &&
    pollQuestion.trim().length > 0 &&
    pollOptions.length >= 2;

  return (
    <main className="min-h-screen overflow-hidden bg-[#08080d] px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">

        {/* BACK BUTTON */}

        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          whileHover={{ x: -4 }}
          onClick={() => router.push("/")}
          className="mb-8 text-sm font-bold text-white/40 transition hover:text-white"
        >
          ← Back to Campus
        </motion.button>

        {/* MAIN EVENT CARD */}

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20"
        >

          {/* HERO */}

          <div className="relative overflow-hidden bg-gradient-to-br from-fuchsia-500/20 via-purple-500/10 to-cyan-500/10 px-7 py-12 md:px-12 md:py-16">

            <motion.div
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl"
            />

            <motion.div
              animate={{
                scale: [1.1, 1, 1.1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"
            />

            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="relative"
            >

              {/* BADGES */}

              <motion.div
                variants={fadeUp}
                className="flex flex-wrap items-center gap-3"
              >
                <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-black tracking-[0.2em] text-fuchsia-300">
                  CAMPUS EVENT
                </span>

                {event.category && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/60">
                    {event.category}
                  </span>
                )}
              </motion.div>

              {/* TITLE */}

              <motion.h1
                variants={fadeUp}
                className="mt-6 max-w-3xl text-4xl font-black leading-tight md:text-6xl"
              >
                {event.title}
              </motion.h1>

              {/* SHORT DESCRIPTION */}

              {event.description && (
                <motion.p
                  variants={fadeUp}
                  className="mt-6 max-w-2xl text-base leading-8 text-white/50 md:text-lg"
                >
                  {event.description}
                </motion.p>
              )}

            </motion.div>
          </div>

          {/* EVENT INFORMATION */}

          <div className="p-7 md:p-12">

            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >

              {/* DATE */}

              <motion.div
                variants={fadeUp}
                whileHover={{ y: -5 }}
                className="rounded-2xl border border-white/10 bg-black/20 p-5 transition"
              >
                <p className="text-xs font-black tracking-[0.2em] text-white/30">
                  DATE
                </p>

                <p className="mt-3 text-lg font-black">
                  📅 {event.date || "TBA"}
                </p>
              </motion.div>

              {/* TIME */}

              <motion.div
                variants={fadeUp}
                whileHover={{ y: -5 }}
                className="rounded-2xl border border-white/10 bg-black/20 p-5 transition"
              >
                <p className="text-xs font-black tracking-[0.2em] text-white/30">
                  TIME
                </p>

                <p className="mt-3 text-lg font-black">
                  🕐 {event.time || "TBA"}
                </p>
              </motion.div>

              {/* VENUE */}

              <motion.div
                variants={fadeUp}
                whileHover={{ y: -5 }}
                className="rounded-2xl border border-white/10 bg-black/20 p-5 transition sm:col-span-2 lg:col-span-1"
              >
                <p className="text-xs font-black tracking-[0.2em] text-white/30">
                  VENUE
                </p>

                <p className="mt-3 text-lg font-black">
                  📍 {event.venue || "TBA"}
                </p>
              </motion.div>

            </motion.div>

            {/* DESCRIPTION */}

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="mt-10"
            >
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
            </motion.div>

            {/* REGISTRATION */}

            {interactionType === "registration" && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6 }}
                className="mt-12 rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-7 md:p-8"
              >
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

                  <motion.button
                    whileHover={{
                      scale: 1.05,
                      boxShadow:
                        "0 15px 35px rgba(217,70,239,0.25)",
                    }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() =>
                      router.push(
                        `/events/${event.id}/register`
                      )
                    }
                    className="shrink-0 rounded-2xl bg-fuchsia-500 px-8 py-4 font-black text-white shadow-lg shadow-fuchsia-500/20"
                  >
                    Register Now →
                  </motion.button>

                </div>
              </motion.div>
            )}

            {/* POLL */}

            {interactionType === "poll" && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.6 }}
                className="mt-12 rounded-3xl border border-cyan-500/20 bg-cyan-500/[0.06] p-7 md:p-8"
              >

                <p className="text-xs font-black tracking-[0.25em] text-cyan-400">
                  QUICK POLL
                </p>

                {!validPoll ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-5"
                  >
                    <p className="font-bold text-yellow-300">
                      This poll isn't available yet.
                    </p>

                    <p className="mt-2 text-sm text-white/40">
                      The poll needs a question and at least two valid response options.
                    </p>
                  </motion.div>
                ) : (
                  <>

                    <motion.h2
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 text-2xl font-black"
                    >
                      {pollQuestion}
                    </motion.h2>

                    <p className="mt-2 text-sm leading-6 text-white/40">
                      {savedVote
                        ? "You've already submitted your response."
                        : "Choose one option below."}
                    </p>

                    {/* LOGIN MESSAGE */}

                    {!currentUser && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-5"
                      >
                        <p className="font-bold text-yellow-300">
                          Log in to vote
                        </p>

                        <p className="mt-1 text-sm text-white/40">
                          You need to be logged in before submitting a response.
                        </p>

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={() => router.push("/auth")}
                          className="mt-4 rounded-xl bg-white px-5 py-3 text-sm font-black text-black"
                        >
                          Log In →
                        </motion.button>
                      </motion.div>
                    )}

                    {/* POLL OPTIONS */}

                    <motion.div
                      variants={stagger}
                      initial="hidden"
                      animate="show"
                      className="mt-6 grid gap-3"
                    >
                      {pollOptions.map((option, index) => {
                        const isSelected =
                          selectedOption === option ||
                          savedVote === option;

                        return (
                          <motion.button
                            key={`${option}-${index}`}
                            variants={fadeUp}
                            whileHover={
                              !savedVote && currentUser
                                ? {
                                    scale: 1.015,
                                    x: 3,
                                  }
                                : {}
                            }
                            whileTap={
                              !savedVote && currentUser
                                ? { scale: 0.98 }
                                : {}
                            }
                            type="button"
                            disabled={
                              !!savedVote ||
                              voting ||
                              !currentUser
                            }
                            onClick={() => {
                              setSelectedOption(option);
                              setVoteMessage("");
                            }}
                            className={`group rounded-2xl border p-4 text-left transition ${
                              isSelected
                                ? "border-cyan-400 bg-cyan-400/10"
                                : "border-white/10 bg-black/20 hover:border-cyan-400/50 hover:bg-cyan-400/10"
                            } ${
                              !currentUser || !!savedVote
                                ? "cursor-default"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-4">

                              <motion.div
                                animate={
                                  isSelected
                                    ? {
                                        scale: [1, 1.15, 1],
                                      }
                                    : {
                                        scale: 1,
                                      }
                                }
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                                  isSelected
                                    ? "bg-cyan-400 text-black"
                                    : "bg-white/10 group-hover:bg-cyan-400 group-hover:text-black"
                                }`}
                              >
                                {isSelected
                                  ? "✓"
                                  : index + 1}
                              </motion.div>

                              <span className="font-bold">
                                {option}
                              </span>

                            </div>
                          </motion.button>
                        );
                      })}
                    </motion.div>

                    {/* SUBMIT */}

                    {currentUser && !savedVote && (
                      <motion.button
                        whileHover={{
                          scale: selectedOption ? 1.01 : 1,
                        }}
                        whileTap={{
                          scale: selectedOption ? 0.98 : 1,
                        }}
                        type="button"
                        onClick={submitVote}
                        disabled={
                          voting || !selectedOption
                        }
                        className="mt-6 w-full rounded-2xl bg-cyan-400 py-4 font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {voting
                          ? "Saving response..."
                          : "Submit Response →"}
                      </motion.button>
                    )}

                    {/* MESSAGE */}

                    {voteMessage && (
                      <motion.div
                        initial={{
                          opacity: 0,
                          y: 10,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        className={`mt-4 rounded-xl p-4 text-sm ${
                          voteMessage.includes("recorded")
                            ? "bg-green-500/10 text-green-300"
                            : "bg-yellow-500/10 text-yellow-300"
                        }`}
                      >
                        {voteMessage}
                      </motion.div>
                    )}

                  </>
                )}

              </motion.div>
            )}

            {/* NO INTERACTION */}

            {interactionType === "none" && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 25,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                  amount: 0.2,
                }}
                transition={{
                  duration: 0.6,
                }}
                className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:p-8"
              >
                <div className="flex items-center gap-4">

                  <motion.div
                    animate={{
                      y: [0, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl"
                  >
                    👀
                  </motion.div>

                  <div>
                    <p className="text-xs font-black tracking-[0.25em] text-white/40">
                      EVENT INFO
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      Just come and enjoy it.
                    </h2>

                    <p className="mt-1 text-sm text-white/40">
                      No registration or response is required for this event.
                    </p>
                  </div>

                </div>
              </motion.div>
            )}

          </div>
        </motion.div>

        {/* BOTTOM NAVIGATION */}

        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.3,
            duration: 0.5,
          }}
          className="mt-8 flex flex-wrap gap-3"
        >

          <motion.button
            whileHover={{
              scale: 1.03,
              x: -2,
            }}
            whileTap={{
              scale: 0.97,
            }}
            onClick={() => router.push("/")}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            ← All Events
          </motion.button>

          {interactionType === "registration" && (
            <motion.button
              whileHover={{
                scale: 1.05,
              }}
              whileTap={{
                scale: 0.97,
              }}
              onClick={() =>
                router.push(
                  `/events/${event.id}/register`
                )
              }
              className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black"
            >
              Register →
            </motion.button>
          )}

        </motion.div>

      </div>
    </main>
  );
}