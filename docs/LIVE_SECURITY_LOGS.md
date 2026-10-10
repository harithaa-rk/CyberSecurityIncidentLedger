# Live Security Log Monitor Documentation

## 1. Purpose

The **Live Security Log Monitor** module provides real-time, authentic security telemetry monitoring within the **Cyber Security Incident Ledger**. 

Its primary mission is to answer with cryptographic certainty and OS-level traceability:
> **"Are these logs genuinely coming from the underlying operating system, or are they synthetic sample/test logs?"**

Every security event ingested into the ledger is immutably tagged with its origin (`REAL`, `SAMPLE`, `TEST`, or `UNKNOWN`) and ingestion method (`WINDOWS_EVENT_LOG`, `TEST_GENERATOR`, `FILE_UPLOAD`, `MANUAL`, `UNKNOWN`), ensuring strict segregation between authentic host telemetry and synthetic demonstrations.

---

## 2. Architecture

```
                                      +---------------------------------------------+
                                      |         Windows Operating System            |
                                      | (Channels: Security, System, Application)   |
                                      +---------------------------------------------+
                                                             |
                                                             | native wevtutil qe ... /f:RenderedXml
                                                             v
+-------------------------------+              +---------------------------------------------+
| Synthetic Test Generator      |              | Windows Event Collector                     |
| (sampleLogGenerator.js)       |              | (windowsEventCollector.js)                  |
| - Origin: SAMPLE / TEST       |              | - Origin: REAL                              |
| - Method: TEST_GENERATOR      |              | - Method: WINDOWS_EVENT_LOG                 |
| - Machine: TEST-GENERATOR     |              | - Machine: Actual OS Hostname (os.hostname) |
| - Non-intrusive on-demand     |              | - EventRecordID Checkpoint Bookmark         |
+-------------------------------+              +---------------------------------------------+
               \                                             /
                \                                           /
                 v                                         v
               +---------------------------------------------+
               | Windows Event Parser (windowsEventParser.js)|
               | Extracts: EventID, EventRecordID, Provider, |
               | Timestamp, ProcessID, Computer, XML text    |
               +---------------------------------------------+
                                     |
                                     v
               +---------------------------------------------+
               | Log Ingestion Service (logIngestionService) |
               | - Deduplication (SHA-256 eventFingerprint)  |
               | - Normalizes to SecurityLog schema          |
               | - Generates SHA-256 Hash & IPFS CID         |
               | - Commits to Blockchain Ledger              |
               | - Emits Socket.IO `security-log:new`        |
               +---------------------------------------------+
                                     |
                                     v
               +---------------------------------------------+
               | AI Threat Analysis Engine                   |
               | (aiThreatAnalysisService.js)                |
               | - Living-off-the-Land pattern matching      |
               | - Brute force threshold evaluation          |
               | - Flags threat: true / false                |
               +---------------------------------------------+
                                     |
                   +-----------------+-----------------+
                   |                                   |
           (threat == false)                   (threat == true)
                   |                                   |
                   v                                   v
          [Stored as Benign Log]              +---------------------------------------------+
                                              | Incident Creation (incidentService.js)      |
                                              | - Preserves dataOrigin: REAL / SAMPLE       |
                                              | - Preserves collectionMethod & Host         |
                                              | - Emits Socket.IO `incident:new`            |
                                              +---------------------------------------------+
                                                               |
                                                               v
                                              +---------------------------------------------+
                                              | Real-Time SOC Dashboard & Inspector         |
                                              | (/admin/live-security-logs)                 |
                                              | - Pulsating ● LIVE connection               |
                                              | - REAL / SAMPLE / TEST visual badges        |
                                              | - Monospace Raw XML Viewer                  |
                                              | - Pause Stream buffer controls              |
                                              +---------------------------------------------+
```

---

## 3. Real Windows Event Collection

The collector (`backend/collectors/windowsEventCollector.js`) uses the Windows native utility:
```powershell
wevtutil
```
No third-party binaries, kernel drivers, or invasive services are required.

