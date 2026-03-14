const { generateKeys } = require('../lib/keygen');

module.exports = async (req, res) => {
    try {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { quantity } = req.body;
        if (typeof quantity !== 'number' || quantity <= 0 || quantity > 100) {
            return res.status(400).json({ error: 'Invalid quantity. Must be 1-100.' });
        }

        const startTime = Date.now();
        const results = await generateKeys(quantity);
        const keys = results.filter(r => r.success).map(r => ({ code: r.code, email: r.email, password: r.password }));

        res.json({
            keys,
            stats: {
                total: quantity,
                success: keys.length,
                failed: quantity - keys.length,
                elapsedTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
            },
        });
    } catch (err) {
        console.error('generate-keys error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
