const fs = require('fs');
const path = require('path');

/**
 * Single source of truth: `.env.example`
 * (Do not duplicate EXPO_PUBLIC_API_URL in eas.json / config.ts / .env)
 */
function loadEnvExample() {
  const envFile = path.join(__dirname, '.env');
  const exampleFile = path.join(__dirname, '.env.example');
  const target = fs.existsSync(envFile) ? envFile : exampleFile;

  if (fs.existsSync(target)) {
    for (const line of fs.readFileSync(target, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
}

loadEnvExample();

const appJson = require('./app.json');
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '');

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is empty — set it in .env.example');
}

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra || {}),
    apiUrl,
  },
});
