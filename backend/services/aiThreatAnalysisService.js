/**
 * AI Threat Analysis Engine for Windows Event Logs
 *
 * Implements contextual and stateful threat evaluation:
 * 1. Differentiates benign baseline events from suspicious anomalies.
 * 2. Tracks event frequency (e.g. brute-force logon thresholds).
 * 3. Inspects process creation telemetry for known Living-off-the-Land (LotL) / attack signatures.
 * 4. Flags security audit log tampering, user creation, privilege elevation.
 * 5. Assigns Threat (Boolean), Attack Type, Threat Category, Severity, Risk Score (0-100),
 *    Explanation, and Recommended Action.
 */

// In-memory frequency tracking for stateful temporal analysis
const stateTracker = {
  failedLogons: new Map(), // key: `${targetUser}_${sourceIP}` -> Array<timestamps>
  processCreations: new Map(),
};

// Housekeeping interval to prune state older than 10 minutes
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

  for (const [key, timestamps] of stateTracker.failedLogons.entries()) {
    const fresh = timestamps.filter((t) => t > tenMinutesAgo);
    if (fresh.length === 0) {
      stateTracker.failedLogons.delete(key);
    } else {
      stateTracker.failedLogons.set(key, fresh);
    }
  }
}, 60 * 1000);

// Common suspicious processes, tools, and command-line keywords
const SUSPICIOUS_PROCESS_PATTERNS = [
  { pattern: /mimikatz/i, name: "CREDENTIAL_DUMPING_MIMIKATZ", severity: "CRITICAL", risk: 98, desc: "Known credential dumping binary pattern identified." },
  { pattern: /vssadmin\s+(delete|resize)\s+shadows/i, name: "RANSOMWARE_SHADOW_DELETION", severity: "CRITICAL", risk: 99, desc: "Shadow copy deletion attempt often preceding ransomware encryption." },
  { pattern: /certutil(\.exe)?\s+(-urlcache|-split)/i, name: "INGRESS_TOOL_TRANSFER_CERTUTIL", severity: "HIGH", risk: 88, desc: "Certutil misused as a living-off-the-land file download utility." },
  { pattern: /powershell(\.exe)?\s+.*(-enc|-encodedcommand|-e\s+)/i, name: "ENCODED_POWERSHELL_EXECUTION", severity: "HIGH", risk: 85, desc: "PowerShell executed with an obfuscated base64 encoded command payload." },
  { pattern: /whoami(\.exe)?\s+(\/all|\/priv)/i, name: "RECONNAISSANCE_PRIVILEGE_ENUMERATION", severity: "MEDIUM", risk: 65, desc: "Host reconnaissance and privilege enumeration command line." },
  { pattern: /net(\.exe)?\s+localgroup\s+administrators\s+.*\/add/i, name: "PRIVILEGE_ESCALATION_ADMIN_ADD", severity: "CRITICAL", risk: 95, desc: "Unauthorized account added to local Administrators group." },
  { pattern: /rundll32(\.exe)?\s+.*,\s*(shellexec|openurl)/i, name: "EXECUTION_PROXY_RUNDLL32", severity: "HIGH", risk: 80, desc: "Rundll32 invoked to proxy execution of arbitrary binary/URL." },
];

/**
 * Evaluates a Windows Event and performs intelligent threat analysis.
 *
 * @param {object} event - Extracted Windows event object
 * @returns {object} Threat analysis decision
 */
