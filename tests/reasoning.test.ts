import assert from "node:assert/strict";
import test from "node:test";

import {
  extractGrounding,
  parseReasoningRequest,
  ReasoningInputError,
} from "../lib/reasoning/index";

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