### Channels Monitored:
1. `Security` — Windows logon auditing, privilege assignments, security audit logs (Event IDs: `4624`, `4625`, `4688`, `1102`, `4720`, etc.).
2. `System` — Kernel status, unexpected shutdowns, service manager events (Event IDs: `41`, `10016`, `7045`, etc.).
3. `Application` — Software crashes, runtime alerts, installer actions, diagnostics (Event IDs: `1000`, `1022`, `16384`, etc.).

### Native Command Format:
To retrieve rendered XML from a channel:
```powershell
wevtutil qe "System" "/q:*[System[(EventRecordID > 123000)]]" /c:50 /f:RenderedXml
```

---

## 4. Sample and Test Data

Synthetic demonstrations are managed via `backend/collectors/sampleLogGenerator.js`.

### Supported Scenarios:
- `SQL_INJECTION` — Web injection payload in parameters.
- `BRUTE_FORCE` — High-velocity authentication burst.
- `PORT_SCAN` — Sequential TCP SYN scan across ports.
- `DDOS` — Volumetric SYN flood.
- `SUSPICIOUS_PROCESS_EXECUTION` — Living-off-the-Land binary invocation (e.g., `certutil.exe -urlcache`).
- `MALWARE_DETECTION` — Ransomware signature or heuristic match.
- `NORMAL_TELEMETRY` — Baseline benign heartbeat event.

**Crucial Isolation Principle**:
- The sample generator **never** runs automatically at boot.
- It is triggered strictly on-demand via the Admin UI or `POST /api/security-logs/test-generate`.
- It **never** labels events as `REAL`.

---

## 5. REAL vs. SAMPLE Classification

| Field | REAL Telemetry | SAMPLE Demonstration | TEST Event | UNKNOWN |
|---|---|---|---|---|
| `dataOrigin` | `"REAL"` | `"SAMPLE"` | `"TEST"` | `"UNKNOWN"` |
| `collectionMethod` | `"WINDOWS_EVENT_LOG"` | `"TEST_GENERATOR"` | `"TEST_GENERATOR"` | `"UNKNOWN"` / `"MANUAL"` |
| `collectorHost` | Machine's actual hostname (e.g. `DESKTOP-ABC123`) | `"LOCAL-TEST-GENERATOR"` | `"LOCAL-TEST-GENERATOR"` | Client IP / `REMOTE-CLIENT` |
| `eventRecordId` | Real integer from Windows Event log | `SMP-<timestamp>-<num>` | `TEST-<timestamp>-<num>` | Empty or user-provided |
| `rawLog` | Authentic XML node from Windows | JSON structure with synthetic flag | JSON structure | Plain string / CSV |
| Source of Authority | Backend OS Collector only | Controlled Generator | Automated Test Suite | Unverified Ingestion API |

> **Security Guard**: The backend API rejects or sanitizes any client payload attempting to set `dataOrigin: "REAL"`. The `REAL` label can only be assigned by the trusted `windowsEventCollector.js` internal service.

---

## 6. Windows Permissions and Access Control

### Security Channel:
Reading the `Security` event channel on Windows requires elevated privileges:
- **Administrator Privileges** (Terminal started with *Run as administrator*), OR
- Membership in the **Event Log Readers** built-in local group.

### Graceful Fallback:
If the backend is run in a standard non-elevated user shell:
1. The collector catches the `Access is denied` message on the `Security` channel.
2. It prints an advisory message:
   ```
   [WINDOWS COLLECTOR] Security log access denied.
   [WINDOWS COLLECTOR] Run the terminal with Administrator privileges or grant appropriate Event Log Reader permissions.
   ```
3. The server **does not crash**.
4. The collector continues actively monitoring the `System` and `Application` channels without interruption.

---

## 7. EventRecordID Checkpoint Mechanism

To prevent re-reading historical events or flooding MongoDB with past events:
1. **Bootstrap Initialization**:
   On startup, the collector inspects the single latest record for each channel:
   ```powershell
   wevtutil qe "<Channel>" /c:1 /rd:true /f:RenderedXml
   ```
   It extracts the latest `EventRecordID` and initializes `channel.lastRecordId`.
