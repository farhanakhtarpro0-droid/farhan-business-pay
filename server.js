const express = require('express');
const Razorpay = require('razorpay');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Razorpay सेटअप
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// RAM Free लोकल स्टोरेज
const appsFile = './apps.json';
if (!fs.existsSync(appsFile)) { fs.writeFileSync(appsFile, JSON.stringify({})); }
const getApps = () => JSON.parse(fs.readFileSync(appsFile));
const saveApps = (data) => fs.writeFileSync(appsFile, JSON.stringify(data, null, 2));

// पासवर्ड चेक करने का मिडलवेयर
const verifyPass = (req, res, next) => {
    if (req.body.password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
};

// HTML वेबसाइट को सर्व करना
app.get('/', (req, res) => res.redirect('/admin'));
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API Endpoints ---

app.post('/api/keys', verifyPass, (req, res) => {
    res.json({ success: true, keys: getApps() });
});

app.post('/api/generate', verifyPass, (req, res) => {
    const { appName } = req.body;
    const apps = getApps();
    apps[appName] = "FBP_" + uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
    saveApps(apps);
    res.json({ success: true, keys: apps });
});

app.post('/api/rename', verifyPass, (req, res) => {
    const { oldName, newName } = req.body;
    const apps = getApps();
    if(apps[oldName]) {
        apps[newName] = apps[oldName];
        delete apps[oldName];
        saveApps(apps);
    }
    res.json({ success: true, keys: apps });
});

app.post('/api/delete', verifyPass, (req, res) => {
    const { appName } = req.body;
    const apps = getApps();
    delete apps[appName];
    saveApps(apps);
    res.json({ success: true, keys: apps });
});

// Payment API (RAM Optimized)
app.post('/create-order', async (req, res) => {
    const { app_key, amount } = req.body;
    const apps = getApps();
    if (!Object.values(apps).includes(app_key)) return res.status(401).json({ error: "Invalid App Key!" });

    try {
        const options = { amount: amount * 100, currency: "INR", receipt: "rcpt_" + Date.now() };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order_id: order.id, amount: order.amount });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Backend Running Securely!"));