function analyzeWindowsThreat(event) {
  const eventId = String(event.eventId || "0").trim();
  const rawData = event.eventData || {};
  const message = event.message || "";
  const processId = event.processId || 0;
  const now = Date.now();

  // Baseline Default: Normal, Non-Threat Event
  const result = {
    threat: false,
    attackType: "NORMAL_WINDOWS_ACTIVITY",
    threatCategory: "System Operations",
    severity: event.severity || "LOW",
    riskScore: event.level === 1 ? 50 : event.level === 2 ? 40 : event.level === 3 ? 25 : 10,
    explanation: "Routine Windows operating system activity within standard operational baseline.",
    recommendedAction: "No action required. Standard telemetry event.",
  };

  // ─────────────────────────────────────────────
  // 1. Windows Security: Logon Events (4624 & 4625)
  // ─────────────────────────────────────────────

  // Event ID 4625: Failed Logon
  if (eventId === "4625") {
    const targetUser = rawData.TargetUserName || "Unknown";
    const srcIp = event.sourceIP || rawData.IpAddress || "127.0.0.1";
    const trackingKey = `${targetUser}_${srcIp}`;

    const history = stateTracker.failedLogons.get(trackingKey) || [];
    history.push(now);
    stateTracker.failedLogons.set(trackingKey, history);

    // Failures in the last 2 minutes
    const twoMinutesAgo = now - 2 * 60 * 1000;
    const recentFailures = history.filter((t) => t >= twoMinutesAgo);

    if (recentFailures.length >= 5) {
      result.threat = true;
      result.attackType = "BRUTE_FORCE_AUTHENTICATION";
      result.threatCategory = "Credential Access";
      result.severity = recentFailures.length >= 10 ? "CRITICAL" : "HIGH";
      result.riskScore = Math.min(95, 65 + recentFailures.length * 3);
      result.explanation = `High-velocity failed logon bursts detected: ${recentFailures.length} failed attempts for account "${targetUser}" from source ${srcIp} within 2 minutes.`;
      result.recommendedAction = "Temporarily throttle or lock the targeted user account. Block or review connections from the originating IP address.";
      return result;
    } else if (recentFailures.length >= 3) {
      result.threat = true;
      result.attackType = "FAILED_LOGON_CLUSTER";
      result.threatCategory = "Credential Access";
      result.severity = "MEDIUM";
      result.riskScore = 60;
      result.explanation = `Multiple failed logon attempts (${recentFailures.length}) observed for user "${targetUser}".`;
      result.recommendedAction = "Verify whether this is a legitimate user mistyping credentials or unauthorized access.";
      return result;
    } else {
      // Single failed logon: Keep normal / low severity
      result.threat = false;
      result.attackType = "FAILED_LOGON";
      result.threatCategory = "Authentication";
      result.severity = "LOW";
      result.riskScore = 30;
      result.explanation = `Single failed logon attempt for user "${targetUser}". Commonly caused by a mistyped password.`;
      result.recommendedAction = "Continue monitoring. No immediate action required.";
      return result;
    }
  }

  // Event ID 4624: Successful Logon
  if (eventId === "4624") {
    const targetUser = rawData.TargetUserName || "User";
    const logonType = rawData.LogonType || "2"; // 2=Interactive, 3=Network, 10=RemoteInteractive
    const isRemote = logonType === "10" || logonType === "3";

    if (isRemote && (targetUser.toLowerCase() === "administrator" || targetUser.toLowerCase() === "admin")) {
      result.threat = true;
      result.attackType = "REMOTE_ADMIN_LOGON";
      result.threatCategory = "Initial Access";
      result.severity = "MEDIUM";
      result.riskScore = 55;
      result.explanation = `Remote administrative logon session established (LogonType: ${logonType}) for privileged account "${targetUser}".`;
      result.recommendedAction = "Verify that remote session was authorized by authorized administrative personnel.";
      return result;
    }

    result.threat = false;
    result.attackType = "AUTHENTICATION_SUCCESS";
    result.threatCategory = "Authentication";
    result.severity = "LOW";
    result.riskScore = 10;
    result.explanation = `Successful user logon verified for account "${targetUser}" (LogonType: ${logonType}).`;
    result.recommendedAction = "No action required. Normal operational activity.";
    return result;
  }

  // ─────────────────────────────────────────────
  // 2. Windows Security: Process Creation (4688)
  // ─────────────────────────────────────────────
  if (eventId === "4688") {
    const newProcess = rawData.NewProcessName || rawData.ProcessName || message;
    const cmdLine = rawData.CommandLine || "";
    const combinedProcessInfo = `${newProcess} ${cmdLine}`;

    for (const item of SUSPICIOUS_PROCESS_PATTERNS) {
      if (item.pattern.test(combinedProcessInfo)) {
        result.threat = true;
        result.attackType = item.name;
        result.threatCategory = "Execution / Living-off-the-Land";
        result.severity = item.severity;
        result.riskScore = item.risk;
        result.explanation = `Suspicious execution command observed: ${item.desc} Process: ${newProcess}`;
        result.recommendedAction = "Inspect parent process hierarchy and isolate the endpoint if execution was unauthorized.";
        return result;
      }
    }

    // Standard benign process creation
    result.threat = false;
    result.attackType = "PROCESS_CREATION";
    result.threatCategory = "Process Execution";
    result.severity = "LOW";
    result.riskScore = 15;
    result.explanation = `Standard system process invocation: ${newProcess.slice(-40)}`;
    result.recommendedAction = "No action required.";
    return result;
  }

  // ─────────────────────────────────────────────
  // 3. Defense Evasion: Audit Log Tampering (1102 / 104)
  // ─────────────────────────────────────────────
  if (eventId === "1102" || eventId === "104") {
    result.threat = true;
    result.attackType = "SECURITY_LOG_TAMPERING";
    result.threatCategory = "Defense Evasion";
    result.severity = "CRITICAL";
    result.riskScore = 98;
    result.explanation = "The Windows Security/System audit event log was explicitly cleared by a user or script.";
    result.recommendedAction = "CRITICAL ALERT: Immediately identify the user account responsible and conduct an incident investigation.";
    return result;
  }

  // ─────────────────────────────────────────────
  // 4. Persistence & Privilege Escalation (7045, 4720, 4728)
  // ─────────────────────────────────────────────
  if (eventId === "7045") {
    // New service installed
    const serviceName = rawData.ServiceName || "Unknown Service";
    const imagePath = rawData.ImagePath || "";

    const isSuspiciousPath = /(temp|appdata|users\\public|\.bat|\.vbs|\.ps1)/i.test(imagePath);

    result.threat = isSuspiciousPath;
    result.attackType = isSuspiciousPath ? "SUSPICIOUS_SERVICE_PERSISTENCE" : "SERVICE_INSTALLATION";
    result.threatCategory = "Persistence";
    result.severity = isSuspiciousPath ? "HIGH" : "LOW";
    result.riskScore = isSuspiciousPath ? 85 : 20;
    result.explanation = isSuspiciousPath
      ? `New Windows service "${serviceName}" installed pointing to suspicious executable path: ${imagePath}`
      : `New standard Windows service installed: "${serviceName}".`;
    result.recommendedAction = isSuspiciousPath
      ? "Verify the digital signature of the service binary and remove unauthorized service definitions."
      : "Confirm service installation corresponds with an authorized software installation.";
    return result;
  }

  if (eventId === "4720") {
    // New local user account created
    const targetUser = rawData.TargetUserName || "NewUser";
    result.threat = true;
    result.attackType = "USER_ACCOUNT_CREATION";
    result.threatCategory = "Persistence / Privilege Escalation";
    result.severity = "MEDIUM";
    result.riskScore = 65;
    result.explanation = `New local user account "${targetUser}" was created on the system.`;
    result.recommendedAction = "Confirm that this user account was authorized by IT/Security management.";
    return result;
  }

  if (eventId === "4728" || eventId === "4732") {
    // Member added to security group
    const targetGroup = rawData.TargetUserName || "Privileged Group";
    const memberName = rawData.MemberName || "User";
    result.threat = true;
    result.attackType = "PRIVILEGED_GROUP_MEMBERSHIP_CHANGE";
    result.threatCategory = "Privilege Escalation";
    result.severity = "HIGH";
    result.riskScore = 80;
    result.explanation = `User "${memberName}" was added to security-sensitive group "${targetGroup}".`;
    result.recommendedAction = "Review change authorization and verify justification for group membership elevation.";
    return result;
  }

  // ─────────────────────────────────────────────
  // 5. System Crashes & Anomaly Analysis (WER 1001, BugCheck 1001, Kernel 41)
  // ─────────────────────────────────────────────
  if (eventId === "41") {
    result.threat = false;
    result.attackType = "UNEXPECTED_SYSTEM_SHUTDOWN";
    result.threatCategory = "System Reliability";
    result.severity = "MEDIUM";
    result.riskScore = 40;
    result.explanation = "The system rebooted without cleanly shutting down first (Kernel-Power event 41).";
    result.recommendedAction = "Check power supply, hardware stability, or review recent kernel crash dumps.";
    return result;
  }

  // ─────────────────────────────────────────────
  // 6. Generic Error/Warning Event Level Fallback
  // ─────────────────────────────────────────────
  if (event.severity === "CRITICAL") {
    result.threat = true;
    result.attackType = `SYSTEM_CRITICAL_EVENT_${eventId}`;
    result.threatCategory = "System Health / Anomaly";
    result.severity = "CRITICAL";
    result.riskScore = 80;
    result.explanation = `Windows logged a Critical level event from provider "${event.provider}": ${message.slice(0, 150)}`;
    result.recommendedAction = "Investigate system hardware and critical software components immediately.";
  } else if (event.severity === "HIGH") {
    result.threat = false;
    result.attackType = `SYSTEM_ERROR_${eventId}`;
    result.threatCategory = "Application / System Errors";
    result.severity = "HIGH";
    result.riskScore = 45;
    result.explanation = `Windows logged an Error level event from provider "${event.provider}": ${message.slice(0, 150)}`;
    result.recommendedAction = "Check event details in Event Viewer to identify software or component failure.";
  } else if (event.severity === "MEDIUM") {
    result.threat = false;
    result.attackType = `SYSTEM_WARNING_${eventId}`;
    result.threatCategory = "System Warning";
    result.severity = "MEDIUM";
    result.riskScore = 25;
    result.explanation = `Windows logged a Warning level event from provider "${event.provider}".`;
    result.recommendedAction = "Review warning message to prevent potential service degradation.";
  }

  return result;
}

module.exports = {
  analyzeWindowsThreat,
};
