"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";

import { auth, db } from "@/lib/firebase";

type Post = {
  id: string;
  userId: string;
  authorEmail: string;
  caption: string;
  imageUrl: string;
  createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
};

type CommentItem = {
  id: string;
  userId: string;
  authorEmail?: string;
  text: string;
  createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
};

type LikeInfo = {
  count: number;
  liked: boolean;
};

export default function CommunityPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* LIKE STATE */
  const [likes, setLikes] = useState<
    Record<string, LikeInfo>
  >({});

  const [likingPostId, setLikingPostId] =
    useState<string | null>(null);

  /* COMMENTS */
  const [comments, setComments] = useState<
    Record<string, CommentItem[]>
  >({});

  const [commentInputs, setCommentInputs] = useState<
    Record<string, string>
  >({});

  const [commentLoadingPostId, setCommentLoadingPostId] =
    useState<string | null>(null);

  /* POST EDITING */
  const [editingPostId, setEditingPostId] =
    useState<string | null>(null);

  const [editingCaption, setEditingCaption] =
    useState("");

  const [editingPhoto, setEditingPhoto] =
    useState<File | null>(null);

  const [editingPhotoPreview, setEditingPhotoPreview] =
    useState("");

  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingPostId, setDeletingPostId] =
    useState<string | null>(null);

  /* POST MENU */
  const [openPostMenuId, setOpenPostMenuId] =
    useState<string | null>(null);

  /* COMMENT EDITING */
  const [editingCommentId, setEditingCommentId] =
    useState<string | null>(null);

  const [editingCommentText, setEditingCommentText] =
    useState("");

  const [savingCommentId, setSavingCommentId] =
    useState<string | null>(null);

  const [deletingCommentId, setDeletingCommentId] =
    useState<string | null>(null);

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
   * SEND ACTIVITY NOTIFICATION
   *
   * This calls the secure server-side notification API.
   * The server verifies the Firebase ID token and decides
   * who should receive the notification.
   */
  const sendActivityNotification = async (payload: {
    type: "like" | "comment";
    postId: string;
    commentId?: string;
  }) => {
    const currentUser = auth.currentUser;

    if (!currentUser) return;

    try {
      const idToken =
        await currentUser.getIdToken();

      const response = await fetch(
        "/api/notifications",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        console.error(
          "Notification request failed:",
          await response.text()
        );
      }
    } catch (notificationError) {
      console.error(
        "Notification request failed:",
        notificationError
      );
    }
  };

  /*
   * LOAD POSTS LIVE
   */
  useEffect(() => {
    if (!user) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const loadedPosts: Post[] =
          snapshot.docs.map((postDoc) => ({
            id: postDoc.id,
            ...(postDoc.data() as Omit<Post, "id">),
          }));

        setPosts(loadedPosts);
        setLoadingPosts(false);
      },
      (snapshotError) => {
        console.error(
          "Posts listener error:",
          snapshotError
        );

        setError(
          "Unable to load community posts."
        );

        setLoadingPosts(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  /*
   * LIVE LIKES + COMMENTS
   */
  useEffect(() => {
    if (!user || posts.length === 0) {
      setLikes({});
      setComments({});
      return;
    }

    const unsubscribers: (() => void)[] = [];

    posts.forEach((post) => {
      /* LIKES */

      const likesRef = collection(
        db,
        "posts",
        post.id,
        "likes"
      );

      const unsubscribeLikes = onSnapshot(
        likesRef,
        (snapshot) => {
          const liked = snapshot.docs.some(
            (likeDoc) =>
              likeDoc.id === user.uid
          );

          setLikes((current) => ({
            ...current,
            [post.id]: {
              count: snapshot.size,
              liked,
            },
          }));
        },
        (snapshotError) => {
          console.error(
            `Likes listener error for ${post.id}:`,
            snapshotError
          );
        }
      );

      unsubscribers.push(unsubscribeLikes);

      /* COMMENTS */

      const commentsQuery = query(
        collection(
          db,
          "posts",
          post.id,
          "comments"
        ),
        orderBy("createdAt", "asc")
      );

      const unsubscribeComments = onSnapshot(
        commentsQuery,
        (snapshot) => {
          const loadedComments: CommentItem[] =
            snapshot.docs.map((commentDoc) => ({
              id: commentDoc.id,
              ...(commentDoc.data() as Omit<
                CommentItem,
                "id"
              >),
            }));

          setComments((current) => ({
            ...current,
            [post.id]: loadedComments,
          }));
        },
        (snapshotError) => {
          console.error(
            `Comments listener error for ${post.id}:`,
            snapshotError
          );
        }
      );

      unsubscribers.push(unsubscribeComments);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) =>
        unsubscribe()
      );
    };
  }, [posts, user]);

  /*
   * PHOTO SELECT
   */
  const handlePhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setError("");
    setSuccess("");

    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Please choose a JPG, PNG, or WebP image."
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Image must be smaller than 5 MB."
      );
      return;
    }

    setPhoto(file);

    const previewUrl =
      URL.createObjectURL(file);

    setPhotoPreview(previewUrl);
  };

  /*
   * REMOVE PHOTO
   */
  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview("");
  };

  /*
   * CLOUDINARY UPLOAD
   */
  const uploadPhoto = async (file: File) => {
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

    const formData = new FormData();

    formData.append("file", file);

    formData.append(
      "upload_preset",
      uploadPreset
    );

    formData.append(
      "folder",
      "campus-vibe/community"
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      console.error(
        "Cloudinary error:",
        data
      );

      throw new Error(
        "Photo upload failed. Please try again."
      );
    }

    return data.secure_url as string;
  };

  /*
   * CREATE POST
   */
  const handleCreatePost = async () => {
    setError("");
    setSuccess("");

    if (!user) {
      setError(
        "Please log in before creating a post."
      );
      return;
    }

    const trimmedCaption =
      caption.trim();

    if (!trimmedCaption) {
      setError("Please write a caption.");
      return;
    }

    if (trimmedCaption.length > 1000) {
      setError(
        "Caption must be 1000 characters or less."
      );
      return;
    }

    if (!photo) {
      setError("Please select a photo.");
      return;
    }

    try {
      setPosting(true);

      const imageUrl =
        await uploadPhoto(photo);

      await addDoc(
        collection(db, "posts"),
        {
          userId: user.uid,
          authorEmail:
            user.email || "",
          caption: trimmedCaption,
          imageUrl,
          createdAt:
            serverTimestamp(),
        }
      );

      setCaption("");
      setPhoto(null);
      setPhotoPreview("");

      setSuccess(
        "Your post was shared! 🎉"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (postError) {
      console.error(
        "Create post error:",
        postError
      );

      setError(
        postError instanceof Error
          ? postError.message
          : "Unable to create your post."
      );
    } finally {
      setPosting(false);
    }
  };

  /*
   * LIKE / UNLIKE
   */
  const handleLike = async (
    postId: string
  ) => {
    if (!user) return;

    setLikingPostId(postId);

    try {
      const likeRef = doc(
        db,
        "posts",
        postId,
        "likes",
        user.uid
      );

      const currentlyLiked =
        likes[postId]?.liked || false;

      if (currentlyLiked) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, {
          userId: user.uid,
          createdAt:
            serverTimestamp(),
        });

        /*
         * Only send a notification when
         * a new like is created.
         *
         * Unlikes do not create notifications.
         */
        await sendActivityNotification({
          type: "like",
          postId,
        });
      }
    } catch (likeError) {
      console.error(
        "Like error:",
        likeError
      );

      setError(
        "Unable to update your like."
      );
    } finally {
      setLikingPostId(null);
    }
  };

  /*
   * COMMENT INPUT
   */
  const handleCommentChange = (
    postId: string,
    value: string
  ) => {
    setCommentInputs((current) => ({
      ...current,
      [postId]: value,
    }));
  };

  /*
   * ADD COMMENT
   */
  const handleAddComment = async (
    postId: string
  ) => {
    if (!user) return;

    const text = (
      commentInputs[postId] || ""
    ).trim();

    if (!text) return;

    if (text.length > 500) {
      setError(
        "Comment must be 500 characters or less."
      );
      return;
    }

    try {
      setCommentLoadingPostId(postId);

      const commentRef =
        await addDoc(
          collection(
            db,
            "posts",
            postId,
            "comments"
          ),
          {
            userId: user.uid,
            authorEmail:
              user.email || "",
            text,
            createdAt:
              serverTimestamp(),
          }
        );

      setCommentInputs((current) => ({
        ...current,
        [postId]: "",
      }));

      /*
       * Send notification only after
       * the comment was successfully created.
       */
      await sendActivityNotification({
        type: "comment",
        postId,
        commentId: commentRef.id,
      });
    } catch (commentError) {
      console.error(
        "Comment error:",
        commentError
      );

      setError(
        "Unable to add your comment."
      );
    } finally {
      setCommentLoadingPostId(null);
    }
  };

  /*
   * START COMMENT EDIT
   */
  const startEditingComment = (
    comment: CommentItem
  ) => {
    if (!user) return;

    if (comment.userId !== user.uid) {
      return;
    }

    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
    setError("");
  };

  /*
   * CANCEL COMMENT EDIT
   */
  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  /*
   * SAVE COMMENT EDIT
   */
  const handleSaveComment = async (
    postId: string,
    comment: CommentItem
  ) => {
    if (!user) return;

    if (comment.userId !== user.uid) {
      return;
    }

    const text =
      editingCommentText.trim();

    if (!text) {
      setError(
        "Comment cannot be empty."
      );
      return;
    }

    if (text.length > 500) {
      setError(
        "Comment must be 500 characters or less."
      );
      return;
    }

    try {
      setSavingCommentId(comment.id);
      setError("");

      await updateDoc(
        doc(
          db,
          "posts",
          postId,
          "comments",
          comment.id
        ),
        {
          text,
        }
      );

      cancelEditingComment();
    } catch (editError) {
      console.error(
        "Edit comment error:",
        editError
      );

      setError(
        "Unable to edit your comment."
      );
    } finally {
      setSavingCommentId(null);
    }
  };

  /*
   * DELETE COMMENT
   */
  const handleDeleteComment = async (
    postId: string,
    commentId: string
  ) => {
    if (!user) return;

    const postComments =
      comments[postId] || [];

    const comment =
      postComments.find(
        (item) => item.id === commentId
      );

    if (!comment) return;

    if (comment.userId !== user.uid) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this comment?"
      );

    if (!confirmed) return;

    try {
      setDeletingCommentId(
        commentId
      );

      await deleteDoc(
        doc(
          db,
          "posts",
          postId,
          "comments",
          commentId
        )
      );

      if (
        editingCommentId ===
        commentId
      ) {
        cancelEditingComment();
      }
    } catch (deleteError) {
      console.error(
        "Delete comment error:",
        deleteError
      );

      setError(
        "Unable to delete your comment."
      );
    } finally {
      setDeletingCommentId(null);
    }
  };

  /*
   * START POST EDIT
   */
  const startEditingPost = (
    post: Post
  ) => {
    if (!user || post.userId !== user.uid) {
      return;
    }

    setOpenPostMenuId(null);

    setEditingPostId(post.id);
    setEditingCaption(post.caption);
    setEditingPhoto(null);
    setEditingPhotoPreview("");

    setError("");
    setSuccess("");
  };

  /*
   * CANCEL POST EDIT
   */
  const cancelEditingPost = () => {
    setEditingPostId(null);
    setEditingCaption("");
    setEditingPhoto(null);
    setEditingPhotoPreview("");
  };

  /*
   * EDIT PHOTO
   */
  const handleEditingPhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Please choose a JPG, PNG, or WebP image."
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Image must be smaller than 5 MB."
      );
      return;
    }

    setEditingPhoto(file);

    const previewUrl =
      URL.createObjectURL(file);

    setEditingPhotoPreview(
      previewUrl
    );
  };

  /*
   * SAVE POST EDIT
   */
  const handleSaveEdit = async (
    post: Post
  ) => {
    if (!user) return;

    if (post.userId !== user.uid) {
      return;
    }

    const trimmedCaption =
      editingCaption.trim();

    if (!trimmedCaption) {
      setError(
        "Caption cannot be empty."
      );
      return;
    }

    if (trimmedCaption.length > 1000) {
      setError(
        "Caption must be 1000 characters or less."
      );
      return;
    }

    try {
      setSavingEdit(true);
      setError("");
      setSuccess("");

      let imageUrl = post.imageUrl;

      if (editingPhoto) {
        imageUrl =
          await uploadPhoto(
            editingPhoto
          );
      }

      await updateDoc(
        doc(db, "posts", post.id),
        {
          caption: trimmedCaption,
          imageUrl,
        }
      );

      cancelEditingPost();

      setSuccess(
        "Post updated successfully! ✨"
      );
    } catch (editError) {
      console.error(
        "Edit post error:",
        editError
      );

      setError(
        editError instanceof Error
          ? editError.message
          : "Unable to update your post."
      );
    } finally {
      setSavingEdit(false);
    }
  };

  /*
   * DELETE POST
   */
  const handleDeletePost = async (
    post: Post
  ) => {
    if (!user) return;

    if (post.userId !== user.uid) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this post? This cannot be undone."
      );

    if (!confirmed) return;

    try {
      setDeletingPostId(
        post.id
      );

      setOpenPostMenuId(null);
      setError("");

      await deleteDoc(
        doc(
          db,
          "posts",
          post.id
        )
      );

      if (
        editingPostId === post.id
      ) {
        cancelEditingPost();
      }

      setSuccess(
        "Post deleted."
      );
    } catch (deleteError) {
      console.error(
        "Delete post error:",
        deleteError
      );

      setError(
        "Unable to delete your post."
      );
    } finally {
      setDeletingPostId(null);
    }
  };

  /*
   * FORMAT DATE
   */
  const formatDate = (
    timestamp?: Post["createdAt"]
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
   * FORMAT COMMENT DATE
   */
  const formatCommentDate = (
    timestamp?: CommentItem["createdAt"]
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
            🔐
          </div>

          <h1 className="text-3xl font-bold">
            Join the Community
          </h1>

          <p className="mt-3 text-white/60">
            Log in to share photos, moments
            and campus memories with
            everyone.
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
    <main
      className="min-h-screen bg-black text-white"
      onClick={() => {
        if (openPostMenuId) {
          setOpenPostMenuId(null);
        }
      }}
    >
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-15%] top-[-10%] h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[120px]" />

        <div className="absolute right-[-15%] top-[20%] h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-[120px]" />

        <div className="absolute bottom-[-10%] left-[30%] h-[350px] w-[350px] rounded-full bg-pink-500/10 blur-[120px]" />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
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
                Community
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

      <div className="relative mx-auto max-w-3xl px-5 py-10">
        {/* TITLE */}
        <motion.div
          initial={{
            opacity: 0,
            y: 25,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/40">
            Campus Community
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            What's happening? 👀
          </h1>

          <p className="mt-3 text-white/50">
            Share your campus moments with
            the Sreenidhi community.
          </p>
        </motion.div>

        {/* ALERTS */}
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

          {success && (
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
              className="mt-6 rounded-2xl border border-green-400/20 bg-green-400/10 px-4 py-3 text-sm text-green-200"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CREATE POST */}
        <motion.section
          initial={{
            opacity: 0,
            y: 30,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.1,
          }}
          className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl"
        >
          <div className="border-b border-white/10 px-5 py-5">
            <h2 className="text-xl font-bold">
              Create a post
            </h2>

            <p className="mt-1 text-sm text-white/40">
              Show everyone what's happening
              on campus.
            </p>
          </div>

          <div className="p-5">
            {photoPreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/10">
                <img
                  src={photoPreview}
                  alt="Post preview"
                  className="max-h-[500px] w-full object-cover"
                />

                <button
                  onClick={removePhoto}
                  type="button"
                  className="absolute right-3 top-3 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold backdrop-blur-md transition hover:bg-black"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] transition hover:border-white/30 hover:bg-white/[0.04]">
                <div className="text-5xl transition group-hover:scale-110">
                  📸
                </div>

                <div className="mt-4 font-semibold">
                  Add a photo
                </div>

                <div className="mt-1 text-sm text-white/40">
                  JPG, PNG or WebP · Max 5 MB
                </div>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handlePhotoChange
                  }
                  className="hidden"
                />
              </label>
            )}

            <div className="mt-5">
              <textarea
                value={caption}
                onChange={(event) =>
                  setCaption(
                    event.target.value
                  )
                }
                placeholder="Write a caption..."
                maxLength={1000}
                rows={4}
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />

              <div className="mt-2 text-right text-xs text-white/30">
                {caption.length}/1000
              </div>
            </div>

            <button
              onClick={
                handleCreatePost
              }
              disabled={posting}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-bold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? (
                <>
                  <motion.span
                    animate={{
                      rotate: 360,
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="inline-block"
                  >
                    ◌
                  </motion.span>

                  Posting...
                </>
              ) : (
                <>
                  Share Post
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </motion.section>

        {/* FEED */}
        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
                Live Feed
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                Campus moments
              </h2>
            </div>

            <div className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs font-semibold text-green-300">
              ● LIVE
            </div>
          </div>

          {loadingPosts ? (
            <div className="space-y-5">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-[420px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center"
            >
              <div className="text-5xl">
                🌱
              </div>

              <h3 className="mt-5 text-xl font-bold">
                Be the first to post!
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-white/40">
                Share a campus memory, event
                moment, achievement or
                anything you'd like the
                community to see.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {posts.map(
                (post, index) => {
                  const postLikes =
                    likes[post.id] || {
                      count: 0,
                      liked: false,
                    };

                  const postComments =
                    comments[post.id] || [];

                  const isEditing =
                    editingPostId ===
                    post.id;

                  const isDeleting =
                    deletingPostId ===
                    post.id;

                  return (
                    <motion.article
                      key={post.id}
                      initial={{
                        opacity: 0,
                        y: 25,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay: Math.min(
                          index * 0.05,
                          0.3
                        ),
                      }}
                      className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl"
                    >
                      {/* AUTHOR */}
                      <div className="flex items-center gap-3 px-5 py-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-sm font-black">
                          {(
                            post.authorEmail?.[0] ||
                            "U"
                          ).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {
                              post.authorEmail
                            }
                          </div>

                          <div className="text-xs text-white/35">
                            {formatDate(
                              post.createdAt
                            )}
                          </div>
                        </div>

                        {/* THREE DOT MENU */}
                        {user.uid ===
                          post.userId && (
                          <div
                            className="relative"
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                          >
                            <button
                              onClick={() =>
                                setOpenPostMenuId(
                                  openPostMenuId ===
                                    post.id
                                    ? null
                                    : post.id
                                )
                              }
                              disabled={
                                isDeleting
                              }
                              aria-label="Post options"
                              className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                            >
                              ⋮
                            </button>

                            <AnimatePresence>
                              {openPostMenuId ===
                                post.id && (
                                <motion.div
                                  initial={{
                                    opacity: 0,
                                    scale: 0.95,
                                    y: -5,
                                  }}
                                  animate={{
                                    opacity: 1,
                                    scale: 1,
                                    y: 0,
                                  }}
                                  exit={{
                                    opacity: 0,
                                    scale: 0.95,
                                    y: -5,
                                  }}
                                  className="absolute right-0 top-12 z-30 w-40 overflow-hidden rounded-2xl border border-white/10 bg-[#151515] p-1 shadow-2xl"
                                >
                                  <button
                                    onClick={() =>
                                      startEditingPost(
                                        post
                                      )
                                    }
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                                  >
                                    <span>✏️</span>
                                    Edit
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeletePost(
                                        post
                                      )
                                    }
                                    disabled={
                                      isDeleting
                                    }
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-300 transition hover:bg-red-400/10 disabled:opacity-40"
                                  >
                                    <span>🗑️</span>
                                    {isDeleting
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>

                      {/* IMAGE */}
                      {post.imageUrl && (
                        <div className="bg-black">
                          <img
                            src={
                              isEditing &&
                              editingPhotoPreview
                                ? editingPhotoPreview
                                : post.imageUrl
                            }
                            alt={
                              post.caption
                            }
                            className="max-h-[650px] w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* CONTENT */}
                      <div className="px-5 py-5">
                        {isEditing ? (
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                            <div className="mb-3 text-sm font-semibold">
                              Edit your post
                            </div>

                            <textarea
                              value={
                                editingCaption
                              }
                              onChange={(
                                event
                              ) =>
                                setEditingCaption(
                                  event
                                    .target
                                    .value
                                )
                              }
                              maxLength={1000}
                              rows={4}
                              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
                            />

                            <div className="mt-2 text-right text-xs text-white/30">
                              {
                                editingCaption.length
                              }
                              /1000
                            </div>

                            <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/60 transition hover:border-white/30 hover:bg-white/[0.06]">
                              📸 Replace photo

                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={
                                  handleEditingPhotoChange
                                }
                                className="hidden"
                              />
                            </label>

                            {editingPhoto && (
                              <p className="mt-2 text-xs text-white/40">
                                New photo selected.
                              </p>
                            )}

                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() =>
                                  handleSaveEdit(
                                    post
                                  )
                                }
                                disabled={
                                  savingEdit
                                }
                                className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:scale-[1.01] disabled:opacity-50"
                              >
                                {savingEdit
                                  ? "Saving..."
                                  : "Save Changes"}
                              </button>

                              <button
                                onClick={
                                  cancelEditingPost
                                }
                                disabled={
                                  savingEdit
                                }
                                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-[15px] leading-7 text-white/80">
                            {
                              post.caption
                            }
                          </p>
                        )}

                        {/* ACTION BAR */}
                        {!isEditing && (
                          <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4">
                            <button
                              onClick={() =>
                                handleLike(
                                  post.id
                                )
                              }
                              disabled={
                                likingPostId ===
                                post.id
                              }
                              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                                postLikes.liked
                                  ? "bg-pink-500/15 text-pink-300"
                                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              <motion.span
                                animate={
                                  postLikes.liked
                                    ? {
                                        scale: [
                                          1,
                                          1.3,
                                          1,
                                        ],
                                      }
                                    : {
                                        scale: 1,
                                      }
                                }
                                transition={{
                                  duration:
                                    0.25,
                                }}
                              >
                                {postLikes.liked
                                  ? "❤️"
                                  : "🤍"}
                              </motion.span>

                              {postLikes.count}

                              {postLikes.count ===
                              1
                                ? " Like"
                                : " Likes"}
                            </button>

                            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/60">
                              💬{" "}
                              {
                                postComments.length
                              }{" "}
                              {postComments.length ===
                              1
                                ? "Comment"
                                : "Comments"}
                            </div>
                          </div>
                        )}

                        {/* COMMENTS */}
                        {!isEditing && (
                          <div className="mt-5 border-t border-white/10 pt-5">
                            <div className="space-y-3">
                              <AnimatePresence initial={false}>
                                {postComments.map(
                                  (
                                    comment
                                  ) => {
                                    const isEditingComment =
                                      editingCommentId ===
                                      comment.id;

                                    return (
                                      <motion.div
                                        key={
                                          comment.id
                                        }
                                        initial={{
                                          opacity: 0,
                                          y: 8,
                                        }}
                                        animate={{
                                          opacity: 1,
                                          y: 0,
                                        }}
                                        exit={{
                                          opacity: 0,
                                          height: 0,
                                        }}
                                        className="group rounded-2xl bg-white/[0.03] px-4 py-3"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                                            {(
                                              comment.authorEmail?.[0] ||
                                              "U"
                                            ).toUpperCase()}
                                          </div>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="truncate text-xs font-semibold text-white/80">
                                                {comment.authorEmail ||
                                                  "Student"}
                                              </span>

                                              <span className="shrink-0 text-[10px] text-white/25">
                                                {formatCommentDate(
                                                  comment.createdAt
                                                )}
                                              </span>
                                            </div>

                                            {isEditingComment ? (
                                              <div className="mt-2">
                                                <input
                                                  value={
                                                    editingCommentText
                                                  }
                                                  onChange={(
                                                    event
                                                  ) =>
                                                    setEditingCommentText(
                                                      event
                                                        .target
                                                        .value
                                                    )
                                                  }
                                                  maxLength={
                                                    500
                                                  }
                                                  autoFocus
                                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                                                />

                                                <div className="mt-2 flex gap-2">
                                                  <button
                                                    onClick={() =>
                                                      handleSaveComment(
                                                        post.id,
                                                        comment
                                                      )
                                                    }
                                                    disabled={
                                                      savingCommentId ===
                                                      comment.id
                                                    }
                                                    className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
                                                  >
                                                    {savingCommentId ===
                                                    comment.id
                                                      ? "Saving..."
                                                      : "Save"}
                                                  </button>

                                                  <button
                                                    onClick={
                                                      cancelEditingComment
                                                    }
                                                    disabled={
                                                      savingCommentId ===
                                                      comment.id
                                                    }
                                                    className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10 disabled:opacity-50"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-white/60">
                                                {
                                                  comment.text
                                                }
                                              </p>
                                            )}
                                          </div>

                                          {comment.userId ===
                                            user.uid &&
                                            !isEditingComment && (
                                              <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                                                <button
                                                  onClick={() =>
                                                    startEditingComment(
                                                      comment
                                                    )
                                                  }
                                                  className="rounded-lg px-2 py-1 text-xs text-white/30 transition hover:bg-white/10 hover:text-white"
                                                  aria-label="Edit comment"
                                                >
                                                  ✏️
                                                </button>

                                                <button
                                                  onClick={() =>
                                                    handleDeleteComment(
                                                      post.id,
                                                      comment.id
                                                    )
                                                  }
                                                  disabled={
                                                    deletingCommentId ===
                                                    comment.id
                                                  }
                                                  className="rounded-lg px-2 py-1 text-xs text-white/30 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-40"
                                                  aria-label="Delete comment"
                                                >
                                                  {deletingCommentId ===
                                                  comment.id
                                                    ? "..."
                                                    : "🗑️"}
                                                </button>
                                              </div>
                                            )}
                                        </div>
                                      </motion.div>
                                    );
                                  }
                                )}
                              </AnimatePresence>
                            </div>

                            {/* COMMENT INPUT */}
                            <div className="mt-4 flex gap-2">
                              <input
                                value={
                                  commentInputs[
                                    post.id
                                  ] || ""
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleCommentChange(
                                    post.id,
                                    event
                                      .target
                                      .value
                                  )
                                }
                                onKeyDown={(
                                  event
                                ) => {
                                  if (
                                    event.key ===
                                      "Enter" &&
                                    !event.shiftKey
                                  ) {
                                    event.preventDefault();

                                    handleAddComment(
                                      post.id
                                    );
                                  }
                                }}
                                maxLength={500}
                                placeholder="Write a comment..."
                                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
                              />

                              <button
                                onClick={() =>
                                  handleAddComment(
                                    post.id
                                  )
                                }
                                disabled={
                                  commentLoadingPostId ===
                                    post.id ||
                                  !(
                                    commentInputs[
                                      post.id
                                    ] || ""
                                  ).trim()
                                }
                                className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {commentLoadingPostId ===
                                post.id
                                  ? "..."
                                  : "Send"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.article>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}