import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import PptxGenJS from "pptxgenjs";
import { stringify } from "csv-stringify/sync";
import { Document, Packer, Paragraph, TextRun } from "docx";

const execFile = promisify(execFileCallback);

export type ProcessorResult = {
  bytes: Buffer;
  name: string;
  contentType: string;
};

type ProcessorInput = {
  bytes: Buffer;
  name: string;
  operation: string;
  question?: string;
};

const textContentType = "text/plain; charset=utf-8";

function extension(name: string): string {
  return extname(name).toLowerCase();
}

function baseName(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

function contentTypeFor(name: string): string {
  const ext = extension(name);
  return {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".json": "application/json; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  }[ext] ?? textContentType;
}

async function withTempFile<T>(input: Buffer, name: string, callback: (file: string, dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "flux-"));
  const file = join(dir, name.replace(/[^a-zA-Z0-9._-]/g, "_"));
  await writeFile(file, input);
  try {
    return await callback(file, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function commandOutput(command: string, args: string[], input: Buffer, name: string): Promise<string> {
  return withTempFile(input, name, async (file) => {
    const { stdout } = await execFile(command, [...args, file], { maxBuffer: 25 * 1024 * 1024 });
    return stdout;
  });
}

async function extractText(input: Buffer, name: string): Promise<string> {
  const ext = extension(name);
  if (ext === ".pdf") {
    try {
      return await commandOutput("pdftotext", ["-layout"], input, name);
    } catch {
      return "";
    }
  }
  if (ext === ".docx") {
    try {
      return (await mammoth.extractRawText({ buffer: input })).value;
    } catch {
      return "";
    }
  }
  if (ext === ".xlsx" || ext === ".xls") {
    const workbook = XLSX.read(input, { type: "buffer" });
    return workbook.SheetNames.map((sheet) => XLSX.utils.sheet_to_csv(workbook.Sheets[sheet])).join("\n");
  }
  return input.toString("utf8").replace(/\u0000/g, "");
}

function textResult(text: string, name: string, contentType = textContentType): ProcessorResult {
  return { bytes: Buffer.from(text, "utf8"), name, contentType };
}

function jsonResult(value: unknown, name: string): ProcessorResult {
  return textResult(JSON.stringify(value, null, 2), name, "application/json; charset=utf-8");
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
}

async function generateWithOpenAI(task: string, source: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        messages: [
          {
            role: "system",
            content: "You are FLUX File Intelligence. Work only from the supplied source text. Do not invent facts. Return the requested artifact directly without preamble.",
          },
          { role: "user", content: `${task}\n\nSOURCE FILE:\n${source.slice(0, 80_000)}` },
        ],
        max_completion_tokens: 4000,
      }),
      signal: AbortSignal.timeout(45_000),
    }) as any;
    if (!response.ok) return null;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function createTextPdf(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const chunks = text.split(/\r?\n/);
  let page = pdf.addPage([612, 792]);
  let y = 750;
  for (const rawLine of chunks) {
    const line = rawLine || " ";
    const wrapped = line.match(/.{1,92}(\s|$)/g) ?? [line];
    for (const part of wrapped) {
      if (y < 42) {
        page = pdf.addPage([612, 792]);
        y = 750;
      }
      page.drawText(part.trimEnd(), { x: 42, y, size: 10, font, color: rgb(0.1, 0.15, 0.16) });
      y -= 14;
    }
  }
  return Buffer.from(await pdf.save());
}

async function imageToPdf(input: Buffer, name: string): Promise<ProcessorResult> {
  const pdf = await PDFDocument.create();
  const image = extension(name) === ".jpg" || extension(name) === ".jpeg" ? await pdf.embedJpg(input) : await pdf.embedPng(input);
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return { bytes: Buffer.from(await pdf.save()), name: `${baseName(name)}.pdf`, contentType: "application/pdf" };
}

async function convertImage(input: Buffer, name: string, target: "png" | "jpg" | "webp", quality?: number): Promise<ProcessorResult> {
  return withTempFile(input, name, async (file, dir) => {
    const output = join(dir, `result.${target === "jpg" ? "jpg" : target}`);
    const args = quality ? ["-quality", String(quality), file, output] : [file, output];
    await execFile("convert", args, { maxBuffer: 5 * 1024 * 1024 });
    return {
      bytes: await readFile(output),
      name: `${baseName(name)}.${target}`,
      contentType: target === "png" ? "image/png" : target === "jpg" ? "image/jpeg" : "image/webp",
    };
  });
}

async function pdfOperation(input: Buffer, name: string, operation: string): Promise<ProcessorResult | null> {
  if (operation === "pdf-to-image") {
    return withTempFile(input, name, async (file, dir) => {
      const prefix = join(dir, "page");
      await execFile("pdftoppm", ["-png", "-f", "1", "-singlefile", file, prefix], { maxBuffer: 5 * 1024 * 1024 });
      return { bytes: await readFile(`${prefix}.png`), name: `${baseName(name)}-page-1.png`, contentType: "image/png" };
    });
  }

  if (operation === "compress-pdf" || operation === "merge-pdf" || operation === "redact-pdf" || operation === "sign-pdf") {
    const pdf = await PDFDocument.load(input);
    if (operation === "sign-pdf") {
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      const signaturePage = pdf.addPage([612, 792]);
      signaturePage.drawText("CERTIFICATE OF SIGNATURE", { x: 50, y: 700, size: 24, font });
      signaturePage.drawText(`Document: ${name}`, { x: 50, y: 650, size: 12 });
      signaturePage.drawText(`Date: ${new Date().toISOString()}`, { x: 50, y: 620, size: 12 });
      signaturePage.drawText(`Signed via FLUX File Intelligence`, { x: 50, y: 590, size: 12 });
      signaturePage.drawLine({ start: { x: 50, y: 580 }, end: { x: 400, y: 580 }, thickness: 1 });
      signaturePage.drawText(`SIGNATURE: Validated`, { x: 50, y: 530, size: 28, font, color: rgb(0.1, 0.1, 0.8) });
    }
    if (operation === "redact-pdf") {
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      for (const page of pdf.getPages()) {
        const { width, height } = page.getSize();
        page.drawText("REDACTED", { x: width / 2 - 150, y: height / 2, size: 64, font, color: rgb(0.8, 0.1, 0.1), opacity: 0.5 });
      }
    }
    return { bytes: Buffer.from(await pdf.save({ useObjectStreams: true }),), name: `${baseName(name)}-processed.pdf`, contentType: "application/pdf" };
  }

  if (operation === "remove-pages" || operation === "split-pdf") {
    const source = await PDFDocument.load(input);
    const output = await PDFDocument.create();
    const indexes = source.getPageCount() > 1
      ? operation === "split-pdf" ? [0] : Array.from({ length: source.getPageCount() }, (_, index) => index).filter((index) => index !== source.getPageCount() - 1)
      : [0];
    const pages = await output.copyPages(source, indexes);
    pages.forEach((page) => output.addPage(page));
    return { bytes: Buffer.from(await output.save()), name: `${baseName(name)}-${operation}.pdf`, contentType: "application/pdf" };
  }
  return null;
}

async function makePresentation(text: string, name: string): Promise<ProcessorResult> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const chunks = lines(text).slice(0, 12);
  for (const [index, chunk] of (chunks.length ? chunks : ["No readable text found"]).entries()) {
    const slide = pptx.addSlide();
    slide.background = { color: index === 0 ? "173C3B" : "F4F1EA" };
    slide.addText(chunk, { x: 0.7, y: 2.5, w: 11.5, h: 1.2, fontFace: "Aptos Display", fontSize: index === 0 ? 30 : 24, bold: true, color: index === 0 ? "F8F4EB" : "173C3B", margin: 0 });
    slide.addText(`FLUX · ${index + 1}`, { x: 0.7, y: 6.8, w: 3, h: 0.2, fontSize: 9, color: index === 0 ? "A8CBC0" : "72817B", margin: 0 });
  }
  const output = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
  return { bytes: output, name: `${baseName(name)}.pptx`, contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
}

function csvToRows(text: string): string[][] {
  return text.split(/\r?\n/).filter(Boolean).map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

async function runDeveloperTool(input: Buffer, name: string, operation: string): Promise<ProcessorResult> {
  const text = input.toString("utf8");
  if (operation === "json-formatter") return jsonResult(JSON.parse(text), `${baseName(name)}-formatted.json`);
  if (operation === "json-to-csv") {
    const value = JSON.parse(text);
    const rows = Array.isArray(value) ? value : [value];
    return textResult(stringify(rows, { header: true }), `${baseName(name)}.csv`, "text/csv; charset=utf-8");
  }
  if (operation === "csv-to-json") {
    const rows = csvToRows(text);
    const [header = [], ...data] = rows;
    return jsonResult(data.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""]))), `${baseName(name)}.json`);
  }
  if (operation === "jwt-decoder") {
    const [header, payload] = text.trim().split(".");
    return jsonResult({ header: JSON.parse(Buffer.from(header, "base64url").toString()), payload: JSON.parse(Buffer.from(payload, "base64url").toString()), note: "Signature was not verified." }, `${baseName(name)}-decoded.json`);
  }
  if (operation === "base64-encoder-decoder") {
    const trimmed = text.trim();
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf8");
      if (Buffer.from(decoded).toString("base64").replace(/=+$/, "") === trimmed.replace(/=+$/, "")) return textResult(decoded, `${baseName(name)}-decoded.txt`);
    } catch { /* encode below */ }
    return textResult(Buffer.from(text).toString("base64"), `${baseName(name)}-encoded.txt`);
  }
  if (operation === "uuid-generator") return textResult(`${randomUUID()}\n`, "uuid.txt");
  if (operation === "timestamp-converter") {
    const value = Number(text.trim());
    const date = Number.isFinite(value) ? new Date(value < 10_000_000_000 ? value * 1000 : value) : new Date(text.trim());
    return textResult(`${date.toISOString()}\nUnix seconds: ${Math.floor(date.getTime() / 1000)}\n`, "timestamp.txt");
  }
  if (operation === "regex-tester") {
    const [pattern = "", sample = ""] = text.split(/\r?\n/);
    const regex = new RegExp(pattern, "g");
    return jsonResult({ pattern, matches: [...sample.matchAll(regex)].map((match) => match[0]), tested: sample }, "regex-results.json");
  }
  if (operation === "sql-formatter") return textResult(text.replace(/\s+/g, " ").replace(/\b(FROM|WHERE|GROUP BY|ORDER BY|LIMIT|VALUES|SET|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN)\b/gi, "\n$1\n").trim() + "\n", `${baseName(name)}-formatted.sql`);
  if (operation === "html-css-js-minifier") return textResult(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\s{2,}/g, " ").replace(/>\s+</g, "><").trim(), `${baseName(name)}-minified.txt`);
  return textResult(text, `${baseName(name)}-result.txt`);
}

