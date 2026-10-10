'use strict';

const { Contract } = require('fabric-contract-api');

/**
 * IncidentLedgerContract — Hyperledger Fabric Smart Contract
 * Phase 4 Module 4: CyberSecurity Incident Ledger
 *
 * Stores tamper-evident evidence metadata on the Fabric ledger.
 * All transaction details are immutably stored with block number, tx ID, and timestamp.
 *
 * Evidence Asset Schema:
 * {
 *   evidenceId:    string  — Unique evidence ID (EVD-YYYYMMDD-XXXXXX)
 *   incidentId:    string  — Associated incident ID (INC-YYYYMMDD-XXXXXX)
 *   sha256Hash:    string  — SHA-256 hash of the evidence file
 *   ipfsCid:       string  — Pinata/IPFS CID
 *   fileName:      string  — Original file name
 *   fileType:      string  — MIME type / file type
 *   fileSize:      number  — File size in bytes
 *   recordedBy:    string  — Identity that submitted the record
 *   timestamp:     string  — ISO 8601 timestamp
 *   description:   string  — Evidence description
 *   status:        string  — ACTIVE | FLAGGED | REVOKED
 * }
 */

class IncidentLedgerContract extends Contract {

  constructor() {
    super('IncidentLedgerContract');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // InitLedger — Initialize the ledger with genesis state
  // ─────────────────────────────────────────────────────────────────────────
  async InitLedger(ctx) {
    const genesis = {
      evidenceId: 'GENESIS-00000000-000000',
      incidentId: 'SYSTEM',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      ipfsCid: 'Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD',
      fileName: 'genesis.log',
      fileType: 'text/plain',
      fileSize: 0,
      recordedBy: 'SYSTEM',
      timestamp: new Date().toISOString(),
      description: 'Genesis evidence record — CyberSecurity Incident Ledger initialized',
      status: 'ACTIVE',
    };

    await ctx.stub.putState(
      genesis.evidenceId,
      Buffer.from(JSON.stringify(genesis))
    );

    console.log('[FABRIC LEDGER] Genesis block written. Incident Ledger chaincode initialized.');
    return JSON.stringify(genesis);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RecordEvidence — Write tamper-evident evidence metadata to the ledger
  // ─────────────────────────────────────────────────────────────────────────
  async RecordEvidence(
    ctx,
    evidenceId,
    incidentId,
    sha256Hash,
    ipfsCid,
    fileName,
    fileType,
    fileSize,
    recordedBy,
    description
  ) {
    const existing = await ctx.stub.getState(evidenceId);
    if (existing && existing.length > 0) {
      throw new Error(`Evidence ${evidenceId} already exists on the ledger. Use UpdateEvidenceStatus to modify.`);
    }

    const txId    = ctx.stub.getTxID();
    const txTimestamp = ctx.stub.getTxTimestamp();
    const isoTime = new Date(
      txTimestamp.seconds.low * 1000
    ).toISOString();

    const asset = {
      evidenceId,
      incidentId,
      sha256Hash,
      ipfsCid,
      fileName,
      fileType,
      fileSize: parseInt(fileSize) || 0,
      recordedBy,
      description: description || '',
      timestamp: isoTime,
      fabricTxId: txId,
      status: 'ACTIVE',
    };

    await ctx.stub.putState(evidenceId, Buffer.from(JSON.stringify(asset)));

    // Emit a Fabric event that external listeners can receive in real-time
    const eventPayload = {
      event:      'EvidenceRecorded',
      evidenceId,
      incidentId,
      sha256Hash,
      ipfsCid,
      fabricTxId: txId,
      timestamp:  isoTime,
      recordedBy,
    };
    await ctx.stub.setEvent(
      'EvidenceRecorded',
      Buffer.from(JSON.stringify(eventPayload))
    );

    console.log(`[FABRIC LEDGER] Evidence recorded: ${evidenceId} | TxID: ${txId} | Hash: ${sha256Hash}`);
    return JSON.stringify(asset);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GetEvidence — Retrieve a single evidence record by ID
  // ─────────────────────────────────────────────────────────────────────────
  async GetEvidence(ctx, evidenceId) {
    const data = await ctx.stub.getState(evidenceId);
    if (!data || data.length === 0) {
      throw new Error(`Evidence ${evidenceId} does not exist on the ledger.`);
    }
    const asset = JSON.parse(data.toString());
    console.log(`[FABRIC LEDGER] Evidence queried: ${evidenceId} | Hash: ${asset.sha256Hash}`);
    return JSON.stringify(asset);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VerifyEvidence — Verify a file's current hash against the immutable ledger hash
  // ─────────────────────────────────────────────────────────────────────────
  async VerifyEvidence(ctx, evidenceId, currentHash) {
    const data = await ctx.stub.getState(evidenceId);
    if (!data || data.length === 0) {
      throw new Error(`Evidence ${evidenceId} not found on ledger.`);
    }

    const asset = JSON.parse(data.toString());
    const match = asset.sha256Hash === currentHash;

    const result = {
      evidenceId,
      ledgerHash:   asset.sha256Hash,
      providedHash: currentHash,
      verified:     match,
      timestamp:    new Date().toISOString(),
      fabricTxId:   ctx.stub.getTxID(),
      status:       match ? 'INTEGRITY_CONFIRMED' : 'INTEGRITY_VIOLATION_DETECTED',
    };

    if (!match) {
      console.error(`[FABRIC LEDGER] ⚠ INTEGRITY VIOLATION: Evidence ${evidenceId} — Hash mismatch!`);
      // Emit tamper alert event
      await ctx.stub.setEvent(
        'IntegrityViolation',
        Buffer.from(JSON.stringify({ ...result, event: 'IntegrityViolation' }))
      );
    } else {
      console.log(`[FABRIC LEDGER] ✓ Integrity verified: ${evidenceId}`);
    }

    return JSON.stringify(result);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GetIncidentEvidence — Get all evidence assets associated with an incident
  // ─────────────────────────────────────────────────────────────────────────
  async GetIncidentEvidence(ctx, incidentId) {
    const iterator = await ctx.stub.getStateByRange('', '');
    const results = [];

    let result = await iterator.next();
    while (!result.done) {
      const data = result.value.value.toString('utf8');
      try {
        const asset = JSON.parse(data);
        if (asset.incidentId === incidentId) {
          results.push(asset);
        }
      } catch (_) { /* skip non-JSON entries */ }
      result = await iterator.next();
    }

    console.log(`[FABRIC LEDGER] Query: ${results.length} evidence records for incident ${incidentId}`);
    return JSON.stringify(results);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GetEvidenceHistory — Full provenance & audit trail from block history
  // ─────────────────────────────────────────────────────────────────────────
  async GetEvidenceHistory(ctx, evidenceId) {
    const iterator = await ctx.stub.getHistoryForKey(evidenceId);
    const history = [];

    let result = await iterator.next();
    while (!result.done) {
      const entry = {
        txId:      result.value.txId,
        timestamp: new Date(result.value.timestamp.seconds.low * 1000).toISOString(),
        isDelete:  result.value.isDelete,
        value:     null,
      };

      if (!result.value.isDelete && result.value.value) {
        try {
          entry.value = JSON.parse(result.value.value.toString('utf8'));
        } catch (_) {
          entry.value = result.value.value.toString('utf8');
        }
      }

      history.push(entry);
      result = await iterator.next();
    }

    console.log(`[FABRIC LEDGER] History for ${evidenceId}: ${history.length} tx(s)`);
    return JSON.stringify(history);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UpdateEvidenceStatus — Admin: flag or revoke evidence
  // ─────────────────────────────────────────────────────────────────────────
  async UpdateEvidenceStatus(ctx, evidenceId, newStatus, reason) {
    const validStatuses = ['ACTIVE', 'FLAGGED', 'REVOKED'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status "${newStatus}". Must be: ACTIVE, FLAGGED, or REVOKED.`);
    }

    const data = await ctx.stub.getState(evidenceId);
    if (!data || data.length === 0) {
      throw new Error(`Evidence ${evidenceId} not found.`);
    }

    const asset = JSON.parse(data.toString());
    asset.status = newStatus;
    asset.statusReason = reason || '';
    asset.statusUpdatedAt = new Date().toISOString();
    asset.statusUpdatedByTx = ctx.stub.getTxID();

    await ctx.stub.putState(evidenceId, Buffer.from(JSON.stringify(asset)));

    console.log(`[FABRIC LEDGER] Evidence ${evidenceId} status updated to ${newStatus}`);

    await ctx.stub.setEvent(
      'EvidenceStatusUpdated',
      Buffer.from(JSON.stringify({ event: 'EvidenceStatusUpdated', evidenceId, newStatus, reason }))
    );

    return JSON.stringify(asset);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GetAllEvidence — List all evidence records on the ledger (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async GetAllEvidence(ctx) {
    const iterator = await ctx.stub.getStateByRange('', '');
    const results  = [];

    let result = await iterator.next();
    while (!result.done) {
      const data = result.value.value.toString('utf8');
      try {
        const asset = JSON.parse(data);
        results.push(asset);
      } catch (_) { /* skip */ }
      result = await iterator.next();
    }

    console.log(`[FABRIC LEDGER] GetAllEvidence: ${results.length} records`);
    return JSON.stringify(results);
  }
}

module.exports = { IncidentLedgerContract };
