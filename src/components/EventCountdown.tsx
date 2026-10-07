"use client";

import { useEffect, useState } from "react";

type EventCountdownProps = {
  date?: string;
  time?: string;
  compact?: boolean;
};

type RemainingTime = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
};

function getEventTimestamp(
  date?: string,
  time?: string
) {
  if (!date || !time) {
    return null;
  }

  const cleanTime =
    time.length === 5
      ? `${time}:00`
      : time;

  const timestamp = Date.parse(
    `${date}T${cleanTime}+05:30`
  );

  return Number.isNaN(timestamp)
    ? null
    : timestamp;
}

function calculateRemaining(
  targetTimestamp: number
): RemainingTime {
  const total = Math.max(
    0,
    targetTimestamp - Date.now()
  );

  const totalSeconds = Math.floor(
    total / 1000
  );

  const days = Math.floor(
    totalSeconds / 86400
  );

  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds =
    totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    total,
  };
}

function pad(value: number) {
  return value
    .toString()
    .padStart(2, "0");
}

export default function EventCountdown({
  date,
  time,
  compact = false,
}: EventCountdownProps) {
  const [remaining, setRemaining] =
    useState<RemainingTime | null>(null);

  useEffect(() => {
    const targetTimestamp =
      getEventTimestamp(date, time);

    if (!targetTimestamp) {
      setRemaining(null);
      return;
    }

    const update = () => {
      setRemaining(
        calculateRemaining(
          targetTimestamp
        )
      );
    };

    update();

    const interval = window.setInterval(
      update,
      1000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [date, time]);

  if (!remaining) {
    return null;
  }

  if (remaining.total <= 0) {
    return (
      <div
        className={
          compact
            ? "inline-flex items-center rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-[10px] font-black tracking-[0.15em] text-green-300"
            : "rounded-2xl border border-green-400/20 bg-green-400/[0.08] p-5"
        }
      >
        <span>
          ⚡ EVENT IS LIVE
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="mt-4 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-400">
          Starts in
        </p>

        <div className="mt-2 flex items-baseline gap-1 font-mono text-xl font-black tracking-tight">
          <span>
            {remaining.days}d
          </span>

          <span className="text-white/30">
            :
          </span>

          <span>
            {pad(remaining.hours)}h
          </span>

          <span className="text-white/30">
            :
          </span>

          <span>
            {pad(remaining.minutes)}m
          </span>

          <span className="text-white/30">
            :
          </span>

          <span className="text-fuchsia-300">
            {pad(remaining.seconds)}s
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/[0.09] via-purple-500/[0.05] to-cyan-500/[0.06] p-6 md:p-8">
      <p className="text-xs font-black tracking-[0.3em] text-fuchsia-400">
        COUNTDOWN
      </p>

      <h2 className="mt-2 text-xl font-black">
        Event starts in
      </h2>

      <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center sm:p-4">
          <p className="font-mono text-2xl font-black sm:text-4xl">
            {remaining.days}
          </p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-white/30">
            Days
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center sm:p-4">
          <p className="font-mono text-2xl font-black sm:text-4xl">
            {pad(remaining.hours)}
          </p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-white/30">
            Hours
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center sm:p-4">
          <p className="font-mono text-2xl font-black sm:text-4xl">
            {pad(remaining.minutes)}
          </p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-white/30">
            Minutes
          </p>
        </div>

        <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3 text-center sm:p-4">
          <p className="font-mono text-2xl font-black text-fuchsia-300 sm:text-4xl">
            {pad(remaining.seconds)}
          </p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-fuchsia-300/60">
            Seconds
          </p>
        </div>
      </div>
    </div>
  );
}