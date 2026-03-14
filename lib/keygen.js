// Shared key generation logic used by multiple API endpoints
const { randomEmail, randomName, createAccount, getLicenseCode } = require('./licenseGeneratorHTTP');

const MAX_PARALLEL = parseInt(process.env.MAX_PARALLEL || '5', 10);

async function generateKeys(quantity) {
    const queue = Array.from({ length: quantity }, (_, i) => i);
    const results = [];

    while (queue.length > 0) {
        const batch = queue.splice(0, MAX_PARALLEL);
        const batchResults = await Promise.all(
            batch.map(async (index) => {
                const email = randomEmail();
                const password = 'DantePass123!';
                const { first, last } = randomName();
                try {
                    await createAccount(email, password);
                    const code = await getLicenseCode(email, password, first, last);
                    return { success: true, code, email, password };
                } catch (error) {
                    return { success: false, email, error: error.message };
                }
            })
        );
        results.push(...batchResults);
    }

    return results;
}

module.exports = { generateKeys };
