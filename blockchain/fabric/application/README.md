# Hyperledger Fabric Application — CyberSecurity Incident Ledger

## Phase 4 Module 4 — Network Setup (COMPLETE)
## Phase 4 Module 5 — Application Integration (NEXT)

This directory is reserved for the **Fabric Gateway Client SDK** application
that will connect the Node.js backend to the `incidentchannel` Fabric ledger.

---

## What Will Be Built Here (Next Module)

```
application/
├── gateway/
│   ├── fabricGateway.js        # Fabric Gateway connection & gRPC client
│   ├── identityManager.js      # Identity/wallet management
│   └── connectionProfile.yaml  # Fabric connection profile
├── services/
│   ├── evidenceLedgerService.js # recordEvidence(), queryEvidence(), verifyEvidence()
│   └── eventListenerService.js  # Real-time event subscription to Fabric
└── package.json
```

## Dependencies (Phase 5)
- `@hyperledger/fabric-gateway` — Official Fabric SDK v1.4+
- `@grpc/grpc-js` — gRPC transport
- `dotenv` — Environment configuration

## Chaincode Methods Available
| Method | Type | Description |
|---|---|---|
| `RecordEvidence` | Submit | Store evidence metadata on ledger |
| `GetEvidence` | Evaluate | Query evidence by ID |
| `VerifyEvidence` | Evaluate | Verify SHA-256 hash integrity |
| `GetIncidentEvidence` | Evaluate | All evidence for an incident |
| `GetEvidenceHistory` | Evaluate | Full audit trail from block history |
| `UpdateEvidenceStatus` | Submit | Flag or revoke evidence |
| `GetAllEvidence` | Evaluate | Admin — all ledger records |

## Fabric Console (Active)
The Blockchain Console is already implemented and can be started immediately:
```bash
cd blockchain/fabric/console
npm install
node fabricConsole.js
```
