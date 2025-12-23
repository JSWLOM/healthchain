const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const pinataSDK = require('@pinata/sdk');
const stream = require('stream');
const { ethers } = require('ethers');
const EHR_ABI = require('./EHR_ABI.json');
require('dotenv').config();

const app = express();
const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

// --- Ethers Setup ---
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL); 
const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
const ehrContract = new ethers.Contract(process.env.EHR_CONTRACT_ADDRESS, EHR_ABI.abi, wallet);

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

/**
 * Robust Gas Strategy for Production
 * Bypasses "txpool is full" and "BAD_DATA" errors.
 */
async function getGasOverrides() {
    try {
        const feeData = await provider.getFeeData();
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas 
            ? (feeData.maxPriorityFeePerGas * 250n) / 100n 
            : ethers.parseUnits('3', 'gwei');

        const currentBaseFee = feeData.maxFeePerGas && feeData.maxPriorityFeePerGas
            ? feeData.maxFeePerGas - feeData.maxPriorityFeePerGas
            : ethers.parseUnits('1', 'gwei');

        const maxFeePerGas = (currentBaseFee * 200n) / 100n + maxPriorityFeePerGas;

        return { maxPriorityFeePerGas, maxFeePerGas, gasLimit: 800000n };
    } catch (error) {
        return { gasLimit: 1000000n, maxPriorityFeePerGas: ethers.parseUnits('5', 'gwei'), maxFeePerGas: ethers.parseUnits('100', 'gwei') }; 
    }
}

// --- Models ---
const counterSchema = new mongoose.Schema({ _id: { type: String, required: true }, sequence_value: { type: Number, default: 0 }});
const Counter = mongoose.model('Counter', counterSchema);
const patientSchema = new mongoose.Schema({ patientId: { type: String, unique: true }, name: { type: String, required: true }, password: { type: String, required: true } });
const Patient = mongoose.model('Patient', patientSchema);
const doctorSchema = new mongoose.Schema({ doctorId: { type: String, unique: true }, name: { type: String, required: true }, password: { type: String, required: true } });
const Doctor = mongoose.model('Doctor', doctorSchema);
const diagnosticCenterSchema = new mongoose.Schema({ diagnosticId: { type: String, unique: true }, name: { type: String, required: true }, password: { type: String, required: true } });
const DiagnosticCenter = mongoose.model('DiagnosticCenter', diagnosticCenterSchema);

async function getNextId(sequenceName, prefix, start) { 
    const doc = await Counter.findByIdAndUpdate(sequenceName, { $inc: { sequence_value: 1 } }, { new: true, upsert: true }); 
    if (doc.sequence_value === 1 && start > 1) { doc.sequence_value = start; await doc.save(); } 
    return `${prefix}-${doc.sequence_value}`; 
}

// --- Routes ---
app.get('/', (req, res) => res.send('EHR Backend Active.'));

