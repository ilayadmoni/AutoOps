# AI assistant behavior

For API key/model installation instructions, use [AI_SETUP.md](AI_SETUP.md). The backend's `AIChatService` uses native tool calling over an OpenRouter/OpenAI-compatible Chat Completions endpoint. It permits at most **six tool rounds** per message, then requests a final answer without offering tools. Recent conversation history, draft context and tool results are bounded.

The assistant is optional. Missing key or model makes `/api/ai/status` return `configured: false`; this status checks configuration presence, not provider connectivity. Manual operations work without AI.

## Tools

All tools execute under the calling user's ownership rules. They read application resources, validate drafts, ask questions or propose actions; none independently starts SSH work or saves a proposed resource.

| Group | Tools |
| --- | --- |
| Machines | `list_machines`, `get_machine`, `propose_machine` |
| Commands | `search_commands`, `propose_command`, `propose_command_run` |
| Workflows | `list_workflows`, `get_workflow`, `validate_workflow_draft`, `propose_workflow_draft` |
| Execution context | `get_execution`, `list_recent_executions` |
| Stored files/folders | `list_files` (metadata) |
| Guided input | `ask_user`, `offer_action_form` |

The system prompt guides five starts: find/add a Linux command, add a server, build a workflow, run an existing workflow through its form, or add credentials through the secure form. Tool availability is not a promise that every arbitrary question is within the prompt's supported scope. There are no general-purpose shell, SQL, SSH, arbitrary-HTTP or filesystem tools.

## User-reviewed operations

`AIOperationValidator` re-validates proposed payloads before returning them:

- `REPLACE_WORKFLOW_DRAFT`: update a draft preview; the user reviews, validates and saves through normal workflow APIs. Command nodes may reference approved entries or contain custom command text.
- `PROPOSE_COMMAND_RUN`: review the command/parameters/targets in the normal run dialog; preflight and approvals still apply.
- `PROPOSE_NEW_COMMAND`: review/add the Command Bank entry through the UI. The current command-creation implementation approves new entries immediately; execution risk gates remain separate.
- `PROPOSE_MACHINE`: review the machine form and select credentials before saving.
- `ASK_USER`: one clarification question with options; ends the tool loop so the user's next reply supplies the answer.
- `OFFER_ACTION_FORM`: open the saved-workflow run form or secure credential form. Passwords belong in that form, not chat.

Workflow proposals do not automatically save or run. Even when targets are tagged, the user must confirm/start the execution.

## Attachments, context and conversations

The `@` picker attaches actual machine IDs; file attachments reference previously stored resources. Backend attachment context provides owned resource metadata, not SSH passwords. Chat messages and selected tool outputs can be sent to the configured provider, so users must consider the contents of prompts and execution output.

Per-user conversations are persisted through `/api/ai/conversations` and can be resumed/deleted. History informs the model but is not authoritative workflow state. Workflow changes still use the validated draft/API path.

See [prompts](PROMPTS.md), [security](SECURITY.md) and [the first AI workflow](FIRST_RUN.md#build-the-same-workflow-with-ai).
