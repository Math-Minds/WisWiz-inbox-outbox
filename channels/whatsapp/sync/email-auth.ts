/**
 * Gmail OAuth2 Token Management
 *
 * Runtime: getGmailClient(account) — loads refresh token, returns gmail instance
 * CLI:     npm run email-auth -- {account} — one-time consent flow per account
 *
 * Tokens stored in GCS: gmail-auth/{account}.json
 * Or locally: ../gmail-auth/{account}.json
 */

import 'dotenv/config';
import { google, type gmail_v1 } from 'googleapis';
import { readRootJson, writeRootJson } from './storage';
import http from 'http';

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

interface StoredTokens {
  refresh_token: string;
  access_token?: string;
  expiry_date?: number;
}

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    'http://localhost:3456/callback'
  );
}

function tokenPath(account: string): string {
  return `gmail-auth/${account}.json`;
}

/**
 * Get an authenticated Gmail client for the given account.
 * Loads the refresh token from storage and creates an OAuth2 client.
 */
export async function getGmailClient(account: string): Promise<gmail_v1.Gmail> {
  const tokens = await readRootJson<StoredTokens>(tokenPath(account));
  const oauth2 = makeOAuth2Client();
  oauth2.setCredentials({
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expiry_date: tokens.expiry_date,
  });

  // Save refreshed tokens when they change
  oauth2.on('tokens', async (newTokens) => {
    const updated: StoredTokens = {
      refresh_token: tokens.refresh_token,
      ...newTokens,
    };
    await writeRootJson(tokenPath(account), updated);
  });

  return google.gmail({ version: 'v1', auth: oauth2 });
}

/**
 * CLI: One-time OAuth2 consent flow.
 * Opens browser, user grants access, receives refresh token.
 *
 * Usage: npm run email-auth -- louisgeradtsvetter
 */
async function runAuthFlow() {
  const account = process.argv[2];
  if (!account) {
    console.error('Usage: npm run email-auth -- <account>');
    console.error('  e.g. npm run email-auth -- louisgeradtsvetter');
    process.exit(1);
  }

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    console.error('❌ Stel GMAIL_CLIENT_ID en GMAIL_CLIENT_SECRET in als env vars.');
    process.exit(1);
  }

  const oauth2 = makeOAuth2Client();
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    login_hint: `${account}@gmail.com`,
  });

  console.log(`\n🔐 Open deze URL in je browser:\n\n${authUrl}\n`);
  console.log('Wachten op callback op http://localhost:3456/callback ...\n');

  // Start a temporary local server to receive the callback
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', 'http://localhost:3456');
      if (url.pathname === '/callback') {
        const authCode = url.searchParams.get('code');
        if (authCode) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>✅ Authenticatie geslaagd! Je kan dit venster sluiten.</h1>');
          server.close();
          resolve(authCode);
        } else {
          const error = url.searchParams.get('error') || 'unknown error';
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>❌ Fout: ${error}</h1>`);
          server.close();
          reject(new Error(error));
        }
      }
    });

    server.listen(3456);
    server.on('error', reject);
  });

  console.log('📬 Auth code ontvangen, tokens ophalen...');
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    console.error('❌ Geen refresh token ontvangen. Probeer opnieuw met prompt=consent.');
    process.exit(1);
  }

  const stored: StoredTokens = {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  };

  await writeRootJson(tokenPath(account), stored);
  console.log(`✅ Tokens opgeslagen voor ${account}@gmail.com`);
}

// Run CLI when executed directly
const isDirectRun = process.argv[1]?.includes('email-auth');
if (isDirectRun) {
  runAuthFlow().catch((err) => {
    console.error('💥 Auth flow mislukt:', err);
    process.exit(1);
  });
}
