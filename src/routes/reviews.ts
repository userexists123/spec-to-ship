import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { emptyResponse, jsonResponse } from "../services/http";
import {
  createReviewFromSelectedPr,
  getExistingReview,
  postReviewComment,
  previewReviewComment
} from "../services/prReviewService";

export async function createReviewRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const review = await createReviewFromSelectedPr();

    return jsonResponse(201, {
      ok: true,
      review
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown review creation error.";
    context.log(`Create review route failed: ${message}`);
    return jsonResponse(400, { ok: false, error: message });
  }
}

export async function getReviewRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const reviewId = request.params.id;

    if (!reviewId) {
      return jsonResponse(400, { ok: false, error: "Review id is required." });
    }

    const review = await getExistingReview(reviewId);

    return jsonResponse(200, {
      ok: true,
      review
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown review loading error.";
    context.log(`Get review route failed: ${message}`);
    return jsonResponse(404, { ok: false, error: message });
  }
}

export async function previewReviewCommentRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const reviewId = request.params.id;

    if (!reviewId) {
      return jsonResponse(400, { ok: false, error: "Review id is required." });
    }

    const review = await previewReviewComment(reviewId);

    return jsonResponse(200, {
      ok: true,
      review
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown comment preview error.";
    context.log(`Preview review comment route failed: ${message}`);
    return jsonResponse(400, { ok: false, error: message });
  }
}

export async function postReviewCommentRoute(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const reviewId = request.params.id;

    if (!reviewId) {
      return jsonResponse(400, { ok: false, error: "Review id is required." });
    }

    const review = await postReviewComment(reviewId);

    return jsonResponse(200, {
      ok: true,
      review
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown comment posting error.";
    context.log(`Post review comment route failed: ${message}`);
    return jsonResponse(400, { ok: false, error: message });
  }
}

app.http("createReview", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "reviews",
  handler: createReviewRoute
});

app.http("getReview", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reviews/{id}",
  handler: getReviewRoute
});

app.http("previewReviewComment", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "reviews/{id}/comment-preview",
  handler: previewReviewCommentRoute
});

app.http("postReviewComment", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "reviews/{id}/comment-post",
  handler: postReviewCommentRoute
});