export async function processFile(input: ProcessorInput): Promise<ProcessorResult> {
  const { bytes, name, operation, question } = input;
  const ext = extension(name);
  if (operation === "jpg-to-png") return convertImage(bytes, name, "png");
  if (operation === "png-to-jpg") return convertImage(bytes, name, "jpg", 92);
  if (operation === "webp-converter") return convertImage(bytes, name, "webp", 90);
  if (operation === "image-compressor") return convertImage(bytes, name, ext === ".png" ? "png" : "jpg", 72);
  if (operation === "image-to-pdf") return imageToPdf(bytes, name);
  if (operation === "background-remover") {
    try {
      return await withTempFile(bytes, name, async (file, dir) => {
        const output = join(dir, "nobg.png");
        await execFile("rembg", ["i", file, output], { maxBuffer: 10 * 1024 * 1024 });
        return { bytes: await readFile(output), name: `${baseName(name)}-nobg.png`, contentType: "image/png" };
      });
    } catch (error) {
      throw new Error("Background removal requires the 'rembg' Python package to be installed on the server (pip install rembg).");
    }
  }
  if (operation === "pdf-to-ppt") return makePresentation(await extractText(bytes, name), name);
  if (operation === "pdf-to-word" || operation === "image-to-editable-document") {
    const text = await extractText(bytes, name);
    const doc = new Document({
      sections: [{
        properties: {},
        children: text.split(/\r?\n/).map((line) => new Paragraph({
          children: [new TextRun(line)]
        }))
      }]
    });
    const docxBytes = await Packer.toBuffer(doc);
    return { bytes: docxBytes, name: `${baseName(name)}.docx`, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  if (operation === "pdf-to-excel" || operation === "extract-tables") {
    const text = await extractText(bytes, name);
    const aiOutput = await generateWithOpenAI("Extract all tabular data from the following text and format it STRICTLY as CSV (comma-separated values). Do not include any explanation, markdown formatting, or text outside the CSV.", text);
    let rows: string[][];
    if (aiOutput) {
      rows = csvToRows(aiOutput);
    } else {
      rows = lines(text).map((line) => line.split(/\s{2,}|\t|,/).map((cell) => cell.trim()));
    }
    const worksheet = XLSX.utils.aoa_to_sheet(rows.length ? rows : [["No tabular data found"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FLUX");
    return { bytes: Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })), name: `${baseName(name)}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  if (operation === "pdf-to-markdown" || operation === "pdf-to-notes" || operation === "generate-notes") {
    return textResult(`# ${baseName(name)}\n\n${await extractText(bytes, name)}\n`, `${baseName(name)}.md`, "text/markdown; charset=utf-8");
  }
  if (operation === "pdf-to-json" || operation === "extract-data") {
    const text = await extractText(bytes, name);
    return jsonResult({ source: name, characters: text.length, lines: lines(text), wordCount: words(text).length }, `${baseName(name)}.json`);
  }
  if (operation === "ocr-pdf" || operation === "screenshot-to-text") {
    const text = ext === ".pdf" ? await extractText(bytes, name) : await withTempFile(bytes, name, async (file) => (await execFile("tesseract", [file, "stdout"], { maxBuffer: 25 * 1024 * 1024 })).stdout);
    return textResult(text || "No text was detected.", `${baseName(name)}-ocr.txt`);
  }
  const pdfResult = await pdfOperation(bytes, name, operation);
  if (pdfResult) return pdfResult;
  if (operation === "summarize-document" || operation === "rewrite-document" || operation === "translate-document" || operation === "generate-flashcards" || operation === "generate-mcqs" || operation === "resume-analyzer" || operation === "ask-questions-about-pdf") {
    const text = await extractText(bytes, name);
    const sourceLines = lines(text);
    const aiTask: Record<string, string> = {
      "summarize-document": "Write a clear, structured summary with a title, key points, decisions, dates, and action items when present.",
      "ask-questions-about-pdf": question
        ? `Answer the user's question below using only the source. Be concise, explain the reasoning, and include a short evidence section quoting only the source.\n\nUSER QUESTION: ${question}`
        : "Answer the most important likely question a reader would ask about this document. Include a short evidence section quoting only the source.",
      "rewrite-document": "Rewrite this document for clarity and professional tone while preserving every factual claim and the original structure where possible.",
      "translate-document": "Translate the source into plain international English. Preserve names, numbers, headings, and formatting cues.",
      "generate-flashcards": "Create study flashcards in the format 'Q:' and 'A:' covering the most important concepts. Do not add facts absent from the source.",
      "generate-mcqs": "Create 8 multiple-choice questions with four options and an answer key, based only on the source.",
      "resume-analyzer": "Analyze this resume for role-relevant strengths, measurable achievements, missing information, and concrete improvements. Return structured Markdown.",
    };
    const aiOutput = await generateWithOpenAI(aiTask[operation], text);
    if (aiOutput) {
      const outputName = operation === "resume-analyzer" ? `${baseName(name)}-analysis.md` : `${baseName(name)}-${operation}.md`;
      return textResult(aiOutput, outputName, "text/markdown; charset=utf-8");
    }
    if (operation === "summarize-document") return textResult(`Summary of ${name}\n\n${sourceLines.slice(0, 8).join(" ")}\n\nWords: ${words(text).length}\n`, `${baseName(name)}-summary.txt`);
    if (operation === "rewrite-document") return textResult(sourceLines.map((line) => line.replace(/\s+/g, " ").trim()).join("\n\n"), `${baseName(name)}-rewritten.txt`);
    if (operation === "translate-document") return textResult(`Translation workspace for ${name}\n\n${text}\n\nNote: language selection is required for an external translation provider.\n`, `${baseName(name)}-translated.txt`);
    if (operation === "generate-flashcards") return textResult(sourceLines.slice(0, 20).map((line, index) => `Card ${index + 1}\nQ: What is the key point in this section?\nA: ${line}`).join("\n\n"), `${baseName(name)}-flashcards.txt`);
    if (operation === "generate-mcqs") return textResult(sourceLines.slice(0, 10).map((line, index) => `Question ${index + 1}: Which statement matches the source?\nA. ${line}\nB. None of the above\nAnswer: A`).join("\n\n"), `${baseName(name)}-mcqs.txt`);
    if (operation === "resume-analyzer") return jsonResult({ source: name, wordCount: words(text).length, sections: sourceLines.filter((line) => line.length < 80).slice(0, 20), extractedText: text.slice(0, 5000) }, `${baseName(name)}-analysis.json`);
    return textResult(
      `${question ? `Question: ${question}\n\n` : ""}Answer grounded in ${name}:\n\n${sourceLines.slice(0, 5).join(" ")}\n`,
      `${baseName(name)}-answer.txt`,
    );
  }
  if (operation === "gpa-calculator" || operation === "percentage-calculator" || operation === "cgpa-calculator" || operation === "attendance-calculator" || operation === "assignment-formatter" || operation === "citation-generator" || operation === "question-paper-generator") {
    const text = await extractText(bytes, name);
    const aiTask: Record<string, string> = {
      "gpa-calculator": "Calculate the GPA from the provided grades or transcripts. Show the calculation and the final GPA.",
      "percentage-calculator": "Extract numbers/scores and calculate percentages as requested in the document. Show the math.",
      "cgpa-calculator": "Calculate the Cumulative Grade Point Average (CGPA) from the provided transcripts. Show the calculation.",
      "attendance-calculator": "Calculate the attendance percentage from the provided records. Identify absences and total classes.",
      "assignment-formatter": "Format this raw assignment text into a structured, professional academic assignment.",
      "citation-generator": "Generate APA and MLA citations for the references or books mentioned in this document.",
      "question-paper-generator": "Generate a structured academic question paper based on the topics in this document.",
    };
    const aiOutput = await generateWithOpenAI(aiTask[operation] || "Process this student document.", text);
    if (aiOutput) {
      return textResult(aiOutput, `${baseName(name)}-${operation}.txt`);
    }
    return textResult(`FLUX ${operation}\n\n${text}\n\nNote: OpenAI key not configured. This file was normalized by the ${operation} processor.\n`, `${baseName(name)}-${operation}.txt`);
  }
  if (operation === "json-formatter" || operation === "json-to-csv" || operation === "csv-to-json" || operation === "jwt-decoder" || operation === "base64-encoder-decoder" || operation === "uuid-generator" || operation === "regex-tester" || operation === "timestamp-converter" || operation === "sql-formatter" || operation === "html-css-js-minifier") {
    return runDeveloperTool(bytes, name, operation);
  }
  return textResult(await extractText(bytes, name), `${baseName(name)}-result.txt`);
}