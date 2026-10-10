require('dotenv').config();
const mongoose = require('mongoose');
const {
  initializeLogFiles,
  appendAnalyzedSystemLog,
  appendRawCoreSystemLog,
  LOG_FILE_PATH_PRIMARY,
  LOG_FILE_PATH_SECONDARY,
} = require('../utils/systemLogFileWriter');
const SecurityLog = require('../models/SecurityLog');
const Incident = require('../models/Incident');

async function sync() {
  initializeLogFiles(true);
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const logs = await SecurityLog.find({ dataOrigin: 'REAL' }).sort({ timestamp: 1 }).limit(100).lean();
  const logIds = logs.map((l) => l._id);
  const incidents = await Incident.find({ securityLogId: { $in: logIds } }, 'incidentId securityLogId').lean();

  const incMap = new Map();
  incidents.forEach((inc) => incMap.set(String(inc.securityLogId), inc.incidentId));

  for (const l of logs) {
    const enriched = {
      ...l,
      createdIncidentId: l.createdIncidentId || incMap.get(String(l._id)) || null,
    };
    appendAnalyzedSystemLog(enriched);
    appendRawCoreSystemLog(l);
  }

  console.log(`[OWLYX SYNC] Synced ${logs.length} entries to:`);
  console.log(`  - Analyzed Ledger: ${LOG_FILE_PATH_PRIMARY}`);
  console.log(`  - Raw Core Logs:   ${LOG_FILE_PATH_SECONDARY}`);
  process.exit(0);
}

sync().catch((err) => {
  console.error('[OWLYX SYNC ERROR]', err);
  process.exit(1);
});
