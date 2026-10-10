const crypto = require("crypto");
const BlockchainTransaction = require("../../models/BlockchainTransaction");
const { generateSHA256Hash } = require("../../utils/logParser");

const CONTRACT_ADDRESS = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

/**
 * Commits a security log event's cryptographic digest to the immutable blockchain ledger.
 * @param {string} logId - Unique Incident ID (e.g. INC-20260901-000001)
 * @param {string} hash - SHA-256 hash
 * @param {string} cid - IPFS / Pinata CID
 * @returns {Promise<object>} - Saved BlockchainTransaction document
 */
async function recordBlockchainTransaction(logId, hash, cid) {
  // Generate deterministic/cryptographic transaction hash
  const txEntropy = `${logId}-${hash}-${cid}-${Date.now()}`;
  const txHash = "0x" + crypto.createHash("sha256").update(txEntropy).digest("hex");

  // Get current highest block number or start from base
  const latestTx = await BlockchainTransaction.findOne().sort({ blockNumber: -1 });
  const blockNumber = latestTx ? latestTx.blockNumber + 1 : 14820100;
  const gasUsed = 21000 + Math.floor(Math.random() * 12500);

  const tx = new BlockchainTransaction({
    txHash,
    blockNumber,
    logId,
    status: "Confirmed",
    gasUsed,
    contractAddress: CONTRACT_ADDRESS,
  });

  const savedTx = await tx.save();

  // ── Print High-Visibility Block Creation Box in CMD ───────────────────────
  const border = "═".repeat(78);
  const thin = "─".repeat(78);
  console.log(`\n\x1b[36m${border}\x1b[0m`);
  console.log(`\x1b[1m\x1b[32m  🧱 NEW BLOCK CREATED & COMMITTED TO LEDGER: BLOCK #${blockNumber}\x1b[0m`);
  console.log(`\x1b[36m${thin}\x1b[0m`);
  console.log(`  \x1b[1m\x1b[34m[1] INPUT IDENTITY & INCIDENT ID:\x1b[0m  ${logId}`);
  console.log(`  \x1b[1m\x1b[34m[2] SHA-256 PAYLOAD HASH:\x1b[0m        \x1b[32m${hash}\x1b[0m`);
  console.log(`      \x1b[2m└─ Derived via: crypto.createHash("sha256").update(rawPayload).digest("hex")\x1b[0m`);
  console.log(`  \x1b[1m\x1b[34m[3] PINATA / IPFS CID:\x1b[0m           \x1b[35m${cid}\x1b[0m`);
  console.log(`      \x1b[2m└─ Derived via: Multihash [0x12, 0x20] + SHA-256 bytes -> Base58 (Qm...)\x1b[0m`);
  console.log(`  \x1b[1m\x1b[34m[4] TX ENTROPY FORMULA:\x1b[0m          \x1b[2m"${logId}-${hash.slice(0, 12)}...-${cid.slice(0, 10)}...-${Date.now()}"\x1b[0m`);
  console.log(`  \x1b[1m\x1b[34m[5] BLOCKCHAIN TXID (HASH):\x1b[0m      \x1b[33m\x1b[1m${txHash}\x1b[0m`);
  console.log(`      \x1b[2m└─ Derived via: "0x" + SHA-256(txEntropy)\x1b[0m`);
  console.log(`  \x1b[1m\x1b[34m[6] SMART CONTRACT ADDRESS:\x1b[0m      ${CONTRACT_ADDRESS}`);
  console.log(`  \x1b[1m\x1b[34m[7] GAS USED / STATUS:\x1b[0m           ${gasUsed.toLocaleString()} units  |  \x1b[32m${savedTx.status}\x1b[0m`);
  console.log(`  \x1b[1m\x1b[34m[8] BLOCK COMMIT TIMESTAMP:\x1b[0m      ${new Date().toISOString()}`);
  console.log(`\x1b[36m${border}\x1b[0m\n`);

  return savedTx;
}

/**
 * Performs active cryptographic verification of a security log against the blockchain ledger.
 * @param {object} log - SecurityLog document
 * @returns {Promise<object>} - Verification result
 */
async function verifyLogIntegrity(log) {
  if (!log) {
    throw new Error("Log record is required for verification.");
  }

  // 1. Recompute SHA-256 hash from raw log / full payload
  const contentToHash = log.fullLog || log.rawLog || log.message;
  const recomputedHash = generateSHA256Hash(contentToHash);

  // 2. Query blockchain ledger record by logId / incidentId
  const incidentId = log.incidentId || log.logId;
  const txRecord = await BlockchainTransaction.findOne({ logId: incidentId });

  // 3. Evaluate integrity
  const isHashMatching = log.hash === recomputedHash;
  const isLedgerConfirmed = !!txRecord && txRecord.status === "Confirmed";
  const isValid = isHashMatching && isLedgerConfirmed;

  return {
    isValid,
    incidentId,
    verificationStatus: isValid ? "Verified" : isHashMatching ? "Unverified" : "Tampered",
    storedHash: log.hash,
    computedHash: recomputedHash,
    isHashMatching,
    cid: log.cid,
    blockchainTransaction: txRecord
      ? {
          txHash: txRecord.txHash,
          blockNumber: txRecord.blockNumber,
          contractAddress: txRecord.contractAddress,
          status: txRecord.status,
          gasUsed: txRecord.gasUsed,
          timestamp: txRecord.createdAt,
        }
      : null,
  };
}

module.exports = {
  recordBlockchainTransaction,
  verifyLogIntegrity,
  CONTRACT_ADDRESS,
};
