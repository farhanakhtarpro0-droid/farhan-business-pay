const express = require('express');
const Razorpay = require('razorpay');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const appsFile = './apps.json';
if (!fs.existsSync(appsFile)) { fs.writeFileSync(appsFile, JSON.stringify({})); }
const getApps = () => JSON.parse(fs.readFileSync(appsFile));
const saveApp = (name, key) => { 
    const apps = getApps(); 
    apps[name] = key; 
    fs.writeFileSync(appsFile, JSON.stringify(apps, null, 2)); 
};

const getHTML = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Farhan Business Pay</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { background-color: #ffffff; color: #cc0000; font-family: sans-serif; user-select: none; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .box { background: white; padding: 30px; border-top: 5px solid #cc0000; box-shadow: 0px 4px 10px rgba(0,0,0,0.1); width: 90%; max-width: 400px; text-align: center; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #cc0000; box-sizing: border-box; outline: none; }
        button { width: 100%; padding: 12px; background-color: #cc0000; color: white; border: none; font-weight: bold; cursor: pointer; }
        .list { text-align: left; margin-top: 20px; max-height: 200px; overflow-y: auto; }
        .item { background: #ffeeee; padding: 10px; border-left: 4px solid #cc0000; margin-bottom: 5px; font-size: 14px; user-select: text; }
    </style>
</head>
<body><div class="box">${content}</div></body>
</html>`;

app.get('/', (req, res) => res.redirect('/admin'));
app.get('/admin', (req, res) => {
    res.send(getHTML(`
        <h2>Admin Login</h2>
        <form action="/admin/dashboard" method="POST">
            <input type="password" name="password" placeholder="अपना सीक्रेट पासवर्ड डालें" required />
            <button type="submit">Login</button>
        </form>
    `));
});

app.post('/admin/dashboard', (req, res) => {
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.send(getHTML(`<h3>❌ ग़लत पासवर्ड!</h3><a href="/admin" style="color:#cc0000;">वापस जाएँ</a>`));
    
    const apps = getApps();
    let listHTML = '';
    for(let name in apps) {
        listHTML += `<div class="item"><b>${name}</b><br><span style="color:#555;">${apps[name]}</span></div>`;
    }

    res.send(getHTML(`
        <h2>Dashboard</h2>
        <form action="/admin/generate" method="POST">
            <input type="hidden" name="password" value="${password}" />
            <input type="text" name="appName" placeholder="Android App का नाम (जैसे: ChatApp)" required />
            <button type="submit">Generate API Key</button>
        </form>
        <div class="list">${listHTML || '<p>कोई API Key नहीं बनी है।</p>'}</div>
    `));
});

app.post('/admin/generate', (req, res) => {
    const { password, appName } = req.body;
    if (password === process.env.ADMIN_PASSWORD && appName) {
        const newKey = "FBP_" + uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
        saveApp(appName, newKey);
        res.send(`<form id="frm" action="/admin/dashboard" method="POST"><input type="hidden" name="password" value="${password}" /></form><script>document.getElementById('frm').submit();</script>`);
    } else {
        res.redirect('/admin');
    }
});

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

app.listen(process.env.PORT || 3000, () => console.log("Farhan Business Pay Running!"));
          
