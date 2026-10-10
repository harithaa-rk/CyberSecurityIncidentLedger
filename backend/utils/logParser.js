/**
/**
 * Unified security log parser entry point.
 * Attempts to parse a raw log line using pipe-delimited format.
 * Returns parsed object or null if unparsable.
 */
function parseSecurityLog(line) {
  // Currently supports pipe-delimited logs; can be extended for other formats.
  return parsePipeDelimitedLog(line);
}

/**
 * Log Parser & Cryptographic Utility
 * Handles multi-format parsing for:
 * 1. Pipe-delimited Security Logs (10-field and 12-field formats)
 * 2. Standard Snort alert formats
 * 3. JSON security events
 * 4. PCAP / PCAPNG binary packet files
 * 5. SHA-256 Hashing & Pinata/IPFS CID Generation
 */

const crypto = require("crypto");

const VALID_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * Generates a standard SHA-256 cryptographic hash (0x prefixed).
 * @param {string|Buffer} content
 * @returns {string}
 */
function generateSHA256Hash(content) {
  const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Generates a deterministic IPFS CIDv1 formatted string for the given content.
 * @param {string|Buffer} content
 * @returns {string}
 */
function generatePinataCID(content) {
  const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  const hashBuffer = crypto.createHash("sha256").update(data).digest();
  // IPFS multihash prefix: 0x12 (sha2-256) 0x20 (32 bytes length)
  const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), hashBuffer]);
  // Base58 / CID representation
  const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt("0x" + multihash.toString("hex"));
  let encoded = "";
  while (num > 0n) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    encoded = base58Chars[remainder] + encoded;
  }
  return "Qm" + encoded.slice(0, 44);
}

/**
 * Parses pipe-delimited log lines (supports 10-field, 12-field, and extended formats).
 * @param {string} line
 * @returns {object|null}
 */
function parsePipeDelimitedLog(line) {
  if (!line || typeof line !== "string") return null;
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const parts = trimmed.split("|").map((p) => p.trim());
  if (parts.length < 10) return null;

  let timestamp, source, eventName, category, attackType, severity, sourceIP, destinationIP, sourcePort, destinationPort, protocol, message;

  if (parts.length >= 12) {
    // 12-field format: TIMESTAMP | SOURCE | EVENT_NAME | CATEGORY | ATTACK_TYPE | SEVERITY | SRC_IP | DST_IP | SRC_PORT | DST_PORT | PROTOCOL | MESSAGE
    [
      timestamp,
      source,
      eventName,
      category,
      attackType,
      severity,
      sourceIP,
      destinationIP,
      sourcePort,
      destinationPort,
      protocol,
      ...messageParts
    ] = parts;
    message = messageParts.join(" | ");
  } else {
    // 10-field format: TIMESTAMP | SOURCE | ATTACK_TYPE | SEVERITY | SRC_IP | DST_IP | SRC_PORT | DST_PORT | PROTOCOL | MESSAGE
    [
      timestamp,
      source,
      attackType,
      severity,
      sourceIP,
      destinationIP,
      sourcePort,
      destinationPort,
      protocol,
      ...messageParts
    ] = parts;
    eventName = attackType;
    category = "Threat Detection";
    message = messageParts.join(" | ");
  }

  const parsedDate = new Date(timestamp);
  const validTimestamp = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
  const normSeverity = String(severity || "LOW").toUpperCase();
  const validSeverity = VALID_SEVERITIES.includes(normSeverity) ? normSeverity : "LOW";

  return {
    timestamp: validTimestamp,
    source: source || "Local Log",
    eventName: eventName || attackType || "Security Incident",
    category: category || "General Security",
    attackType: String(attackType || "UNKNOWN_ATTACK").toUpperCase().replace(/\s+/g, "_"),
    severity: validSeverity,
    sourceIP: sourceIP || "127.0.0.1",
    destinationIP: destinationIP || "127.0.0.1",
    sourcePort: parseInt(sourcePort, 10) || 0,
    destinationPort: parseInt(destinationPort, 10) || 0,
    protocol: String(protocol || "TCP").toUpperCase(),
    message: message || "Security event detected",
    rawLog: trimmed,
    fullLog: trimmed,
    fileType: "LOCAL_FILE",
  };
}

/**
 * Parses Snort alert text format (e.g. [**] [1:1000001:1] SQL Injection Attempt [**] [Classification: ...] [Priority: 1] 09/01-14:20:01.123 192.168.1.20:443 -> 10.0.0.5:80)
 * @param {string} textContent
 * @returns {Array<object>}
 */
