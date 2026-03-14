// Subscription store — Upstash Redis (persists on Vercel serverless)
//
// Setup:
//   1. Go to https://console.upstash.com → Create a Redis database (free tier)
//   2. Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
//   3. Add them to Vercel env vars (or .env for local dev)
//
// All subscriptions are stored as a single JSON array under the key "subscriptions".
// For small data this is simpler and cheaper than per-key hashes.

const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const KEY = 'dvs:subscriptions';

async function load() {
    const data = await redis.get(KEY);
    return data || [];
}

async function save(subs) {
    await redis.set(KEY, subs);
}

async function list() {
    return await load();
}

async function find(email) {
    const subs = await load();
    return subs.find(s => s.email === email) || null;
}

async function create(email, quantity, durationMs) {
    const subs = await load();
    if (subs.find(s => s.email === email)) {
        throw new Error('Subscription already exists for this email');
    }
    const sub = {
        email,
        quantity: parseInt(quantity, 10),
        subscribedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + durationMs).toISOString(),
    };
    subs.push(sub);
    await save(subs);
    return sub;
}

async function update(email, fields) {
    const subs = await load();
    const sub = subs.find(s => s.email === email);
    if (!sub) return null;

    if (fields.quantity !== undefined) sub.quantity = parseInt(fields.quantity, 10);
    if (fields.expiresAt !== undefined) sub.expiresAt = new Date(fields.expiresAt).toISOString();

    await save(subs);
    return sub;
}

async function remove(email) {
    const subs = await load();
    const filtered = subs.filter(s => s.email !== email);
    if (filtered.length === subs.length) return false;
    await save(filtered);
    return true;
}

async function getExpired() {
    const now = new Date();
    const subs = await load();
    return subs.filter(s => new Date(s.expiresAt) <= now);
}

module.exports = { list, find, create, update, remove, getExpired };
