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
import EventCountdown from "@/components/EventCountdown";

type InteractionType = "none" | "registration" | "poll";

const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
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
        console.error("Failed to check existing vote:", error);

        setSavedVote("");
        setSelectedOption("");
      }
    });

    return () => unsubscribe();
  }, [eventId]);

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

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#171321] px-6 text-[#fff8f0]">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#ff7a45]/15 blur-3xl" />

        <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-[#9b6dff]/15 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative text-center"
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
            className="mb-5 text-5xl"
          >
            ⚡
          </motion.div>

          <p className="text-sm font-bold text-[#fff8f0]/45">
            Loading event...
          </p>
        </motion.div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#171321] px-6 text-[#fff8f0]">
        <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-[#ff4f81]/10 blur-3xl" />

        <div className="pointer-events-none absolute -right-32 bottom-20 h-80 w-80 rounded-full bg-[#42e8d4]/10 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-lg text-center"
        >
          <div className="text-6xl">😕</div>

          <h1 className="mt-6 text-3xl font-black tracking-tight">
            Event not found
          </h1>

          <p className="mt-3 text-[#fff8f0]/45">
            {error || "This event could not be found."}
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/")}
            className="mt-8 rounded-2xl bg-[#fff8f0] px-7 py-3 font-black text-[#171321] shadow-xl"
          >
            Back to Campus
          </motion.button>
        </motion.div>
      </main>
    );
  }

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

  const hasDescription =
    typeof event.description === "string" &&
    event.description.trim().length > 0;

  const eventDetailImage =
    event.detailImageUrl || event.imageUrl;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#171321] text-[#fff8f0]">
      {/* BACKGROUND EFFECTS */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            opacity: [0.25, 0.4, 0.25],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-[#ff7a45]/10 blur-3xl"
        />

        <motion.div
          animate={{
            x: [0, -30, 0],
            y: [0, 20, 0],
            opacity: [0.2, 0.35, 0.2],
          }}
          transition={{
            duration: 11,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-[#9b6dff]/10 blur-3xl"
        />

        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#42e8d4]/5 blur-3xl" />
      </div>

      <div className="relative w-full">
        {/* BACK BUTTON */}
        <div className="px-5 py-6 sm:px-8 md:px-12 lg:px-20">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ x: -4 }}
            onClick={() => router.push("/")}
            className="group flex items-center gap-2 text-sm font-bold text-[#fff8f0]/45 transition hover:text-[#fff8f0]"
          >
            <span className="transition-transform group-hover:-translate-x-1">
              ←
            </span>

            Back to Campus
          </motion.button>
        </div>

        {/* ===================================================== */}
        {/* EVENT DETAIL IMAGE */}
        {/* ===================================================== */}

        <motion.section
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative w-full overflow-hidden border-y border-[#fff8f0]/10 bg-[#0d0a12]"
        >
          {eventDetailImage ? (
            <div className="relative flex w-full justify-center">
              <img
                src={eventDetailImage}
                alt={event.title || "Event image"}
                className="block h-auto max-h-[850px] w-full object-contain"
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#171321]/20 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="flex min-h-[420px] w-full items-center justify-center bg-[#0d0a12]">
              <div className="text-center">
                <div className="text-7xl opacity-20">
                  ⚡
                </div>

                <p className="mt-4 text-sm font-bold text-[#fff8f0]/25">
                  No event image available
                </p>
              </div>
            </div>
          )}
        </motion.section>

        {/* ===================================================== */}
        {/* TITLE + OPTIONAL DESCRIPTION */}
        {/* ===================================================== */}

        <motion.section
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.1,
            duration: 0.7,
          }}
          className="relative overflow-hidden border-b border-[#fff8f0]/10 px-5 py-16 sm:px-8 md:px-12 md:py-24 lg:px-20"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,122,69,0.13),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(155,109,255,0.13),transparent_32%),radial-gradient(circle_at_60%_100%,rgba(66,232,212,0.07),transparent_35%)]" />

          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.2, 0.35, 0.2],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#ff7a45]/10 blur-3xl"
          />

          <motion.div
            animate={{
              scale: [1.1, 1, 1.1],
              opacity: [0.15, 0.3, 0.15],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-[#9b6dff]/10 blur-3xl"
          />

          <div className="pointer-events-none absolute right-[12%] top-[18%] h-2 w-2 rounded-full bg-[#ffd166]" />

          <div className="pointer-events-none absolute right-[18%] top-[25%] h-1.5 w-1.5 rounded-full bg-[#42e8d4]" />

          <div className="pointer-events-none absolute bottom-[20%] left-[14%] h-2 w-2 rounded-full bg-[#ff4f81]" />

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="relative mx-auto flex w-full max-w-6xl flex-col items-center text-center"
          >
            <motion.h1
              variants={fadeUp}
              className={`font-black leading-[0.92] tracking-[-0.055em] ${
                hasDescription
                  ? "text-5xl sm:text-6xl md:text-7xl lg:text-8xl"
                  : "text-6xl sm:text-7xl md:text-8xl lg:text-[9rem]"
              }`}
            >
              {event.title}
            </motion.h1>

            {hasDescription && (
              <motion.p
                variants={fadeUp}
                className="mt-8 max-w-4xl text-base leading-8 text-[#fff8f0]/50 md:text-lg"
              >
                {event.description}
              </motion.p>
            )}
          </motion.div>
        </motion.section>

        {/* EVERYTHING BELOW */}
        <div className="w-full px-5 py-9 sm:px-8 md:px-12 md:py-14 lg:px-20">
          {/* COUNTDOWN */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.15,
              duration: 0.6,
            }}
            className="relative overflow-hidden rounded-[2rem] border border-[#ffd166]/20 bg-[#ffd166]/[0.055] p-5 shadow-2xl shadow-black/10 md:p-7"
          >
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#ffd166]/10 blur-3xl" />

            <div className="relative">
              <p className="mb-4 text-xs font-black tracking-[0.3em] text-[#ffd166]">
                THE CLOCK IS TICKING
              </p>

              <EventCountdown
                date={event.date}
                time={event.time}
              />
            </div>
          </motion.div>

          {/* DATE / TIME / VENUE */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <motion.div
              variants={fadeUp}
              whileHover={{ y: -5 }}
              className="group rounded-3xl border border-[#fff8f0]/10 bg-[#fff8f0]/[0.045] p-5 transition hover:border-[#ff7a45]/30 hover:bg-[#fff8f0]/[0.065]"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff7a45]/10 text-xl">
                📅
              </div>

              <p className="text-[10px] font-black tracking-[0.25em] text-[#fff8f0]/30">
                DATE
              </p>

              <p className="mt-2 text-lg font-black">
                {event.date || "TBA"}
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              whileHover={{ y: -5 }}
              className="group rounded-3xl border border-[#fff8f0]/10 bg-[#fff8f0]/[0.045] p-5 transition hover:border-[#9b6dff]/30 hover:bg-[#fff8f0]/[0.065]"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#9b6dff]/10 text-xl">
                🕐
              </div>

              <p className="text-[10px] font-black tracking-[0.25em] text-[#fff8f0]/30">
                TIME
              </p>

              <p className="mt-2 text-lg font-black">
                {event.time || "TBA"}
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              whileHover={{ y: -5 }}
              className="group rounded-3xl border border-[#fff8f0]/10 bg-[#fff8f0]/[0.045] p-5 transition hover:border-[#42e8d4]/30 hover:bg-[#fff8f0]/[0.065] sm:col-span-2 lg:col-span-1"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#42e8d4]/10 text-xl">
                📍
              </div>

              <p className="text-[10px] font-black tracking-[0.25em] text-[#fff8f0]/30">
                VENUE
              </p>

              <p className="mt-2 text-lg font-black">
                {event.venue || "TBA"}
              </p>
            </motion.div>
          </motion.div>

          {/* ABOUT — ONLY WHEN DESCRIPTION EXISTS */}
          {hasDescription && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{
                once: true,
                amount: 0.2,
              }}
              className="mt-14"
            >
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[#ff4f81]" />

                <p className="text-xs font-black tracking-[0.3em] text-[#ff4f81]">
                  ABOUT THIS EVENT
                </p>
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
                What's happening?
              </h2>

              <p className="mt-5 max-w-4xl whitespace-pre-wrap text-base leading-8 text-[#fff8f0]/50">
                {event.description}
              </p>
            </motion.div>
          )}

          {/* REGISTRATION */}
          {interactionType === "registration" && (
            <motion.div
              initial={{
                opacity: 0,
                y: 30,
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
              className="relative mt-14 overflow-hidden rounded-[2rem] border border-[#ff7a45]/20 bg-[#ff7a45]/[0.07] p-7 md:p-9"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#ff7a45]/15 blur-3xl" />

              <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#ff7a45]" />

                    <p className="text-xs font-black tracking-[0.25em] text-[#ff7a45]">
                      READY TO JOIN?
                    </p>
                  </div>

                  <h2 className="mt-3 text-3xl font-black tracking-tight">
                    Save your spot.
                  </h2>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#fff8f0]/45">
                    Register for this event and be part of the campus experience.
                  </p>
                </div>

                <motion.button
                  whileHover={{
                    scale: 1.05,
                    boxShadow:
                      "0 18px 40px rgba(255,122,69,0.22)",
                  }}
                  whileTap={{
                    scale: 0.96,
                  }}
                  onClick={() =>
                    router.push(
                      `/events/${event.id}/register`
                    )
                  }
                  className="shrink-0 rounded-2xl bg-[#ff7a45] px-8 py-4 font-black text-[#171321] shadow-xl shadow-[#ff7a45]/10"
                >
                  Register Now →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* POLL */}
          {interactionType === "poll" && (
            <motion.div
              initial={{
                opacity: 0,
                y: 30,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                once: true,
                amount: 0.15,
              }}
              transition={{
                duration: 0.6,
              }}
              className="relative mt-14 overflow-hidden rounded-[2rem] border border-[#42e8d4]/20 bg-[#42e8d4]/[0.055] p-7 md:p-9"
            >
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#42e8d4]/10 blur-3xl" />

              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#42e8d4]" />

                  <p className="text-xs font-black tracking-[0.25em] text-[#42e8d4]">
                    QUICK POLL
                  </p>
                </div>

                {!validPoll ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-5 rounded-2xl border border-[#ffd166]/20 bg-[#ffd166]/[0.05] p-5"
                  >
                    <p className="font-bold text-[#ffd166]">
                      This poll isn't available yet.
                    </p>

                    <p className="mt-2 text-sm text-[#fff8f0]/40">
                      The poll needs a question and at least two valid response options.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <motion.h2
                      initial={{
                        opacity: 0,
                        y: 15,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      className="mt-4 max-w-3xl text-2xl font-black md:text-3xl"
                    >
                      {pollQuestion}
                    </motion.h2>

                    <p className="mt-2 text-sm leading-6 text-[#fff8f0]/40">
                      {savedVote
                        ? "You've already submitted your response."
                        : "Choose one option below."}
                    </p>

                    {!currentUser && (
                      <motion.div
                        initial={{
                          opacity: 0,
                          scale: 0.97,
                        }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                        }}
                        className="mt-5 rounded-2xl border border-[#ffd166]/20 bg-[#ffd166]/[0.05] p-5"
                      >
                        <p className="font-bold text-[#ffd166]">
                          Log in to vote
                        </p>

                        <p className="mt-1 text-sm text-[#fff8f0]/40">
                          You need to be logged in before submitting a response.
                        </p>

                        <motion.button
                          whileHover={{
                            scale: 1.05,
                          }}
                          whileTap={{
                            scale: 0.97,
                          }}
                          type="button"
                          onClick={() =>
                            router.push("/auth")
                          }
                          className="mt-4 rounded-xl bg-[#fff8f0] px-5 py-3 text-sm font-black text-[#171321]"
                        >
                          Log In →
                        </motion.button>
                      </motion.div>
                    )}

                    <motion.div
                      variants={stagger}
                      initial="hidden"
                      animate="show"
                      className="mt-6 grid gap-3"
                    >
                      {pollOptions.map(
                        (option, index) => {
                          const isSelected =
                            selectedOption === option ||
                            savedVote === option;

                          return (
                            <motion.button
                              key={`${option}-${index}`}
                              variants={fadeUp}
                              whileHover={
                                !savedVote &&
                                currentUser
                                  ? {
                                      scale: 1.015,
                                      x: 3,
                                    }
                                  : {}
                              }
                              whileTap={
                                !savedVote &&
                                currentUser
                                  ? {
                                      scale: 0.98,
                                    }
                                  : {}
                              }
                              type="button"
                              disabled={
                                !!savedVote ||
                                voting ||
                                !currentUser
                              }
                              onClick={() => {
                                setSelectedOption(
                                  option
                                );
                                setVoteMessage("");
                              }}
                              className={`group rounded-2xl border p-4 text-left transition ${
                                isSelected
                                  ? "border-[#42e8d4]/60 bg-[#42e8d4]/10"
                                  : "border-[#fff8f0]/10 bg-[#171321]/30 hover:border-[#42e8d4]/40 hover:bg-[#42e8d4]/[0.07]"
                              } ${
                                !currentUser ||
                                !!savedVote
                                  ? "cursor-default"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <motion.div
                                  animate={
                                    isSelected
                                      ? {
                                          scale: [
                                            1,
                                            1.15,
                                            1,
                                          ],
                                        }
                                      : {
                                          scale: 1,
                                        }
                                  }
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                                    isSelected
                                      ? "bg-[#42e8d4] text-[#171321]"
                                      : "bg-[#fff8f0]/10 group-hover:bg-[#42e8d4] group-hover:text-[#171321]"
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
                        }
                      )}
                    </motion.div>

                    {currentUser && !savedVote && (
                      <motion.button
                        whileHover={{
                          scale: selectedOption
                            ? 1.01
                            : 1,
                        }}
                        whileTap={{
                          scale: selectedOption
                            ? 0.98
                            : 1,
                        }}
                        type="button"
                        onClick={submitVote}
                        disabled={
                          voting ||
                          !selectedOption
                        }
                        className="mt-6 w-full rounded-2xl bg-[#42e8d4] py-4 font-black text-[#171321] transition hover:bg-[#67f1e1] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {voting
                          ? "Saving response..."
                          : "Submit Response →"}
                      </motion.button>
                    )}

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
                          voteMessage.includes(
                            "recorded"
                          )
                            ? "bg-[#8be28b]/10 text-[#8be28b]"
                            : "bg-[#ffd166]/10 text-[#ffd166]"
                        }`}
                      >
                        {voteMessage}
                      </motion.div>
                    )}
                  </>
                )}
              </div>
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
              className="mt-14 rounded-[2rem] border border-[#fff8f0]/10 bg-[#fff8f0]/[0.035] p-7 md:p-8"
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
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ffd166]/10 text-xl"
                >
                  👀
                </motion.div>

                <div>
                  <p className="text-xs font-black tracking-[0.25em] text-[#fff8f0]/40">
                    EVENT INFO
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Just come and enjoy it.
                  </h2>

                  <p className="mt-1 text-sm text-[#fff8f0]/40">
                    No registration or response is required for this event.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* BOTTOM BUTTONS */}
        <div className="px-5 py-10 sm:px-8 md:px-12 lg:px-20">
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
            className="flex flex-wrap gap-3"
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
              className="rounded-xl border border-[#fff8f0]/10 bg-[#fff8f0]/[0.025] px-5 py-3 text-sm font-bold text-[#fff8f0]/55 transition hover:bg-[#fff8f0]/[0.06] hover:text-[#fff8f0]"
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
                className="rounded-xl bg-[#ff7a45] px-5 py-3 text-sm font-black text-[#171321] shadow-lg shadow-[#ff7a45]/10"
              >
                Register →
              </motion.button>
            )}
          </motion.div>
        </div>
      </div>
    </main>
  );
}