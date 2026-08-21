import { z } from "zod";

/**
 * Only these domains are eligible for deletion. Keep this list small and explicit:
 * it is the final safety boundary, independent of the model's response.
 */
export const TARGET_DOMAINS = [
  "bankbazaar.com",
  "monsterindia.com",
  "timesjobs.com",
  "github.com",
  "linkedin.com",
  "producthunt.com",
  "substack.com",
  "quora.com",
  "freeletics.com",
  "groww.in",
  "actcorp.in",
  "grammarly.com"
] as const;

export function senderMatchesTargetDomain(sender: string): boolean {
  const address = sender.match(/<([^>]+)>/)?.[1] ?? sender;
  const domain = address.split("@")[1]?.trim().toLowerCase();

  if (!domain) return false;

  return TARGET_DOMAINS.some(
    (target) => domain === target || domain.endsWith(`.${target}`),
  );
}

// 1. Define the structural contract we expect back from the AI
export const ClassificationSchema = z.object({
  shouldDelete: z.boolean().describe("True if the email matches the spam/unwanted criteria, false otherwise."),
  confidenceScore: z.number().min(0).max(1).describe("The confidence score of the classification from 0.0 to 1.0."),
  reasoning: z.string().describe("A brief, one-sentence technical justification for the decision based on sender or content."),
});

export type EmailClassification = z.infer<typeof ClassificationSchema>;

// 2. Shape of the input email data coming from our future API fetch
export interface EmailMessage {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
}

// 3. Realistic mock data representing your native inbox pain-points
export const mockEmails: EmailMessage[] = [
  {
    id: "msg_001",
    sender: "creditreport+ratealert@bankbazaar.com",
    subject: "Urgent: Your Credit Score dropped by 15 points! Check alerts",
    snippet: "Dear Customer, your monthly credit rating alert is ready. Check your new dashboard parameters immediately to see eligible loans."
  },
  {
    id: "msg_002",
    sender: "jobmessenger@monsterindia.com",
    subject: "5 New Senior Frontend Roles matching your profile in Bangalore",
    snippet: "Matches found for React, TypeScript. Apply to these premium vacancies posted within the last 24 hours on Monster India."
  },
  {
    id: "msg_003",
    sender: "support@github.com",
    subject: "[GitHub] Security Alert: Personal Access Token Expiring Soon",
    snippet: "Hi Murugesh, your token 'dev-token-2026' is set to expire in 7 days. Please rotate this credential to prevent action runner failures."
  }
];
