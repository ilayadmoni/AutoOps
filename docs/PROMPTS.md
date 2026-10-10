# Prompts

Prompts live in `backend/src/main/resources/prompts` and are loaded at startup:

- `system/autoops-system.md` — scope and routing: the assistant does exactly three things (find or add a Linux command,
  add a server, build a workflow) and politely declines anything else; hard rules (no execution, no invented
  ids/results, no secrets).
- `workflow/workflow-builder.md` — node schema guidance for `propose_workflow_draft`.

Proposal tools: `propose_command` (new Command Bank entry), `propose_machine` (new server), `propose_command_run`,
`propose_workflow_draft`. When the intent is unclear the model calls `ask_user` (one question, 2-5 options, optional
free-text answer); it returns an `ASK_USER` operation rendered as clickable options and ends the turn. Files attached in the chat reach the model as stored file ids for FILE_TRANSFER steps.

The prompts guide the model; enforcement is in Java (tool permissions, ownership, validation, approvals).
