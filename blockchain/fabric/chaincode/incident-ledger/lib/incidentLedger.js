/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

/**
 * IncidentLedger Smart Contract
 * Phase 4 Module 5: Hyperledger Fabric chaincode for evidence integrity
 *
 * Stores and verifies tamper-evident evidence metadata on Hyperledger Fabric.
 *
 * DATA STORED ON FABRIC:
 * - incidentId:           string (Associated incident identifier)
 * - evidenceId:           string (Unique evidence identifier)
 * - ipfsCid:              string (IPFS content identifier / Pinata CID)
 * - sha256Hash:           string (Cryptographic SHA-256 hash of the evidence file)
 * - recordedBy:           string (Identity/Analyst recording the evidence)
 * - recordedAt:           string (Timestamp of recording)
 * - fabricTransactionId:  string (Hyperledger Fabric transaction ID from ctx.stub.getTxID())
 *
 * NOTE: The actual evidence file is NOT stored on Fabric; only immutable metadata
 * and cryptographic proof (SHA-256 + IPFS CID) are committed to the ledger.
 */
class IncidentLedger extends Contract {

  constructor() {
    super('IncidentLedger');
  }

  /**
   * 1. registerEvidence
   * Records evidence integrity metadata on the ledger.
   *
   * Validations:
   * - incidentId required
   * - evidenceId required
   * - ipfsCid required
   * - sha256Hash required
   * - sha256Hash must be valid 64-char hexadecimal SHA-256 format
   * - duplicate evidenceId must be rejected (no silent overwrite)
   *
   * @param {Context} ctx The transaction context
   * @param {string} incidentId Associated incident ID
   * @param {string} evidenceId Unique evidence ID
   * @param {string} ipfsCid IPFS CID where the evidence file is hosted
   * @param {string} sha256Hash SHA-256 checksum of raw evidence file
   * @param {string} recordedBy Identity registering the record
   * @param {string} [recordedAt] Optional ISO timestamp (defaults to transaction timestamp)
   * @returns {string} JSON string of the committed evidence record
   */
  async registerEvidence(ctx, incidentId, evidenceId, ipfsCid, sha256Hash, recordedBy, recordedAt) {
    // ── Validation: incidentId ──────────────────────────────────────────────
    if (!incidentId || typeof incidentId !== 'string' || incidentId.trim().length === 0) {
      throw new Error('incidentId is required and must be a non-empty string.');
    }

    // ── Validation: evidenceId ──────────────────────────────────────────────
    if (!evidenceId || typeof evidenceId !== 'string' || evidenceId.trim().length === 0) {
      throw new Error('evidenceId is required and must be a non-empty string.');
    }

    // ── Validation: ipfsCid ─────────────────────────────────────────────────
    if (!ipfsCid || typeof ipfsCid !== 'string' || ipfsCid.trim().length === 0) {
      throw new Error('ipfsCid is required and must be a non-empty string.');
    }

    // ── Validation: sha256Hash ──────────────────────────────────────────────
    if (!sha256Hash || typeof sha256Hash !== 'string' || sha256Hash.trim().length === 0) {
      throw new Error('sha256Hash is required and must be a non-empty string.');
    }

    // ── Validation: sha256Hash format (64 hex characters) ───────────────────
    const sha256Regex = /^[a-fA-F0-9]{64}$/;
    const cleanHash = sha256Hash.trim().toLowerCase();
    if (!sha256Regex.test(cleanHash)) {
      throw new Error(`Invalid sha256Hash format: "${sha256Hash}". Must be a 64-character hexadecimal SHA-256 string.`);
    }

    const cleanEvidenceId = evidenceId.trim();
    const cleanIncidentId = incidentId.trim();

    // ── Validation: Reject duplicate evidenceId (Do not allow overwriting) ──
    const exists = await this.evidenceExists(ctx, cleanEvidenceId);
    if (exists) {
      throw new Error(`Evidence with ID "${cleanEvidenceId}" already exists on the ledger. Existing blockchain records cannot be overwritten.`);
    }

    // ── Extract Fabric Transaction ID ───────────────────────────────────────
    const fabricTransactionId = ctx.stub.getTxID();

    // ── Resolve Timestamp ───────────────────────────────────────────────────
    let timestamp = recordedAt ? recordedAt.trim() : null;
    if (!timestamp) {
      try {
        const txTimestamp = ctx.stub.getTxTimestamp();
        if (txTimestamp && txTimestamp.seconds) {
          const sec = txTimestamp.seconds.low !== undefined ? txTimestamp.seconds.low : txTimestamp.seconds;
          const nanos = txTimestamp.nanos || 0;
          timestamp = new Date(sec * 1000 + nanos / 1000000).toISOString();
        } else {
          timestamp = new Date().toISOString();
        }
      } catch (err) {
        timestamp = new Date().toISOString();
      }
    }

    // ── Build Immutable Evidence Record ─────────────────────────────────────
    const evidenceRecord = {
      incidentId: cleanIncidentId,
      evidenceId: cleanEvidenceId,
      ipfsCid: ipfsCid.trim(),
      sha256Hash: cleanHash,
      recordedBy: (recordedBy && typeof recordedBy === 'string') ? recordedBy.trim() : 'ANONYMOUS',
      recordedAt: timestamp,
      fabricTransactionId: fabricTransactionId,
    };

    // ── Commit to Ledger State ──────────────────────────────────────────────
    await ctx.stub.putState(cleanEvidenceId, Buffer.from(JSON.stringify(evidenceRecord)));

    // ── Emit Event ──────────────────────────────────────────────────────────
    const eventPayload = Buffer.from(JSON.stringify({
      event: 'EVIDENCE_REGISTERED',
      incidentId: evidenceRecord.incidentId,
      evidenceId: evidenceRecord.evidenceId,
      sha256Hash: evidenceRecord.sha256Hash,
      ipfsCid: evidenceRecord.ipfsCid,
      fabricTransactionId: fabricTransactionId,
      recordedAt: evidenceRecord.recordedAt,
    }));
    ctx.stub.setEvent('EvidenceRegistered', eventPayload);

    return JSON.stringify(evidenceRecord);
  }

