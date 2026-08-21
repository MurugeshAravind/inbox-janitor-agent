import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as dotenv from "dotenv";
import { ClassificationSchema, TARGET_DOMAINS, senderMatchesTargetDomain } from "./agents.js";
import { getGmailClient } from "./gmailService.js";
import { fetchUnreadEmails, moveEmailToTrash } from "./gmailActions.js";

dotenv.config();

// SAFETY TOGGLE: Set to false only when you are ready to let the AI actually delete emails!
const DRY_RUN = false;

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY || "",
  temperature: 0,
});

const structuredAnalyst = model.withStructuredOutput(ClassificationSchema);

async function executeInboxJanitor() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "❌ GEMINI_API_KEY is missing from environment.\n" +
        "Please ensure GEMINI_API_KEY is set in your .env file or GitHub Secrets."
      );
    }

    console.log("⚡ Initializing Live Inbox Janitor Operations...");
    const gmail = await getGmailClient();

    console.log("📥 Querying live unread message streams...");
    const liveEmails = await fetchUnreadEmails(gmail);

    if (liveEmails.length === 0) {
      console.log("✨ Inbox clean! No unread messages located.");
      return;
    }

    console.log(`🤖 Processing ${liveEmails.length} messages through the LangChain reasoning engine...\n`);

    const systemInstructions = `
      You are a defensive Enterprise Inbox Janitor Agent. Your single task is to classify emails for automated purging.
      
      CRITICAL MATCHING RULES:
      Set 'shouldDelete' to true only when the sender's email domain is exactly one
      of these domains or a subdomain of one of them:
      ${TARGET_DOMAINS.map((domain, index) => `${index + 1}. '${domain}'`).join("\n      ")}
      
      SAFEGUARD RULES:
      - For ANY other sender domain not explicitly listed above, you MUST set shouldDelete to false.
    `;

    for (const email of liveEmails) {
      console.log(`Analyzing Message ID: [${email.id}]`);
      console.log(`   From:    ${email.sender}`);
      console.log(`   Subject: ${email.subject}`);

      const userContext = `
        Evaluate this specific message now:
        Sender: ${email.sender}
        Subject: ${email.subject}
        Snippet: ${email.snippet}
      `;

      const analysis = await structuredAnalyst.invoke([
        { role: "system", content: systemInstructions },
        { role: "user", content: userContext }
      ]);

      // The model may explain a decision, but it cannot expand the deletion allowlist.
      const isAllowedSender = senderMatchesTargetDomain(email.sender);
      const shouldDelete = isAllowedSender && analysis.shouldDelete;

      console.log(`   -> Final Decision: ${shouldDelete ? "❌ PURGE" : "✅ KEEP"}`);
      console.log(`   -> Reason:      "${analysis.reasoning}"`);

      if (shouldDelete) {
        if (DRY_RUN) {
          console.log(`   ⚠️ [DRY RUN ACTIVE] Would have moved message ${email.id} to trash.\n`);
        } else {
          console.log(`   🔥 [LIVE DELETION] Purging message ${email.id} from database...`);
          await moveEmailToTrash(gmail, email.id);
          console.log(`   🗑️ Message safely sent to trash bin.\n`);
        }
      } else {
        console.log(`   ➡️ Message retained in current location.\n`);
      }
    }

    console.log("🏁 Janitor operations cycle complete.");

  } catch (error) {
    const err = error as any;
    if (err?.response?.data?.error === "invalid_grant" || err?.message?.includes("invalid_grant")) {
      console.error(
        "\n❌ Gmail refresh token is expired or revoked.\n" +
        "Please run 'npx tsx scripts/generate-refresh-token.ts' locally to mint a new refresh token,\n" +
        "and update GMAIL_REFRESH_TOKEN (and/or TOKEN_JSON) in GitHub Actions / your environment.\n"
      );
      process.exit(1);
    }
    console.error("❌ Critical failure during dynamic operations cycle:", error);
  }
}

executeInboxJanitor();
