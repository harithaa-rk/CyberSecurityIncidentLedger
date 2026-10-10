"use strict";
const path   = require("path");
const fs     = require("fs");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");

const { generateQrCodeBuffer } = require("./qrVerificationService");

// ─────────────────────────────────────────────────────────────────────────────
// PDF Report Service — Formal Light-Themed A4 Incident Report (1–2 pages)
//
// All sections flow continuously. A page break is inserted only when the next
// block would overflow the bottom margin. No forced page-breaks mid-flow.
// ─────────────────────────────────────────────────────────────────────────────

const REPORTS_DIR = path.resolve(__dirname, "..", "reports");
function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ── Formal light palette ──────────────────────────────────────────────────────
const C = {
  white:      "#FFFFFF",
  black:      "#111111",
  darkGray:   "#222222",
  midGray:    "#555555",
  lightGray:  "#999999",
  borderGray: "#CCCCCC",
  sectionBg:  "#E5E5E5",
  rowAlt:     "#F5F5F5",
  titleNavy:  "#1A3A5C",
};

// ── A4 page constants (points) ────────────────────────────────────────────────
const ML = 36, MR = 36, MT = 30, MB = 32;
const PW = 595.28, PH = 841.89;
const CW = PW - ML - MR;          // 523.28 pt content width
const USABLE_H = PH - MT - MB;    // 779.89 pt usable per page

// ── Compact sizing ────────────────────────────────────────────────────────────
const ROW_H     = 12;   // standard kv-table row height
const HDR_H     = 12;   // section-header strip height
const SEC_GAP   = 4;    // gap between sections
const CELL_PAD  = 2.5;  // inner cell padding (top)
const LW_RATIO  = 0.34; // label-column width ratio

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────
function s(v) {
  if (v === null || v === undefined || v === "" || v === "0.0.0.0") return "Not Available";
  return String(v);
}

function fmtDate(d) {
  if (!d) return "Not Available";
  try {
    const dt = new Date(d);
    const pad = n => String(n).padStart(2, "0");
    return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()}  ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  } catch { return "Not Available"; }
}

function fmtSize(bytes) {
  if (!bytes) return "—";
  const k = 1024, sz = ["B","KB","MB","GB"], i = Math.floor(Math.log(bytes)/Math.log(k));
  return `${(bytes/Math.pow(k,i)).toFixed(1)} ${sz[i]}`;
}

