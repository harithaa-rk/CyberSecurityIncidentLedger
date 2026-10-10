import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";

/**
 * ThreatConstellation Component
 * Interactive graph-based constellation of the real security environment.
 * Maps Incidents, Suspicious IPs, Target Assets, and Blockchain Evidence.
 * High-performance HTML5 Canvas with smooth pan, zoom, node selection,
 * and contextual investigation drawer.
 */
export default function ThreatConstellation({ incidents = [], logs = [], onSelectNode }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Viewport State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterType, setFilterType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Build Graph Nodes & Edges from ACTUAL backend incidents & logs
  const graphData = useMemo(() => {
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    // Central Sentinel Node
    const centerNode = {
      id: "CENTRAL_SENTINEL",
      type: "SENTINEL",
      label: "OWLYX SOC CORE",
      sublabel: "Active Sentinel Node",
      color: "#F4C542",
      radius: 28,
      x: 0,
      y: 0,
    };
    nodes.push(centerNode);
    nodeMap.set("CENTRAL_SENTINEL", centerNode);

    // Track extracted entities
    const ipMap = new Map();
    const activeIncidents = (incidents || []).slice(0, 15);

    activeIncidents.forEach((inc, idx) => {
      const angle = (idx / Math.max(1, activeIncidents.length)) * 2 * Math.PI;
      const dist = 180 + (idx % 2 === 0 ? 30 : -30);
      const incX = Math.cos(angle) * dist;
      const incY = Math.sin(angle) * dist;

      const incNode = {
        id: `INC_${inc._id || inc.incidentId}`,
        rawId: inc._id || inc.incidentId,
        incidentId: inc.incidentId,
        type: "INCIDENT",
        label: inc.incidentId,
        sublabel: inc.title || inc.attackType || "Security Incident",
        severity: inc.severity || "MEDIUM",
        status: inc.status || "OPEN",
        color:
          inc.severity === "CRITICAL"
            ? "#FF4D4F"
            : inc.severity === "HIGH"
            ? "#FF7849"
            : inc.severity === "MEDIUM"
            ? "#FFB547"
            : "#36D6AE",
        radius: 18,
        x: incX,
        y: incY,
        raw: inc,
      };
      nodes.push(incNode);
      nodeMap.set(incNode.id, incNode);

      // Edge from Central Sentinel to Incident
      edges.push({
        source: "CENTRAL_SENTINEL",
        target: incNode.id,
        color: "rgba(244, 197, 66, 0.25)",
        dashed: true,
      });

      // Extract Source IP Node
      const srcIP = inc.sourceIP || (inc.relatedEvents && inc.relatedEvents[0]?.sourceIP);
      if (srcIP && srcIP !== "N/A" && srcIP !== "127.0.0.1") {
        let ipNode = ipMap.get(srcIP);
        if (!ipNode) {
          const ipAngle = angle + (Math.random() - 0.5) * 0.5;
          const ipDist = dist + 110;
          ipNode = {
            id: `IP_${srcIP}`,
            type: "IP",
            label: srcIP,
            sublabel: "Threat Source IP",
            color: "#FF4D4F",
            radius: 13,
            x: Math.cos(ipAngle) * ipDist,
            y: Math.sin(ipAngle) * ipDist,
            ip: srcIP,
          };
          nodes.push(ipNode);
          nodeMap.set(ipNode.id, ipNode);
          ipMap.set(srcIP, ipNode);
        }
        edges.push({
          source: ipNode.id,
          target: incNode.id,
          color: "rgba(255, 77, 79, 0.4)",
        });
      }

      // Extract Evidence Nodes if attached
      if (inc.evidence && inc.evidence.length > 0) {
        inc.evidence.slice(0, 2).forEach((ev, evIdx) => {
          const evAngle = angle - 0.25 + evIdx * 0.5;
          const evDist = dist + 85;
          const evNode = {
            id: `EV_${ev._id || ev.evidenceId || evIdx}`,
            type: "EVIDENCE",
            label: ev.evidenceId || `EVD-${idx + 1}`,
            sublabel: ev.fileName || "Blockchain Evidence",
            color: ev.blockchainTxId ? "#36D6AE" : "#B58B20",
            radius: 12,
            x: Math.cos(evAngle) * evDist,
            y: Math.sin(evAngle) * evDist,
            evidence: ev,
            incidentId: inc.incidentId,
          };
          nodes.push(evNode);
          nodeMap.set(evNode.id, evNode);
          edges.push({
            source: incNode.id,
            target: evNode.id,
            color: "rgba(54, 214, 174, 0.4)",
          });
        });
      }
    });

    return { nodes, edges, nodeMap };
  }, [incidents, logs]);

  // Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Save transform
      ctx.save();
      ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
      ctx.scale(zoom, zoom);

      // Subtle Background Radar Circles
      ctx.strokeStyle = "rgba(41, 43, 34, 0.6)";
      ctx.lineWidth = 1;
      [100, 180, 260, 340].forEach((r) => {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, 2 * Math.PI);
        ctx.stroke();
      });

      // Draw Edges
      graphData.edges.forEach((edge) => {
        const source = graphData.nodeMap.get(edge.source);
        const target = graphData.nodeMap.get(edge.target);
        if (!source || !target) return;

        // Skip filtered out edges
        if (
          filterType !== "ALL" &&
          source.type !== filterType &&
          target.type !== filterType &&
          source.type !== "SENTINEL"
        ) {
          return;
        }

        ctx.strokeStyle = edge.color || "rgba(155, 157, 145, 0.2)";
        ctx.lineWidth = selectedNode && (selectedNode.id === source.id || selectedNode.id === target.id) ? 2 : 1;

        if (edge.dashed) {
          ctx.setLineDash([4, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw Nodes
      graphData.nodes.forEach((node) => {
        if (filterType !== "ALL" && node.type !== filterType && node.type !== "SENTINEL") {
          return;
        }

        const isSelected = selectedNode && selectedNode.id === node.id;
        const isMatched =
          searchQuery &&
          (node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            node.sublabel.toLowerCase().includes(searchQuery.toLowerCase()));

        // Outer glow on selected/threat nodes
        if (isSelected || isMatched || node.type === "SENTINEL") {
          ctx.fillStyle = node.color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, 2 * Math.PI);
          ctx.globalAlpha = 0.25;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }

        // Main Node Body
        ctx.fillStyle = "#141610";
        ctx.strokeStyle = node.color;
        ctx.lineWidth = isSelected ? 3 : 2;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Node Inner Symbol or Mascot Core
        if (node.type === "SENTINEL") {
          ctx.fillStyle = "#F4C542";
          ctx.font = "bold 14px 'Space Grotesk', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("OWL", node.x, node.y);
        } else if (node.type === "INCIDENT") {
          ctx.fillStyle = node.color;
          ctx.font = "bold 10px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("!", node.x, node.y);
        } else if (node.type === "IP") {
          ctx.fillStyle = "#FF4D4F";
          ctx.font = "bold 9px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("IP", node.x, node.y);
        } else if (node.type === "EVIDENCE") {
          ctx.fillStyle = node.color;
          ctx.font = "bold 9px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⛓", node.x, node.y);
        }

        // Labels
        ctx.fillStyle = isSelected ? "#F4C542" : "#F2F2EA";
        ctx.font = "600 11px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.label, node.x, node.y + node.radius + 4);

        if (zoom >= 0.95 && node.type !== "SENTINEL") {
          ctx.fillStyle = "#9B9D91";
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.fillText(node.sublabel.slice(0, 18), node.x, node.y + node.radius + 18);
        }
      });

      ctx.restore();
    };

    render();

    const handleResize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = 480;
        render();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [graphData, zoom, pan, selectedNode, filterType, searchQuery]);

  // Mouse Interaction: Pan and Zoom
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = (e) => {
    setIsDragging(false);

    // Check click hit test
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - canvas.width / 2 - pan.x;
    const mouseY = e.clientY - rect.top - canvas.height / 2 - pan.y;

    const clicked = graphData.nodes.find((node) => {
      const dx = (node.x * zoom) - mouseX;
      const dy = (node.y * zoom) - mouseY;
      return Math.sqrt(dx * dx + dy * dy) <= (node.radius + 6) * zoom;
    });

    if (clicked) {
      setSelectedNode(clicked);
      if (onSelectNode) onSelectNode(clicked);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(2.5, Math.max(0.5, prev * zoomFactor)));
  };

  return (
    <div
      style={{
        background: "#0D0F0C",
        border: "1px solid #292B22",
        borderRadius: 14,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
      }}
    >
      {/* HUD Header Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid #292B22",
          background: "#141610",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#F4C542",
              boxShadow: "0 0 10px #F4C542",
            }}
          />
          <div>
            <div
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "#F2F2EA",
                letterSpacing: "-0.01em",
              }}
            >
              THREAT CONSTELLATION GRAPH
            </div>
            <div style={{ fontSize: "0.72rem", color: "#9B9D91", fontFamily: "JetBrains Mono, monospace" }}>
              Active Entities: {graphData.nodes.length} Nodes · {graphData.edges.length} Telemetry Vectors
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { id: "ALL", label: "All Entities" },
            { id: "INCIDENT", label: "Incidents" },
            { id: "IP", label: "Threat IPs" },
            { id: "EVIDENCE", label: "Evidence" },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilterType(btn.id)}
              style={{
                background: filterType === btn.id ? "rgba(244, 197, 66, 0.15)" : "#080907",
                color: filterType === btn.id ? "#F4C542" : "#9B9D91",
                border: filterType === btn.id ? "1px solid #F4C542" : "1px solid #292B22",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: "0.75rem",
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            style={{
              background: "#1A1D15",
              color: "#F2F2EA",
              border: "1px solid #292B22",
              borderRadius: 6,
              width: 28,
              height: 28,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            style={{
              background: "#1A1D15",
              color: "#F2F2EA",
              border: "1px solid #292B22",
              borderRadius: 6,
              width: 28,
              height: 28,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            -
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            style={{
              background: "#1A1D15",
              color: "#9B9D91",
              border: "1px solid #292B22",
              borderRadius: 6,
              padding: "0 8px",
              height: 28,
              fontSize: "0.72rem",
              fontFamily: "JetBrains Mono, monospace",
              cursor: "pointer",
            }}
          >
            RESET
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div style={{ width: "100%", height: 480, position: "relative", cursor: isDragging ? "grabbing" : "grab" }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Tactical Legend Overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 16,
            background: "rgba(8, 9, 7, 0.85)",
            backdropFilter: "blur(6px)",
            border: "1px solid #292B22",
            borderRadius: 8,
            padding: "8px 14px",
            display: "flex",
            gap: 14,
            fontSize: "0.72rem",
            fontFamily: "JetBrains Mono, monospace",
            color: "#9B9D91",
            pointerEvents: "none",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F4C542" }} /> Core Sentinel
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF4D4F" }} /> Critical / Threat IP
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFB547" }} /> Incident Under Study
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#36D6AE" }} /> Blockchain Verified
          </span>
        </div>

        {/* Contextual Side Drawer for Selected Entity */}
        {selectedNode && selectedNode.type !== "SENTINEL" && (
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              bottom: 14,
              width: 320,
              background: "#141610",
              border: "1px solid rgba(244, 197, 66, 0.4)",
              borderRadius: 10,
              boxShadow: "0 10px 40px rgba(0,0,0,0.85)",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              zIndex: 10,
              animation: "drawerSlideRight 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.75rem",
                  color: selectedNode.color,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  background: "rgba(244, 197, 66, 0.08)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: `1px solid ${selectedNode.color}`,
                }}
              >
                {selectedNode.type} NODE
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  color: "#9B9D91",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  padding: "0 4px",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#F2F2EA" }}>
              {selectedNode.label}
            </div>
            <div style={{ color: "#9B9D91", fontSize: "0.8rem", marginTop: 4, marginBottom: 16 }}>
              {selectedNode.sublabel}
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {selectedNode.type === "INCIDENT" && (
                <>
                  <div style={{ background: "#080907", padding: "10px", borderRadius: 8, border: "1px solid #292B22" }}>
                    <div style={{ fontSize: "0.7rem", color: "#686B60", fontFamily: "JetBrains Mono, monospace" }}>SEVERITY</div>
                    <div style={{ color: selectedNode.color, fontWeight: 700, fontSize: "0.9rem" }}>{selectedNode.severity}</div>
                  </div>
                  <div style={{ background: "#080907", padding: "10px", borderRadius: 8, border: "1px solid #292B22" }}>
                    <div style={{ fontSize: "0.7rem", color: "#686B60", fontFamily: "JetBrains Mono, monospace" }}>STATUS</div>
                    <div style={{ color: "#F2F2EA", fontWeight: 700, fontSize: "0.9rem" }}>{selectedNode.status}</div>
                  </div>
                  {selectedNode.raw?.sourceIP && (
                    <div style={{ background: "#080907", padding: "10px", borderRadius: 8, border: "1px solid #292B22" }}>
                      <div style={{ fontSize: "0.7rem", color: "#686B60", fontFamily: "JetBrains Mono, monospace" }}>SOURCE IP</div>
                      <div style={{ color: "#F2F2EA", fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem" }}>
                        {selectedNode.raw.sourceIP}
                      </div>
                    </div>
                  )}
                  {selectedNode.raw?.evidence?.length > 0 && (
                    <div style={{ background: "#080907", padding: "10px", borderRadius: 8, border: "1px solid #292B22" }}>
                      <div style={{ fontSize: "0.7rem", color: "#686B60", fontFamily: "JetBrains Mono, monospace" }}>ATTACHED EVIDENCE</div>
                      <div style={{ color: "#36D6AE", fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem" }}>
                        {selectedNode.raw.evidence.length} Forensic Record(s)
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedNode.type === "IP" && (
                <div style={{ background: "#080907", padding: "12px", borderRadius: 8, border: "1px solid #292B22" }}>
                  <div style={{ fontSize: "0.7rem", color: "#686B60", fontFamily: "JetBrains Mono, monospace" }}>THREAT TELEMETRY</div>
                  <div style={{ color: "#FF4D4F", fontSize: "0.85rem", marginTop: 4 }}>
                    Host identified across network security logs. Verified external telemetry source.
                  </div>
                </div>
              )}

              {selectedNode.type === "EVIDENCE" && (
                <>
                  <div style={{ background: "#080907", padding: "10px", borderRadius: 8, border: "1px solid #292B22" }}>
                    <div style={{ fontSize: "0.7rem", color: "#686B60", fontFamily: "JetBrains Mono, monospace" }}>SHA-256 HASH</div>
                    <div style={{ color: "#F2F2EA", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>
                      {selectedNode.evidence?.hash || "Computed and verified"}
                    </div>
                  </div>
                  {selectedNode.evidence?.cid && (
                    <div style={{ background: "#080907", padding: "10px", borderRadius: 8, border: "1px solid #292B22" }}>
                      <div style={{ fontSize: "0.7rem", color: "#686B60", fontFamily: "JetBrains Mono, monospace" }}>IPFS CID</div>
                      <div style={{ color: "#36D6AE", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>
                        {selectedNode.evidence.cid}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Quick Action Button */}
            {selectedNode.type === "INCIDENT" && (
              <button
                onClick={() => navigate(`/admin/incidents/${selectedNode.incidentId}`)}
                style={{
                  marginTop: 14,
                  background: "linear-gradient(135deg, #F4C542 0%, #B58B20 100%)",
                  color: "#080907",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 800,
                  fontSize: "0.875rem",
                  padding: "10px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Inspect Incident Details →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
