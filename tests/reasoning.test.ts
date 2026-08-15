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
    extractGrounding({
      webSearchQueries: ["OESP official rules"],
      groundingChunks: [
        { web: { uri: "https://oeb.ca/oesp", title: "OESP" } },
        { web: { uri: "https://oeb.ca/oesp", title: "Duplicate" } },
      ],
      searchEntryPoint: { renderedContent: "<div>Search results</div>" },
    }),
    {
      queries: ["OESP official rules"],
      sources: [{ title: "OESP", url: "https://oeb.ca/oesp" }],
      searchEntryPointHtml: "<div>Search results</div>",
    },
  );
});
