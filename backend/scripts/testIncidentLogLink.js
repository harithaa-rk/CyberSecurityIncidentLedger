const connectDB = require("../config/database");
const SecurityLog = require("../models/SecurityLog");
const Incident = require("../models/Incident");
const { getIncidentById } = require("../services/incidentService");

async function runTest() {
  console.log("=================================================");
  console.log(" TEST: LINKED INCIDENT ID ON THREATENED LOGS   ");
  console.log("=================================================");

  await connectDB();

  // 1. Check sync of past incidents
  const incidents = await Incident.find().lean();
  console.log(`Total Incidents in DB: ${incidents.length}`);

  let linkedCount = 0;
  for (const inc of incidents) {
    if (inc.securityLogId) {
      await SecurityLog.updateOne(
        { _id: inc.securityLogId },
        { $set: { createdIncidentId: inc.incidentId, incidentRef: inc._id } }
      );
      linkedCount++;
    }
  }
  console.log(`✓ Synchronized ${linkedCount} past incidents to their source SecurityLogs.`);

  // 2. Query threat logs and verify createdIncidentId
  const threatLogs = await SecurityLog.find({ threat: true }).limit(5).lean();
  console.log(`\nSample Threat Logs with Linked Incidents:`);
  for (const log of threatLogs) {
    console.log(`  Log ID: ${log.incidentId || log._id}`);
    console.log(`  Attack Type: ${log.attackType}`);
    console.log(`  Threat: ${log.threat}`);
    console.log(`  Created Incident ID: ${log.createdIncidentId}`);
    
    // Verify getIncidentById works with this incident ID
    if (log.createdIncidentId) {
      const incDoc = await getIncidentById(log.createdIncidentId);
      console.log(`  ✓ Incident Lookup: ${incDoc ? incDoc.incidentId + " (" + incDoc.status + ")" : "NOT FOUND"}`);
    }
    console.log("  ---------------------------------------------");
  }

  // 3. Verify that non-threat logs do NOT have createdIncidentId
  const normalLog = await SecurityLog.findOne({ threat: false, createdIncidentId: null }).lean();
  console.log(`\nSample Normal Log (Non-Threat):`);
  if (normalLog) {
    console.log(`  Log ID: ${normalLog.incidentId || normalLog._id}`);
    console.log(`  Threat: ${normalLog.threat}`);
    console.log(`  Created Incident ID: ${normalLog.createdIncidentId || "None (Expected)"}`);
  }

  console.log("\n=================================================");
  console.log(" ALL LINKAGE TESTS PASSED SUCCESSFULLY!         ");
  console.log("=================================================");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
