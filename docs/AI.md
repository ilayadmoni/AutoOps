# AI assistant

The assistant (`AIChatService`) talks to an OpenRouter / OpenAI-compatible endpoint using native tool calling
(assistant `tool_calls` and `tool`-role results). It can run at most three tool rounds per message; then it must
answer without tools. Context is bounded (recent history, draft summary, tool results). It is optional: when
`AI_API_KEY`/`AI_MODEL` are empty `/api/ai/status` reports `configured: false` and the UI points to manual paths.

## Tools (read / validate / propose only)

`list_machines`, `get_machine`, `search_commands`, `list_workflows`, `get_workflow`, `validate_workflow_draft`,
`propose_workflow_draft`, `propose_command_run`, `get_execution` (sanitized failure context: statuses, preflight,
exit codes, bounded output), `list_recent_executions`, `list_files` (metadata only). Tools act as the calling user,
so ownership rules apply. There are no SQL, shell, SSH, HTTP or filesystem tools.

## Operations

Proposal tools return operations that Java re-validates (`AIOperationValidator`) before the client sees them:

- `REPLACE_WORKFLOW_DRAFT` — validated with the workflow validator; problems are returned as `missingFields`.
  The user opens it in the Workflow Builder, edits, validates and saves through the normal API.
- `PROPOSE_COMMAND_RUN` — command must be approved, parameters are previewed, foreign machines are dropped.
  The user reviews it in the Run dialog and starts it like any manual run (preflight and approvals apply).

Chat response: `{conversationId, messageId, message, operations[], missingFields[], toolsUsed[]}`.
Nothing is saved or executed because the assistant proposed it.

## Conversations

Conversations and messages are stored per user (`/api/ai/conversations`) and can be resumed or deleted. History is
context for the model only, never authoritative workflow state.