  /**
   * 2. getEvidence
   * Returns the blockchain evidence record for the given evidenceId.
   *
   * @param {Context} ctx The transaction context
   * @param {string} evidenceId Evidence identifier
   * @returns {string} JSON string of the evidence record
   */
  async getEvidence(ctx, evidenceId) {
    if (!evidenceId || typeof evidenceId !== 'string' || evidenceId.trim().length === 0) {
      throw new Error('evidenceId is required and must be a non-empty string.');
    }

    const cleanEvidenceId = evidenceId.trim();
    const evidenceAsBytes = await ctx.stub.getState(cleanEvidenceId);
    if (!evidenceAsBytes || evidenceAsBytes.length === 0) {
      throw new Error(`Evidence "${cleanEvidenceId}" does not exist on the ledger.`);
    }

    return evidenceAsBytes.toString('utf8');
  }

  /**
   * 3. evidenceExists
   * Checks whether an evidence record exists on the ledger.
   *
   * @param {Context} ctx The transaction context
   * @param {string} evidenceId Evidence identifier
   * @returns {boolean} True if exists, false otherwise
   */
  async evidenceExists(ctx, evidenceId) {
    if (!evidenceId || typeof evidenceId !== 'string' || evidenceId.trim().length === 0) {
      return false;
    }

    const cleanEvidenceId = evidenceId.trim();
    const evidenceAsBytes = await ctx.stub.getState(cleanEvidenceId);
    return Boolean(evidenceAsBytes && evidenceAsBytes.length > 0);
  }

  /**
   * 4. verifyEvidenceHash
   * Compares the stored blockchain hash with the current hash.
   *
   * @param {Context} ctx The transaction context
   * @param {string} evidenceId Evidence identifier
   * @param {string} currentHash Current computed SHA-256 hash
   * @returns {string} "VERIFIED" if matching, "TAMPERED" if mismatched
   */
  async verifyEvidenceHash(ctx, evidenceId, currentHash) {
    if (!evidenceId || typeof evidenceId !== 'string' || evidenceId.trim().length === 0) {
      throw new Error('evidenceId is required and must be a non-empty string.');
    }

    if (!currentHash || typeof currentHash !== 'string' || currentHash.trim().length === 0) {
      throw new Error('currentHash is required and must be a non-empty string.');
    }

    const cleanEvidenceId = evidenceId.trim();
    const cleanCurrentHash = currentHash.trim().toLowerCase();

    const evidenceJson = await this.getEvidence(ctx, cleanEvidenceId);
    const evidence = JSON.parse(evidenceJson);

    const storedHash = (evidence.sha256Hash || '').toLowerCase();
    const isVerified = storedHash === cleanCurrentHash;
    const result = isVerified ? 'VERIFIED' : 'TAMPERED';

    // Emit verification event for audit loggers
    try {
      ctx.stub.setEvent('EvidenceVerified', Buffer.from(JSON.stringify({
        evidenceId: cleanEvidenceId,
        status: result,
        storedHash: storedHash,
        currentHash: cleanCurrentHash,
        txId: ctx.stub.getTxID(),
      })));
    } catch (err) {
      // Event emission non-fatal during query context
    }

    return result;
  }

