/**
 * Windows Event Log XML Parser
 * Extracts structured attributes from Windows Event Log rendered XML format.
 */

/**
 * Strips XML tags and unescapes XML entities
 */
function unescapeXml(text) {
  if (!text) return "";
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#13;&#10;/g, "\n")
    .replace(/&#13;/g, "\n")
    .replace(/&#10;/g, "\n");
}

/**
 * Parses rendered XML output from wevtutil into structured event objects.
 * Handles multiple <Event>...</Event> blocks in a single output stream.
 *
 * @param {string} xmlText - Raw XML string containing one or more <Event> elements
 * @returns {Array<object>} Array of parsed event objects
 */
function parseWindowsEventXml(xmlText) {
  if (!xmlText || typeof xmlText !== "string") return [];

  const events = [];
  const eventRegex = /<Event\b[^>]*>([\s\S]*?)<\/Event>/gi;
  let match;

  while ((match = eventRegex.exec(xmlText)) !== null) {
    const rawEvent = match[0];
    const inner = match[1];

    try {
      // 1. System section extraction
      const eventIdMatch = inner.match(/<EventID\b[^>]*>(\d+)<\/EventID>/i);
      const eventId = eventIdMatch ? eventIdMatch[1] : "0";

      const recordIdMatch = inner.match(/<EventRecordID\b[^>]*>(\d+)<\/EventRecordID>/i);
      const recordId = recordIdMatch ? parseInt(recordIdMatch[1], 10) : 0;

      const providerMatch = inner.match(/<Provider\b[^>]*\bName=['"]([^'"]+)['"]/i);
      const provider = providerMatch ? providerMatch[1] : "Windows";

      const timeCreatedMatch = inner.match(/<TimeCreated\b[^>]*\bSystemTime=['"]([^'"]+)['"]/i);
      const timestamp = timeCreatedMatch ? timeCreatedMatch[1] : new Date().toISOString();

      const channelMatch = inner.match(/<Channel\b[^>]*>([^<]+)<\/Channel>/i);
      const channel = channelMatch ? channelMatch[1].trim() : "System";

      const computerMatch = inner.match(/<Computer\b[^>]*>([^<]+)<\/Computer>/i);
      const computer = computerMatch ? computerMatch[1].trim() : "localhost";

      const userMatch = inner.match(/<Security\b[^>]*\bUserID=['"]([^'"]+)['"]/i);
      const userId = userMatch ? userMatch[1] : "SYSTEM";

      const executionMatch = inner.match(/<Execution\b[^>]*\bProcessID=['"](\d+)['"](?:\s+\bThreadID=['"](\d+)['"])?/i);
      const processId = executionMatch ? parseInt(executionMatch[1], 10) : 0;
      const threadId = executionMatch && executionMatch[2] ? parseInt(executionMatch[2], 10) : 0;

      const keywordsMatch = inner.match(/<Keywords\b[^>]*>([^<]+)<\/Keywords>/i);
      const keywords = keywordsMatch ? keywordsMatch[1].trim() : "";

      const taskMatch = inner.match(/<Task\b[^>]*>([^<]+)<\/Task>/i);
      const taskCategory = taskMatch ? taskMatch[1].trim() : "";

      // Level: 1 = Critical, 2 = Error, 3 = Warning, 4 = Information, 5 = Verbose
      const levelMatch = inner.match(/<Level\b[^>]*>(\d+)<\/Level>/i);
      const rawLevelNum = levelMatch ? parseInt(levelMatch[1], 10) : 4;

      // 2. RenderingInfo extraction (if present)
      let message = "";
      const messageMatch = inner.match(/<RenderingInfo\b[^>]*>[\s\S]*?<Message>([\s\S]*?)<\/Message>/i);
      if (messageMatch) {
        message = unescapeXml(messageMatch[1].trim());
      }

      // 3. EventData / UserData key-value extraction
      const eventData = {};
      const dataRegex = /<Data(?:\s+Name=['"]([^'"]+)['"])?>([\s\S]*?)<\/Data>/gi;
      let dataMatch;
      let dataIndex = 0;
      while ((dataMatch = dataRegex.exec(inner)) !== null) {
        const key = dataMatch[1] || `Data_${dataIndex++}`;
        const val = unescapeXml(dataMatch[2].trim());
        eventData[key] = val;
      }

      // If message wasn't rendered by wevtutil, assemble a sensible fallback from EventData
      if (!message) {
        if (eventData.TargetUserName) {
          message = `Event for user: ${eventData.TargetUserName} (Domain: ${eventData.TargetDomainName || ""})`;
        } else if (Object.keys(eventData).length > 0) {
          message = Object.entries(eventData)
            .slice(0, 5)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ");
        } else {
          message = `Windows Event ${eventId} from ${provider} (${channel})`;
        }
      }

      // Map raw level to standard severity
      let severity = "LOW";
      if (rawLevelNum === 1) severity = "CRITICAL";
      else if (rawLevelNum === 2) severity = "HIGH";
      else if (rawLevelNum === 3) severity = "MEDIUM";
      else severity = "LOW";

      // Try extracting IP addresses if present in EventData
      const sourceIP = eventData.IpAddress || eventData.WorkstationName || eventData.ClientIP || "127.0.0.1";
      const destinationIP = computer || "127.0.0.1";
      const sourcePort = parseInt(eventData.IpPort || "0", 10) || 0;

      events.push({
        eventId,
        recordId,
        provider,
        timestamp,
        level: rawLevelNum,
        severity,
        logName: channel,
        computerName: computer,
        user: userId,
        processId,
        threadId,
        keywords,
        taskCategory,
        message,
        eventData,
        sourceIP: sourceIP === "-" ? "127.0.0.1" : sourceIP,
        destinationIP,
        sourcePort,
        rawLog: rawEvent,
      });
    } catch (parseErr) {
      console.warn(`[WINDOWS PARSER] Warning parsing event XML node: ${parseErr.message}`);
    }
  }

  return events;
}

module.exports = {
  parseWindowsEventXml,
  unescapeXml,
};
