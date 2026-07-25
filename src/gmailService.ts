import { google } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";
import * as path from "path";
import * as fs from "fs/promises";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify"
];

const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "token.json");

/**
 * Parses raw JSON or base64 encoded JSON string securely
 */
function parseJsonOrBase64(content: string, secretName: string): any {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch (rawErr) {
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch {
      throw new Error(
        `Failed to parse ${secretName} as valid JSON or Base64-encoded JSON.\n` +
        `Please ensure the GitHub secret ${secretName} contains valid JSON text (or Base64 encoded JSON).`
      );
    }
  }
}

/**
 * Loads the client secrets from environment variable or credentials.json
 */
async function getClientSecrets() {
  let content: string | undefined = process.env.CREDENTIALS_JSON;

  if (!content) {
    try {
      content = await fs.readFile(CREDENTIALS_PATH, "utf-8");
    } catch {
      // credentials.json file missing
    }
  }

  if (!content && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uris: [process.env.GOOGLE_REDIRECT_URI || "http://localhost:3005"]
    };
  }

  if (!content) {
    throw new Error(
      "Missing Google OAuth credentials. Ensure 'credentials.json' exists or 'CREDENTIALS_JSON' env var is set."
    );
  }

  const keys = parseJsonOrBase64(content, "CREDENTIALS_JSON");
  return keys.installed || keys.web || keys;
}

/**
 * Core authentication entry point. Returns a fully authorized Gmail service client instance.
 */
export async function getGmailClient() {
  const secrets = await getClientSecrets();
  
  // 1. Create a dedicated OAuth2 client instance using your application secrets
  const oauth2Client = new google.auth.OAuth2(
    secrets.client_id,
    secrets.client_secret,
    secrets.redirect_uris?.[0] || "http://localhost:3005"
  );

  try {
    // 2. Attempt to read existing cached tokens from env or file
    let tokenContent: string | undefined = process.env.TOKEN_JSON;
    if (!tokenContent) {
      tokenContent = await fs.readFile(TOKEN_PATH, "utf-8");
    }

    const tokens = parseJsonOrBase64(tokenContent, "TOKEN_JSON");
    
    // Inject tokens into the client
    oauth2Client.setCredentials(tokens);
    return google.gmail({ version: "v1", auth: oauth2Client });
    
  } catch (err) {
    // 3. If token.json doesn't exist, trigger the one-time interactive login
    console.log("No valid cached token found. Starting interactive OAuth flow...");
    
    const localAuthClient = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });

    const freshTokens = localAuthClient.credentials;
    
    // Cache the raw tokens securely
    await fs.writeFile(TOKEN_PATH, JSON.stringify(freshTokens, null, 2));
    console.log("Access tokens successfully generated and cached to token.json!");

    oauth2Client.setCredentials(freshTokens);
    return google.gmail({ version: "v1", auth: oauth2Client });
  }
}