# 🏥 HealthChain: Decentralized EHR System

> **Patient-centric medical records secured by blockchain — because your health data belongs to you.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-healthchain--frontend.vercel.app-00c896?style=for-the-badge&logo=vercel)](https://healthchain-frontend.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.x-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org)
[![Node.js](https://img.shields.io/badge/Node.js-v16+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)

HealthChain is a production-grade, decentralized Electronic Health Record (EHR) platform built on a **Hybrid Web3 architecture**. It combines the speed of traditional databases with the trustlessness of blockchain, returning complete data ownership to patients while enabling seamless, verifiable access for authorized healthcare professionals.

---

## 🌟 Key Features

| Feature | Description |
|---|---|
| 🔐 **Patient Ownership** | Patients are the sole authority to grant or revoke access — no intermediary can override this |
| ⛓️ **Immutable Audit Trail** | Every permission change and record upload is anchored to the Ethereum Sepolia blockchain |
| 🌐 **Decentralized Storage** | Medical files are stored on IPFS via Pinata — no single point of failure, no central server holding your data |
| ⚡ **Hybrid Architecture** | MongoDB Atlas handles fast metadata lookups; blockchain enforces integrity and access control |
| 📡 **Real-time Feedback** | Transaction Stepper UI gives users live blockchain mining and IPFS pinning status updates |
| 🔒 **Cryptographic Identity** | Passwords hashed with Bcrypt; private keys never leave the backend environment |

---

## 🛠️ Tech Stack

### Frontend
- **React.js** — component-based UI with hooks
- **Tailwind CSS** — utility-first responsive styling
- **Framer Motion** — fluid UI animations
- **Lucide Icons** — consistent iconography
- **Ethers.js** — wallet and contract interaction from the browser

### Backend
- **Node.js + Express.js** — REST API layer
- **MongoDB Atlas** — user authentication and off-chain metadata storage
- **Bcrypt** — password hashing
- **Pinata SDK** — IPFS file pinning via stream upload

### Blockchain
- **Solidity** — smart contract for access control and CID linking
- **Ethereum Sepolia Testnet** — decentralized permission ledger
- **Ethers.js (backend)** — server-side contract interaction for write operations

### Infrastructure
- **Vercel** — frontend deployment with CDN
- **Koyeb** — backend deployment with persistent processes

---

## 📐 System Architecture

HealthChain uses a **"Hybrid Web3"** approach — combining the performance of Web2 infrastructure with the trustlessness of blockchain:

```
┌──────────────┐        ┌──────────────────────┐        ┌───────────────────┐
│   Patient /  │        │   Node.js Backend    │        │  Ethereum Sepolia │
│   Doctor UI  │◄──────►│  Express + MongoDB   │◄──────►│   Smart Contract  │
│  (React.js)  │        │  Auth + Metadata     │        │  Access Control   │
└──────────────┘        └──────────┬───────────┘        └───────────────────┘
                                   │                              ▲
                                   ▼                              │
                         ┌──────────────────┐           CID anchored on-chain
                         │   Pinata / IPFS  │
                         │  Decentralized   │
                         │  File Storage    │
                         └──────────────────┘
```

### Data Flow

1. **Identity** — Users register via the Express backend; passwords are hashed with Bcrypt and profiles are stored in MongoDB Atlas.
2. **Permissions** — Patients call the smart contract directly (via Ethers.js in-browser) to update access mappings on-chain.
3. **Storage** — Healthcare professionals upload files; the backend streams them to IPFS via Pinata and receives a Content Identifier (CID).
4. **Linking** — The backend signs and submits a transaction anchoring the CID to the patient's on-chain record.
5. **Retrieval** — Patients and authorized providers fetch records through the IPFS gateway using the CID stored on-chain.

---

## 🚀 Getting Started

### Prerequisites

- Node.js v16+
- Metamask Wallet with Sepolia test ETH ([faucet](https://sepoliafaucet.com))
- [Alchemy](https://www.alchemy.com) or [Infura](https://infura.io) API key (Sepolia RPC)
- [Pinata](https://pinata.cloud) API key and secret

### 1. Clone the Repository

```bash
git clone https://github.com/JSWLOM/healthchain.git
cd healthchain
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file in `/backend`:

```env
MONGO_URI=your_mongodb_atlas_connection_string
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret
BACKEND_PRIVATE_KEY=your_wallet_private_key
ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
EHR_CONTRACT_ADDRESS=your_deployed_contract_address
PORT=5000
```

```bash
npm start
```

### 3. Setup Frontend

```bash
cd ../frontend
npm install
```

Update `BASE_URL` in `src/pages/LandingPage.jsx` to point to your backend URL (local or deployed).

```bash
npm start
```

The app will be live at `http://localhost:3000`.

---

## 🔄 Workflow

```
Patient Registers
      │
      ▼
Patient grants access ──► Smart Contract updated on-chain
      │
      ▼
Doctor searches Patient ID ──► Contract verifies permission
      │
      ▼
Doctor uploads report ──► File streamed to IPFS → CID returned
      │
      ▼
CID anchored on Ethereum ──► Permanent, tamper-proof record
      │
      ▼
Patient logs in ──► Views / downloads report via IPFS gateway
```

---

## 📁 Project Structure

```
healthchain/
├── frontend/
│   ├── src/
│   │   ├── pages/          # LandingPage, Dashboard, RecordsView
│   │   ├── components/     # TransactionStepper, AccessControl, FileUpload
│   │   └── utils/          # contract.js, ipfs.js, api.js
│   └── public/
├── backend/
│   ├── routes/             # auth.js, records.js, access.js
│   ├── controllers/        # Handles IPFS upload, contract write
│   ├── models/             # User, Record (Mongoose schemas)
│   └── server.js
├── contracts/
│   └── EHR.sol             # Solidity access control + CID registry
└── scripts/
    └── deploy.js           # Hardhat deployment script
```

---

## 🔐 Smart Contract Overview

The `EHR.sol` contract manages two core responsibilities:

```solidity
// Access Control Mapping
mapping(address => mapping(address => bool)) private accessPermissions;

// Record Storage
mapping(address => string[]) private patientRecords;

function grantAccess(address provider) external;
function revokeAccess(address provider) external;
function addRecord(address patient, string memory cid) external onlyAuthorized(patient);
function getRecords(address patient) external view onlyAuthorized(patient) returns (string[] memory);
```

All permission changes and record additions emit on-chain events, forming an immutable audit log.

---

## 👥 Team

| Name | Role |
|---|---|
| **Om Jaiswal** | Full-Stack & Blockchain — Data Science, Manipal University Jaipur |
| **Shreya Singh** | Frontend & Integration — Data Science, Manipal University Jaipur |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  Developed with ❤️ as a secure solution for modern healthcare.<br/>
  <sub>Built on Ethereum Sepolia Testnet — not for production medical use.</sub>
</div>
