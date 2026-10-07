"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type InteractionType = "none" | "registration" | "poll";

export default function NewEventPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [category, setCategory] = useState("Campus");
  const [published, setPublished] = useState(true);

  const [entryCodeEnabled, setEntryCodeEnabled] = useState(false);

  const [interactionType, setInteractionType] =
    useState<InteractionType>("registration");

  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>([
    "Yes",
    "No",
    "Maybe",
  ]);
  const [newPollOption, setNewPollOption] = useState("");

  const [eventPhoto, setEventPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, "admins", user.uid));

        const admin =
          adminDoc.exists() &&
          adminDoc.data()?.role === "admin";

        setIsAdmin(admin);
      } catch (error) {
        console.error("Admin check failed:", error);
        setIsAdmin(false);
      }

      setChecking(false);
    });

    return () => unsubscribe();
  }, []);

  function handlePhotoChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    setMessage("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Please choose a JPG, PNG or WebP image.");
      e.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setMessage("Please choose an image smaller than 5 MB.");
      e.target.value = "";
      return;
    }

    setEventPhoto(file);

    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  }

  function removePhoto() {
    setEventPhoto(null);
    setPhotoPreview("");
    setMessage("");
  }

  async function uploadPhoto(): Promise<string> {
    if (!eventPhoto) {
      return "";
    }

    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    const uploadPreset =
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary configuration is missing.");
    }

    setUploadingPhoto(true);

    try {
      const formData = new FormData();

      formData.append("file", eventPhoto);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", "campus-vibe/events");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Cloudinary upload failed:", data);

        throw new Error(
          data?.error?.message || "Photo upload failed."
        );
      }

      return data.secure_url || "";
    } finally {
      setUploadingPhoto(false);
    }
  }

  function addPollOption() {
    const option = newPollOption.trim();

    if (!option) return;

    if (pollOptions.length >= 8) {
      setMessage("You can add up to 8 poll options.");
      return;
    }

    const alreadyExists = pollOptions.some(
      (existingOption) =>
        existingOption.toLowerCase() === option.toLowerCase()
    );

    if (alreadyExists) {
      setMessage("That poll option already exists.");
      return;
    }

    setPollOptions((current) => [...current, option]);
    setNewPollOption("");
    setMessage("");
  }

  function removePollOption(index: number) {
    setPollOptions((current) =>
      current.filter((_, optionIndex) => optionIndex !== index)
    );
  }

  function resetPollOptions() {
    setPollOptions(["Yes", "No", "Maybe"]);
    setMessage("");
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      let imageUrl = "";

      if (eventPhoto) {
        imageUrl = await uploadPhoto();

        if (!imageUrl) {
          throw new Error(
            "The photo uploaded but no image URL was returned."
          );
        }
      }

      const cleanTitle = title.trim();
      const cleanDescription = description.trim();
      const cleanVenue = venue.trim();

      if (!cleanTitle) {
        setMessage("Please enter an event name.");
        setSaving(false);
        return;
      }

      if (!date) {
        setMessage("Please select an event date.");
        setSaving(false);
        return;
      }

      if (!time) {
        setMessage("Please select an event time.");
        setSaving(false);
        return;
      }

      if (!cleanVenue) {
        setMessage("Please enter the event venue.");
        setSaving(false);
        return;
      }

      if (interactionType === "poll") {
        const cleanQuestion = pollQuestion.trim();

        const cleanOptions = pollOptions
          .map((option) => option.trim())
          .filter(Boolean);

        if (!cleanQuestion) {
          setMessage("Please enter a question for the poll.");
          setSaving(false);
          return;
        }

        if (cleanOptions.length < 2) {
          setMessage("A poll needs at least 2 options.");
          setSaving(false);
          return;
        }

        await addDoc(collection(db, "events"), {
          title: cleanTitle,
          description: cleanDescription,
          date,
          time,
          venue: cleanVenue,
          category,
          published,

          entryCodeEnabled,
          qrEntryEnabled: entryCodeEnabled,

          interactionType: "poll",

          poll: {
            question: cleanQuestion,
            options: cleanOptions,
          },

          imageUrl,

          createdAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "events"), {
          title: cleanTitle,
          description: cleanDescription,
          date,
          time,
          venue: cleanVenue,
          category,
          published,

          entryCodeEnabled,
          qrEntryEnabled: entryCodeEnabled,

          interactionType,

          imageUrl,

          createdAt: serverTimestamp(),
        });
      }

      router.push("/admin/events");
    } catch (error) {
      console.error("Failed to create event:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Couldn't create the event. Please try again."
      );

      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#07051a] text-white">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="relative text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-300/20 bg-violet-500/10 text-4xl shadow-[0_0_60px_rgba(139,92,246,0.25)]">
            ⚡
          </div>

          <p className="font-bold text-white/50">
            Checking admin access...
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07051a] px-6 text-white">
        <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative max-w-md text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-red-300/20 bg-red-500/10 text-5xl">
            🔒
          </div>

          <p className="text-xs font-black tracking-[0.35em] text-fuchsia-300">
            CAMPUS VIBE
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Access denied
          </h1>

          <p className="mt-4 leading-7 text-white/45">
            Only administrators can manage events.
          </p>

          <button
            onClick={() => router.push("/admin")}
            className="mt-8 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-7 py-3.5 font-black text-white shadow-[0_0_35px_rgba(139,92,246,0.3)] transition hover:scale-105"
          >
            Back to Dashboard →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07051a] px-4 py-6 text-white sm:px-6 sm:py-10">
      {/* BACKGROUND AURORA */}

      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-[100px]" />
      <div className="pointer-events-none absolute right-[-10rem] top-[20%] h-[25rem] w-[25rem] rounded-full bg-cyan-500/15 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-12rem] left-[20%] h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/15 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-20 right-10 h-40 w-40 rounded-full bg-yellow-400/10 blur-[80px]" />

      {/* DECORATIVE DOTS */}

      <div className="pointer-events-none absolute left-[8%] top-[15%] text-xl text-yellow-300/40">
        ✦
      </div>

      <div className="pointer-events-none absolute right-[12%] top-[10%] text-2xl text-cyan-300/30">
        +
      </div>

      <div className="pointer-events-none absolute bottom-[12%] left-[8%] text-2xl text-fuchsia-300/30">
        ✦
      </div>

      <div className="pointer-events-none absolute bottom-[25%] right-[8%] text-xl text-violet-300/30">
        •
      </div>

      <div className="relative mx-auto max-w-4xl">

        {/* TOP NAV */}

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/admin")}
            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-bold text-white/55 backdrop-blur-xl transition hover:border-violet-400/30 hover:bg-violet-400/10 hover:text-white"
          >
            <span className="transition group-hover:-translate-x-1">
              ←
            </span>
            Dashboard
          </button>

          <div className="rounded-full border border-yellow-300/20 bg-yellow-300/5 px-4 py-2 text-[10px] font-black tracking-[0.25em] text-yellow-300">
            ADMIN MODE
          </div>
        </div>

        {/* HERO */}

        <div className="mt-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-4 py-2 text-xs font-black tracking-[0.2em] text-fuchsia-300">
            <span className="h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_12px_rgba(232,121,249,0.9)]" />
            CAMPUS VIBE
          </div>

          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
            Create something{" "}
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              unforgettable.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
            Turn your next campus idea into an event students
            actually want to show up for.
          </p>

          {/* MINI VIBE BAR */}

          <div className="mt-7 flex flex-wrap gap-2">
            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-bold text-violet-200">
              ✦ CREATE
            </span>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-200">
              ⚡ CONNECT
            </span>

            <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1.5 text-xs font-bold text-yellow-200">
              ✹ VIBE
            </span>
          </div>
        </div>

        {/* FORM */}

        <form
          onSubmit={createEvent}
          className="relative mt-10 space-y-6"
        >

          {/* EVENT IDENTITY */}

          <section className="overflow-hidden rounded-[2rem] border border-violet-300/10 bg-white/[0.045] shadow-[0_25px_100px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
            <div className="border-b border-white/10 bg-gradient-to-r from-violet-500/[0.08] via-fuchsia-500/[0.05] to-transparent px-6 py-5 sm:px-8">
              <p className="text-xs font-black tracking-[0.25em] text-violet-300">
                01 · EVENT IDENTITY
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Give it a personality.
              </h2>

              <p className="mt-1 text-sm text-white/35">
                The first thing students will see.
              </p>
            </div>

            <div className="space-y-6 p-6 sm:p-8">

              {/* TITLE */}

              <div>
                <label className="text-sm font-black text-white/75">
                  Event name
                </label>

                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Sreenidhi Tech Fest 2026"
                  className="mt-2 w-full rounded-2xl border border-violet-300/10 bg-[#08071b]/70 px-5 py-4 text-base font-medium outline-none transition placeholder:text-white/20 focus:border-violet-400/60 focus:bg-violet-500/[0.04] focus:shadow-[0_0_30px_rgba(139,92,246,0.12)]"
                />
              </div>

              {/* DESCRIPTION */}

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-black text-white/75">
                    Description
                  </label>

                  <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black tracking-wider text-cyan-300">
                    OPTIONAL
                  </span>
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell students what this event is about..."
                  rows={5}
                  className="mt-2 w-full resize-none rounded-2xl border border-cyan-300/10 bg-[#08071b]/70 px-5 py-4 leading-7 outline-none transition placeholder:text-white/20 focus:border-cyan-400/60 focus:bg-cyan-500/[0.04] focus:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                />
              </div>

            </div>
          </section>

          {/* EVENT PHOTO */}

          <section className="overflow-hidden rounded-[2rem] border border-fuchsia-300/10 bg-white/[0.045] backdrop-blur-2xl">
            <div className="border-b border-white/10 bg-gradient-to-r from-fuchsia-500/[0.08] via-pink-500/[0.04] to-transparent px-6 py-5 sm:px-8">
              <p className="text-xs font-black tracking-[0.25em] text-fuchsia-300">
                02 · VISUAL ENERGY
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Set the scene.
              </h2>

              <p className="mt-1 text-sm text-white/35">
                Give your event a cover students will remember.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              {!photoPreview ? (
                <label className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[1.5rem] border border-dashed border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-500/[0.07] via-violet-500/[0.04] to-cyan-500/[0.05] px-6 py-14 text-center transition hover:border-fuchsia-300/50 hover:bg-fuchsia-400/[0.08]">

                  <div className="absolute left-8 top-7 text-yellow-300/50">
                    ✦
                  </div>

                  <div className="absolute right-10 bottom-8 text-cyan-300/40">
                    +
                  </div>

                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] border border-white/10 bg-white/[0.06] text-4xl shadow-[0_0_50px_rgba(217,70,239,0.12)] transition group-hover:scale-110 group-hover:rotate-3">
                    📸
                  </div>

                  <p className="mt-5 text-lg font-black">
                    Drop some visual energy
                  </p>

                  <p className="mt-2 max-w-sm text-sm text-white/35">
                    Choose a JPG, PNG or WebP image up to 5 MB.
                  </p>

                  <span className="mt-5 rounded-full bg-gradient-to-r from-fuchsia-500/20 to-violet-500/20 px-4 py-2 text-xs font-black text-fuchsia-200">
                    + Choose event photo
                  </span>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="overflow-hidden rounded-[1.5rem] border border-fuchsia-300/15 bg-black/30">
                  <div className="relative aspect-video w-full">
                    <img
                      src={photoPreview}
                      alt="Event preview"
                      className="h-full w-full object-cover"
                    />

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5">
                      <span className="rounded-full bg-fuchsia-400/20 px-3 py-1 text-xs font-black text-fuchsia-200">
                        EVENT COVER
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">
                        {eventPhoto?.name}
                      </p>

                      <p className="mt-1 text-xs text-white/30">
                        {eventPhoto
                          ? `${(
                              eventPhoto.size /
                              1024 /
                              1024
                            ).toFixed(2)} MB`
                          : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={removePhoto}
                      className="rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-black text-red-300 transition hover:bg-red-400/10"
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* WHEN + WHERE */}

          <section className="overflow-hidden rounded-[2rem] border border-cyan-300/10 bg-white/[0.045] backdrop-blur-2xl">
            <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/[0.08] via-blue-500/[0.04] to-transparent px-6 py-5 sm:px-8">
              <p className="text-xs font-black tracking-[0.25em] text-cyan-300">
                03 · THE DETAILS
              </p>

              <h2 className="mt-2 text-2xl font-black">
                When & where?
              </h2>

              <p className="mt-1 text-sm text-white/35">
                Give everyone the coordinates.
              </p>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">

              <div>
                <label className="text-sm font-black text-white/75">
                  Date
                </label>

                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-cyan-300/10 bg-[#08071b]/70 px-5 py-4 outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                />
              </div>

              <div>
                <label className="text-sm font-black text-white/75">
                  Time
                </label>

                <input
                  required
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-cyan-300/10 bg-[#08071b]/70 px-5 py-4 outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                />
              </div>

              <div>
                <label className="text-sm font-black text-white/75">
                  Venue
                </label>

                <input
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Main Auditorium"
                  className="mt-2 w-full rounded-2xl border border-cyan-300/10 bg-[#08071b]/70 px-5 py-4 outline-none transition placeholder:text-white/20 focus:border-cyan-400/60 focus:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                />
              </div>

              <div>
                <label className="text-sm font-black text-white/75">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-cyan-300/10 bg-[#08071b]/70 px-5 py-4 outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                >
                  <option>Campus</option>
                  <option>Technical</option>
                  <option>Cultural</option>
                  <option>Sports</option>
                  <option>Workshop</option>
                  <option>Competition</option>
                  <option>Club</option>
                </select>
              </div>

            </div>
          </section>

          {/* INTERACTION */}

          <section className="overflow-hidden rounded-[2rem] border border-violet-300/10 bg-white/[0.045] backdrop-blur-2xl">
            <div className="border-b border-white/10 bg-gradient-to-r from-violet-500/[0.09] via-blue-500/[0.04] to-transparent px-6 py-5 sm:px-8">
              <p className="text-xs font-black tracking-[0.25em] text-violet-300">
                04 · THE EXPERIENCE
              </p>

              <h2 className="mt-2 text-2xl font-black">
                What should students do?
              </h2>

              <p className="mt-1 text-sm text-white/35">
                Pick the kind of experience you want to create.
              </p>
            </div>

            <div className="space-y-3 p-6 sm:p-8">

              {/* NONE */}

              <button
                type="button"
                onClick={() => {
                  setInteractionType("none");
                  setMessage("");
                }}
                className={`group w-full rounded-2xl border p-5 text-left transition ${
                  interactionType === "none"
                    ? "border-violet-400/60 bg-gradient-to-r from-violet-500/15 to-cyan-400/5 shadow-[0_0_35px_rgba(139,92,246,0.1)]"
                    : "border-white/10 bg-white/[0.025] hover:border-violet-300/20 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-xl ${
                      interactionType === "none"
                        ? "bg-violet-400 text-black shadow-[0_0_25px_rgba(139,92,246,0.4)]"
                        : "bg-white/10"
                    }`}
                  >
                    👀
                  </div>

                  <div>
                    <p className="font-black">
                      No interaction
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      Students can simply view the event.
                    </p>
                  </div>
                </div>
              </button>

              {/* REGISTRATION */}

              <button
                type="button"
                onClick={() => {
                  setInteractionType("registration");
                  setMessage("");
                }}
                className={`group w-full rounded-2xl border p-5 text-left transition ${
                  interactionType === "registration"
                    ? "border-cyan-400/60 bg-gradient-to-r from-cyan-500/15 to-violet-400/5 shadow-[0_0_35px_rgba(34,211,238,0.1)]"
                    : "border-white/10 bg-white/[0.025] hover:border-cyan-300/20 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-xl ${
                      interactionType === "registration"
                        ? "bg-cyan-400 text-black shadow-[0_0_25px_rgba(34,211,238,0.35)]"
                        : "bg-white/10"
                    }`}
                  >
                    🎟️
                  </div>

                  <div>
                    <p className="font-black">
                      Registration
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      Students can register using Campus Vibe.
                    </p>
                  </div>
                </div>
              </button>

              {/* POLL */}

              <button
                type="button"
                onClick={() => {
                  setInteractionType("poll");
                  setMessage("");
                }}
                className={`group w-full rounded-2xl border p-5 text-left transition ${
                  interactionType === "poll"
                    ? "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-500/15 to-violet-400/5 shadow-[0_0_35px_rgba(217,70,239,0.1)]"
                    : "border-white/10 bg-white/[0.025] hover:border-fuchsia-300/20 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-xl ${
                      interactionType === "poll"
                        ? "bg-fuchsia-400 text-black shadow-[0_0_25px_rgba(217,70,239,0.35)]"
                        : "bg-white/10"
                    }`}
                  >
                    📊
                  </div>

                  <div>
                    <p className="font-black">
                      Poll
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      Ask students a question with custom choices.
                    </p>
                  </div>
                </div>
              </button>

              {/* POLL SETTINGS */}

              {interactionType === "poll" && (
                <div className="mt-6 space-y-6 rounded-2xl border border-fuchsia-300/10 bg-fuchsia-500/[0.025] p-5 sm:p-6">

                  <div>
                    <label className="text-sm font-black text-white/75">
                      Poll question
                    </label>

                    <input
                      required
                      value={pollQuestion}
                      onChange={(e) =>
                        setPollQuestion(e.target.value)
                      }
                      placeholder="Are you joining this event?"
                      className="mt-2 w-full rounded-2xl border border-fuchsia-300/10 bg-[#08071b]/70 px-5 py-4 outline-none transition placeholder:text-white/20 focus:border-fuchsia-400/60"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="text-sm font-black text-white/75">
                        Response options
                      </label>

                      <button
                        type="button"
                        onClick={resetPollOptions}
                        className="text-xs font-black text-fuchsia-300 transition hover:text-fuchsia-200"
                      >
                        Reset to Yes / No / Maybe
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {pollOptions.map((option, index) => (
                        <div
                          key={`${option}-${index}`}
                          className="flex items-center gap-3"
                        >
                          <div className="flex min-h-12 flex-1 items-center rounded-2xl border border-white/10 bg-[#08071b]/70 px-4">
                            <span className="mr-3 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-400/20 to-violet-400/20 text-xs font-black text-fuchsia-300">
                              {index + 1}
                            </span>

                            <span className="text-sm font-bold">
                              {option}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removePollOption(index)}
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl text-white/35 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300"
                            aria-label={`Remove ${option}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <input
                        value={newPollOption}
                        onChange={(e) =>
                          setNewPollOption(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPollOption();
                          }
                        }}
                        placeholder="Add a custom option..."
                        className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#08071b]/70 px-4 py-3.5 text-sm outline-none transition placeholder:text-white/20 focus:border-fuchsia-400/50"
                      />

                      <button
                        type="button"
                        onClick={addPollOption}
                        className="rounded-2xl bg-gradient-to-r from-fuchsia-400 to-violet-400 px-5 py-3.5 text-sm font-black text-white transition hover:scale-[1.02]"
                      >
                        + Add
                      </button>
                    </div>

                    <p className="mt-3 text-xs text-white/25">
                      Use between 2 and 8 response options.
                    </p>
                  </div>

                </div>
              )}

            </div>
          </section>

          {/* ENTRY CODE */}

          <section className="overflow-hidden rounded-[2rem] border border-yellow-300/10 bg-white/[0.045] backdrop-blur-2xl">
            <div className="border-b border-white/10 bg-gradient-to-r from-yellow-400/[0.09] via-orange-400/[0.04] to-transparent px-6 py-5 sm:px-8">
              <p className="text-xs font-black tracking-[0.25em] text-yellow-300">
                05 · ENTRY
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Make check-in easy.
              </h2>

              <p className="mt-1 text-sm text-white/35">
                Give registered students a unique code for attendance.
              </p>
            </div>

            <div className="p-6 sm:p-8">

              <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-yellow-300/10 bg-yellow-400/[0.035] p-5 transition hover:border-yellow-300/25 hover:bg-yellow-400/[0.06]">
                <input
                  type="checkbox"
                  checked={entryCodeEnabled}
                  onChange={(e) =>
                    setEntryCodeEnabled(e.target.checked)
                  }
                  className="h-5 w-5 accent-yellow-400"
                />

                <div>
                  <p className="font-black">
                    Enable Entry Code
                  </p>

                  <p className="mt-1 text-xs text-white/35">
                    Generate unique 8-character codes for attendees.
                  </p>
                </div>
              </label>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.025] p-4">
                <span className="text-yellow-300">
                  ✦
                </span>

                <p className="text-xs leading-5 text-white/35">
                  Optional — leave this off if this event
                  doesn't need attendance entry codes.
                </p>
              </div>

            </div>
          </section>

          {/* PUBLISH */}

          <section className="overflow-hidden rounded-[2rem] border border-lime-300/10 bg-white/[0.045] backdrop-blur-2xl">
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="text-xs font-black tracking-[0.25em] text-lime-300">
                  06 · LAUNCH
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Ready to put it out there?
                </h2>

                <p className="mt-1 text-sm text-white/35">
                  Publish now or keep it hidden until you're ready.
                </p>
              </div>

              <label className="flex shrink-0 cursor-pointer items-center gap-3 rounded-2xl border border-lime-300/15 bg-lime-400/[0.05] px-5 py-4">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) =>
                    setPublished(e.target.checked)
                  }
                  className="h-5 w-5 accent-lime-400"
                />

                <span className="text-sm font-black text-lime-100">
                  Publish immediately
                </span>
              </label>
            </div>
          </section>

          {/* MESSAGE */}

          {message && (
            <div
              className={`rounded-2xl border p-5 text-sm font-bold ${
                message.toLowerCase().includes("success")
                  ? "border-green-400/20 bg-green-400/10 text-green-300"
                  : "border-red-400/20 bg-red-400/10 text-red-300"
              }`}
            >
              {message}
            </div>
          )}

          {/* CREATE */}

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/[0.06] to-cyan-400/10 p-6 sm:p-8">

            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-cyan-400/15 blur-3xl" />

            <div className="relative">
              <p className="text-center text-xs font-black tracking-[0.3em] text-white/30">
                YOUR EVENT. YOUR VIBE.
              </p>

              <button
                type="submit"
                disabled={saving || uploadingPhoto}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 py-5 text-base font-black text-white shadow-[0_0_50px_rgba(139,92,246,0.25)] transition hover:scale-[1.01] hover:shadow-[0_0_65px_rgba(217,70,239,0.3)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {uploadingPhoto
                  ? "Uploading photo..."
                  : saving
                  ? "Creating event..."
                  : "✦ Create Event →"}
              </button>

              <p className="mt-4 text-center text-xs text-white/25">
                Make it memorable. Make it yours.
              </p>
            </div>
          </div>

        </form>

        {/* FOOTER */}

        <div className="pb-8 pt-10 text-center">
          <p className="text-xs font-bold text-white/20">
            CAMPUS VIBE · SREENIDHI UNIVERSITY
          </p>

          <div className="mx-auto mt-3 flex justify-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-violet-400/50" />
            <span className="h-1.5 w-8 rounded-full bg-fuchsia-400/50" />
            <span className="h-1.5 w-8 rounded-full bg-cyan-400/50" />
            <span className="h-1.5 w-8 rounded-full bg-yellow-400/50" />
          </div>
        </div>

      </div>
    </main>
  );
}