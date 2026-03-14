// Local dev server — simulates Vercel serverless functions
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.VERCEL_DEV_PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { redirect: true }));

// API routes — each maps to a Vercel serverless function
app.post('/api/generate-keys', require('./api/generate-keys'));
app.post('/api/send-keys', require('./api/send-keys'));
app.all('/api/subscriptions', require('./api/subscriptions'));
app.post('/api/send-subscription', require('./api/send-subscription'));
app.get('/api/cron-renew', require('./api/cron-renew'));

app.listen(PORT, () => {
    console.log(`Vercel dev server: http://localhost:${PORT}`);
    console.log(`  Keygen:        http://localhost:${PORT}/`);
    console.log(`  Subscriptions: http://localhost:${PORT}/admin`);
});