2. **Delta Polling**:
   Every polling cycle (`WINDOWS_EVENT_POLL_INTERVAL_MS = 5000`), the collector requests only:
   ```powershell
   wevtutil qe "<Channel>" "/q:*[System[(EventRecordID > ${channel.lastRecordId})]]" /c:50 /f:RenderedXml
   ```
3. **Sequential Bookmark Update**:
   Events are sorted ascending by `recordId`. As each is processed, `channel.lastRecordId = event.recordId` is stored in memory.

---

## 8. Log Deduplication and Fingerprinting

Windows event channels maintain independent record counters. Record ID `5000` in `System` is distinct from Record ID `5000` in `Application`.

To guarantee zero duplicates across restarts and overlapping queries:
```javascript
eventFingerprint = crypto
  .createHash("sha256")
  .update(`${collectorHost}|${channelName}|${recordId}|${providerName}`)
  .digest("hex");
```
Before saving to MongoDB, the pipeline performs:
```javascript
const existingLog = await SecurityLog.findOne({
  $or: [{ fingerprint }, { eventFingerprint }]
});
```
If a match is found, the existing record is returned and duplicate ingestion is skipped.

---

## 9. Socket.IO Live Updates

When a new log is processed, the backend emits `security-log:new`:
```json
{
  "id": "67a3f81e9b20b2d41b001a1a",
  "incidentId": "INC-20261007-482910",
  "timestamp": "2026-10-07T04:40:09.479Z",
  "receivedAt": "2026-10-07T05:00:12.100Z",
  "source": "Windows-System",
  "threat": true,
  "severity": "HIGH",
  "riskScore": 80,
  "attackType": "SYSTEM_CRITICAL_EVENT",
  "message": "Windows logged a Critical level event...",
  "dataOrigin": "REAL",
  "collectionMethod": "WINDOWS_EVENT_LOG",
  "collectorHost": "DESKTOP-ABC123",
  "eventRecordId": "123031",
  "providerName": "Microsoft-Windows-DistributedCOM",
  "logName": "System"
}
```
If `threat === true`, `incident:new` is also emitted.

### UI Stream Controls:
- **Live Stream Pause**: Clicking **Pause Live Stream** freezes table updates while enqueuing incoming events in memory buffer. Resuming prepends the buffer smoothly.
- **Client Buffer Limit**: Retains the 100 most recent items to prevent browser memory exhaustion.

---

## 10. API Endpoints

### 1. `GET /api/security-logs/live`
- **Query Parameters**:
  - `limit` (default: 100)
  - `origin` (`REAL`, `SAMPLE`, `TEST`, `UNKNOWN`)
  - `severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - `threat` (`threats`, `normal`)
  - `source` (e.g. `Windows-Security`, `Windows-System`)
  - `search` (free-text across messages, hosts, event IDs)
- **Response**: Paginated logs + live counts.

### 2. `GET /api/security-logs/stats`
- **Response**: Aggregated counts `{ total, real, sample, test, unknown, threats, critical, high, medium, low }`.

### 3. `GET /api/security-logs/:id`
- **Response**: Complete log object including `rawLog`, `windowsEventData`, and blockchain hashes.

### 4. `POST /api/security-logs/test-generate`
- **Body**: `{ "scenario": "SQL_INJECTION", "origin": "SAMPLE" }`
- **Response**: Creates and returns synthetic demonstration event.

### 5. `POST /api/security-logs/trigger-windows-event`
- **Body**: `{ "eventId": 1000, "message": "Test verification" }`
- **Action**: Uses PowerShell `Write-EventLog` to write to the Windows Application log. The Windows Collector queries it via `wevtutil`, parses it, and emits it as `REAL`.

### 6. `GET /api/security-logs/collector/status`
- **Response**: Running status, polling interval, and per-channel permission status.

---

## 11. Testing Instructions

### Step 1: Start Backend and Frontend
In terminal 1 (Backend):
```powershell
cd c:\Users\harit\CyberSecurityIncidentLedger\backend
node server.js
```
Console output will show:
```
[WINDOWS COLLECTOR] Starting...
[WINDOWS COLLECTOR] Host: <YOUR_HOSTNAME>
[WINDOWS COLLECTOR] Poll interval: 5000 ms
[WINDOWS COLLECTOR] Monitoring: Security,System,Application
[WINDOWS COLLECTOR] Monitoring System
[WINDOWS COLLECTOR] Monitoring Application
```

In terminal 2 (Frontend):
```powershell
cd c:\Users\harit\CyberSecurityIncidentLedger\frontend
npm run dev
```

### Step 2: Open Admin Live Security Logs
1. Navigate to: `http://localhost:5173/login`
2. Log in with an Admin account.
3. In the sidebar, click **Live Security Logs** (or go to `http://localhost:5173/admin/live-security-logs`).
4. Verify the top right status badge shows **● LIVE**.