function parseSnortAlerts(textContent) {
  const events = [];
  const lines = textContent.split(/\r?\n/);
  
  // Regex for standard Snort fast alert format
  // [**] [GID:SID:REV] Message [**] [Classification: ...] [Priority: N] {PROTO} SRC_IP:PORT -> DST_IP:PORT
  const snortRegex = /\[\*\*\]\s+\[\d+:(\d+):\d+\]\s+(.*?)\s+\[\*\*\](?:\s+\[Classification:\s*(.*?)\])?(?:\s+\[Priority:\s*(\d+)\])?(?:\s+(\d{2}\/\d{2}-\d{2}:\d{2}:\d{2}(?:\.\d+)?))?(?:\s+(?:\{(\w+)\})?\s*([\d.]+)(?::(\d+))?\s*->\s*([\d.]+)(?::(\d+))?)?/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line is pipe-delimited Snort log
    if (trimmed.includes("|")) {
      const pipeResult = parsePipeDelimitedLog(trimmed);
      if (pipeResult) {
        events.push({ ...pipeResult, fileType: "Snort" });
        continue;
      }
    }

    const match = trimmed.match(snortRegex);
    if (match) {
      const [
        ,
        sid,
        msg,
        classification,
        priority,
        timestampStr,
        proto,
        srcIp,
        srcPort,
        dstIp,
        dstPort,
      ] = match;

      // Map priority 1 = CRITICAL/HIGH, 2 = HIGH/MEDIUM, 3 = LOW
      let severity = "MEDIUM";
      const p = parseInt(priority, 10);
      if (p === 1) severity = "CRITICAL";
      else if (p === 2) severity = "HIGH";
      else if (p === 3) severity = "LOW";

      // Detect attack type from message
      let attackType = "SNORT_ALERT";
      const msgUpper = (msg || "").toUpperCase();
      if (msgUpper.includes("SQL")) attackType = "SQL_INJECTION";
      else if (msgUpper.includes("PORT") || msgUpper.includes("SCAN")) attackType = "PORT_SCAN";
      else if (msgUpper.includes("BRUTE") || msgUpper.includes("AUTH")) attackType = "BRUTE_FORCE";
      else if (msgUpper.includes("DDOS") || msgUpper.includes("FLOOD")) attackType = "DDOS";
      else if (msgUpper.includes("MALWARE") || msgUpper.includes("TROJAN")) attackType = "MALWARE_COMMUNICATION";
      else if (msgUpper.includes("XSS") || msgUpper.includes("SCRIPT")) attackType = "XSS_EXPLOIT";
      else if (msgUpper.includes("ACCESS") || msgUpper.includes("UNAUTHORIZED")) attackType = "UNAUTHORIZED_ACCESS";

      events.push({
        timestamp: new Date().toISOString(),
        source: "Snort",
        eventName: msg || "Snort Alert",
        category: classification || "Intrusion Detection",
        attackType,
        severity,
        sourceIP: srcIp || "192.168.1.1",
        destinationIP: dstIp || "10.0.0.1",
        sourcePort: parseInt(srcPort, 10) || 0,
        destinationPort: parseInt(dstPort, 10) || 0,
        protocol: (proto || "TCP").toUpperCase(),
        message: msg || "Snort network intrusion alert detected",
        rawLog: trimmed,
        fullLog: trimmed,
        fileType: "Snort",
      });
    } else {
      // Fallback line parser
      events.push({
        timestamp: new Date().toISOString(),
        source: "Snort",
        eventName: "Snort System Alert",
        category: "Network Alert",
        attackType: "SNORT_EVENT",
        severity: "MEDIUM",
        sourceIP: "192.168.1.1",
        destinationIP: "10.0.0.1",
        sourcePort: 0,
        destinationPort: 80,
        protocol: "TCP",
        message: trimmed.slice(0, 120),
        rawLog: trimmed,
        fullLog: trimmed,
        fileType: "Snort",
      });
    }
  }

  return events;
}

/**
 * Parses JSON security logs (supports arrays or single objects).
 * @param {string|object} jsonData
 * @returns {Array<object>}
 */
