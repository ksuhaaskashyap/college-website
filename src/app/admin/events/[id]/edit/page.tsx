"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type InteractionType =
  | "none"
  | "registration"
  | "poll";

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();

  const eventId = params.id as string;

  const [checking, setChecking] = useState(true);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [category, setCategory] = useState("Campus");
  const [published, setPublished] = useState(true);

  // ENTRY CODE
  const [qrEntryEnabled, setQrEntryEnabled] =
    useState(false);

  const [interactionType, setInteractionType] =
    useState<InteractionType>("registration");

  const [pollQuestion, setPollQuestion] =
    useState("");

  const [pollOptions, setPollOptions] =
    useState<string[]>([
      "Yes",
      "No",
      "Maybe",
    ]);

  const [newPollOption, setNewPollOption] =
    useState("");

  // EVENT PHOTO
  const [existingImageUrl, setExistingImageUrl] =
    useState("");

  const [eventPhoto, setEventPhoto] =
    useState<File | null>(null);

  const [photoPreview, setPhotoPreview] =
    useState("");

  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  /*
   * --------------------------------------------------
   * CHECK ADMIN
   * --------------------------------------------------
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

          const admin =
            adminDoc.exists() &&
            adminDoc.data()?.role === "admin";

          setIsAdmin(admin);
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
   * --------------------------------------------------
   * LOAD EVENT
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!eventId || !isAdmin) {
      return;
    }

    async function loadEvent() {
      try {
        setLoadingEvent(true);
        setMessage("");

        const eventDoc = await getDoc(
          doc(db, "events", eventId)
        );

        if (!eventDoc.exists()) {
          setMessage(
            "This event doesn't exist."
          );
          setLoadingEvent(false);
          return;
        }

        const data = eventDoc.data();

        setTitle(data.title || "");
        setDescription(
          data.description || ""
        );
        setDate(data.date || "");
        setTime(data.time || "");
        setVenue(data.venue || "");
        setCategory(
          data.category || "Campus"
        );
        setPublished(
          data.published === true
        );

        setQrEntryEnabled(
          data.qrEntryEnabled === true
        );

        const loadedInteraction =
          data.interactionType;

        if (
          loadedInteraction === "none" ||
          loadedInteraction === "registration" ||
          loadedInteraction === "poll"
        ) {
          setInteractionType(
            loadedInteraction
          );
        } else {
          setInteractionType(
            "registration"
          );
        }

        if (
          data.poll &&
          typeof data.poll === "object"
        ) {
          setPollQuestion(
            data.poll.question || ""
          );

          if (
            Array.isArray(data.poll.options) &&
            data.poll.options.length > 0
          ) {
            setPollOptions(
              data.poll.options.filter(
                (option: unknown): option is string =>
                  typeof option === "string" &&
                  option.trim().length > 0
              )
            );
          }
        }

        const imageUrl =
          typeof data.imageUrl === "string"
            ? data.imageUrl
            : "";

        setExistingImageUrl(imageUrl);
        setPhotoPreview(imageUrl);
      } catch (error) {
        console.error(
          "Failed to load event:",
          error
        );

        setMessage(
          "Couldn't load this event."
        );
      } finally {
        setLoadingEvent(false);
      }
    }

    loadEvent();
  }, [eventId, isAdmin]);

  /*
   * --------------------------------------------------
   * PHOTO
   * --------------------------------------------------
   */

  function handlePhotoChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    setMessage("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage(
        "Please choose a JPG, PNG or WebP image."
      );

      e.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setMessage(
        "Please choose an image smaller than 5 MB."
      );

      e.target.value = "";
      return;
    }

    setEventPhoto(file);

    const previewUrl =
      URL.createObjectURL(file);

    setPhotoPreview(previewUrl);
  }

  function removePhoto() {
    setEventPhoto(null);
    setExistingImageUrl("");
    setPhotoPreview("");
    setMessage("");
  }

  async function uploadPhoto(): Promise<string> {
    if (!eventPhoto) {
      return "";
    }

    const cloudName =
      process.env
        .NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    const uploadPreset =
      process.env
        .NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary configuration is missing."
      );
    }

    setUploadingPhoto(true);

    try {
      const formData = new FormData();

      formData.append(
        "file",
        eventPhoto
      );

      formData.append(
        "upload_preset",
        uploadPreset
      );

      formData.append(
        "folder",
        "campus-vibe/events"
      );

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Cloudinary upload failed:",
          data
        );

        throw new Error(
          data?.error?.message ||
            "Photo upload failed."
        );
      }

      return data.secure_url || "";
    } finally {
      setUploadingPhoto(false);
    }
  }

  /*
   * --------------------------------------------------
   * POLL OPTIONS
   * --------------------------------------------------
   */

  function addPollOption() {
    const option =
      newPollOption.trim();

    if (!option) {
      return;
    }

    if (pollOptions.length >= 8) {
      setMessage(
        "You can add up to 8 poll options."
      );
      return;
    }

    const alreadyExists =
      pollOptions.some(
        (existingOption) =>
          existingOption.toLowerCase() ===
          option.toLowerCase()
      );

    if (alreadyExists) {
      setMessage(
        "That poll option already exists."
      );
      return;
    }

    setPollOptions((current) => [
      ...current,
      option,
    ]);

    setNewPollOption("");
    setMessage("");
  }

  function removePollOption(
    index: number
  ) {
    setPollOptions((current) =>
      current.filter(
        (_, optionIndex) =>
          optionIndex !== index
      )
    );
  }

  function resetPollOptions() {
    setPollOptions([
      "Yes",
      "No",
      "Maybe",
    ]);

    setMessage("");
  }

  /*
   * --------------------------------------------------
   * SAVE EVENT
   * --------------------------------------------------
   */

  async function saveEvent(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      if (!eventId) {
        throw new Error(
          "Event ID is missing."
        );
      }

      let imageUrl = existingImageUrl;

      /*
       * Upload a replacement photo
       * if the admin selected one.
       */
      if (eventPhoto) {
        imageUrl = await uploadPhoto();

        if (!imageUrl) {
          throw new Error(
            "The photo uploaded but no image URL was returned."
          );
        }
      }

      /*
       * Validate poll before saving.
       */
      if (interactionType === "poll") {
        const cleanQuestion =
          pollQuestion.trim();

        const cleanOptions =
          pollOptions
            .map((option) =>
              option.trim()
            )
            .filter(Boolean);

        const uniqueOptions =
          Array.from(
            new Set(
              cleanOptions
            )
          );

        if (!cleanQuestion) {
          setMessage(
            "Please enter a question for the poll."
          );

          setSaving(false);
          return;
        }

        if (uniqueOptions.length < 2) {
          setMessage(
            "A poll needs at least 2 options."
          );

          setSaving(false);
          return;
        }

        await updateDoc(
          doc(db, "events", eventId),
          {
            title,
            description,
            date,
            time,
            venue,
            category,
            published,

            qrEntryEnabled,

            interactionType: "poll",

            poll: {
              question:
                cleanQuestion,
              options:
                uniqueOptions,
            },

            imageUrl,
          }
        );
      } else {
        /*
         * Remove old poll data by replacing
         * the event with the non-poll fields.
         *
         * Firestore updateDoc cannot delete an
         * existing field unless we explicitly
         * use deleteField(), so import it below
         * and use it here.
         */
        const { deleteField } =
          await import(
            "firebase/firestore"
          );

        await updateDoc(
          doc(db, "events", eventId),
          {
            title,
            description,
            date,
            time,
            venue,
            category,
            published,

            qrEntryEnabled,

            interactionType,

            poll: deleteField(),

            imageUrl,
          }
        );
      }

      setMessage(
        "Event updated successfully! 🎉"
      );

      setTimeout(() => {
        router.push("/admin/events");
      }, 700);
    } catch (error) {
      console.error(
        "Failed to update event:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Couldn't update the event. Please try again."
      );

      setSaving(false);
    }
  }

  /*
   * --------------------------------------------------
   * LOADING
   * --------------------------------------------------
   */

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">
            ⚡
          </div>

          <p className="text-white/50">
            Checking admin access...
          </p>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * ACCESS DENIED
   * --------------------------------------------------
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
            Only administrators can edit events.
          </p>

          <button
            onClick={() =>
              router.push("/admin")
            }
            className="mt-8 rounded-xl bg-white px-6 py-3 font-black text-black transition hover:scale-105"
          >
            Back to Dashboard →
          </button>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * LOADING EVENT
   * --------------------------------------------------
   */

  if (loadingEvent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">
            ✏️
          </div>

          <p className="text-white/50">
            Loading event...
          </p>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * PAGE
   * --------------------------------------------------
   */

  return (
    <main className="min-h-screen bg-[#08080d] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">

        <button
          type="button"
          onClick={() =>
            router.push("/admin/events")
          }
          className="mb-8 text-sm text-white/40 transition hover:text-white"
        >
          ← Back to Manage Events
        </button>

        <p className="text-xs font-black tracking-[0.3em] text-blue-400">
          SREENIDHI
        </p>

        <h1 className="mt-3 text-5xl font-black">
          Edit Event
        </h1>

        <p className="mt-3 text-white/40">
          Update your campus event details.
        </p>

        <form
          onSubmit={saveEvent}
          className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-7"
        >

          {/* EVENT NAME */}

          <div>
            <label className="text-sm font-bold text-white/70">
              Event name
            </label>

            <input
              required
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="Sreenidhi Tech Fest 2026"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-blue-400"
            />
          </div>

          {/* DESCRIPTION */}

          <div>
            <label className="text-sm font-bold text-white/70">
              Description
            </label>

            <textarea
              required
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              placeholder="Tell students what this event is about..."
              rows={5}
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-blue-400"
            />
          </div>

          {/* EVENT PHOTO */}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">

            <div>
              <p className="text-xs font-black tracking-[0.2em] text-blue-400">
                EVENT PHOTO
              </p>

              <h2 className="mt-2 text-xl font-black">
                Update cover image
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/40">
                Upload a new JPG, PNG or WebP image up to 5 MB.
              </p>
            </div>

            {!photoPreview ? (
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center transition hover:border-blue-400/50 hover:bg-blue-400/[0.04]">

                <div className="text-4xl">
                  📸
                </div>

                <p className="mt-3 font-black">
                  Choose event photo
                </p>

                <p className="mt-1 text-xs text-white/30">
                  JPG, PNG or WebP · Max 5 MB
                </p>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handlePhotoChange
                  }
                  className="hidden"
                />

              </label>
            ) : (
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/30">

                <div className="relative aspect-video w-full">
                  <img
                    src={photoPreview}
                    alt="Event preview"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {eventPhoto?.name ||
                        "Current event photo"}
                    </p>

                    {eventPhoto && (
                      <p className="mt-1 text-xs text-white/30">
                        {(
                          eventPhoto.size /
                          1024 /
                          1024
                        ).toFixed(2)}{" "}
                        MB
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">

                    <label className="cursor-pointer rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10">
                      Replace

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={
                          handlePhotoChange
                        }
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={
                        removePhoto
                      }
                      className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-400/10"
                    >
                      Remove
                    </button>

                  </div>

                </div>

              </div>
            )}

          </div>

          {/* DATE + TIME */}

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="text-sm font-bold text-white/70">
                Date
              </label>

              <input
                required
                type="date"
                value={date}
                onChange={(e) =>
                  setDate(e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-blue-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-white/70">
                Time
              </label>

              <input
                required
                type="time"
                value={time}
                onChange={(e) =>
                  setTime(e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-blue-400"
              />
            </div>

          </div>

          {/* VENUE + CATEGORY */}

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="text-sm font-bold text-white/70">
                Venue
              </label>

              <input
                required
                value={venue}
                onChange={(e) =>
                  setVenue(e.target.value)
                }
                placeholder="Main Auditorium"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-blue-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-white/70">
                Category
              </label>

              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-blue-400"
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

          {/* EVENT INTERACTION */}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">

            <div>
              <p className="text-xs font-black tracking-[0.2em] text-blue-400">
                EVENT INTERACTION
              </p>

              <h2 className="mt-2 text-xl font-black">
                What should students do?
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/40">
                Choose how students can interact with this event.
              </p>
            </div>

            <div className="mt-5 grid gap-3">

              {/* NONE */}

              <button
                type="button"
                onClick={() => {
                  setInteractionType(
                    "none"
                  );
                  setMessage("");
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  interactionType ===
                  "none"
                    ? "border-blue-400 bg-blue-400/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-4">

                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${
                      interactionType ===
                      "none"
                        ? "bg-blue-400 text-black"
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
                  setInteractionType(
                    "registration"
                  );
                  setMessage("");
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  interactionType ===
                  "registration"
                    ? "border-blue-400 bg-blue-400/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-4">

                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${
                      interactionType ===
                      "registration"
                        ? "bg-blue-400 text-black"
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
                  setInteractionType(
                    "poll"
                  );
                  setMessage("");
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  interactionType ===
                  "poll"
                    ? "border-blue-400 bg-blue-400/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-4">

                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${
                      interactionType ===
                      "poll"
                        ? "bg-blue-400 text-black"
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

            </div>

            {/* POLL SETTINGS */}

            {interactionType ===
              "poll" && (
              <div className="mt-6 space-y-5 border-t border-white/10 pt-6">

                <div>
                  <label className="text-sm font-bold text-white/70">
                    Poll question
                  </label>

                  <input
                    required
                    value={
                      pollQuestion
                    }
                    onChange={(e) =>
                      setPollQuestion(
                        e.target.value
                      )
                    }
                    placeholder="Are you joining this event?"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-blue-400"
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <label className="text-sm font-bold text-white/70">
                      Response options
                    </label>

                    <button
                      type="button"
                      onClick={
                        resetPollOptions
                      }
                      className="text-xs font-bold text-blue-400 transition hover:text-blue-300"
                    >
                      Use Yes / No / Maybe
                    </button>

                  </div>

                  <div className="mt-3 space-y-2">

                    {pollOptions.map(
                      (
                        option,
                        index
                      ) => (
                        <div
                          key={`${option}-${index}`}
                          className="flex items-center gap-3"
                        >

                          <div className="flex h-11 flex-1 items-center rounded-xl border border-white/10 bg-black/30 px-4">

                            <span className="mr-3 text-xs font-black text-blue-400">
                              {index +
                                1}
                            </span>

                            <span className="text-sm font-bold">
                              {option}
                            </span>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removePollOption(
                                index
                              )
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300"
                            aria-label={`Remove ${option}`}
                          >
                            ×
                          </button>

                        </div>
                      )
                    )}

                  </div>

                  <div className="mt-3 flex gap-2">

                    <input
                      value={
                        newPollOption
                      }
                      onChange={(e) =>
                        setNewPollOption(
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key ===
                          "Enter"
                        ) {
                          e.preventDefault();
                          addPollOption();
                        }
                      }}
                      placeholder="Add a custom option..."
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                    />

                    <button
                      type="button"
                      onClick={
                        addPollOption
                      }
                      className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-blue-400"
                    >
                      + Add
                    </button>

                  </div>

                  <p className="mt-2 text-xs text-white/30">
                    Use between 2 and 8 response options.
                  </p>

                </div>

              </div>
            )}

          </div>

          {/* ENTRY CODE */}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">

            <div>
              <p className="text-xs font-black tracking-[0.2em] text-blue-400">
                ENTRY CODE
              </p>

              <h2 className="mt-2 text-xl font-black">
                Enable entry codes
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/40">
                Registered students can receive a unique 8-character code that admins can use to mark attendance.
              </p>
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-3">

              <input
                type="checkbox"
                checked={
                  qrEntryEnabled
                }
                onChange={(e) =>
                  setQrEntryEnabled(
                    e.target.checked
                  )
                }
                className="h-5 w-5"
              />

              <span className="text-sm font-bold text-white/70">
                Enable Entry Code
              </span>

            </label>

            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] p-4 text-xs leading-5 text-white/40">
              Optional — leave this unchecked if this event doesn't need entry codes.
            </div>

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

            <span className="text-sm text-white/70">
              Publish this event
            </span>

          </label>

          {/* MESSAGE */}

          {message && (
            <div
              className={`rounded-xl p-4 text-sm ${
                message
                  .toLowerCase()
                  .includes(
                    "successfully"
                  )
                  ? "bg-green-500/10 text-green-300"
                  : "bg-red-500/10 text-red-300"
              }`}
            >
              {message}
            </div>
          )}

          {/* ACTIONS */}

          <div className="flex flex-col gap-3 sm:flex-row">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/admin/events"
                )
              }
              className="flex-1 rounded-xl border border-white/10 py-4 font-black text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                uploadingPhoto
              }
              className="flex-1 rounded-xl bg-blue-500 py-4 font-black text-white transition hover:bg-blue-400 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingPhoto
                ? "Uploading photo..."
                : saving
                ? "Saving changes..."
                : "Save Changes →"}
            </button>

          </div>

        </form>
      </div>
    </main>
  );
}