import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

import { requireUser } from "@/lib/auth";
import { findOwnedCaseStatus } from "@/lib/cases";
import { getDatabase } from "@/lib/db";
import {
  createObjectKey,
  parseUploadRequest,
  presignedTtlSeconds,
  requestId as createRequestId,
  sha256HexFromBase64,
  UploadValidationError,
  uploadMaxBytes,
  usesVercelOidc,
} from "@/lib/uploads";

export const runtime = "nodejs";

type StoredDocument = {
  id: string;
  object_key: string;
  content_type: string;
  byte_size: number | string;
  sha256: string;
  status: string;
  expires_at: string | Date;
};

type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<StoredDocument[]>;

class UploadRouteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function jsonError(error: UploadRouteError, requestId: string) {
  return Response.json(
    {
      data: null,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
      requestId,
    },
    { status: error.status },
  );
}

async function verifyCaseOwnership(caseId: string, userId: string): Promise<void> {
  if (!await findOwnedCaseStatus(userId, caseId)) {
    throw new UploadRouteError("case_not_found", "Case not found.", 404, false);
  }
}

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  if (!bucket) throw new UploadRouteError("upload_unavailable", "Uploads are temporarily unavailable.", 503, true);
  return bucket;
}

async function saveDocument(input: ReturnType<typeof parseUploadRequest>, objectKey: string) {
  const expiresAtSeconds = presignedTtlSeconds();
  const sql = getDatabase() as unknown as SqlClient;
  const rows = await sql`
    INSERT INTO documents
      (case_id, object_key, content_type, byte_size, sha256, status, idempotency_key, expires_at)
    VALUES
      (${input.caseId}, ${objectKey}, ${input.contentType}, ${input.size}, ${sha256HexFromBase64(input.sha256)}, 'upload_ready',
       ${input.idempotencyKey ?? null}, now() + make_interval(secs => ${expiresAtSeconds}))
    ON CONFLICT (case_id, idempotency_key) DO UPDATE
      SET updated_at = documents.updated_at
      WHERE documents.content_type = EXCLUDED.content_type
        AND documents.byte_size = EXCLUDED.byte_size
        AND documents.sha256 = EXCLUDED.sha256
    RETURNING id, object_key, content_type, byte_size, sha256, status, expires_at
  `;
  if (!rows[0]) {
    throw new UploadRouteError(
      "idempotency_conflict",
      "That upload key is already associated with different file metadata.",
      409,
      false,
    );
  }
  return rows[0];
}

export async function POST(request: Request) {
  const id = createRequestId();
  try {
    const user = await requireUser(id);
    if (user instanceof Response) return user;
    const userId = user.userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new UploadRouteError("invalid_request", "Request body must be valid JSON.", 400, false);
      }
      throw error;
    }

    const idempotencyKey = request.headers.get("idempotency-key");
    if (
      idempotencyKey !== null && body && typeof body === "object" && !Array.isArray(body) &&
      (body as Record<string, unknown>).idempotencyKey !== undefined &&
      (body as Record<string, unknown>).idempotencyKey !== idempotencyKey
    ) {
      throw new UploadValidationError("Idempotency-Key must match body.idempotencyKey.");
    }
    const bodyWithHeader = idempotencyKey !== null && body && typeof body === "object" && !Array.isArray(body) &&
      (body as Record<string, unknown>).idempotencyKey === undefined
      ? { ...(body as Record<string, unknown>), idempotencyKey }
      : body;
    const input = parseUploadRequest(bodyWithHeader, uploadMaxBytes());
    await verifyCaseOwnership(input.caseId, userId);

    const bucket = getBucket();
    const objectKey = createObjectKey(input.caseId);
    const document = await saveDocument(input, objectKey);
    const region = process.env.AWS_REGION?.trim() || "ca-central-1";
    const roleArn = process.env.AWS_ROLE_ARN?.trim();
    const client = new S3Client({
      region,
      ...(usesVercelOidc() && roleArn
        ? { credentials: awsCredentialsProvider({ roleArn, clientConfig: { region } }) }
        : {}),
    });
    const expiresIn = presignedTtlSeconds();
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: document.object_key,
        ContentType: document.content_type,
        ContentLength: Number(document.byte_size),
        ChecksumSHA256: input.sha256,
      }),
      { expiresIn },
    );

    return Response.json({
      data: {
        documentId: document.id,
        status: document.status,
        upload: {
          method: "PUT",
          url: uploadUrl,
          headers: {
            "content-type": document.content_type,
            "x-amz-checksum-sha256": input.sha256,
          },
          expiresIn,
        },
        expiresAt: document.expires_at,
      },
      error: null,
      requestId: id,
    });
  } catch (error) {
    if (error instanceof UploadRouteError) return jsonError(error, id);
    if (error instanceof UploadValidationError) {
      return jsonError(new UploadRouteError(error.code, error.message, 400, false), id);
    }

    console.error("Upload request failed", {
      requestId: id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError(
      new UploadRouteError("upload_unavailable", "Uploads are temporarily unavailable.", 503, true),
      id,
    );
  }
}