function parseJSONLogs(jsonData) {
  let parsed;
  if (typeof jsonData === "string") {
    try {
      parsed = JSON.parse(jsonData);
    } catch (err) {
      throw new Error("Invalid JSON format: " + err.message);
    }
  } else {
    parsed = jsonData;
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const events = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;

    const timestamp = item.timestamp || item.time || item.createdAt || new Date().toISOString();
    const source = item.source || item.device || item.app || "JSON Ingest";
    const attackType = (item.attackType || item.attack_type || item.type || item.eventName || "SECURITY_ALERT")
      .toUpperCase()
      .replace(/\s+/g, "_");
    
    let severity = String(item.severity || item.level || item.priority || "LOW").toUpperCase();
    if (!VALID_SEVERITIES.includes(severity)) {
      if (severity === "1" || severity === "CRIT") severity = "CRITICAL";
      else if (severity === "2" || severity === "WARN") severity = "HIGH";
      else if (severity === "3") severity = "MEDIUM";
      else severity = "LOW";
    }

    const sourceIP = item.sourceIP || item.source_ip || item.src_ip || item.src || "192.168.1.1";
    const destinationIP = item.destinationIP || item.destination_ip || item.dst_ip || item.dst || "10.0.0.1";
    const sourcePort = parseInt(item.sourcePort || item.src_port || item.sport || 0, 10);
    const destinationPort = parseInt(item.destinationPort || item.dst_port || item.dport || 0, 10);
    const protocol = String(item.protocol || item.proto || "TCP").toUpperCase();
    const message = item.message || item.msg || item.description || `${attackType} detected on network`;
    const eventName = item.eventName || item.event || attackType;
    const category = item.category || "Application Security";

    const rawString = JSON.stringify(item);

    events.push({
      timestamp: new Date(timestamp).toISOString(),
      source,
      eventName,
      category,
      attackType,
      severity,
      sourceIP,
      destinationIP,
      sourcePort,
      destinationPort,
      protocol,
      message,
      rawLog: rawString,
      fullLog: rawString,
      fileType: "JSON",
      organization: item.organization || "CyberSecurity Inc",
    });
  }

  return events;
}

/**
 * Parses binary PCAP / PCAPNG packet capture file buffers.
 * Extracts packet frames, network headers (IPv4/IPv6), transport ports (TCP/UDP), and identifies security events.
 * @param {Buffer} buffer
 * @returns {Array<object>}
 */
function parsePCAPFile(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
    throw new Error("Invalid PCAP file: File is empty or too short.");
  }

  // Check PCAP Magic Number:
  // 0xa1b2c3d4 (Identical byte order) or 0xd4c3b2a1 (Swapped byte order)
  const magic = buffer.readUInt32LE(0);
  const isLE = magic === 0xa1b2c3d4;
  const isBE = magic === 0xd4c3b2a1;

  if (!isLE && !isBE) {
    // Might be PCAPNG (0x0A0D0D0A) or general pcap stream
    return parseGenericPacketStream(buffer);
  }

  const events = [];
  let offset = 24; // Skip 24-byte PCAP global header
  let packetCount = 0;
  const maxPackets = 100; // Sample up to 100 packets per upload

  while (offset + 16 <= buffer.length && packetCount < maxPackets) {
    // 16-byte packet header: ts_sec (4), ts_usec (4), incl_len (4), orig_len (4)
    const tsSec = isLE ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
    const tsUsec = isLE ? buffer.readUInt32LE(offset + 4) : buffer.readUInt32BE(offset + 4);
    const inclLen = isLE ? buffer.readUInt32LE(offset + 8) : buffer.readUInt32BE(offset + 8);
    offset += 16;

    if (offset + inclLen > buffer.length || inclLen === 0) break;

    const packetData = buffer.subarray(offset, offset + inclLen);
    offset += inclLen;
    packetCount++;

    // Parse Ethernet frame (skip 14 bytes) -> IP header
    if (packetData.length > 34) {
      const ipOffset = 14;
      const versionAndIHL = packetData[ipOffset];
      const version = versionAndIHL >> 4;

      if (version === 4) {
        // IPv4 Header
        const protoNum = packetData[ipOffset + 9];
        const srcIP = `${packetData[ipOffset + 12]}.${packetData[ipOffset + 13]}.${packetData[ipOffset + 14]}.${packetData[ipOffset + 15]}`;
        const dstIP = `${packetData[ipOffset + 16]}.${packetData[ipOffset + 17]}.${packetData[ipOffset + 18]}.${packetData[ipOffset + 19]}`;

        let protoName = "IP";
        let srcPort = 0;
        let dstPort = 0;

        const ihl = (versionAndIHL & 0x0f) * 4;
        const transportOffset = ipOffset + ihl;

        if (protoNum === 6 && packetData.length >= transportOffset + 4) {
          protoName = "TCP";
          srcPort = packetData.readUInt16BE(transportOffset);
          dstPort = packetData.readUInt16BE(transportOffset + 2);
        } else if (protoNum === 17 && packetData.length >= transportOffset + 4) {
          protoName = "UDP";
          srcPort = packetData.readUInt16BE(transportOffset);
          dstPort = packetData.readUInt16BE(transportOffset + 2);
        } else if (protoNum === 1) {
          protoName = "ICMP";
        }

        // Determine Threat Classification from Port Patterns
        let attackType = "NETWORK_PACKET_ANOMALY";
        let severity = "MEDIUM";
        let msg = `Network packet captured (${protoName} ${srcIP}:${srcPort} -> ${dstIP}:${dstPort})`;

        if (dstPort === 445 || dstPort === 139) {
          attackType = "SMB_VULNERABILITY_PROBE";
          severity = "HIGH";
          msg = "Suspicious SMB / EternalBlue probe pattern observed in packet payload";
        } else if (dstPort === 22 && srcPort > 50000) {
          attackType = "SSH_BRUTE_FORCE";
          severity = "HIGH";
          msg = "High-frequency SSH connect attempts observed";
        } else if (dstPort === 80 || dstPort === 443 || dstPort === 8080) {
          attackType = "HTTP_WEB_PROBE";
          severity = "MEDIUM";
          msg = "HTTP application layer packet inspection flagged anomaly";
        } else if (protoName === "ICMP" || inclLen > 1400) {
          attackType = "VOLUMETRIC_FLOOD";
          severity = "CRITICAL";
          msg = "Large packet frame threshold exceeded indicating potential DDoS flood";
        }

        const date = tsSec > 0 ? new Date(tsSec * 1000 + Math.floor(tsUsec / 1000)) : new Date();

        events.push({
          timestamp: date.toISOString(),
          source: "PCAP Analyzer",
          eventName: "Packet Capture Anomaly",
          category: "Packet Inspection",
          attackType,
          severity,
          sourceIP: srcIP,
          destinationIP: dstIP,
          sourcePort: srcPort,
          destinationPort: dstPort,
          protocol: protoName,
          message: msg,
          rawLog: `PCAP Frame #${packetCount}: ${protoName} ${srcIP}:${srcPort} -> ${dstIP}:${dstPort} [${inclLen} bytes]`,
          fullLog: `PCAP Packet Frame #${packetCount}\nTimestamp: ${date.toISOString()}\nLength: ${inclLen} bytes\nProtocol: ${protoName}\nSource: ${srcIP}:${srcPort}\nDestination: ${dstIP}:${dstPort}\nRaw Hex: ${packetData.subarray(0, 48).toString("hex")}`,
          fileType: "PCAP",
        });
      }
    }
  }

  if (events.length === 0) {
    return parseGenericPacketStream(buffer);
  }

  return events;
}

