const { generateKeys } = require('../lib/keygen');
const { sendLicenseEmail } = require('../lib/mailer');

module.exports = async (req, res) => {
    try {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { email, quantity } = req.body;
        if (!email || typeof quantity !== 'number' || quantity <= 0) {
            return res.status(400).json({ error: 'Email and a positive quantity are required' });
        }

        const startTime = Date.now();
        const results = await generateKeys(quantity);
        const keys = results.filter(r => r.success);

        if (keys.length === 0) return res.status(500).json({ error: 'Failed to generate any keys' });

        try {
            await sendLicenseEmail(email, keys);
        } catch (error) {
            return res.status(500).json({ error: 'Keys generated but email failed: ' + error.message, keys: keys.map(k => k.code) });
        }

        res.json({
            message: `Sent ${keys.length} key(s) to ${email}`,
            keysGenerated: keys.length,
            keysFailed: quantity - keys.length,
            elapsedTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        });
    } catch (err) {
        console.error('send-keys error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
