import { gmail_v1 } from "googleapis";
import { type EmailMessage } from "./agents.js";

/**
 * Fetches a list of unread message summaries from the live inbox.
 */
export async function fetchUnreadEmails(gmail: gmail_v1.Gmail): Promise<EmailMessage[]> {
  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread",
    maxResults: 50
  });

  const messagesSummary = (listResponse.data.messages || []).filter(
    (message): message is typeof message & { id: string } => Boolean(message.id),
  );

  // These requests are independent. Fetching them together avoids waiting for
  // one network round trip to finish before starting the next one.
  return Promise.all(messagesSummary.map(async (msg): Promise<EmailMessage> => {
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

    return {
      id: msg.id,
      sender,
      subject,
      snippet
    };
  }));
}

/**
 * Physically moves a target message ID directly to the Gmail Trash bin.
 */
export async function moveEmailToTrash(gmail: gmail_v1.Gmail, messageId: string): Promise<void> {
  await gmail.users.messages.trash({
    userId: "me",
    id: messageId
  });
}
