# Phase 4 Module 4 — Hyperledger Fabric Development Network
## CyberSecurity Incident Ledger

---

## Network Architecture

```
blockchain/fabric/
├── network/
│   ├── compose/
│   │   └── docker-compose.yaml       ← Orderer, Peer, CA ×2, CLI
│   ├── configtx/
│   │   └── configtx.yaml             ← IncidentChannelGenesis profile
│   ├── organizations/
│   │   ├── cryptogen/
│   │   │   ├── crypto-config-org1.yaml
│   │   │   └── crypto-config-orderer.yaml
│   │   └── fabric-ca/
│   │       ├── registerEnroll.ps1    ← Windows: enroll identities
│   │       └── registerEnroll.sh     ← Linux/Mac: enroll identities
│   ├── scripts/
│   │   ├── startNetwork.ps1 / .sh    ← START the network
│   │   ├── stopNetwork.ps1  / .sh    ← STOP the network
│   │   ├── createChannel.ps1 / .sh   ← CREATE incidentchannel
│   │   ├── networkStatus.ps1         ← VIEW network status
│   │   └── testTransaction.ps1       ← TEST transactions on ledger
│   └── channel-artifacts/            ← Genesis block output dir
├── chaincode/incident-ledger/
│   ├── package.json
│   ├── index.js
│   └── lib/
│       └── incidentLedgerContract.js ← Smart Contract
├── console/
│   ├── package.json
│   └── fabricConsole.js             ← 🖥️ BLOCKCHAIN CONSOLE (CMD)
└── application/
    └── README.md                    ← Phase 5 integration plan
```

---

## Components

| Component | Image | Port | Role |
|---|---|---|---|
| `orderer.incidentledger.com` | `fabric-orderer:2.5` | 7050, 7053 | Raft orderer |
| `peer0.org1.incidentledger.com` | `fabric-peer:2.5` | 7051, 7052 | Endorser peer |
| `ca_org1` | `fabric-ca:1.5` | 7054 | Org1 Certificate Authority |
| `ca_orderer` | `fabric-ca:1.5` | 9054 | Orderer Certificate Authority |
| `cli` | `fabric-tools:2.5` | — | Admin CLI tools |

**Channel:** `incidentchannel`  
**MSP:** `Org1MSP` / `OrdererMSP`

---

## Commands

### Start the Network
```powershell
# From: blockchain/fabric/network/
.\scripts\startNetwork.ps1
```

### Enroll Fabric Identities
```powershell
# From: blockchain/fabric/network/
.\organizations\fabric-ca\registerEnroll.ps1
```

### Create incidentchannel
```powershell
# From: blockchain/fabric/network/
.\scripts\createChannel.ps1
```

### View Network Status
```powershell
# From: blockchain/fabric/network/
.\scripts\networkStatus.ps1
```

### Stop the Network
```powershell
# From: blockchain/fabric/network/
.\scripts\stopNetwork.ps1

# Full clean (removes crypto + artifacts):
.\scripts\stopNetwork.ps1 -Clean
```

### Test Transactions
```powershell
# From: blockchain/fabric/network/
.\scripts\testTransaction.ps1
```

---

## 🖥️ Blockchain Console

Streams all Fabric blockchain transactions live to the terminal (CMD/PowerShell).

### Start the Console
```powershell
cd blockchain\fabric\console
npm install
node fabricConsole.js
```

### What the Console Displays

Every committed Fabric transaction prints a block like this:

```
══════════════════════════════════════════════════════════════════════
  [TX #1] EvidenceRecorded  @ 11/09/2026, 10:35:25 AM  |  Uptime: 0s
══════════════════════════════════════════════════════════════════════
  BLOCK           #2
  CHANNEL         incidentchannel
  CHAINCODE       incident-ledger
  TX ID           a96a2b1721108e91385800bfa79d4dc93dbca1a13c90d4b9641380d54c5ae168
  EVIDENCE ID     EVD-20260911-080406
  INCIDENT ID     INC-20260909-533328
  SHA-256 HASH    bafkreifjnivroiiqr2itqwaax6tz2tojhw6kdij4sdklszatqdkuywxbna
  IPFS CID        bafkreifjnivroiiqr2itqwaax6tz2tojhw6kdij4sdklszatqdkuywxbna
  RECORDED BY     analyst@incidentledger.io
  TIMESTAMP       2026-09-11T04:35:25.275Z
  FILE            firewall-drop.log (text/plain, 2,048 bytes)
  STATUS          ACTIVE
──────────────────────────────────────────────────────────────────────
  📊 Total Transactions: 1  |  Latest Block: #2  |  Uptime: 12s  |  Channel: incidentchannel
```

- ✅ **DEMO MODE**: Works immediately without a live Fabric network — simulates transactions every 8s.
- ✅ **LIVE MODE**: Automatically switches to real block event streaming when the network is up.
- 🔴 **IntegrityViolation** events are highlighted in red with a tamper alert.

---

## Chaincode — `IncidentLedgerContract`

| Function | Type | Description |
|---|---|---|
| `InitLedger` | Submit | Initialize ledger with genesis record |
| `RecordEvidence` | Submit | Immutably store evidence metadata |
| `GetEvidence` | Evaluate | Read evidence by ID |
| `VerifyEvidence` | Evaluate | Verify SHA-256 hash integrity |
| `GetIncidentEvidence` | Evaluate | All evidence for an incident |
| `GetEvidenceHistory` | Evaluate | Full audit trail from ledger history |
| `UpdateEvidenceStatus` | Submit | Flag or revoke evidence |
| `GetAllEvidence` | Evaluate | Admin: list all ledger records |
