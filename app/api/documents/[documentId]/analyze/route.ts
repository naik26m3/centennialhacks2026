import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import {
  buildExtractedFields,
  DocumentInputError,
  documentNeedsReview,
  findDocumentFields,
  findOwnedDocument,
  mapDocumentFields,
  parseDocumentId,
  readObjectBody,
  verifyObjectBytes,
  type DocumentRow,
  type DocumentStatus,
} from "@/lib/documents";
import { analyzeBillDocument, type CanonicalBillOcr } from "@/lib/ocr";

export const runtime = "nodejs";

class DocumentRouteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function jsonError(error: DocumentRouteError, requestId: string): Response {
  return Response.json({
    data: null,
    error: { code: error.code, message: error.message, retryable: error.retryable },
    requestId,
  }, { status: error.status });
}

function bucket(): string {
  const value = process.env.AWS_S3_BUCKET?.trim();
  if (!value) throw new DocumentRouteError("documents_unavailable", "Document analysis is temporarily unavailable.", 503, true);
  return value;
}

function s3Client(): S3Client {
  const region = process.env.AWS_REGION?.trim() || "ca-central-1";
  const roleArn = process.env.AWS_ROLE_ARN?.trim();
  return new S3Client({
    region,
    ...(process.env.VERCEL === "1" && roleArn
      ? { credentials: awsCredentialsProvider({ roleArn, clientConfig: { region } }) }
      : {}),
  });
}

function responseData(document: DocumentRow, rows: Awaited<ReturnType<typeof findDocumentFields>>) {
  return {
    documentId: document.id,
    status: document.status,
    fields: mapDocumentFields(rows),
  };
}

async function markFailed(documentId: string, userId: string): Promise<void> {
  const sql = getDatabase();
  await sql`
    UPDATE documents d SET status = 'failed', updated_at = now()
    FROM cases c
    WHERE d.id = ${documentId} AND d.case_id = c.id AND c.clerk_user_id = ${userId}
      AND d.status = 'extracting'
  `;
}

async function persistExtraction(
  document: DocumentRow,
  userId: string,
  ocr: CanonicalBillOcr,
): Promise<DocumentStatus> {
  const fields = buildExtractedFields(ocr);
  const status: DocumentStatus = documentNeedsReview(fields) ? "needs_review" : "extracted";
  const sql = getDatabase();

  await sql.begin(async (transaction) => {
    await transaction`
      DELETE FROM extracted_fields
      WHERE document_id = ${document.id} AND case_id = ${document.case_id}
    `;
    for (const field of fields) {
      await transaction`
        INSERT INTO extracted_fields
          (case_id, document_id, field_name, value, confidence, page_number, bounding_box, review_status, critical)
        VALUES
          (${document.case_id}, ${document.id}, ${field.fieldName}, ${JSON.stringify(field.value)}::jsonb,
           ${field.confidence}, ${field.pageNumber}, ${field.boundingBox ? JSON.stringify(field.boundingBox) : null}::jsonb,
           'pending', ${field.critical})
        ON CONFLICT (document_id, field_name) DO UPDATE SET
          value = EXCLUDED.value,
          confidence = EXCLUDED.confidence,
          page_number = EXCLUDED.page_number,
          bounding_box = EXCLUDED.bounding_box,
          review_status = 'pending',
          critical = EXCLUDED.critical,
          updated_at = now()
      `;
    }
    await transaction`
      UPDATE documents d SET status = ${status}, updated_at = now()
      FROM cases c
      WHERE d.id = ${document.id} AND d.case_id = c.id AND c.clerk_user_id = ${userId}
        AND d.status = 'extracting'
    `;
  });
  return status;
}

async function acquire(document: DocumentRow, userId: string): Promise<boolean> {
  if (document.status !== "uploaded" && document.status !== "failed") return false;
  const sql = getDatabase();
  const rows = await sql<{ id: string }[]>`
    UPDATE documents d SET status = 'extracting', updated_at = now()
    FROM cases c
    WHERE d.id = ${document.id} AND d.case_id = c.id AND c.clerk_user_id = ${userId}
      AND d.status IN ('uploaded', 'failed')
    RETURNING d.id
  `;
  if (!rows[0]) return false;
  await sql`DELETE FROM extracted_fields WHERE document_id = ${document.id} AND case_id = ${document.case_id}`;
  return true;
}

async function analyze(document: DocumentRow, userId: string): Promise<DocumentStatus> {
  try {
    const output = await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: document.object_key }));
    const expectedSize = Number(document.byte_size);
    if (output.ContentLength !== undefined && output.ContentLength !== expectedSize) {
      throw new DocumentInputError("Stored document size verification failed.");
    }
    const bytes = readObjectBody(output.Body, expectedSize);
    const verified = verifyObjectBytes(await bytes, document.byte_size, document.sha256);
    return await persistExtraction(document, userId, await analyzeBillDocument({
      bytes: verified,
      contentType: document.content_type,
    }));
  } catch (error) {
    await markFailed(document.id, userId).catch(() => undefined);
    if (error instanceof DocumentInputError) {
      throw new DocumentRouteError("document_integrity_error", "Stored document verification failed.", 422, false);
    }
    throw new DocumentRouteError("document_analysis_failed", "Document analysis failed. Please retry.", 503, true);
  }
}

export async function POST(
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
      throw new DocumentRouteError("invalid_request", "Document id must be a valid UUID.", 400, false);
    }
    const document = await findOwnedDocument(documentId, user.userId);
    if (!document) throw new DocumentRouteError("document_not_found", "Document not found.", 404, false);

    if (document.status === "extracted" || document.status === "needs_review") {
      return Response.json({ data: responseData(document, await findDocumentFields(document.id)), error: null, requestId });
    }
    if (document.status === "extracting") {
      return Response.json({ data: responseData(document, await findDocumentFields(document.id)), error: null, requestId }, { status: 202 });
    }
    if (document.status !== "uploaded" && document.status !== "failed") {
      throw new DocumentRouteError("document_not_uploaded", "Document upload has not completed.", 409, false);
    }
    if (!await acquire(document, user.userId)) {
      const current = await findOwnedDocument(document.id, user.userId);
      if (!current) throw new DocumentRouteError("document_not_found", "Document not found.", 404, false);
      return Response.json({ data: responseData(current, await findDocumentFields(current.id)), error: null, requestId }, { status: 202 });
    }
    const status = await analyze({ ...document, status: "extracting" }, user.userId);
    const current = { ...document, status };
    return Response.json({ data: responseData(current, await findDocumentFields(current.id)), error: null, requestId });
  } catch (error) {
    if (error instanceof DocumentRouteError) return jsonError(error, requestId);
    return jsonError(new DocumentRouteError("documents_unavailable", "Document analysis is temporarily unavailable.", 503, true), requestId);
  }
}
