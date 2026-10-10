const crypto = require("crypto");

// ─────────────────────────────────────────────────────────────────────────────
// Digital Seal Service – Phase 5 Module 4: Digital Authenticity Seal
//
// Creates an application-generated digital authenticity seal.
// Does NOT use government, police, or court insignia.
// Strictly an application-level verifiable provenance mark.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate unique digital seal identifier.
 * Format: SEAL-YYYYMMDD-XXXXXXXX (8 uppercase hex/alphanumeric chars)
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function generateDigitalSealId(date = new Date()) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `SEAL-${year}${month}${day}-${randomHex}`;
}

/**
 * Generate a clean, official-style SVG string representation of the seal.
 *
 * @param {object} params
 * @param {string} params.digitalSealId
 * @param {string} params.reportNumber
 * @param {string} params.reportId
 * @param {Date|string} params.timestamp
 * @returns {string} SVG xml string
 */
function createDigitalSealSvg({ digitalSealId, reportNumber, reportId, timestamp }) {
  const tsStr = timestamp ? new Date(timestamp).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260" width="260" height="260">
  <defs>
    <linearGradient id="sealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14b8a6" />
      <stop offset="100%" stop-color="#0d9488" />
    </linearGradient>
  </defs>

  <!-- Outer Ring with Dashes -->
  <circle cx="130" cy="130" r="124" fill="none" stroke="url(#borderGrad)" stroke-width="3" stroke-dasharray="6,4" />

  <!-- Outer Border -->
  <circle cx="130" cy="130" r="116" fill="url(#sealGrad)" stroke="#14b8a6" stroke-width="2.5" />

  <!-- Inner Concentric Ring -->
  <circle cx="130" cy="130" r="92" fill="#0b1120" stroke="#334155" stroke-width="1.5" />

  <!-- Header Banner Text -->
  <path id="curveTop" d="M 40,130 A 90,90 0 0,1 220,130" fill="none" />
  <text font-family="Arial, sans-serif" font-size="9.5" font-weight="bold" fill="#38bdf8" letter-spacing="2">
    <textPath href="#curveTop" startOffset="50%" text-anchor="middle">
      CYBERSECURITY INCIDENT LEDGER
    </textPath>
  </text>

  <!-- Central Emblem: Stylized Shield & Lock -->
  <g transform="translate(112, 82) scale(1.5)">
    <path d="M12 2L4 5v6.5c0 5 3.4 9.7 8 10.5 4.6-.8 8-5.5 8-10.5V5l-8-3z" fill="none" stroke="#2dd4bf" stroke-width="1.8" />
    <circle cx="12" cy="11.5" r="2" fill="#2dd4bf" />
    <path d="M12 13.5v3" stroke="#2dd4bf" stroke-width="1.5" stroke-linecap="round" />
  </g>

  <!-- Central Title Text -->
  <text x="130" y="142" font-family="Arial, sans-serif" font-size="11" font-weight="900" fill="#f8fafc" text-anchor="middle" letter-spacing="1.5">
    DIGITALLY GENERATED
  </text>
  <text x="130" y="156" font-family="Arial, sans-serif" font-size="8.5" font-weight="700" fill="#2dd4bf" text-anchor="middle" letter-spacing="2">
    VERIFIABLE REPORT
  </text>

  <!-- Seal Identifier & Date -->
  <rect x="52" y="166" width="156" height="18" rx="4" fill="#1e293b" stroke="#334155" stroke-width="0.8" />
  <text x="130" y="178" font-family="Courier, monospace" font-size="7.5" font-weight="bold" fill="#cbd5e1" text-anchor="middle">
    ${digitalSealId}
  </text>

  <text x="130" y="196" font-family="Arial, sans-serif" font-size="7" fill="#94a3b8" text-anchor="middle">
    AUTHENTICATED: ${tsStr}
  </text>

  <!-- Stars -->
  <text x="75" y="132" font-size="10" fill="#2dd4bf">★</text>
  <text x="175" y="132" font-size="10" fill="#2dd4bf">★</text>

  <!-- Bottom Subtitle -->
  <path id="curveBottom" d="M 40,130 A 90,90 0 0,0 220,130" fill="none" />
  <text font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#94a3b8" letter-spacing="2">
    <textPath href="#curveBottom" startOffset="50%" text-anchor="middle">
      TAMPER-EVIDENT LEDGER AUDIT
    </textPath>
  </text>
</svg>`;
}

/**
 * Draw a high-resolution vector digital seal directly on a PDFKit document.
 * Avoids any external image converter and guarantees crisp vector output.
 *
 * @param {object} doc - PDFKit Document instance
 * @param {number} cx  - Center X coordinate
 * @param {number} cy  - Center Y coordinate
 * @param {number} r   - Radius (e.g. 55)
 * @param {object} data - Seal metadata { digitalSealId, reportNumber, date }
 */
function drawDigitalSealOnPdf(doc, cx, cy, r = 55, data = {}) {
  const sealId = data.digitalSealId || "SEAL-00000000-000000";
  const dateStr = data.date ? new Date(data.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

  doc.save();

  // Outer dashed circle
  doc.circle(cx, cy, r)
     .lineWidth(1.8)
     .dash(4, { space: 3 })
     .strokeColor("#0d9488")
     .stroke();

  // Outer solid ring
  doc.circle(cx, cy, r - 4)
     .undash()
     .lineWidth(2.5)
     .strokeColor("#14b8a6")
     .fillColor("#0f172a")
     .fillAndStroke();

  // Inner dark circle
  doc.circle(cx, cy, r - 16)
     .lineWidth(1)
     .strokeColor("#334155")
     .fillColor("#0b1120")
     .fillAndStroke();

  // Decorative stars
  doc.fontSize(8).fillColor("#2dd4bf");
  doc.text("★", cx - r + 8, cy - 5, { width: 14, align: "center" });
  doc.text("★", cx + r - 22, cy - 5, { width: 14, align: "center" });

  // Seal Top Text
  doc.fontSize(6)
     .fillColor("#38bdf8")
     .font("Helvetica-Bold")
     .text("CYBERSECURITY INCIDENT LEDGER", cx - r + 16, cy - r + 18, {
       width: (r - 16) * 2,
       align: "center",
     });

  // Center Shield Icon (Vector Path)
  const sx = cx - 8;
  const sy = cy - 24;
  doc.save();
  doc.lineWidth(1.2).strokeColor("#2dd4bf");
  doc.moveTo(sx + 8, sy)
     .lineTo(sx + 2, sy + 3)
     .lineTo(sx + 2, sy + 9)
     .bezierCurveTo(sx + 2, sy + 14, sx + 5, sy + 17, sx + 8, sy + 18)
     .bezierCurveTo(sx + 11, sy + 17, sx + 14, sy + 14, sx + 14, sy + 9)
     .lineTo(sx + 14, sy + 3)
     .closePath()
     .stroke();
  doc.circle(sx + 8, sy + 8, 1.8).fillColor("#2dd4bf").fill();
  doc.restore();

  // Center Main Text
  doc.fontSize(7.5)
     .font("Helvetica-Bold")
     .fillColor("#ffffff")
     .text("DIGITALLY GENERATED", cx - r + 16, cy - 3, {
       width: (r - 16) * 2,
       align: "center",
     });

  doc.fontSize(6)
     .font("Helvetica-Bold")
     .fillColor("#2dd4bf")
     .text("VERIFIABLE REPORT", cx - r + 16, cy + 7, {
       width: (r - 16) * 2,
       align: "center",
     });

  // Seal ID badge rectangle
  const bW = r * 1.5;
  const bH = 11;
  doc.rect(cx - bW / 2, cy + 16, bW, bH)
     .fillColor("#1e293b")
     .strokeColor("#334155")
     .lineWidth(0.6)
     .fillAndStroke();

  doc.fontSize(5.5)
     .font("Courier-Bold")
     .fillColor("#cbd5e1")
     .text(sealId, cx - bW / 2, cy + 18.5, {
       width: bW,
       align: "center",
     });

  // Timestamp and bottom text
  doc.fontSize(5)
     .font("Helvetica")
     .fillColor("#94a3b8")
     .text(`DATE: ${dateStr}`, cx - r + 16, cy + 29, {
       width: (r - 16) * 2,
       align: "center",
     });

  doc.fontSize(5)
     .font("Helvetica-Bold")
     .fillColor("#64748b")
     .text("APPLICATION AUTHENTICATED", cx - r + 16, cy + r - 15, {
       width: (r - 16) * 2,
       align: "center",
     });

  doc.restore();
}

module.exports = {
  generateDigitalSealId,
  createDigitalSealSvg,
  drawDigitalSealOnPdf,
};