app.post('/api/upload', upload.single('file'), async (req, res) => {
    const { patientId, uploaderId, fileType } = req.body;
    if (!req.file || !patientId || !uploaderId) return res.status(400).json({ message: 'Missing fields.' });
    try {
        const pId = patientId.trim();
        const uId = uploaderId.trim();
        if (uId.startsWith('DIAG')) {
            const hasAccess = await ehrContract.checkDiagnosticAccess(pId, uId);
            if (!hasAccess) return res.status(403).json({ message: 'Access Denied.' });
        }
        const readableStream = new stream.Readable();
        readableStream.push(req.file.buffer);
        readableStream.push(null);
        const pinataResult = await pinata.pinFileToIPFS(readableStream, { pinataMetadata: { name: fileType } });
        const overrides = await getGasOverrides();
        const tx = await ehrContract.addRecord(pinataResult.IpfsHash, pId, uId, fileType, overrides);
        await tx.wait();
        res.status(200).json({ message: 'Success', cid: pinataResult.IpfsHash });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/access/grant-doctor', async (req, res) => {
    try {
        const overrides = await getGasOverrides();
        const tx = await ehrContract.grantDoctorAccess(req.body.patientId.trim(), req.body.doctorId.trim(), overrides);
        await tx.wait();
        res.status(200).json({ message: 'Success' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/access/revoke-doctor', async (req, res) => {
    try {
        const pId = req.body.patientId.trim();
        const dId = req.body.doctorId.trim();
        try { await ehrContract.revokeDoctorAccess.staticCall(pId, dId); } catch (s) { return res.status(400).json({ message: "Not authorized." }); }
        const overrides = await getGasOverrides();
        const tx = await ehrContract.revokeDoctorAccess(pId, dId, overrides);
        await tx.wait();
        res.status(200).json({ message: 'Success' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// (Analogous logic for Diagnostic grant/revoke follows...)
app.post('/api/access/grant-diagnostic', async (req, res) => {
    try {
        const overrides = await getGasOverrides();
        const tx = await ehrContract.grantDiagnosticAccess(req.body.patientId.trim(), req.body.diagnosticId.trim(), overrides);
        await tx.wait();
        res.status(200).json({ message: 'Success' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/access/revoke-diagnostic', async (req, res) => {
    try {
        const overrides = await getGasOverrides();
        const tx = await ehrContract.revokeDiagnosticAccess(req.body.patientId.trim(), req.body.diagnosticId.trim(), overrides);
        await tx.wait();
        res.status(200).json({ message: 'Success' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/records/:patientId', async (req, res) => {
    try {
        const records = await ehrContract.getRecords(req.params.patientId.trim());
        res.status(200).json(records.map(r => ({ cid: r.cid, uploaderId: r.uploaderId, fileType: r.fileType, timestamp: new Date(Number(r.timestamp) * 1000).toLocaleString() })));
    } catch (error) { res.status(500).json({ message: 'Error.' }); }
});

app.post('/api/doctor/records', async (req, res) => {
    try {
        const records = await ehrContract.getRecordsForDoctor(req.body.patientId.trim(), req.body.doctorId.trim());
        res.status(200).json(records.map(r => ({ cid: r.cid, uploaderId: r.uploaderId, fileType: r.fileType, timestamp: new Date(Number(r.timestamp) * 1000).toLocaleString() })));
    } catch (error) { res.status(403).json({ message: 'Access Denied.' }); }
});

app.post('/api/diagnostic/records', async (req, res) => {
    try {
        const hasAccess = await ehrContract.checkDiagnosticAccess(req.body.patientId.trim(), req.body.diagnosticId.trim());
        if (!hasAccess) return res.status(403).json({ message: 'Access Denied.' });
        const records = await ehrContract.getRecords(req.body.patientId.trim());
        res.status(200).json(records.map(r => ({ cid: r.cid, uploaderId: r.uploaderId, fileType: r.fileType, timestamp: new Date(Number(r.timestamp) * 1000).toLocaleString() })));
    } catch (error) { res.status(500).json({ message: 'Error.' }); }
});

app.post('/api/login/:role', async (req, res) => {
    const { role } = req.params;
    const idField = role === 'patient' ? 'patientId' : role === 'doctor' ? 'doctorId' : 'diagnosticId';
    const Model = role === 'patient' ? Patient : role === 'doctor' ? Doctor : DiagnosticCenter;
    const user = await Model.findOne({ [idField]: req.body[idField] });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).json({ message: 'Invalid.' });
    res.json({ user: { id: user[idField], name: user.name, role } });
});

app.post('/api/register/:role', async (req, res) => {
    const { role } = req.params;
    const hashed = await bcrypt.hash(req.body.password, 10);
    const idField = role === 'patient' ? 'patientId' : role === 'doctor' ? 'doctorId' : 'diagnosticId';
    const id = await getNextId(idField, role.toUpperCase(), role === 'patient' ? 1001 : role === 'doctor' ? 2001 : 3001);
    const newUser = new (role === 'patient' ? Patient : role === 'doctor' ? Doctor : DiagnosticCenter)({ name: req.body.name, password: hashed, [idField]: id });
    await newUser.save();
    res.json({ [idField]: id });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Production Server on Port ${PORT}`));