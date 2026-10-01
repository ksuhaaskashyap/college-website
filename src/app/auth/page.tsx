"use client";

import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      } else {
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
      }

      // Send the user directly back to Campus Vibe
      router.push("/");

    } catch (error: any) {
      console.error(error);

      if (error.code === "auth/invalid-credential") {
        setError(
          "Incorrect email or password."
        );
      } else if (
        error.code === "auth/email-already-in-use"
      ) {
        setError(
          "An account with this email already exists."
        );
      } else if (
        error.code === "auth/weak-password"
      ) {
        setError(
          "Password should be at least 6 characters."
        );
      } else if (
        error.code === "auth/invalid-email"
      ) {
        setError(
          "Please enter a valid email address."
        );
      } else {
        setError(
          "Something went wrong. Please try again."
        );
      }

      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08080d] px-6 text-white">

      <div className="w-full max-w-md">

        {/* BRAND */}

        <div className="mb-10 text-center">

          <p className="text-xs font-black tracking-[0.3em] text-fuchsia-400">
            SREENIDHI
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-tight">
            Campus Vibe
          </h1>

          <p className="mt-3 text-white/40">
            Join the campus. Find your vibe.
          </p>

        </div>


        {/* CARD */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">

          {/* TABS */}

          <div className="mb-8 grid grid-cols-2 rounded-xl bg-black/30 p-1">

            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`rounded-lg py-3 text-sm font-bold transition ${
                mode === "login"
                  ? "bg-white text-black"
                  : "text-white/40 hover:text-white"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              className={`rounded-lg py-3 text-sm font-bold transition ${
                mode === "signup"
                  ? "bg-white text-black"
                  : "text-white/40 hover:text-white"
              }`}
            >
              Create Account
            </button>

          </div>


          <h2 className="text-2xl font-black">
            {mode === "login"
              ? "Welcome back 👋"
              : "Join Campus Vibe 🚀"}
          </h2>

          <p className="mt-2 text-sm text-white/40">
            {mode === "login"
              ? "Sign in to continue."
              : "Create your account and start exploring."}
          </p>


          {/* FORM */}

          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-5"
          >

            <div>

              <label className="text-sm font-bold text-white/70">
                Email
              </label>

              <input
                required
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-fuchsia-400"
              />

            </div>


            <div>

              <label className="text-sm font-bold text-white/70">
                Password
              </label>

              <input
                required
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="••••••••"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-fuchsia-400"
              />

            </div>


            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}


            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-fuchsia-500 py-4 font-black text-white transition hover:scale-[1.01] disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Login →"
                  : "Create Account →"}
            </button>

          </form>


          <button
            onClick={() => router.push("/")}
            className="mt-5 w-full text-center text-sm text-white/30 transition hover:text-white"
          >
            ← Back to Campus
          </button>

        </div>


        <p className="mt-6 text-center text-xs text-white/20">
          Sreenidhi University · Campus Vibe
        </p>

      </div>

    </main>
  );
}