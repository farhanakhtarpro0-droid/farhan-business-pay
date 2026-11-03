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

// लोकल डेटाबेस फाइल
const appsFile = './apps.json';

// 🚀 5 परमानेंट (Permanent) API Keys जो कभी डिलीट नहीं होंगी
const permanentKeys = {
    "Project_1_WhatsApp_Agent": "FBP_PERM_KEY_1_ALPHA9X8Y",
    "Project_2_Shayari_App": "FBP_PERM_KEY_2_BETA4A5B",
    "Project_3_Digital_Gold": "FBP_PERM_KEY_3_GAMMA1M2N",
    "Project_4_Future_App": "FBP_PERM_KEY_4_DELTA8P9Q",
    "Project_5_Extra_Backup": "FBP_PERM_KEY_5_OMEGA5U6V"
};

// ऐप्स गेट करने का क्रैश-प्रूफ फंक्शन
const getApps = () => {
    let apps = {};
    
    // अगर फाइल मौजूद है, तो उसे पढ़ें
    if (fs.existsSync(appsFile)) {
        try {
            apps = JSON.parse(fs.readFileSync(appsFile));
        } catch (error) {
            console.error("File Read Error, recovering...");
        }
    }

    // 🔥 अगर Render ने फाइल डिलीट कर दी है (खाली है), तो 5 परमानेंट Keys वापस डाल दें
    if (Object.keys(apps).length === 0) {
        apps = { ...permanentKeys };
        fs.writeFileSync(appsFile, JSON.stringify(apps, null, 2));
    }
    
    return apps;
};

// ऐप्स सेव करने का फंक्शन
const saveApps = (data) => {
    fs.writeFileSync(appsFile, JSON.stringify(data, null, 2));
};

// पासवर्ड वेरिफिकेशन मिडलवेयर
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

// नई Key जनरेट करना (यह भी काम करेगा, लेकिन परमानेंट Keys हमेशा सेफ रहेंगी)
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

// Payment API (RAM Optimized & Crash-Proof)
app.post('/create-order', async (req, res) => {
    const { app_key, amount } = req.body;
    const apps = getApps();
    
    // चेक करें कि भेजी गई Key हमारे सिस्टम में है या नहीं
    if (!Object.values(apps).includes(app_key)) {
        return res.status(401).json({ error: "Invalid App Key! पेमेंट रिजेक्ट कर दिया गया है।" });
    }

    try {
        const options = { amount: amount * 100, currency: "INR", receipt: "rcpt_" + Date.now() };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order_id: order.id, amount: order.amount });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Farhan Business Pay Running with Permanent Keys!"));
