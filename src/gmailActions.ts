import { gmail_v1 } from "googleapis";
import { type EmailMessage } from "./agents.js";

/**
 * Fetches a list of unread message summaries from the live inbox.
 */
export async function fetchUnreadEmails(gmail: gmail_v1.Gmail): Promise<EmailMessage[]> {
  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread",
    maxResults: 15 
  });

  const messagesSummary = listResponse.data.messages || [];
  const detailedEmails: EmailMessage[] = [];

  for (const msg of messagesSummary) {
    if (!msg.id) continue;
    
    // Configured with 'metadata' format and explicit header selectors
    const detailResponse = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata", 
      metadataHeaders: ["From", "Subject"] // Only download what we actively extract
    });

    const headers = detailResponse.data.payload?.headers || [];
    const sender = headers.find(h => h.name?.toLowerCase() === "from")?.value || "Unknown";
    const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value || "No Subject";
    const snippet = detailResponse.data.snippet || "";

    detailedEmails.push({
      id: msg.id,
      sender,
      subject,
      snippet
    });
  }

  return detailedEmails;
}

/**
 * Physically moves a target message ID directly to the Gmail Trash bin.
 */
export async function moveEmailToTrash(gmail: gmail_v1.Gmail, messageId: string) {
  await gmail.users.messages.trash({
    userId: "me",
    id: messageId
  });
}