// Generates a synthetic single-page utility bill PDF for testing the extractor.
// PRD §5.3 wants "a clean single-page synthetic bill" for the live demo, and
// §13 wants synthetic or redacted bills rather than real ones.
//
//   node lib/ocr/dev/make-sample-bill.mjs sample-bill.pdf
//
// The layout deliberately includes two distractors a naive parser grabs by
// mistake: a prior-year usage figure and a previous balance. A correct
// extraction reports 947 kWh and $164.54, not 1,012 kWh or $151.03.

import { writeFileSync } from "node:fs";

const lines = [
  [72, 760, 18, "TORONTO HYDRO"],
  [72, 738, 10, "Electricity Bill  -  Residential Service"],
  [72, 706, 10, "Account Number: 4021-8837-2291-6640"],
  [72, 690, 10, "Service Address: 118 Wallace Ave, Toronto, ON  M6H 1V1, Canada"],
  [72, 674, 10, "Rate Class: Residential (RPP - Tiered)"],
  [72, 642, 11, "Billing Period: June 3, 2026 to July 2, 2026  (30 days)"],
  [72, 610, 10, "Electricity Consumption This Period ............ 947 kWh"],
  [72, 594, 10, "  Tier 1  (600 kWh @ $0.0993/kWh) ............. $59.58"],
  [72, 578, 10, "  Tier 2  (347 kWh @ $0.1160/kWh) ............. $40.25"],
  [72, 562, 10, "Delivery - Electric Heating Rate Class ......... $41.17"],
  [72, 546, 10, "Regulatory Charges ............................ $4.62"],
  [72, 530, 10, "HST (13%) ..................................... $18.92"],
  [72, 506, 12, "TOTAL AMOUNT DUE: $164.54 CAD"],
  [72, 490, 10, "Payment Due Date: July 24, 2026"],
  [72, 458, 10, "Same period last year: 1,012 kWh"],
  [72, 442, 10, "Previous balance: $151.03 (paid - thank you)"],
];

const content = lines
  .map(([x, y, size, text]) => `BT /F1 ${size} Tf ${x} ${y} Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`)
  .join("\n");

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
];

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});

const xrefStart = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

const out = process.argv[2] ?? "sample-bill.pdf";
writeFileSync(out, pdf, "latin1");
console.log(`Wrote ${out} (${pdf.length} bytes)`);
