const axios = require('axios');
const crypto = require('crypto');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

// ─── PKCE helpers ────────────────────────────────────────────
function generateCodeVerifier() {
    // 43-128 chars, base64url-safe
    return crypto.randomBytes(32)
        .toString('base64url')
        .replace(/[^a-zA-Z0-9\-._~]/g, '')
        .substring(0, 43);
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256')
        .update(verifier)
        .digest('base64url');
}

// ─── Constants ───────────────────────────────────────────────
const CLIENT_ID = 'Q1ZVfFL9uTVRzm5c8KS526kloohRNXDp';
const REDIRECT_URI = 'https://www.getdante.com/account';
const AUTH_BASE = 'https://auth.audinate.com';
const API_BASE = 'https://api.dcp.audinate.com';

const NAMES = [
    ['James', 'Smith'], ['John', 'Johnson'], ['Robert', 'Williams'],
    ['Michael', 'Brown'], ['William', 'Jones'], ['David', 'Garcia']
];

function randomEmail() {
    return crypto.randomBytes(6).toString('hex') + '@gmail.com';
}

function randomName() {
    const [first, last] = NAMES[Math.floor(Math.random() * NAMES.length)];
    return { first, last };
}

// ─── Step 1: Create account via Auth0 DB connection ─────────
async function createAccount(email, pass) {
    try {
        const res = await axios.post(`${AUTH_BASE}/dbconnections/signup`, {
            client_id: CLIENT_ID,
            email, password: pass, connection: 'Audinate-Users'
        });
        return res.data._id;
    } catch (e) {
        throw new Error(e.response?.data?.description || e.message);
    }
}

