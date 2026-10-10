# CyberSecurity Incident Ledger

An immutable, verifiable cybersecurity incident management and auditing platform powered by **Hyperledger Fabric**, **IPFS (Pinata)**, **Express.js**, and **React**.

---

## 🚀 Key Features

- **Immutable Incident Ledger**: Store and audit cybersecurity incident reports on a decentralized Hyperledger Fabric blockchain.
- **Decentralized Evidence Vault**: Upload and pin digital forensic evidence to IPFS via Pinata, maintaining verifiable cryptographic hashes.
- **Live Security Log Monitoring**: Real-time Windows Event log collector (Security, System, Application) with instant alerts and WebSocket streaming.
- **Cryptographic Verification**: Tamper-proof verification of incident records, chain of custody, and cryptographic signatures.
- **Incident Lifecycle Management**: End-to-end status tracking from detection to investigation, mitigation, and post-incident review.
- **Comprehensive Audit Reports**: PDF generation with verification QR codes for compliance and reporting.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, React Router, Socket.IO Client, Vanilla CSS Design System.
- **Backend**: Node.js, Express 5, MongoDB (Mongoose), Socket.IO, JWT Authentication, Multer, PDFKit.
- **Blockchain**: Hyperledger Fabric (Fabric Gateway v1, smart contracts / chaincode), Cryptogen, Fabric CA.
- **Storage**: IPFS via Pinata Web3 SDK.

---

## 📂 Project Structure

```
CyberSecurityIncidentLedger/
├── backend/                  # Express REST API & WebSocket server
│   ├── collectors/           # Windows Event Log live collector
│   ├── config/               # Database and Fabric configurations
│   ├── controllers/          # Request handlers
│   ├── middleware/           # Auth and error middleware
│   ├── models/               # MongoDB models
│   ├── routes/               # API routes
│   ├── services/             # Blockchain and Pinata services
│   ├── utils/                # Helper utilities
│   ├── .env.example          # Environment variable template
│   └── server.js             # Server entry point
├── blockchain/               # Hyperledger Fabric configuration & chaincode
│   ├── chaincode/            # Incident ledger smart contract
│   └── fabric/               # Network setup, crypto material & configs
├── frontend/                 # React + Vite client application
│   ├── src/
│   │   ├── components/       # UI components & charts
│   │   ├── pages/            # Application views & dashboards
│   │   └── services/         # API & socket services
├── docs/                     # Documentation and guides
├── scripts/                  # Network automation scripts
└── README.md
```

---

## 🚦 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- [Docker](https://www.docker.com/) (for Hyperledger Fabric network)

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Fill in your MONGO_URI, JWT_SECRET, and PINATA credentials in .env
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

---

## 📄 License
ISC
