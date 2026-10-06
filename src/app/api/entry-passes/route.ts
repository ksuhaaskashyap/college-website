import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

type PassSource = "registration" | "poll";

const ENTRY_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getBearerToken(request: NextRequest) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function generateEntryCode() {
  return Array.from({ length: 8 }, () =>
    ENTRY_CODE_ALPHABET[
      crypto.randomInt(
        0,
        ENTRY_CODE_ALPHABET.length
      )
    ]
  ).join("");
}

async function generateUniqueEntryCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateEntryCode();

    const existing = await adminDb
      .collection("entryPasses")
      .where("entryCode", "==", code)
      .limit(1)
      .get();

    if (existing.empty) {
      return code;
    }
  }

  throw new Error(
    "Couldn't generate a unique entry code."
  );
}

function timestampToISOString(value: any) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    const userId = decodedToken.uid;

    const body = await request.json();

    const eventId =
      typeof body?.eventId === "string"
        ? body.eventId.trim()
        : "";

    const source: PassSource | "" =
      body?.source === "registration" ||
      body?.source === "poll"
        ? body.source
        : "";

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required." },
        { status: 400 }
      );
    }

    if (!source) {
      return NextResponse.json(
        { error: "A valid pass source is required." },
        { status: 400 }
      );
    }

    const eventRef = adminDb
      .collection("events")
      .doc(eventId);

    const eventSnapshot = await eventRef.get();

    if (!eventSnapshot.exists) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const event = eventSnapshot.data() || {};

    const entryCodeEnabled =
      event.entryCodeEnabled === true ||
      event.qrEntryEnabled === true;

    if (!entryCodeEnabled) {
      return NextResponse.json(
        {
          error:
            "Entry codes are not enabled for this event.",
        },
        { status: 400 }
      );
    }

    const registrationId =
      `${eventId}_${userId}`;

    let registrationData:
      | Record<string, unknown>
      | null = null;

    let pollData:
      | Record<string, unknown>
      | null = null;

    if (source === "registration") {
      if (
        event.interactionType !==
        "registration"
      ) {
        return NextResponse.json(
          {
            error:
              "This event does not use registration.",
          },
          { status: 400 }
        );
      }

      const registrationSnapshot =
        await adminDb
          .collection("registrations")
          .doc(registrationId)
          .get();

      if (!registrationSnapshot.exists) {
        return NextResponse.json(
          {
            error:
              "You must register for this event first.",
          },
          { status: 403 }
        );
      }

      registrationData =
        registrationSnapshot.data() || {};

      if (
        registrationData.userId !== userId
      ) {
        return NextResponse.json(
          {
            error:
              "This registration does not belong to you.",
          },
          { status: 403 }
        );
      }
    }

    if (source === "poll") {
      if (
        event.interactionType !== "poll"
      ) {
        return NextResponse.json(
          {
            error:
              "This event does not use a poll.",
          },
          { status: 400 }
        );
      }

      const voteId =
        `${eventId}_${userId}`;

      const voteSnapshot =
        await adminDb
          .collection("pollVotes")
          .doc(voteId)
          .get();

      if (!voteSnapshot.exists) {
        return NextResponse.json(
          {
            error:
              "You must submit the poll response first.",
          },
          { status: 403 }
        );
      }

      pollData =
        voteSnapshot.data() || {};

      const qrPassOption =
        typeof event.qrPassOption === "string"
          ? event.qrPassOption.trim()
          : "";

      if (
        qrPassOption &&
        pollData.option !== qrPassOption
      ) {
        return NextResponse.json(
          {
            error:
              "Your poll response does not qualify for an entry code.",
          },
          { status: 403 }
        );
      }
    }

    const existingPasses =
      await adminDb
        .collection("entryPasses")
        .where("eventId", "==", eventId)
        .where("userId", "==", userId)
        .limit(1)
        .get();

    if (!existingPasses.empty) {
      const existingPass =
        existingPasses.docs[0];

      const existingData =
        existingPass.data();

      let entryCode =
        typeof existingData.entryCode ===
        "string"
          ? existingData.entryCode
          : "";

      if (!entryCode) {
        entryCode =
          await generateUniqueEntryCode();

        await existingPass.ref.update({
          entryCode,
        });
      }

      return NextResponse.json({
        success: true,
        existing: true,
        passId: existingPass.id,
        entryCode,
      });
    }

    const firebaseUser =
      await adminAuth.getUser(userId);

    const nameFromAuth =
      firebaseUser.displayName?.trim() || "";

    const emailFromAuth =
      firebaseUser.email?.trim() || "";

    const nameFromRegistration =
      typeof registrationData?.fullName ===
      "string"
        ? registrationData.fullName.trim()
        : "";

    const emailFromRegistration =
      typeof registrationData?.email ===
      "string"
        ? registrationData.email.trim()
        : "";

    const attendeeName =
      nameFromAuth ||
      nameFromRegistration ||
      emailFromAuth ||
      "Campus Vibe attendee";

    const attendeeEmail =
      emailFromAuth ||
      emailFromRegistration;

    const entryCode =
      await generateUniqueEntryCode();

    const passId =
      crypto.randomBytes(32).toString("hex");

    const passRef = adminDb
      .collection("entryPasses")
      .doc(passId);

    await passRef.set({
      eventId,
      userId,
      registrationId:
        source === "registration"
          ? registrationId
          : null,
      source,

      entryCode,

      status: "active",

      attendeeName,
      attendeeEmail,

      createdAt:
        FieldValue.serverTimestamp(),

      scannedAt: null,
    });

    return NextResponse.json({
      success: true,
      existing: false,
      passId,
      entryCode,
    });
  } catch (error) {
    console.error(
      "Failed to create entry pass:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Couldn't create the entry code.",
      },
      { status: 500 }
    );
  }
}