// ─── Step 2-9: Full HTTP flow to get license key ────────────
async function getLicenseCode(email, pass, first, last) {
    const jar = new CookieJar();
    const client = wrapper(axios.create({
        jar,
        withCredentials: true,
        maxRedirects: 0,
        validateStatus: () => true,
    }));

    // ── PKCE ─────────────────────────────────────────────────
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // ── Step 2: /authorize with PKCE ─────────────────────────
    console.log('[HTTP-GEN] Starting OAuth /authorize with PKCE...');
    const authorizeUrl =
        `${AUTH_BASE}/authorize` +
        `?client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=openid%20profile%20email%20offline_access` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256` +
        `&ext-aud-auth-intent=trial%2Fcom.audinate.dcp`;

    let res = await client.get(authorizeUrl);

    if (![301, 302, 303, 307].includes(res.status)) {
        throw new Error(`/authorize returned ${res.status} instead of redirect`);
    }

    let loginUrl = res.headers.location;
    if (loginUrl.startsWith('/')) loginUrl = `${AUTH_BASE}${loginUrl}`;

    // ── Step 3: Load login page & extract state ──────────────
    console.log('[HTTP-GEN] Loading login page...');
    const loginPageRes = await client.get(loginUrl);

    if (loginPageRes.status >= 400) {
        throw new Error(`Login page returned ${loginPageRes.status}`);
    }

    const stateMatch = loginPageRes.data.match(/name="state"\s+value="([^"]+)"/)
        || loginPageRes.data.match(/value="([^"]+)"\s+name="state"/);
    if (!stateMatch) throw new Error('Could not extract state from login page');
    const hiddenState = stateMatch[1];

    // ── Step 4: POST login form ──────────────────────────────
    console.log('[HTTP-GEN] Submitting login form...');
    const loginForm = new URLSearchParams();
    loginForm.append('username', email);
    loginForm.append('password', pass);
    loginForm.append('state', hiddenState);
    loginForm.append('action', 'default');

    res = await client.post(loginUrl, loginForm, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': AUTH_BASE,
            'Referer': loginUrl,
        },
    });

    if (res.status === 200) {
        throw new Error('Login failed — Auth0 returned the form again (wrong credentials?)');
    }

    // ── Step 5: Follow redirects, handle custom prompt ───────
    console.log('[HTTP-GEN] Following redirect chain...');
    let authCode = null;

    for (let hop = 0; hop < 15; hop++) {
        if (![301, 302, 303, 307, 308].includes(res.status)) break;

        const location = res.headers.location;
        const nextUrl = new URL(location, AUTH_BASE).href;

        // Check for auth code in redirect
        if (nextUrl.includes('code=')) {
            const parsed = new URL(nextUrl);
            authCode = parsed.searchParams.get('code');
            console.log('[HTTP-GEN] Got authorization code');
            break;
        }

        res = await client.get(nextUrl);

        // Handle Auth0 Forms custom prompt (profile completion)
        if (res.status === 200 && typeof res.data === 'string' && nextUrl.includes('custom-prompt')) {
            console.log('[HTTP-GEN] Handling profile completion form...');
            res = await handleCustomPrompt(client, res, nextUrl, first, last);
        }
    }

    if (!authCode) {
        throw new Error('Failed to obtain authorization code from redirect chain');
    }

    // ── Step 6: Exchange code for access token (PKCE) ────────
    console.log('[HTTP-GEN] Exchanging code for access token...');
    const tokenRes = await axios.post(`${AUTH_BASE}/oauth/token`, {
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: REDIRECT_URI,
    });

    const idToken = tokenRes.data.id_token;
    if (!idToken) {
        throw new Error('No id_token in token response');
    }
    console.log('[HTTP-GEN] Got id_token');

    // ── Step 7: Activate trial via DCP API ───────────────────
    console.log('[HTTP-GEN] Activating DVS trial...');
    const trialRes = await axios.put(
        `${API_BASE}/entitlement/evaluation/v1/DanteVirtualSoundcard`,
        {
            givenName: first,
            surname: last,
            country: 'AUS',
            organization: 'Audinate',
            organizationRole: 'other',
            jobTitles: [],
            marketingOptIn: false,
        },
        {
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    console.log('[HTTP-GEN] Trial API status:', trialRes.status);

    // Extract license key from response
    const licenseCode = extractLicenseKey(trialRes.data);

    if (!licenseCode) {
        // If not in PUT response, try GET
        console.log('[HTTP-GEN] Checking entitlement for license key...');
        const entitlementRes = await axios.get(
            `${API_BASE}/entitlement/evaluation/v1/DanteVirtualSoundcard`,
            { headers: { 'Authorization': `Bearer ${idToken}` } }
        );
        const keyFromGet = extractLicenseKey(entitlementRes.data);
        if (!keyFromGet) {
            console.log('[HTTP-GEN] PUT response:', JSON.stringify(trialRes.data));
            console.log('[HTTP-GEN] GET response:', JSON.stringify(entitlementRes.data));
            throw new Error('Failed to extract license key from API response');
        }
        return keyFromGet;
    }

    return licenseCode;
}

// ─── Extract XXXXX-XXXXX-XXXXX-XXXXX-XXXXX from response ────
function extractLicenseKey(data) {
    const keyRegex = /\b[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}\b/i;

    if (typeof data === 'string') {
        const match = data.match(keyRegex);
        return match ? match[0] : null;
    }

    // Search recursively through JSON
    const jsonStr = JSON.stringify(data);
    const match = jsonStr.match(keyRegex);
    return match ? match[0] : null;
}

// ─── Handle Auth0 Forms custom prompt ────────────────────────
async function handleCustomPrompt(client, pageRes, pageUrl, first, last) {
    const configMatch = pageRes.data.match(/id="custom-form-config"\s+value="([^"]+)"/);
    if (!configMatch) throw new Error('Could not find custom-form-config');

    const configJson = configMatch[1].replace(/&#34;/g, '"').replace(/&amp;/g, '&');
    const config = JSON.parse(configJson);

    // Fetch form definition
    const formApiUrl = `${AUTH_BASE}/forms/api/forms/${config.promptId}?state=${encodeURIComponent(config.state)}`;
    const formDefRes = await client.get(formApiUrl, {
        headers: {
            'Referer': pageUrl,
            'auth0-forms-location': pageUrl,
            'auth0-forms-state': config.state,
        },
    });

    const checkpoint = formDefRes.headers['auth0-forms-journey-checkpoint'];
    const formDef = formDefRes.data;

    // Build field values
    const fields = (formDef.steps || []).flatMap(s => s.components || []).filter(c => c.category === 'FIELD');
    const fieldValues = {};
    for (const field of fields) {
        switch (field.id) {
            case 'given_name': fieldValues[field.id] = first; break;
            case 'family_name': fieldValues[field.id] = last; break;
            default:
                if (field.type === 'DROPDOWN' && field.config?.options?.length) {
                    fieldValues[field.id] = field.config.options[0].value;
                } else if (field.type === 'LEGAL' || field.type === 'CHECKBOX') {
                    fieldValues[field.id] = true;
                } else {
                    fieldValues[field.id] = 'Test';
                }
        }
    }

    const metaData = {
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', language: 'en-US' },
        navigation: { referer: pageUrl, location: { protocol: 'https:', hostname: 'auth.audinate.com' } },
    };

    // Send validation beat
    const stepId = formDef.steps?.[0]?.id || 'step_form';
    const beatRes = await client.post(
        `${AUTH_BASE}/forms/api/forms/${config.promptId}/validations/${stepId}`,
        { formData: fieldValues, metaData },
        {
            headers: {
                'Content-Type': 'application/json',
                'Origin': AUTH_BASE,
                'Referer': pageUrl,
                'auth0-forms-location': pageUrl,
                'Authorization': `Bearer ${checkpoint}`,
            },
        }
    );

    if (beatRes.status !== 200) {
        throw new Error(`Beat validation failed: ${JSON.stringify(beatRes.data)}`);
    }

    const submitCheckpoint = beatRes.data?.checkpoint || checkpoint;

    // Submit form
    await client.post(
        `${AUTH_BASE}/forms/api/forms/${config.promptId}/submissions/`,
        { formData: fieldValues, metaData },
        {
            headers: {
                'Content-Type': 'application/json',
                'Origin': AUTH_BASE,
                'Referer': pageUrl,
                'auth0-forms-location': pageUrl,
                'Authorization': `Bearer ${submitCheckpoint}`,
            },
        }
    );

    // Resume OAuth flow
    const resumeForm = new URLSearchParams();
    resumeForm.append('state', config.state);
    return await client.post(pageUrl, resumeForm, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': AUTH_BASE,
            'Referer': pageUrl,
        },
    });
}

// No browser to clean up
async function cleanup() {}

module.exports = {
    randomEmail,
    randomName,
    createAccount,
    getLicenseCode,
    cleanup
};
