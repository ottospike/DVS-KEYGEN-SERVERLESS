const store = require('../lib/store');
const { generateKeys } = require('../lib/keygen');
const { sendLicenseEmail } = require('../lib/mailer');

const SUBSCRIPTION_DAYS = parseInt(process.env.SUBSCRIPTION_DAYS || '28', 10);
const DURATION_MS = SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;

module.exports = async (req, res) => {
    const email = req.query.email;

    if (req.method === 'GET') {
        return res.json({ subscriptions: await store.list() });
    }

    if (req.method === 'POST') {
        const { email: bodyEmail, quantity } = req.body;
        if (!bodyEmail || typeof quantity !== 'number' || quantity <= 0) {
            return res.status(400).json({ error: 'Email and a positive quantity are required' });
        }
        try {
            const sub = await store.create(bodyEmail, quantity, DURATION_MS);

            // Auto-send keys on creation
            try {
                const results = await generateKeys(sub.quantity);
                const keys = results.filter(r => r.success);
                if (keys.length > 0) await sendLicenseEmail(bodyEmail, keys);
            } catch (e) {
                // Subscription created but send failed — don't block the response
                console.error('Auto-send failed:', e.message);
            }

            return res.json({ message: 'Subscribed and keys sent', subscription: sub });
        } catch (err) {
            return res.status(409).json({ error: err.message });
        }
    }

    if (req.method === 'PUT') {
        if (!email) return res.status(400).json({ error: 'email query param required' });
        const { quantity, expiresAt } = req.body;
        if (expiresAt && isNaN(new Date(expiresAt).getTime())) {
            return res.status(400).json({ error: 'Invalid date' });
        }
        const sub = await store.update(email, { quantity, expiresAt });
        if (!sub) return res.status(404).json({ error: 'Not found' });
        return res.json({ message: 'Updated', subscription: sub });
    }

    if (req.method === 'DELETE') {
        if (!email) return res.status(400).json({ error: 'email query param required' });
        if (!(await store.remove(email))) return res.status(404).json({ error: 'Not found' });
        return res.json({ message: 'Deleted' });
    }

    res.status(405).json({ error: 'Method not allowed' });
};
