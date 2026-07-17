import { google } from "googleapis";
import * as http from "http";
import * as url from "url";
import * as path from "path";
import * as fs from "fs/promises";
import * as dotenv from "dotenv";

dotenv.config();

const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify"
];

async function main() {
  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    try {
      const content = await fs.readFile(CREDENTIALS_PATH, "utf-8");
      const keys = JSON.parse(content);
      const secrets = keys.installed || keys.web;
      if (secrets) {
        clientId = clientId || secrets.client_id;
        clientSecret = clientSecret || secrets.client_secret;
        redirectUri = redirectUri || secrets.redirect_uris?.[0];
      }
    } catch (err) {
      // credentials.json not found, we will require env vars or a local credentials.json
    }
  }

  if (!clientId || !clientSecret) {
    console.error("Error: Missing Google OAuth Client ID or Client Secret.");
    console.error("Please either:");
    console.log("1. Place 'credentials.json' in the root directory, OR");
    console.log("2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file or environment.");
    process.exit(1);
  }

  // Fallback redirect URI if not found
  if (!redirectUri) {
    redirectUri = "http://localhost:3000/oauth2callback";
  }

  // Parse redirect URI port and path
  const parsedRedirect = new url.URL(redirectUri);
  const port = parsedRedirect.port ? parseInt(parsedRedirect.port, 10) : 80;
  const pathName = parsedRedirect.pathname || "/oauth2callback";

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a new refresh_token even if authorized before
    scope: SCOPES,
  });

  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new url.URL(req.url || "", `http://localhost:${port}`);
      if (reqUrl.pathname !== pathName) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = reqUrl.searchParams.get("code");
      if (!code) {
        res.writeHead(400);
        res.end("Authorization code not found in redirect URL.");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>Authentication Successful!</h1><p>You can close this window and check your terminal.</p>");
      server.close();

      const { tokens } = await oauth2Client.getToken(code);
      console.log("\n==================================================================================");
      console.log("SUCCESS! Here is your new GMAIL_REFRESH_TOKEN (and complete token.json content):");
      console.log("==================================================================================");
      console.log("\n1. GMAIL_REFRESH_TOKEN (for GitHub Actions / env variable):");
      console.log(tokens.refresh_token);
      console.log("\n2. Full TOKEN_JSON content (for local token.json or GitHub Actions TOKEN_JSON secret):");
      console.log(JSON.stringify(tokens, null, 2));
      console.log("==================================================================================\n");
      
      // Optionally write to local token.json if the user wants
      await fs.writeFile(path.join(process.cwd(), "token.json"), JSON.stringify(tokens, null, 2));
      console.log("Also updated local token.json with these credentials.");
    } catch (err) {
      console.error("Error exchanging code for tokens:", err);
      res.writeHead(500);
      res.end("Authentication failed during token exchange.");
      server.close();
    }
  });

  server.listen(port, () => {
    console.log(`Server listening on port ${port}...`);
    console.log("Please visit the following URL to authorize the app:\n");
    console.log(authUrl);
    console.log("\n----------------------------------------------------------------------------------");
  });
}

main().catch(console.error);
