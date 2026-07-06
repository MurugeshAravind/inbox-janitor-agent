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
 * Loads the client secrets from credentials.json
 */
async function getClientSecrets() {
  const content = await fs.readFile(CREDENTIALS_PATH, "utf-8");
  const keys = JSON.parse(content);
  return keys.installed || keys.web;
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
    // 2. Attempt to read existing cached tokens
    const tokenContent = await fs.readFile(TOKEN_PATH, "utf-8");
    const tokens = JSON.parse(tokenContent);
    
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
    await fs.writeFile(TOKEN_PATH, JSON.stringify(freshTokens));
    console.log("Access tokens successfully generated and cached to token.json!");

    oauth2Client.setCredentials(freshTokens);
    return google.gmail({ version: "v1", auth: oauth2Client });
  }
}