### Step 3: Verify a REAL Windows Event
Option A (Via Dashboard Button):
- Click the green **Emit Real Windows Event** button in the dashboard.
- Within 5 seconds, a new row appears with:
  - Origin: **✓ REAL**
  - Method: `WINDOWS_EVENT_LOG`
  - Source: `Windows-Application`
  - Host: Actual PC Hostname
  - EventRecordID: Genuine Windows EventRecordID

Option B (Via Native PowerShell Command):
Open any PowerShell window on the computer and run:
```powershell
Write-EventLog -LogName "Application" -Source "Application Error" -EventId 1000 -EntryType Information -Message "Live Ledger Telemetry Test Event"
```
Within 5 seconds, the event appears in the dashboard labeled **REAL**.

### Step 4: Verify Raw XML Inspection
- Click the newly received REAL log row.
- The Inspector modal opens.
- Observe the **VERIFIED REAL OPERATING SYSTEM TELEMETRY** banner.
- Observe the **RAW EVENT DATA** section containing actual Windows XML elements:
  `<Event ...><System><EventID>1000</EventID><EventRecordID>...</EventRecordID>...`

### Step 5: Verify a SAMPLE Event
- Click **Generate Sample Event ▾** and select **Sample SQL Injection**.
- A new row appears with:
  - Origin: **⚠️ SAMPLE**
  - Method: `TEST_GENERATOR`
  - Host: `LOCAL-TEST-GENERATOR`
- Click to inspect: shows **SYNTHETIC DEMONSTRATION DATA (NOT REAL TELEMETRY)**.

### Step 6: Verify Incident Traceability
- If a high-risk or threat event is ingested, click **View Incident Details ↗**.
- In the Incident details modal, observe:
  - Data Origin: `REAL` or `SAMPLE`
  - Collection Method: `WINDOWS_EVENT_LOG`
  - Collector Host
  - Event Record ID
- This demonstrates complete traceability from Windows Event -> Security Log -> AI Analysis -> Incident.

---

## 12. Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| `[WINDOWS COLLECTOR] Security log access denied.` | Windows Security audit log requires administrator elevation. | Right-click your terminal application and select **Run as Administrator**, then restart the backend. (System and Application monitoring continues regardless). |
| `wevtutil: command not found` | PATH variable missing System32 or non-Windows OS. | Ensure `C:\Windows\System32` is in the system PATH. The collector is designed for Windows 10/11 environments. |
| Socket shows `● DISCONNECTED` | Backend server offline or CORS port mismatch. | Verify backend is running on `http://localhost:5000` and `VITE_BACKEND_URL` points to port 5000. |
| Event count not increasing | Polling interval active or no new events on Windows channels. | Click **Emit Real Windows Event** or generate activity in Windows (e.g., open apps or run `Write-EventLog`). |
| Duplicate events in table | Re-polling same Record IDs | Check that `EventRecordID` checkpointing is enabled (`WINDOWS_EVENT_START_FROM_LATEST=true`). |