function trunc(str, n) {
  if (!str || str === "Not Available") return "Not Available";
  return str.length <= n ? str : str.slice(0, n) + "…";
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-break guard  — call BEFORE drawing any block
// Returns new y (after possibly adding a fresh page)
// ─────────────────────────────────────────────────────────────────────────────
function needsPage(doc, y, needed) {
  if (y + needed > PH - MB) {
    doc.addPage();
    return MT;
  }
  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
async function generatePdfReport(report, filename) {
  ensureReportsDir();
  const pdfPath  = path.join(REPORTS_DIR, `${filename}.pdf`);
  const qrBuffer = await generateQrCodeBuffer(report.verificationUrl || "").catch(() => null);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:    "A4",
      margins: { top: MT, bottom: MB, left: ML, right: MR },
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title:   `Cybersecurity Incident Report ${report.reportNumber}`,
        Author:  "Cybersecurity Incident Ledger",
        Subject: `Incident Report – ${report.incidentIdentifier}`,
        Creator: "Cybersecurity Incident Ledger – Automated Report System",
      },
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    let y = MT;

    // ── Title ──────────────────────────────────────────────────────────────
    y = drawTitle(doc, y);

    // ── Top info table ─────────────────────────────────────────────────────
    y = needsPage(doc, y, 11 * ROW_H + 4);
    y = drawTopInfoTable(doc, report, y);

    // ── Section 1 ──────────────────────────────────────────────────────────
    y = needsPage(doc, y, HDR_H + 10 * ROW_H + SEC_GAP);
    y = drawSection(doc, "1.  INCIDENT INFORMATION", y);
    y = drawKV(doc, [
      ["Incident Title",    s(report.incidentTitle)],
      ["Incident Type",     s(report.incidentType)],
      ["Threat Category",   s(report.threatCategory)],
      ["Attack Type",       s(report.attackType)],
      ["Severity",          s(report.severity)],
      ["Risk Score",        report.riskScore != null ? `${report.riskScore} / 100` : "Not Available"],
      ["Detection Time",    fmtDate(report.incidentDetectedAt)],
      ["Resolution Time",   fmtDate(report.incidentResolvedAt)],
      ["Security Source",   s(report.source)],
      ["Protocol",          s(report.protocol)],
    ], y);

    // ── Section 2 ──────────────────────────────────────────────────────────
    y = needsPage(doc, y, HDR_H + 9 * ROW_H + SEC_GAP);
    y = drawSection(doc, "2.  AFFECTED SYSTEM / NETWORK INFORMATION", y);
    const sp = report.sourcePort      ? String(report.sourcePort)      : "Not Available";
    const dp = report.destinationPort ? String(report.destinationPort) : "Not Available";
    y = drawKV(doc, [
      ["Source IP",          s(report.sourceIP)],
      ["Destination IP",     s(report.destinationIP)],
      ["Source Port",        sp],
      ["Destination Port",   dp],
      ["Protocol",           s(report.protocol)],
      ["Source System",      s(report.source)],
      ["Destination System", "Not Available"],
      ["Hostname",           s(report.hostname)],
      ["Event ID",           s(report.eventId)],
    ], y);

    // ── Section 3 — Description (capped height) ────────────────────────────
    const descText  = s(report.aiSummary);
    const descLines = doc.heightOfString(descText, { width: CW - 8, fontSize: 7, lineGap: 1.5 });
    const descBoxH  = Math.min(62, descLines + 8);
    y = needsPage(doc, y, HDR_H + descBoxH + SEC_GAP);
    y = drawSection(doc, "3.  INCIDENT DESCRIPTION", y);
    y = drawTextBox(doc, descText, y, descBoxH);

    // ── Section 4 — AI Analysis ───────────────────────────────────────────
    const explText   = s(report.aiExplanation);
    const actionText = s(report.recommendedAction);
    const explH   = Math.min(36, doc.heightOfString(explText,   { width: CW*(1-LW_RATIO)-8, fontSize: 6.5, lineGap: 1 }) + 6);
    const actionH = Math.min(36, doc.heightOfString(actionText, { width: CW*(1-LW_RATIO)-8, fontSize: 6.5, lineGap: 1 }) + 6);
    y = needsPage(doc, y, HDR_H + 4 * ROW_H + explH + actionH + SEC_GAP);
    y = drawSection(doc, "4.  AI THREAT ANALYSIS", y);
    y = drawKV(doc, [
      ["Threat Classification", s(report.threatCategory)],
      ["Attack Type",           s(report.attackType)],
      ["Severity",              s(report.severity)],
      ["Risk Score",            report.riskScore != null ? `${report.riskScore} / 100` : "Not Available"],
    ], y);
    y = drawWrapRow(doc, "AI Explanation",     explText,   y, explH);
    y = drawWrapRow(doc, "Recommended Action", actionText, y, actionH);

    // ── Section 5 — Investigation ─────────────────────────────────────────
    const invText = s(report.investigationSummary);
    const resText = s(report.resolutionSummary);
    const invH = Math.min(32, doc.heightOfString(invText, { width: CW*(1-LW_RATIO)-8, fontSize: 6.5, lineGap: 1 }) + 6);
    const resH = Math.min(32, doc.heightOfString(resText, { width: CW*(1-LW_RATIO)-8, fontSize: 6.5, lineGap: 1 }) + 6);
    y = needsPage(doc, y, HDR_H + 6 * ROW_H + invH + resH + SEC_GAP);
    y = drawSection(doc, "5.  INVESTIGATION AND RESOLUTION", y);
    y = drawKV(doc, [
      ["Assigned Analyst",     s(report.generatedByName)],
      ["Investigation Status", s(report.incidentStatus)],
      ["Root Cause",           s(report.rootCause)],
      ["Action Taken",         s(report.actionTaken)],
      ["Resolved By",          s(report.resolvedByName)],
      ["Resolution Time",      fmtDate(report.incidentResolvedAt)],
    ], y);
    y = drawWrapRow(doc, "Investigation Summary", invText, y, invH);
    y = drawWrapRow(doc, "Resolution Summary",    resText, y, resH);

    // ── Section 6 — Evidence ──────────────────────────────────────────────
    const evList = Array.isArray(report.evidenceList) ? report.evidenceList : [];
    const evTableH = evList.length > 0 ? (evList.length * 14 + 12) : 14;
    y = needsPage(doc, y, HDR_H + evTableH + 12 + SEC_GAP);
    y = drawSection(doc, "6.  DIGITAL EVIDENCE", y);
    y = drawEvidenceTable(doc, evList, y);

    // ── Section 7 — Integrity ─────────────────────────────────────────────
    y = needsPage(doc, y, HDR_H + 5 * ROW_H + 18 + SEC_GAP);
    y = drawSection(doc, "7.  EVIDENCE INTEGRITY", y);
    const evListLocal = Array.isArray(report.evidenceList) ? report.evidenceList : [];
    const verified = evListLocal.filter(e => (e.verificationStatus||"").toUpperCase() === "VERIFIED").length;
    const tampered = evListLocal.filter(e => (e.verificationStatus||"").toUpperCase() === "TAMPERED").length;
    const total    = evListLocal.length;
    const intStat  = tampered > 0 ? "TAMPERED DETECTED"
                   : verified === total && total > 0 ? "ALL VERIFIED"
                   : "NOT FULLY VERIFIED";
    y = drawKV(doc, [
      ["Storage",          "Pinata / IPFS"],
      ["Hash Algorithm",   "SHA-256"],
      ["Blockchain",       "Hyperledger Fabric"],
      ["Integrity Status", intStat],
      ["Evidence Items",   total > 0 ? `${verified} Verified / ${tampered} Tampered / ${total-verified-tampered} Pending` : "No evidence"],
    ], y);
    // integrity note
    const noteH = 14;
    y = needsPage(doc, y, noteH + 2);
    doc.rect(ML, y, CW, noteH).strokeColor(C.borderGray).lineWidth(0.4).stroke();
    doc.fontSize(6).font("Helvetica").fillColor(C.midGray)
       .text("Evidence integrity is verified by recalculating the SHA-256 hash of the stored IPFS evidence and comparing it with the hash recorded on Hyperledger Fabric. The blockchain record is the trusted reference.",
             ML + 3, y + 3, { width: CW - 6, height: noteH - 4, lineGap: 1 });
    y += noteH + SEC_GAP;

    // ── Section 8 — Verification + QR + Seal ─────────────────────────────
    const qrW  = 70;
    const verH = 4 * ROW_H + 4;
    const sealH = 46;
    const s8Total = HDR_H + Math.max(verH, qrW + 16) + sealH + 8;
    y = needsPage(doc, y, s8Total);
    y = drawSection(doc, "8.  REPORT VERIFICATION", y);
    y = drawVerificationBlock(doc, report, qrBuffer, y, qrW);

    // Digital seal (right-aligned, after verification block)
    y = needsPage(doc, y, sealH + 4);
    drawDigitalSeal(doc, report, y);
    y += sealH + 4;

    // ── Footers on every page ──────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, report, i + 1, range.count);
    }

    doc.end();
    stream.on("finish", () => {
      const buf  = fs.readFileSync(pdfPath);
      const reportHash = crypto.createHash("sha256").update(buf).digest("hex");
      resolve({ pdfPath, reportHash });
    });
    stream.on("error", reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK DRAWERS
// ─────────────────────────────────────────────────────────────────────────────

function drawTitle(doc, y) {
  // Double border title block
  doc.rect(ML, y, CW, 44).strokeColor(C.borderGray).lineWidth(0.6).stroke();
  // top navy band
  doc.rect(ML, y, CW, 16).fillColor(C.titleNavy).fill();

  doc.fontSize(8).font("Helvetica-Bold").fillColor("#FFFFFF")
     .text("CYBERSECURITY INCIDENT LEDGER", ML, y + 4, { width: CW, align: "center", lineBreak: false });

  doc.fontSize(13).font("Helvetica-Bold").fillColor(C.titleNavy)
     .text("CYBERSECURITY INCIDENT REPORT", ML, y + 20, { width: CW, align: "center", lineBreak: false });

  doc.fontSize(6).font("Helvetica").fillColor(C.lightGray)
     .text("AUTOMATED · TAMPER-EVIDENT · BLOCKCHAIN-ANCHORED  ·  NOT A GOVERNMENT OR LEGAL DOCUMENT",
           ML, y + 36, { width: CW, align: "center", lineBreak: false });

  y += 46;
  // thin separator
  doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor("#333333").lineWidth(0.8).stroke();
  return y + 3;
}

function drawTopInfoTable(doc, report, y) {
  // 2-column layout: two kv-pairs per row to save vertical space
  const rows = [
    ["Report Number",    s(report.reportNumber),          "Report ID",      s(report.reportId)],
    ["Incident ID",      s(report.incidentIdentifier),    "Incident Status",s(report.incidentStatus)],
    ["Date Reported",    fmtDate(report.incidentDetectedAt), "Date Generated", fmtDate(report.generatedAt)],
    ["Severity",         s(report.severity),              "Risk Score",     report.riskScore != null ? `${report.riskScore} / 100` : "Not Available"],
    ["Analyst",          s(report.generatedByName),       "Organization",   s(report.organizationName)],
    ["Location",         s(report.organizationLocation),  "",               ""],
  ];

  const colW  = CW / 2;
  const lw    = colW * 0.38;

  doc.rect(ML, y, CW, rows.length * ROW_H).strokeColor(C.borderGray).lineWidth(0.5).stroke();

  rows.forEach((row, i) => {
    const ry = y + i * ROW_H;
    if (i % 2 === 0) doc.rect(ML, ry, CW, ROW_H).fillColor(C.rowAlt).fill();
    // left pair
    doc.rect(ML, ry, colW, ROW_H).strokeColor(C.borderGray).lineWidth(0.3).stroke();
    doc.rect(ML, ry, lw, ROW_H).strokeColor(C.borderGray).lineWidth(0.2).stroke();
    doc.fontSize(6).font("Helvetica-Bold").fillColor(C.midGray)
       .text(row[0], ML + 2, ry + CELL_PAD, { width: lw - 3, lineBreak: false });
    doc.fontSize(6).font("Helvetica").fillColor(C.black)
       .text(row[1], ML + lw + 2, ry + CELL_PAD, { width: colW - lw - 3, lineBreak: false });
    // right pair (if present)
    if (row[2]) {
      const rx = ML + colW;
      doc.rect(rx, ry, colW, ROW_H).strokeColor(C.borderGray).lineWidth(0.3).stroke();
      doc.rect(rx, ry, lw, ROW_H).strokeColor(C.borderGray).lineWidth(0.2).stroke();
      doc.fontSize(6).font("Helvetica-Bold").fillColor(C.midGray)
         .text(row[2], rx + 2, ry + CELL_PAD, { width: lw - 3, lineBreak: false });
      doc.fontSize(6).font("Helvetica").fillColor(C.black)
         .text(row[3], rx + lw + 2, ry + CELL_PAD, { width: colW - lw - 3, lineBreak: false });
    }
  });
  return y + rows.length * ROW_H + SEC_GAP;
}

function drawSection(doc, label, y) {
  doc.rect(ML, y, CW, HDR_H).fillColor(C.sectionBg).fill();
  doc.rect(ML, y, CW, HDR_H).strokeColor(C.borderGray).lineWidth(0.5).stroke();
  doc.rect(ML, y, 3, HDR_H).fillColor(C.titleNavy).fill();
  doc.fontSize(7).font("Helvetica-Bold").fillColor(C.darkGray)
     .text(label, ML + 6, y + 2.5, { width: CW - 8, lineBreak: false });
  return y + HDR_H + 1;
}

function drawKV(doc, rows, y) {
  const lw = CW * LW_RATIO;
  doc.rect(ML, y, CW, rows.length * ROW_H).strokeColor(C.borderGray).lineWidth(0.5).stroke();
  rows.forEach((row, i) => {
    const ry = y + i * ROW_H;
    if (i % 2 === 0) doc.rect(ML, ry, CW, ROW_H).fillColor(C.rowAlt).fill();
    doc.rect(ML, ry, CW, ROW_H).strokeColor(C.borderGray).lineWidth(0.25).stroke();
    doc.rect(ML, ry, lw, ROW_H).strokeColor(C.borderGray).lineWidth(0.2).stroke();
    doc.fontSize(6).font("Helvetica-Bold").fillColor(C.midGray)
       .text(row[0], ML + 3, ry + CELL_PAD, { width: lw - 4, lineBreak: false });
    doc.fontSize(6).font("Helvetica").fillColor(C.black)
       .text(row[1], ML + lw + 3, ry + CELL_PAD, { width: CW - lw - 5, lineBreak: false });
  });
  return y + rows.length * ROW_H;
}

// A single tall row for multiline text (explanation, summary, etc.)
function drawWrapRow(doc, label, text, y, h) {
  const lw = CW * LW_RATIO;
  doc.rect(ML, y, CW, h).fillColor(C.rowAlt).fill();
  doc.rect(ML, y, CW, h).strokeColor(C.borderGray).lineWidth(0.4).stroke();
  doc.rect(ML, y, lw, h).strokeColor(C.borderGray).lineWidth(0.2).stroke();
  doc.fontSize(6).font("Helvetica-Bold").fillColor(C.midGray)
     .text(label, ML + 3, y + CELL_PAD, { width: lw - 4, lineBreak: false });
  doc.fontSize(6).font("Helvetica").fillColor(C.black)
     .text(text, ML + lw + 3, y + CELL_PAD, {
       width:   CW - lw - 6,
       height:  h - CELL_PAD - 2,
       lineGap: 1,
       ellipsis: true,
     });
  return y + h;
}

function drawTextBox(doc, text, y, h) {
  doc.rect(ML, y, CW, h).strokeColor(C.borderGray).lineWidth(0.5).stroke();
  doc.fontSize(7).font("Helvetica").fillColor(C.black)
     .text(text, ML + 4, y + 4, {
       width:   CW - 8,
       height:  h - 8,
       lineGap: 1.5,
       ellipsis: true,
     });
  return y + h + SEC_GAP;
}

function drawEvidenceTable(doc, evList, y) {
  if (evList.length === 0) {
    const h = ROW_H + 2;
    doc.rect(ML, y, CW, h).strokeColor(C.borderGray).lineWidth(0.4).stroke();
    doc.fontSize(6.5).font("Helvetica").fillColor(C.midGray)
       .text("No digital evidence recorded for this incident.", ML + 4, y + 3, { lineBreak: false });
    return y + h + SEC_GAP;
  }

  // Compact column widths
  const cols = [
    { label: "#",           w: 14 },
    { label: "File Name",   w: 82 },
    { label: "Type",        w: 32 },
    { label: "Collected",   w: 54 },
    { label: "SHA-256",     w: 90 },
    { label: "IPFS CID",    w: 70 },
    { label: "Fabric Tx",   w: 65 },
    { label: "Integrity",   w: 116 },
  ];
  // Adjust last col to fill remaining width
  const fixedW = cols.slice(0, -1).reduce((a, c) => a + c.w, 0);
  cols[cols.length - 1].w = CW - fixedW;

  const hdrH  = 11;
  const rowH  = 14;

  // Header
  doc.rect(ML, y, CW, hdrH).fillColor(C.sectionBg).fill();
  doc.rect(ML, y, CW, hdrH).strokeColor(C.borderGray).lineWidth(0.5).stroke();
  let cx = ML;
  cols.forEach(col => {
    doc.rect(cx, y, col.w, hdrH).strokeColor(C.borderGray).lineWidth(0.3).stroke();
    doc.fontSize(5.5).font("Helvetica-Bold").fillColor(C.darkGray)
       .text(col.label, cx + 2, y + 3, { width: col.w - 3, lineBreak: false });
    cx += col.w;
  });
  y += hdrH;

  evList.forEach((ev, idx) => {
    // page break guard within evidence table
    if (y + rowH > PH - MB) {
      // add a continuation page
      const doc2 = doc; doc2.addPage(); y = MT;
      // re-draw header
      doc2.rect(ML, y, CW, hdrH).fillColor(C.sectionBg).fill();
      doc2.rect(ML, y, CW, hdrH).strokeColor(C.borderGray).lineWidth(0.5).stroke();
      cx = ML;
      cols.forEach(col => {
        doc2.rect(cx, y, col.w, hdrH).strokeColor(C.borderGray).lineWidth(0.3).stroke();
        doc2.fontSize(5.5).font("Helvetica-Bold").fillColor(C.darkGray)
           .text(col.label, cx + 2, y + 3, { width: col.w - 3, lineBreak: false });
        cx += col.w;
      });
      y += hdrH;
    }

    const ry = y;
    if (idx % 2 === 0) doc.rect(ML, ry, CW, rowH).fillColor(C.rowAlt).fill();
    doc.rect(ML, ry, CW, rowH).strokeColor(C.borderGray).lineWidth(0.3).stroke();

    const cells = [
      String(idx + 1),
      trunc(s(ev.fileName),            18),
      trunc(s(ev.fileType),             8),
      fmtDate(ev.collectionTimestamp),
      trunc(s(ev.sha256Hash),          28),
      trunc(s(ev.ipfsCid),             20),
      trunc(s(ev.fabricTransactionId), 20),
      s(ev.verificationStatus).replace("NOT_VERIFIED","NOT VERIFIED"),
    ];

    cx = ML;
    cols.forEach((col, ci) => {
      doc.rect(cx, ry, col.w, rowH).strokeColor(C.borderGray).lineWidth(0.2).stroke();
      doc.fontSize(5.5).font("Courier").fillColor(C.black)
         .text(cells[ci], cx + 2, ry + 2.5, { width: col.w - 3, height: rowH - 4, lineGap: 0.5 });
      cx += col.w;
    });
    y += rowH;
  });

  // footnote
  doc.fontSize(5.5).font("Helvetica").fillColor(C.lightGray)
     .text("* SHA-256 / IPFS CID / Fabric Tx ID values are truncated. Full values are stored in the system database.",
           ML, y + 2, { width: CW, lineBreak: false });
  return y + 10 + SEC_GAP;
}

function drawVerificationBlock(doc, report, qrBuffer, y, qrW) {
  const infoW = CW - qrW - 6;
  const lw    = infoW * 0.40;

  const rows = [
    ["Digital Seal ID",  s(report.digitalSealId)],
    ["Verification ID",  s(report.qrVerificationId)],
    ["Report Hash",      trunc(s(report.reportHash), 46)],
    ["Verification URL", s(report.verificationUrl)],
  ];
  const tableH = rows.length * ROW_H + 4;

  // Info table
  doc.rect(ML, y, infoW, rows.length * ROW_H).strokeColor(C.borderGray).lineWidth(0.5).stroke();
  rows.forEach((row, i) => {
    const ry = y + i * ROW_H;
    if (i % 2 === 0) doc.rect(ML, ry, infoW, ROW_H).fillColor(C.rowAlt).fill();
    doc.rect(ML, ry, infoW, ROW_H).strokeColor(C.borderGray).lineWidth(0.25).stroke();
    doc.rect(ML, ry, lw, ROW_H).strokeColor(C.borderGray).lineWidth(0.2).stroke();
    doc.fontSize(6).font("Helvetica-Bold").fillColor(C.midGray)
       .text(row[0], ML + 2, ry + CELL_PAD, { width: lw - 3, lineBreak: false });
    doc.fontSize(5.5).font("Courier").fillColor(C.black)
       .text(row[1], ML + lw + 2, ry + CELL_PAD, { width: infoW - lw - 3, lineBreak: false });
  });

  // QR code
  const qrX = ML + infoW + 6;
  const qrY = y;
  if (qrBuffer) {
    doc.image(qrBuffer, qrX, qrY, { width: qrW, height: qrW });
    doc.fontSize(6).font("Helvetica-Bold").fillColor(C.darkGray)
       .text("SCAN TO VERIFY", qrX, qrY + qrW + 2, { width: qrW, align: "center", lineBreak: false });
    doc.fontSize(5).font("Helvetica").fillColor(C.midGray)
       .text("this report", qrX, qrY + qrW + 10, { width: qrW, align: "center", lineBreak: false });
  } else {
    doc.rect(qrX, qrY, qrW, qrW).strokeColor(C.borderGray).lineWidth(0.5).stroke();
    doc.fontSize(6).font("Helvetica").fillColor(C.midGray)
       .text("QR unavailable", qrX, qrY + qrW / 2 - 4, { width: qrW, align: "center", lineBreak: false });
  }

  return y + Math.max(rows.length * ROW_H, qrW + 14) + SEC_GAP;
}

function drawDigitalSeal(doc, report, y) {
  const sW = 160, sH = 46;
  const sX = ML + CW - sW;
  const dateStr = report.generatedAt
    ? new Date(report.generatedAt).toISOString().split("T")[0] : "";

  doc.rect(sX, y, sW, sH).strokeColor("#333333").lineWidth(1).stroke();
  doc.rect(sX + 2, y + 2, sW - 4, sH - 4).strokeColor(C.borderGray).lineWidth(0.4).stroke();
  doc.rect(sX + 2, y + 2, sW - 4, 11).fillColor(C.sectionBg).fill();

  doc.fontSize(6).font("Helvetica-Bold").fillColor(C.darkGray)
     .text("CYBERSECURITY INCIDENT LEDGER", sX + 2, y + 4, { width: sW - 4, align: "center", lineBreak: false });

  doc.fontSize(8).font("Helvetica-Bold").fillColor(C.titleNavy)
     .text("DIGITALLY GENERATED", sX + 2, y + 16, { width: sW - 4, align: "center", lineBreak: false });

  doc.fontSize(6.5).font("Helvetica").fillColor(C.midGray)
     .text("VERIFIABLE REPORT", sX + 2, y + 27, { width: sW - 4, align: "center", lineBreak: false });

  doc.fontSize(5.5).font("Courier").fillColor(C.midGray)
     .text(s(report.digitalSealId), sX + 2, y + 36, { width: sW - 4, align: "center", lineBreak: false });

  doc.fontSize(5).font("Helvetica").fillColor(C.lightGray)
     .text(`GENERATED: ${dateStr}`, sX + 2, y + 43, { width: sW - 4, align: "center", lineBreak: false });
}

function drawFooter(doc, report, pageNum, totalPages) {
  const footerY = PH - MB - 12;
  doc.moveTo(ML, footerY).lineTo(ML + CW, footerY).strokeColor(C.borderGray).lineWidth(0.4).stroke();

  const genStr = report.generatedAt
    ? new Date(report.generatedAt).toLocaleDateString("en-GB") + " " +
      new Date(report.generatedAt).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", hour12: false })
    : "";

  doc.fontSize(5.5).font("Helvetica").fillColor(C.lightGray)
     .text(
       `CYBERSECURITY INCIDENT LEDGER  ·  AUTOMATED INCIDENT REPORT  ·  ${s(report.reportNumber)}`,
       ML, footerY + 3, { width: CW * 0.68, lineBreak: false }
     );
  doc.fontSize(5.5).font("Helvetica").fillColor(C.lightGray)
     .text(
       `Generated: ${genStr}    Page ${pageNum} of ${totalPages}`,
       ML, footerY + 3, { width: CW, align: "right", lineBreak: false }
     );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF integrity verify
// ─────────────────────────────────────────────────────────────────────────────
function verifyPdfIntegrity(pdfPath, storedHash) {
  if (!fs.existsSync(pdfPath)) throw new Error("PDF file not found on disk.");
  const buf = fs.readFileSync(pdfPath);
  const currentHash = crypto.createHash("sha256").update(buf).digest("hex");
  return { intact: currentHash === storedHash, currentHash, storedHash };
}

module.exports = { generatePdfReport, verifyPdfIntegrity, REPORTS_DIR };
