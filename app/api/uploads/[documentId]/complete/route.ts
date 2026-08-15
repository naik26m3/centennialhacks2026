import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import {
  findOwnedDocument,
  parseDocumentId,
  type DocumentRow,
  type DocumentStatus,
} from "@/lib/documents";
import { usesVercelOidc } from "@/lib/uploads";

export const runtime = "nodejs";

type HeadObjectResult = {
  ContentLength?: number;
  ContentType?: string;
  ChecksumSHA256?: string;
};

class CompleteUploadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function errorResponse(error: CompleteUploadError, requestId: string): Response {
  return Response.json({
    data: null,
    error: { code: error.code, message: error.message, retryable: error.retryable },
    requestId,
  }, { status: error.status });
}

function bucket(): string {
  const value = process.env.AWS_S3_BUCKET?.trim();
  if (!value) {
    throw new CompleteUploadError(
      "uploads_unavailable",
      "Uploads are temporarily unavailable.",
      503,
      true,
    );
  }
  return value;
}

function s3Client(): S3Client {
  const region = process.env.AWS_REGION?.trim() || "ca-central-1";
  const roleArn = process.env.AWS_ROLE_ARN?.trim();
  return new S3Client({
    region,
    ...(usesVercelOidc() && roleArn
      ? { credentials: awsCredentialsProvider({ roleArn, clientConfig: { region } }) }
      : {}),
  });
}

export function isCompletionIdempotentStatus(status: DocumentStatus): boolean {
  return status === "uploaded" || status === "extracting" || status === "extracted" || status === "needs_review";
}

export function verifyHeadObject(document: Pick<DocumentRow, "byte_size" | "content_type" | "sha256">, head: HeadObjectResult): void {
  const expectedSize = typeof document.byte_size === "string" ? Number(document.byte_size) : document.byte_size;
  if (head.ContentLength !== expectedSize || head.ContentType !== document.content_type) {
    throw new CompleteUploadError(
      "upload_verification_failed",
      "Uploaded file metadata does not match the requested document.",
      409,
      false,
    );
  }

  const expectedSha256 = document.sha256.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) ||
      head.ChecksumSHA256 !== Buffer.from(expectedSha256, "hex").toString("base64")) {
    throw new CompleteUploadError(
      "upload_verification_failed",
      "Uploaded file verification failed.",
      409,
      false,
    );
  }
}

function responseData(document: Pick<DocumentRow, "id" | "status">) {
  return { documentId: document.id, status: document.status };
}

async function markUploaded(document: DocumentRow, userId: string): Promise<DocumentStatus | null> {
  const rows = await getDatabase()<Pick<DocumentRow, "id" | "status">[]>`
    UPDATE documents d
    SET status = 'uploaded', uploaded_at = COALESCE(uploaded_at, now()), updated_at = now()
    FROM cases c
    WHERE d.id = ${document.id}
      AND d.case_id = c.id
      AND c.clerk_user_id = ${userId}
      AND c.deleted_at IS NULL
      AND d.status = 'upload_ready'
    RETURNING d.id, d.status
  `;
  return rows[0]?.status ?? null;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const user = await requireUser(requestId);
    if (user instanceof Response) return user;

    let documentId: string;
    try {
      documentId = parseDocumentId((await context.params).documentId);
    } catch {
      throw new CompleteUploadError("invalid_request", "Document id must be a valid UUID.", 400, false);
    }

    const document = await findOwnedDocument(documentId, user.userId);
    if (!document) {
      throw new CompleteUploadError("document_not_found", "Document not found.", 404, false);
    }
    if (isCompletionIdempotentStatus(document.status)) {
      return Response.json({ data: responseData(document), error: null, requestId });
    }
    if (document.status !== "upload_ready") {
      throw new CompleteUploadError(
        "upload_not_ready",
        "The document upload cannot be completed.",
        409,
        false,
      );
    }

    const head = await s3Client().send(new HeadObjectCommand({
      Bucket: bucket(),
      Key: document.object_key,
      ChecksumMode: "ENABLED",
    }));
    verifyHeadObject(document, head);

    const status = await markUploaded(document, user.userId);
    if (status) {
      return Response.json({
        data: responseData({ id: document.id, status }),
        error: null,
        requestId,
      });
    }

    const current = await findOwnedDocument(document.id, user.userId);
    if (!current) throw new CompleteUploadError("document_not_found", "Document not found.", 404, false);
    if (isCompletionIdempotentStatus(current.status)) {
      return Response.json({ data: responseData(current), error: null, requestId });
    }
    throw new CompleteUploadError("upload_not_ready", "The document upload cannot be completed.", 409, false);
  } catch (error) {
    if (error instanceof CompleteUploadError) return errorResponse(error, requestId);
    return errorResponse(
      new CompleteUploadError("upload_verification_failed", "Uploaded file verification failed.", 409, false),
      requestId,
    );
  }
}
