const encoder = new TextEncoder();

function ascii(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const DISCLAIMER =
  "This material is for internal review and demonstration purposes only. It is not an offer, solicitation, or commitment to lend. Rates, terms, and availability are subject to change without notice. Not all applicants will qualify.";

function pageStream(lines: { text: string; size: number; bold?: boolean }[]) {
  let y = 720;
  const ops: string[] = [];
  for (const line of lines) {
    ops.push(
      `BT /${line.bold ? "F2" : "F1"} ${line.size} Tf 72 ${y} Td (${ascii(line.text)}) Tj ET`,
    );
    y -= line.size + 8;
  }
  return ops.join("\n");
}

export function buildPdf(title: string, versionNumber: number): Uint8Array {
  const page1 = pageStream([
    { text: title, size: 18, bold: true },
    { text: `Version ${versionNumber}`, size: 12 },
    ...wrap(DISCLAIMER, 85).map((text) => ({ text, size: 11 })),
    { text: "Body copy placeholder for marketing review workflows.", size: 11 },
  ]);
  const page2 = pageStream([
    {
      text: `${title} - version ${versionNumber}, terms and conditions`,
      size: 14,
      bold: true,
    },
    {
      text: "Additional terms appear on this page for longer materials.",
      size: 11,
    },
  ]);

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 8 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${page1.length} >>\nstream\n${page1}\nendstream`,
    `<< /Length ${page2.length} >>\nstream\n${page2}\nendstream`,
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return encoder.encode(body);
}
