// ─────────────────────────────────────────────────────────────────────────────
// Report Summary Service – Phase 5 Module 1: AI-Driven Report Narrative
//
// Compiles the AI analysis fields from an existing Incident record into a
// structured, readable summary for the PDF report.
// Never invents data; falls back to "Not Available" for missing fields.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a plain-text AI executive summary from incident AI fields.
 * Reuses aiExplanation and recommendedAction that were already written by
 * aiThreatAnalysisService during log ingestion — no second AI call needed.
 *
 * @param {object} incident – Populated Mongoose Incident document
 * @returns {object} { aiSummary, aiExplanation, recommendedAction }
 */
function buildAiSummary(incident) {
  if (!incident) {
    return {
      aiSummary: "Not Available",
      aiExplanation: "Not Available",
      recommendedAction: "Not Available",
    };
  }

  const attackType     = incident.attackType     || "Unknown Attack";
  const severity       = incident.severity       || "UNKNOWN";
  const threatCat      = incident.threatCategory || "General Threat";
  const riskScore      = typeof incident.riskScore === "number" ? incident.riskScore : "N/A";
  const explanation    = incident.aiExplanation  || "";
  const recommendation = incident.recommendedAction || "";

  // ── Compose a one-paragraph executive summary ─────────────────────────────
  const summaryParts = [
    `This report documents a ${severity} severity ${attackType} classified under "${threatCat}".`,
  ];

  if (typeof riskScore === "number") {
    summaryParts.push(`The computed risk score is ${riskScore}/100.`);
  }

  if (explanation && explanation.trim().length > 0) {
    summaryParts.push(explanation.trim());
  }

  const aiSummary = summaryParts.join(" ");

  return {
    aiSummary,
    aiExplanation:     explanation    || "Not Available",
    recommendedAction: recommendation || "Not Available",
  };
}

/**
 * Build the investigation narrative (root cause, actions taken, resolution).
 * Reads directly from incident fields. Never fabricates data.
 *
 * @param {object} incident
 * @returns {object} { investigationSummary, rootCause, actionTaken, resolutionSummary }
 */
function buildInvestigationNarrative(incident) {
  if (!incident) {
    return {
      investigationSummary: "Not Available",
      rootCause:            "Not Available",
      actionTaken:          "Not Available",
      resolutionSummary:    "Not Available",
    };
  }

  // Combine investigationNotes sources (plain string or structured notes array)
  let investigationSummary = "Not Available";
  if (incident.investigationNotes && incident.investigationNotes.trim()) {
    investigationSummary = incident.investigationNotes.trim();
  } else if (Array.isArray(incident.notes) && incident.notes.length > 0) {
    investigationSummary = incident.notes
      .map((n) => `[${new Date(n.timestamp).toISOString().split("T")[0]}] ${n.author}: ${n.note}`)
      .join("\n");
  }

  return {
    investigationSummary,
    rootCause:         incident.rootCause        || "Not Available",
    actionTaken:       incident.actionTaken       || "Not Available",
    resolutionSummary: incident.resolutionSummary || "Not Available",
  };
}

module.exports = {
  buildAiSummary,
  buildInvestigationNarrative,
};
