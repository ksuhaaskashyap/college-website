import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";

type NotificationRequest = {
  type?: "like" | "comment";
  postId?: string;
  commentId?: string;
};

export async function POST(
  request: Request
) {
  try {
    /*
     * ----------------------------------------------------------
     * VERIFY AUTHENTICATION
     * ----------------------------------------------------------
     */

    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const idToken =
      authorization.substring(7);

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );

    const actorId =
      decodedToken.uid;

    /*
     * ----------------------------------------------------------
     * READ REQUEST
     * ----------------------------------------------------------
     */

    const body =
      (await request.json()) as NotificationRequest;

    const type = body.type;
    const postId = body.postId;
    const commentId = body.commentId;

    if (
      type !== "like" &&
      type !== "comment"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid notification type.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !postId ||
      typeof postId !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "A valid postId is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * GET POST
     * ----------------------------------------------------------
     */

    const postRef = adminDb
      .collection("posts")
      .doc(postId);

    const postSnapshot =
      await postRef.get();

    if (!postSnapshot.exists) {
      return NextResponse.json(
        {
          error: "Post not found.",
        },
        {
          status: 404,
        }
      );
    }

    const postData =
      postSnapshot.data();

    const recipientId =
      postData?.userId;

    if (
      !recipientId ||
      typeof recipientId !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Post owner could not be determined.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * NEVER NOTIFY YOURSELF
     * ----------------------------------------------------------
     */

    if (recipientId === actorId) {
      return NextResponse.json({
        success: true,
        skipped: true,
      });
    }

    /*
     * ----------------------------------------------------------
     * LIKE NOTIFICATION
     * ----------------------------------------------------------
     */

    if (type === "like") {
      const likeRef = postRef
        .collection("likes")
        .doc(actorId);

      const likeSnapshot =
        await likeRef.get();

      if (!likeSnapshot.exists) {
        return NextResponse.json(
          {
            error:
              "Like does not exist.",
          },
          {
            status: 400,
          }
        );
      }

      const likeData =
        likeSnapshot.data();

      if (
        likeData?.userId !== actorId
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid like.",
          },
          {
            status: 403,
          }
        );
      }

      /*
       * One notification per
       * user/post like.
       */

      const notificationId =
        `like_${postId}_${actorId}`;

      await adminDb
        .collection("notifications")
        .doc(notificationId)
        .set({
          recipientId,
          actorId,
          type: "like",

          title: "Someone liked your post ❤️",

          message:
            "Someone liked your campus post.",

          postId,

          published: false,
          read: false,

          createdAt:
            FieldValue.serverTimestamp(),
        });

      return NextResponse.json({
        success: true,
      });
    }

    /*
     * ----------------------------------------------------------
     * COMMENT NOTIFICATION
     * ----------------------------------------------------------
     */

    if (!commentId) {
      return NextResponse.json(
        {
          error:
            "commentId is required.",
        },
        {
          status: 400,
        }
      );
    }

    const commentRef =
      postRef
        .collection("comments")
        .doc(commentId);

    const commentSnapshot =
      await commentRef.get();

    if (!commentSnapshot.exists) {
      return NextResponse.json(
        {
          error:
            "Comment not found.",
        },
        {
          status: 404,
        }
      );
    }

    const commentData =
      commentSnapshot.data();

    if (
      commentData?.userId !== actorId
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid comment.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * One notification per comment.
     */

    const notificationId =
      `comment_${commentId}`;

    await adminDb
      .collection("notifications")
      .doc(notificationId)
      .set({
        recipientId,
        actorId,
        type: "comment",

        title:
          "Someone commented on your post 💬",

        message:
          "Someone commented on your campus post.",

        postId,
        commentId,

        published: false,
        read: false,

        createdAt:
          FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Notification API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create notification.",
      },
      {
        status: 500,
      }
    );
  }
}