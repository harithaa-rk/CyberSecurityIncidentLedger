const crypto = require("crypto");
const QRCode = require("qrcode");

// ─────────────────────────────────────────────────────────────────────────────
// QR Verification Service – Phase 5 Module 5: Verification URL & QR Generator
//
// Creates verifiable URLs and scannable QR codes pointing to the public
// report integrity verification page.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate unique QR verification identifier.
 * Format: VRF-YYYYMMDD-XXXXXXXX (8 uppercase alphanumeric characters)
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function generateQrVerificationId(date = new Date()) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `VRF-${year}${month}${day}-${randomHex}`;
}

/**
 * Build verification URL using environment variable base URL.
 * Never hardcodes production URLs.
 *
 * @param {string} reportNumber - CSR-YYYYMMDD-XXXXXX
 * @returns {string} Fully qualified verification URL
 */
function buildVerificationUrl(reportNumber) {
  const baseUrl = (
    process.env.REPORT_VERIFICATION_BASE_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");

  return `${baseUrl}/verify/${encodeURIComponent(reportNumber)}`;
}

/**
 * Generate a PNG Buffer of the QR code containing the verification URL.
 *
 * @param {string} verificationUrl
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateQrCodeBuffer(verificationUrl) {
  if (!verificationUrl) {
    throw new Error("Verification URL is required to generate QR code.");
  }

  const options = {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6,           // higher scale → crisper when printed
    color: {
      dark:  "#111111", // near-black modules – readable on light paper
      light: "#FFFFFF", // pure white background
    },
  };

  return await QRCode.toBuffer(verificationUrl, options);
}

module.exports = {
  generateQrVerificationId,
  buildVerificationUrl,
  generateQrCodeBuffer,
};
