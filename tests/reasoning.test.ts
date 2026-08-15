import assert from "node:assert/strict";
import test from "node:test";

import {
  getEmbeddingDimensions,
  getOpenRouterChatModel,
  getOpenRouterEmbeddingModel,
} from "../lib/ai/openrouter";
import {
  extractGrounding,
  parseReasoningRequest,
  redactSensitiveFacts,
  ReasoningInputError,
} from "../lib/reasoning/index";

function withEnvironment(values: Record<string, string | undefined>, callback: () => void): void {
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    callback();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("validates requests and deduplicates grounded sources", () => {
  assert.deepEqual(parseReasoningRequest({ question: "  Find OESP rules  " }), {
    question: "Find OESP rules",
    facts: {},
  });
  assert.throws(() => parseReasoningRequest({ question: "" }), ReasoningInputError);
  assert.throws(() => parseReasoningRequest({ question: "x", facts: [] }), ReasoningInputError);

  assert.deepEqual(
    extractGrounding([
      {
        type: "source",
        sourceType: "url",
        id: "oesp-1",
        url: "https://oeb.ca/oesp",
        title: "OESP",
      },
    ]),
    {
      queries: [],
      sources: [{ title: "OESP", url: "https://oeb.ca/oesp", reviewed: false }],
      searchEntryPointHtml: null,
    },
  );
});

test("redacts sensitive facts before model calls", () => {
  assert.deepEqual(
    redactSensitiveFacts({
      provider: "Toronto Hydro",
      accountNumber: "123456789",
      contact: { email: "person@example.com", postalPrefix: "M5V" },
      occupants: [{ full_name: "Test User", age: 30 }],
    }),
    {
      provider: "Toronto Hydro",
      accountNumber: "[REDACTED]",
      contact: { email: "[REDACTED]", postalPrefix: "M5V" },
      occupants: [{ full_name: "[REDACTED]", age: 30 }],
    },
  );
});

test("requires configured OpenRouter models and schema dimensions", () => {
  withEnvironment(
    {
      OPENROUTER_CHAT_MODEL: undefined,
      OPENROUTER_EMBEDDING_MODEL: undefined,
      EMBEDDING_DIMENSIONS: undefined,
    },
    () => {
      assert.throws(() => getOpenRouterChatModel(), /OPENROUTER_CHAT_MODEL is not configured/);
      assert.throws(() => getOpenRouterEmbeddingModel(), /OPENROUTER_EMBEDDING_MODEL is not configured/);
      assert.throws(() => getEmbeddingDimensions(), /EMBEDDING_DIMENSIONS is not configured/);
    },
  );

  withEnvironment(
    {
      OPENROUTER_CHAT_MODEL: "  configured/chat  ",
      OPENROUTER_EMBEDDING_MODEL: "configured/embedding",
      EMBEDDING_DIMENSIONS: "768",
    },
    () => {
      assert.equal(getOpenRouterChatModel(), "configured/chat");
      assert.equal(getOpenRouterEmbeddingModel(), "configured/embedding");
      assert.equal(getEmbeddingDimensions(), 768);
    },
  );

  withEnvironment({ EMBEDDING_DIMENSIONS: "1536" }, () => {
    assert.throws(() => getEmbeddingDimensions(), /must be 768/);
  });
});
