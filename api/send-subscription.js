const store = require('../lib/store');
const { generateKeys } = require('../lib/keygen');
const { sendLicenseEmail } = require('../lib/mailer');

const SUBSCRIPTION_DAYS = parseInt(process.env.SUBSCRIPTION_DAYS || '28', 10);
const DURATION_MS = SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const email = req.query.email || req.body.email;
    if (!email) return res.status(400).json({ error: 'email required' });

    const sub = await store.find(email);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    if (new Date(sub.expiresAt) <= new Date()) {
        return res.status(410).json({ error: 'Subscription expired' });
    }

    const startTime = Date.now();
    const results = await generateKeys(sub.quantity);
    const keys = results.filter(r => r.success);

    if (keys.length === 0) return res.status(500).json({ error: 'Failed to generate keys' });

    try {
        await sendLicenseEmail(email, keys);
    } catch (err) {
        return res.status(500).json({ error: 'Email failed: ' + err.message, keys: keys.map(k => k.code) });
    }

    // Renew
    await store.update(email, { expiresAt: new Date(Date.now() + DURATION_MS).toISOString() });

    res.json({
        message: `Sent ${keys.length} key(s) to ${email}`,
        elapsedTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    });
};
