import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

function getBearerToken(request: NextRequest) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization
    .slice("Bearer ".length)
    .trim();
}

async function getAdminUser(request: NextRequest) {
  const idToken = getBearerToken(request);

  if (!idToken) {
    throw new Error("AUTH_REQUIRED");
  }

  const decodedToken =
    await adminAuth.verifyIdToken(idToken);

  const adminDoc = await adminDb
    .collection("admins")
    .doc(decodedToken.uid)
    .get();

  if (
    !adminDoc.exists ||
    adminDoc.data()?.role !== "admin"
  ) {
    throw new Error("ADMIN_REQUIRED");
  }

  return decodedToken;
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

async function findPassByEntryCode(
  entryCode: string
) {
  const snapshot = await adminDb
    .collection("entryPasses")
    .where("entryCode", "==", entryCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0];
}

export async function GET(request: NextRequest) {
  try {
    await getAdminUser(request);

    const { searchParams } =
      new URL(request.url);

    const entryCode =
      searchParams
        .get("entryCode")
        ?.trim()
        .toUpperCase() || "";

    if (!entryCode) {
      return NextResponse.json(
        {
          error:
            "Entry code is required.",
        },
        { status: 400 }
      );
    }

    if (entryCode.length !== 8) {
      return NextResponse.json(
        {
          error:
            "Entry code must be 8 characters.",
        },
        { status: 400 }
      );
    }

    const passSnapshot =
      await findPassByEntryCode(
        entryCode
      );

    if (!passSnapshot) {
      return NextResponse.json(
        {
          error:
            "Entry code not found.",
        },
        { status: 404 }
      );
    }

    const pass =
      passSnapshot.data() || {};

    const eventId =
      typeof pass.eventId === "string"
        ? pass.eventId
        : "";

    if (!eventId) {
      return NextResponse.json(
        {
          error:
            "This entry pass is missing its event.",
        },
        { status: 500 }
      );
    }

    const eventSnapshot =
      await adminDb
        .collection("events")
        .doc(eventId)
        .get();

    if (!eventSnapshot.exists) {
      return NextResponse.json(
        {
          error:
            "The event associated with this code no longer exists.",
        },
        { status: 404 }
      );
    }

    const event =
      eventSnapshot.data() || {};

    return NextResponse.json({
      success: true,
      pass: {
        passId: passSnapshot.id,

        entryCode:
          typeof pass.entryCode === "string"
            ? pass.entryCode
            : entryCode,

        eventId,

        eventTitle:
          typeof event.title === "string"
            ? event.title
            : "Campus Vibe Event",

        attendeeName:
          typeof pass.attendeeName ===
          "string"
            ? pass.attendeeName
            : "Unknown attendee",

        attendeeEmail:
          typeof pass.attendeeEmail ===
          "string"
            ? pass.attendeeEmail
            : "",

        status:
          pass.status === "used"
            ? "used"
            : "active",

        source:
          pass.source === "poll"
            ? "poll"
            : "registration",

        createdAt:
          timestampToISOString(
            pass.createdAt
          ),

        scannedAt:
          timestampToISOString(
            pass.scannedAt
          ),
      },
    });
  } catch (error) {
    console.error(
      "Failed to inspect entry code:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "ADMIN_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error:
            "Admin access required.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Couldn't inspect the entry code.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    await getAdminUser(request);

    const body = await request.json();

    const entryCode =
      typeof body?.entryCode === "string"
        ? body.entryCode
            .trim()
            .toUpperCase()
        : "";

    if (!entryCode) {
      return NextResponse.json(
        {
          error:
            "Entry code is required.",
        },
        { status: 400 }
      );
    }

    if (entryCode.length !== 8) {
      return NextResponse.json(
        {
          error:
            "Entry code must be 8 characters.",
        },
        { status: 400 }
      );
    }

    const passSnapshot =
      await findPassByEntryCode(
        entryCode
      );

    if (!passSnapshot) {
      return NextResponse.json(
        {
          error:
            "Entry code not found.",
        },
        { status: 404 }
      );
    }

    const passRef =
      passSnapshot.ref;

    const result =
      await adminDb.runTransaction(
        async (transaction) => {
          const currentSnapshot =
            await transaction.get(
              passRef
            );

          if (!currentSnapshot.exists) {
            return {
              type: "not-found" as const,
            };
          }

          const pass =
            currentSnapshot.data() || {};

          const eventId =
            typeof pass.eventId ===
            "string"
              ? pass.eventId
              : "";

          if (!eventId) {
            return {
              type: "invalid" as const,
            };
          }

          const eventRef =
            adminDb
              .collection("events")
              .doc(eventId);

          const eventSnapshot =
            await transaction.get(
              eventRef
            );

          if (!eventSnapshot.exists) {
            return {
              type: "event-not-found" as const,
            };
          }

          const event =
            eventSnapshot.data() || {};

          const attendeeName =
            typeof pass.attendeeName ===
            "string"
              ? pass.attendeeName
              : "Unknown attendee";

          const attendeeEmail =
            typeof pass.attendeeEmail ===
            "string"
              ? pass.attendeeEmail
              : "";

          const eventTitle =
            typeof event.title ===
            "string"
              ? event.title
              : "Campus Vibe Event";

          if (
            pass.status === "used"
          ) {
            return {
              type:
                "already-used" as const,

              eventId,
              eventTitle,
              attendeeName,
              attendeeEmail,

              scannedAt:
                timestampToISOString(
                  pass.scannedAt
                ),
            };
          }

          transaction.update(
            passRef,
            {
              status: "used",

              scannedAt:
                FieldValue.serverTimestamp(),
            }
          );

          return {
            type: "marked" as const,

            eventId,
            eventTitle,
            attendeeName,
            attendeeEmail,
          };
        }
      );

    if (
      result.type ===
      "not-found"
    ) {
      return NextResponse.json(
        {
          error:
            "Entry code not found.",
        },
        { status: 404 }
      );
    }

    if (
      result.type === "invalid"
    ) {
      return NextResponse.json(
        {
          error:
            "This entry code is invalid.",
        },
        { status: 500 }
      );
    }

    if (
      result.type ===
      "event-not-found"
    ) {
      return NextResponse.json(
        {
          error:
            "The event associated with this code no longer exists.",
        },
        { status: 404 }
      );
    }

    if (
      result.type ===
      "already-used"
    ) {
      return NextResponse.json({
        success: true,
        alreadyUsed: true,

        pass: {
          passId:
            passSnapshot.id,

          entryCode,

          eventId:
            result.eventId,

          eventTitle:
            result.eventTitle,

          attendeeName:
            result.attendeeName,

          attendeeEmail:
            result.attendeeEmail,

          status: "used",

          scannedAt:
            result.scannedAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      alreadyUsed: false,

      pass: {
        passId:
          passSnapshot.id,

        entryCode,

        eventId:
          result.eventId,

        eventTitle:
          result.eventTitle,

        attendeeName:
          result.attendeeName,

        attendeeEmail:
          result.attendeeEmail,

        status: "used",

        scannedAt: null,
      },
    });
  } catch (error) {
    console.error(
      "Failed to mark entry:",
      error
    );

    if (
      error instanceof Error &&
      error.message ===
        "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "ADMIN_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error:
            "Admin access required.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Couldn't process the entry code.",
      },
      { status: 500 }
    );
  }
}