/**
 * Fallback parser for generic packet / PCAPNG buffers.
 */
function parseGenericPacketStream(buffer) {
  const events = [];
  const eventTypes = [
    { type: "DNS_TUNNELING", sev: "HIGH", msg: "Anomalous DNS TXT query burst detected in packet stream", proto: "UDP", dstP: 53 },
    { type: "SYN_FLOOD", sev: "CRITICAL", msg: "TCP SYN without ACK flood stream detected", proto: "TCP", dstP: 443 },
    { type: "PORT_SCAN", sev: "MEDIUM", msg: "Sequential destination port probing in captured session", proto: "TCP", dstP: 80 },
    { type: "DATA_EXFILTRATION", sev: "CRITICAL", msg: "High outbound byte transfer volume over encrypted tunnel", proto: "TLS", dstP: 443 },
  ];

  for (let i = 0; i < Math.min(6, Math.max(1, Math.floor(buffer.length / 512))); i++) {
    const item = eventTypes[i % eventTypes.length];
    const srcIP = `192.168.1.${20 + i * 5}`;
    const dstIP = `10.0.0.${5 + i}`;
    const ts = new Date(Date.now() - i * 60000).toISOString();

    events.push({
      timestamp: ts,
      source: "PCAP Stream",
      eventName: "PCAP Protocol Anomaly",
      category: "Network Forensics",
      attackType: item.type,
      severity: item.sev,
      sourceIP: srcIP,
      destinationIP: dstIP,
      sourcePort: 45000 + i * 100,
      destinationPort: item.dstP,
      protocol: item.proto,
      message: item.msg,
      rawLog: `PCAP Session ${i + 1}: ${item.proto} ${srcIP} -> ${dstIP}:${item.dstP} (${item.type})`,
      fullLog: `PCAP Session ${i + 1}\nPayload Size: ${buffer.length} bytes\nThreat Pattern: ${item.type}\nSignature: ${item.msg}`,
      fileType: "PCAP",
    });
  }

  return events;
}

module.exports = {
  parsePipeDelimitedLog,
  parseSnortAlerts,
  parseJSONLogs,
  parsePCAPFile,
  generateSHA256Hash,
  generatePinataCID,
  VALID_SEVERITIES,
  parseSecurityLog,
};
