# 🤖 AGENTS.md - Codebase Context Harness for AI Agents

> [!IMPORTANT]
> This file is a localized context harness detailing structural boundaries, execution landmines, and strict implementation rules for any autonomous agent (such as `agy`) working in this repository.

---

## 💣 Architectural Landmines

To avoid execution loops, unexpected crashes, or hanging processes, keep the following quirks in mind:

### 1. Interactive OAuth Authentication (The Hanging Process)
- **Location:** [`src/gmailService.ts`](file:///E:/Project/inbox-janitor-agent/src/gmailService.ts)
- **Quirk:** If [`token.json`](file:///E:/Project/inbox-janitor-agent/token.json) does not exist in the root, running the project via `npm run dev` or direct node execution will trigger `@google-cloud/local-auth`. This attempts to open a browser window and wait for manual user authorization.
- **Agent Action:**
  - **Never** execute the application in headless or automated CI environments if `token.json` is missing.
  - **Do not** attempt to programmatically bypass the OAuth flow unless you mock the entire Google API backend.

### 2. Live Inbox Destructive Operations (`DRY_RUN` Toggle)
- **Location:** [`src/index.ts`](file:///E:/Project/inbox-janitor-agent/src/index.ts#L9-L10)
- **Quirk:** The codebase operates on live inbox data. The safety toggle `DRY_RUN` is currently configured. Setting it to `false` will result in actual deletions (moving unread emails matching rules to the Gmail Trash).
- **Agent Action:** 
  - Always verify the state of `DRY_RUN` before launching the runtime.
  - Keep `DRY_RUN = true` during test cycles or code modifications unless specifically directed to run a live execution.

### 3. ESM Relative Import Extensions
- **Location:** Entire `src/` directory (e.g., [`src/index.ts`](file:///E:/Project/inbox-janitor-agent/src/index.ts#L3-L5))
- **Quirk:** The project is configured with `"type": "module"` in `package.json` to leverage modern ESM modules. Consequently, all relative TypeScript imports **must** end with `.js` extensions (e.g., `import { ... } from "./agents.js"`), even though the file is technically a `.ts` file on disk.
- **Agent Action:**
  - **Never** refactor imports to remove the `.js` extension or replace it with `.ts`. Omitting the `.js` extension will result in immediate `ERR_MODULE_NOT_FOUND` runtime crashes under Node ESM.

### 4. Limited Metadata Fetching Config
- **Location:** [`src/gmailActions.ts`](file:///E:/Project/inbox-janitor-agent/src/gmailActions.ts#L24-L26)
- **Quirk:** To conserve memory, payload size, and API rate limits, `fetchUnreadEmails` requests Gmail metadata format with explicit header exclusions: `metadataHeaders: ["From", "Subject"]`. 
- **Agent Action:**
  - If you need additional header fields (e.g., `Date` or `To`), you must append them to `metadataHeaders` rather than requesting the entire message body, to prevent memory bloating.

---

## 📜 Strict Implementation Rules

All future changes and refactors must strictly follow these rules:

1. **Defensive-By-Default Prompting:** 
   - The LLM instructions in [`src/index.ts`](file:///E:/Project/inbox-janitor-agent/src/index.ts) must always contain safeguard rules stating that any domain not explicitly listed for deletion must be kept (`shouldDelete = false`). 
   - Do not let the AI "hallucinate" domains or use broad categorization without deterministic whitelists/rules.
   
2. **Structured AI Schema Enforcement:**
   - Any modifications to the email filtering logic must be matched by updates to the Zod schema [`ClassificationSchema`](file:///E:/Project/inbox-janitor-agent/src/agents.ts#L4-L8) to ensure type safety remains intact.
   
3. **No Direct Secret Commits:**
   - Keep `.env`, `credentials.json`, and `token.json` listed in `.gitignore`. Never write mock credentials directly into files that are checked into git.