  /**
   * 5. getEvidenceHistory
   * Returns the complete blockchain transaction history for the evidence record.
   *
   * @param {Context} ctx The transaction context
   * @param {string} evidenceId Evidence identifier
   * @returns {string} JSON array of history entries
   */
  async getEvidenceHistory(ctx, evidenceId) {
    if (!evidenceId || typeof evidenceId !== 'string' || evidenceId.trim().length === 0) {
      throw new Error('evidenceId is required and must be a non-empty string.');
    }

    const cleanEvidenceId = evidenceId.trim();
    const iterator = await ctx.stub.getHistoryForKey(cleanEvidenceId);
    const history = [];

    let result = await iterator.next();
    while (!result.done) {
      const item = result.value;
      let recordValue = null;

      if (item.value && item.value.length > 0) {
        try {
          recordValue = JSON.parse(item.value.toString('utf8'));
        } catch (e) {
          recordValue = item.value.toString('utf8');
        }
      }

      let timestamp = null;
      if (item.timestamp) {
        const sec = item.timestamp.seconds.low !== undefined ? item.timestamp.seconds.low : item.timestamp.seconds;
        const nanos = item.timestamp.nanos || 0;
        timestamp = new Date(sec * 1000 + nanos / 1000000).toISOString();
      }

      history.push({
        txId: item.txId,
        timestamp: timestamp,
        isDelete: Boolean(item.isDelete),
        value: recordValue,
      });

      result = await iterator.next();
    }

    if (typeof iterator.close === 'function') {
      await iterator.close();
    }

    return JSON.stringify(history);
  }

  /**
   * 6. getIncidentEvidence
   * Returns all evidence registered for an incident.
   *
   * Compatible with both CouchDB (rich selector query) and LevelDB (state range scan).
   *
   * @param {Context} ctx The transaction context
   * @param {string} incidentId Associated incident identifier
   * @returns {string} JSON array of matching evidence records
   */
  async getIncidentEvidence(ctx, incidentId) {
    if (!incidentId || typeof incidentId !== 'string' || incidentId.trim().length === 0) {
      throw new Error('incidentId is required and must be a non-empty string.');
    }

    const targetIncidentId = incidentId.trim();
    let allResults = [];

    // Strategy A: CouchDB rich query
    let richQuerySucceeded = false;
    try {
      const queryString = JSON.stringify({
        selector: {
          incidentId: targetIncidentId,
        },
      });

      const iterator = await ctx.stub.getQueryResult(queryString);
      let res = await iterator.next();
      while (!res.done) {
        if (res.value && res.value.value && res.value.value.length > 0) {
          try {
            allResults.push(JSON.parse(res.value.value.toString('utf8')));
          } catch (e) {
            // Non-JSON state entry, skip
          }
        }
        res = await iterator.next();
      }

      if (typeof iterator.close === 'function') {
        await iterator.close();
      }
      richQuerySucceeded = true;
    } catch (err) {
      // CouchDB not available or not supported on this stub, fall back to range scan
      richQuerySucceeded = false;
    }

    // Strategy B: LevelDB / mock stub range scan fallback
    if (!richQuerySucceeded) {
      allResults = [];
      const iterator = await ctx.stub.getStateByRange('', '');
      let res = await iterator.next();
      while (!res.done) {
        if (res.value && res.value.value && res.value.value.length > 0) {
          try {
            const record = JSON.parse(res.value.value.toString('utf8'));
            if (record && record.incidentId === targetIncidentId) {
              allResults.push(record);
            }
          } catch (e) {
            // Non-JSON or metadata record, skip
          }
        }
        res = await iterator.next();
      }

      if (typeof iterator.close === 'function') {
        await iterator.close();
      }
    }

    return JSON.stringify(allResults);
  }
}

module.exports = IncidentLedger;
