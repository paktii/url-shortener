const Redis = require('ioredis');

const client = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379,
});

const DEFAULT_TTL = 604800; // 7 days
const CODES_SET = '__codes__';

const redis = {

  async set(code, url, ttlSeconds = DEFAULT_TTL) {
    const entry = JSON.stringify({
      url,
      createdAt: new Date().toISOString(),
      enabled: true,
      clicks: 0
    });

    await client.set(code, entry, 'EX', ttlSeconds);
    await client.sadd(CODES_SET, code);

    return true;
  },

  async get(code) {
    const raw = await client.get(code);
    if (!raw) return null;

    const obj = JSON.parse(raw);

    if (obj.enabled === false) return null;

    return obj.url;
  },

  async list() {
    const codes = await client.smembers(CODES_SET);
    if (!codes.length) return [];

    const entries = await Promise.all(
      codes.map(async (code) => {

        const raw = await client.get(code);

        if (!raw) {
          await client.srem(CODES_SET, code);
          return null;
        }

        const obj = JSON.parse(raw);

        return {
          code,
          url: obj.url,
          createdAt: obj.createdAt,
          enabled: obj.enabled ?? true,
          clicks: obj.clicks ?? 0
        };
      })
    );

    return entries
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async toggle(code) {
    const raw = await client.get(code);
    if (!raw) return null;

    const obj = JSON.parse(raw);

    obj.enabled = !obj.enabled;

    await client.set(code, JSON.stringify(obj), 'EX', DEFAULT_TTL);

    return obj.enabled;
  },

  async incrementClick(code) {
    const raw = await client.get(code);
    if (!raw) return;

    const obj = JSON.parse(raw);

    if (!obj.clicks) obj.clicks = 0;

    obj.clicks++;

    await client.set(code, JSON.stringify(obj), 'EX', DEFAULT_TTL);
  },

  async del(code) {
    const result = await client.del(code);
    await client.srem(CODES_SET, code);
    return result;
  }

};

module.exports = redis;