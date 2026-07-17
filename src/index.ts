import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as dotenv from "dotenv";
import { ClassificationSchema } from "./agents.js";
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
      Set 'shouldDelete' to true if the sender string contains ANY of the following target domains:
      1. 'bankbazaar.com' (Promotional loan offers/credit alerts)
      2. 'monsterindia.com' or 'timesjobs.com' (Aggressive automated job aggregators)
      3. 'github.com' (Support notifications and alert mailers)
      4. 'linkedin.com' (Automated job alert updates)
      5. 'producthunt.com' or 'substack.com' or 'quora.com' (Weekly/Daily digest newsletters)
      6. 'freeletics.com' (Fitness marketing and guides)
      7. 'groww.in' (Generic financial digests)
      8. 'actcorp.in' or 'in4.actcorp.in' (ISP promotional marketing/offers)
      
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

      console.log(`   -> AI Decision: ${analysis.shouldDelete ? "❌ PURGE" : "✅ KEEP"}`);
      console.log(`   -> Reason:      "${analysis.reasoning}"`);

      if (analysis.shouldDelete) {
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