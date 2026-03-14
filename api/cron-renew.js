// Vercel Cron Job — auto-renew expired subscriptions
// Triggered by vercel.json cron config or manually via GET /api/cron-renew
const store = require('../lib/store');
const { generateKeys } = require('../lib/keygen');
const { sendLicenseEmail } = require('../lib/mailer');

const SUBSCRIPTION_DAYS = parseInt(process.env.SUBSCRIPTION_DAYS || '28', 10);
const DURATION_MS = SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;

module.exports = async (req, res) => {
    try {
    // Optional: protect with a secret so only Vercel cron or you can trigger it
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const expired = await store.getExpired();

    if (expired.length === 0) {
        return res.json({ message: 'No subscriptions to renew', renewed: 0 });
    }

    const results = [];

    for (const sub of expired) {
        try {
            const genResults = await generateKeys(sub.quantity);
            const keys = genResults.filter(r => r.success);

            if (keys.length === 0) {
                results.push({ email: sub.email, status: 'failed', error: 'No keys generated' });
                continue;
            }

            await sendLicenseEmail(sub.email, keys);
            await store.update(sub.email, { expiresAt: new Date(Date.now() + DURATION_MS).toISOString() });
            results.push({ email: sub.email, status: 'renewed', keys: keys.length });
        } catch (err) {
            results.push({ email: sub.email, status: 'failed', error: err.message });
        }
    }

    res.json({ message: `Processed ${expired.length} subscription(s)`, renewed: results.filter(r => r.status === 'renewed').length, results });
    } catch (err) {
        console.error('cron-renew error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
