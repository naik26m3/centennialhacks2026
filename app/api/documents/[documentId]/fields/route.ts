import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import {
  findDocumentFields,
  findOwnedDocument,
  mapDocumentFields,
  parseFieldReviewInput,
  parseDocumentId,
  updateDocumentField,
  FieldReviewInputError,
} from "@/lib/documents";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number, requestId: string, retryable = false): Response {
  return Response.json({
    data: null,
    error: { code, message, retryable },
    requestId,
  }, { status });
}
export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const user = await requireUser(requestId);
    if (user instanceof Response) return user;
    const { documentId: rawDocumentId } = await context.params;
    let documentId: string;
    try {
      documentId = parseDocumentId(rawDocumentId);
    } catch {
      return errorResponse("invalid_request", "Document id must be a valid UUID.", 400, requestId);
    }
    const document = await findOwnedDocument(documentId, user.userId);
    if (!document) return errorResponse("document_not_found", "Document not found.", 404, requestId);
    return Response.json({
      data: {
        documentId: document.id,
        status: document.status,
        fields: mapDocumentFields(await findDocumentFields(document.id)),
      },
      error: null,
      requestId,
    });
  } catch {
    return errorResponse("documents_unavailable", "Document fields are temporarily unavailable.", 503, requestId, true);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const user = await requireUser(requestId);
    if (user instanceof Response) return user;
    const { documentId: rawDocumentId } = await context.params;
    let documentId: string;
    try {
      documentId = parseDocumentId(rawDocumentId);
    } catch {
      return errorResponse("invalid_request", "Document id must be a valid UUID.", 400, requestId);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Request body must be valid JSON.", 400, requestId);
    }
    const input = parseFieldReviewInput(body);
    const document = await findOwnedDocument(documentId, user.userId);
    if (!document) return errorResponse("document_not_found", "Document not found.", 404, requestId);
    const field = await updateDocumentField(document.id, user.userId, input);
    if (!field) return errorResponse("field_not_found", "Document field not found.", 404, requestId);
    return Response.json({
      data: { documentId: document.id, field: mapDocumentFields([field])[0] },
      error: null,
      requestId,
    });
  } catch (error) {
    if (error instanceof FieldReviewInputError) {
      return errorResponse("invalid_request", error.message, 400, requestId);
    }
    return errorResponse("documents_unavailable", "Document fields are temporarily unavailable.", 503, requestId, true);
  }
}
