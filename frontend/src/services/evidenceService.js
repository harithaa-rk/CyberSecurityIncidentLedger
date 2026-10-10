import API from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// Frontend Evidence Service – Phase 4 Module 1
//
// All IDs used here are incidentId (EVD-/INC- format or MongoDB _id) as
// returned from the backend.  The frontend NEVER generates evidenceId,
// collectedBy, or collectionTimestamp — those come exclusively from the API.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all evidence records for a given incident.
 * @param {string} incidentId  - MongoDB _id or human-readable INC-… string
 * @returns {Promise<{ incidentId, evidenceCount, evidence: Array }>}
 */
export const getEvidenceForIncident = async (incidentId) => {
  const response = await API.get(`/incidents/${incidentId}/evidence`);
  return response.data;
};

/**
 * Fetch a single evidence record.
 * @param {string} evidenceId  - EVD-… or MongoDB _id
 * @returns {Promise<{ evidence: object }>}
 */
export const getEvidenceById = async (evidenceId) => {
  const response = await API.get(`/evidence/${evidenceId}`);
  return response.data;
};

/**
 * Upload and collect evidence for an incident.
 *
 * @param {string} incidentId   - MongoDB _id or INC-… string of the parent incident
 * @param {File}   file         - Browser File object selected by user
 * @param {string} description  - Optional analyst description (max 2000 chars)
 * @param {function} onProgress - Optional progress callback (0–100)
 * @returns {Promise<{ message, evidenceId, evidence: object }>}
 */
export const uploadEvidence = async (incidentId, file, description = "", onProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  if (description.trim()) {
    formData.append("description", description.trim().slice(0, 2000));
  }

  const response = await API.post(`/incidents/${incidentId}/evidence`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return response.data;
};

/**
 * Delete an evidence record (only if not yet registered on blockchain).
 * @param {string} evidenceId  - EVD-… or MongoDB _id
 * @returns {Promise<{ message: string }>}
 */
export const deleteEvidence = async (evidenceId) => {
  const response = await API.delete(`/evidence/${evidenceId}`);
  return response.data;
};

/**
 * Fetch SHA-256 cryptographic hash and status for an evidence record.
 * @param {string} evidenceId  - EVD-… or MongoDB _id
 * @returns {Promise<{ evidenceId: string, sha256Hash: string, hashStatus: string }>}
 */
export const getEvidenceHash = async (evidenceId) => {
  const response = await API.get(`/evidence/${evidenceId}/hash`);
  return response.data;
};

/**
 * Upload evidence file to Pinata/IPFS and persist the CID.
 * @param {string} evidenceId  - EVD-… or MongoDB _id
 * @returns {Promise<{ evidenceId: string, ipfsCid: string, sha256Hash: string, storageStatus: string }>}
 */
export const uploadEvidenceToIpfs = async (evidenceId) => {
  const response = await API.post(`/evidence/${evidenceId}/upload-ipfs`);
  return response.data;
};

/**
 * Safely fetch evidence file as a Blob using backend authenticated retrieval.
 * Avoids exposing any Pinata or storage credentials to the client.
 * @param {string} evidenceId  - EVD-… or MongoDB _id
 * @returns {Promise<{ blob: Blob, mimeType: string, filename: string }>}
 */
export const fetchEvidenceBlob = async (evidenceId) => {
  const response = await API.get(`/evidence/${evidenceId}/view`, {
    responseType: "blob",
  });
  const mimeType = response.headers["content-type"] || "application/octet-stream";
  const disposition = response.headers["content-disposition"] || "";
  let filename = "evidence-file";
  const match = disposition.match(/filename="?([^";]+)"?/);
  if (match && match[1]) {
    filename = decodeURIComponent(match[1]);
  }
  return { blob: response.data, mimeType, filename };
};

/**
 * Register evidence on Hyperledger Fabric (Phase 4 Module 7).
 * @param {string} evidenceId - EVD-… or MongoDB _id
 * @returns {Promise<{ message, evidenceId, fabricTransactionId, fabricRecordedAt, blockchainStatus }>}
 */
export const registerEvidenceOnBlockchain = async (evidenceId) => {
  const response = await API.post(`/evidence/${evidenceId}/register-blockchain`);
  return response.data;
};

/**
 * Fetch live ledger record and history from Hyperledger Fabric.
 * @param {string} evidenceId - EVD-… or MongoDB _id
 * @returns {Promise<{ evidenceId, record, history }>}
 */
export const getBlockchainRecord = async (evidenceId) => {
  const response = await API.get(`/evidence/${evidenceId}/blockchain-record`);
  return response.data;
};

/**
 * Verify evidence integrity by retrieving file from IPFS, computing SHA-256,
 * and comparing against Hyperledger Fabric on-chain hash (Phase 4 Module 8).
 * @param {string} evidenceId - EVD-… or MongoDB _id
 * @returns {Promise<{ evidenceId: string, blockchainHash: string, currentHash: string, verificationStatus: 'VERIFIED'|'TAMPERED', lastVerifiedAt: string, lastVerifiedBy: string }>}
 */
export const verifyEvidenceIntegrity = async (evidenceId) => {
  const response = await API.post(`/evidence/${evidenceId}/verify`);
  return response.data;
};



