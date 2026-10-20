# Prompts

Prompts live in `backend/src/main/resources/prompts` and are loaded at startup:

- `system/autoops-system.md` — scope and routing: find/add a Linux command, add a server, build a workflow,
  open a saved-workflow run form, or open the secure credential form; hard rules (no autonomous execution, no invented
  ids/results, no secrets).
- `workflow/workflow-builder.md` — node schema guidance for `propose_workflow_draft`.

Proposal tools: `propose_command` (new Command Bank entry), `propose_machine` (new server), `propose_command_run`,
`propose_workflow_draft`; `offer_action_form` opens a saved-workflow run form or secure credential form. When clarification is needed the model calls `ask_user` (one question, 2-5 options, optional
free-text answer); it returns an `ASK_USER` operation rendered as clickable options and ends the turn. Files attached in the chat reach the model as stored file ids for FILE_TRANSFER steps.

The prompts guide the model; enforcement is in Java (tool permissions, ownership, validation, approvals).
