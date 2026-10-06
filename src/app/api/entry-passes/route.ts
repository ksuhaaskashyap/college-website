import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

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

function getString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function generateUniqueEntryCode(
  adminDb: any
) {
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

export async function POST(
  request: NextRequest
) {
  let step = "starting";

  try {
    // --------------------------------------------------
    // LOAD FIREBASE ADMIN INSIDE THE REQUEST
    // --------------------------------------------------

    step = "loading Firebase Admin";

    let adminAuth: any;
    let adminDb: any;

    try {
      const firebaseAdmin =
        await import("@/lib/firebaseAdmin");

      adminAuth = firebaseAdmin.adminAuth;
      adminDb = firebaseAdmin.adminDb;
    } catch (error) {
      console.error(
        "Firebase Admin initialization failed:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Firebase Admin initialization failed.",
          step,
          details: getErrorMessage(error),
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

    step = "reading authentication token";

    const idToken =
      getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
          step,
        },
        { status: 401 }
      );
    }

    step = "verifying Firebase ID token";

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );

    const userId =
      decodedToken.uid;

    // --------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------

    step = "reading request body";

    const body =
      await request.json();

    const eventId =
      getString(body?.eventId);

    const source: PassSource | "" =
      body?.source === "registration" ||
      body?.source === "poll"
        ? body.source
        : "";

    if (!eventId) {
      return NextResponse.json(
        {
          error:
            "Event ID is required.",
          step,
        },
        { status: 400 }
      );
    }

    if (!source) {
      return NextResponse.json(
        {
          error:
            "A valid pass source is required.",
          step,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // LOAD EVENT
    // --------------------------------------------------

    step = "loading event";

    const eventRef = adminDb
      .collection("events")
      .doc(eventId);

    const eventSnapshot =
      await eventRef.get();

    if (!eventSnapshot.exists) {
      return NextResponse.json(
        {
          error:
            "Event not found.",
          step,
        },
        { status: 404 }
      );
    }

    const event =
      eventSnapshot.data() || {};

    // --------------------------------------------------
    // CHECK ENTRY CODE ENABLED
    // --------------------------------------------------

    step =
      "checking entry code setting";

    const entryCodeEnabled =
      event.entryCodeEnabled === true ||
      event.qrEntryEnabled === true;

    if (!entryCodeEnabled) {
      return NextResponse.json(
        {
          error:
            "Entry codes are not enabled for this event.",
          step,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // VERIFY REGISTRATION / POLL
    // --------------------------------------------------

    const registrationId =
      `${eventId}_${userId}`;

    let registrationData:
      | Record<string, unknown>
      | null = null;

    let pollData:
      | Record<string, unknown>
      | null = null;

    if (source === "registration") {
      step =
        "checking registration";

      if (
        event.interactionType !==
        "registration"
      ) {
        return NextResponse.json(
          {
            error:
              "This event does not use registration.",
            step,
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
            step,
          },
          { status: 403 }
        );
      }

      const loadedRegistrationData =
  registrationSnapshot.data() || {};

registrationData =
  loadedRegistrationData;

if (
  loadedRegistrationData.userId !==
  userId
) {
        return NextResponse.json(
          {
            error:
              "This registration does not belong to you.",
            step,
          },
          { status: 403 }
        );
      }
    }

    if (source === "poll") {
      step =
        "checking poll response";

      if (
        event.interactionType !==
        "poll"
      ) {
        return NextResponse.json(
          {
            error:
              "This event does not use a poll.",
            step,
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
            step,
          },
          { status: 403 }
        );
      }

      const loadedPollData =
  voteSnapshot.data() || {};

pollData =
  loadedPollData;

const qrPassOption =
  getString(
    event.qrPassOption
  );

if (
  qrPassOption &&
  loadedPollData.option !==
    qrPassOption
) {
        return NextResponse.json(
          {
            error:
              "Your poll response does not qualify for an entry code.",
            step,
          },
          { status: 403 }
        );
      }
    }

    // --------------------------------------------------
    // PASS
    // --------------------------------------------------

    step =
      "loading existing entry pass";

    const passId =
      `${eventId}_${userId}`;

    const passRef = adminDb
      .collection("entryPasses")
      .doc(passId);

    const existingPass =
      await passRef.get();

    if (existingPass.exists) {
      step =
        "checking existing entry code";

      const existingData =
        existingPass.data() || {};

      let entryCode =
        getString(
          existingData.entryCode
        );

      if (!entryCode) {
        step =
          "generating missing entry code";

        entryCode =
          await generateUniqueEntryCode(
            adminDb
          );

        await passRef.update({
          entryCode,
        });
      }

      return NextResponse.json({
        success: true,
        existing: true,
        passId,
        entryCode,
      });
    }

    // --------------------------------------------------
    // LOAD USER
    // --------------------------------------------------

    step =
      "loading Firebase user";

    const firebaseUser =
      await adminAuth.getUser(
        userId
      );

    const nameFromAuth =
      firebaseUser.displayName?.trim() ||
      "";

    const emailFromAuth =
      firebaseUser.email?.trim() ||
      "";

    const nameFromRegistration =
      getString(
        registrationData?.fullName
      );

    const emailFromRegistration =
      getString(
        registrationData?.email
      );

    const attendeeName =
      nameFromRegistration ||
      nameFromAuth ||
      emailFromRegistration ||
      emailFromAuth ||
      "Campus Vibe attendee";

    const attendeeEmail =
      emailFromRegistration ||
      emailFromAuth;

    // --------------------------------------------------
    // GENERATE CODE
    // --------------------------------------------------

    step =
      "generating unique entry code";

    const entryCode =
      await generateUniqueEntryCode(
        adminDb
      );

    // --------------------------------------------------
    // CREATE PASS
    // --------------------------------------------------

    step =
      "creating entry pass";

    await passRef.create({
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

      createdAt: new Date(),

      scannedAt: null,
    });

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      existing: false,
      passId,
      entryCode,
    });
  } catch (error) {
    console.error(
      "ENTRY PASS ERROR:",
      {
        step,
        error,
      }
    );

    return NextResponse.json(
      {
        error:
          "Entry code generation failed.",
        step,
        details:
          getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}