# Prompts

Prompts live in `backend/src/main/resources/prompts` and are loaded at startup:

- `system/autoops-system.md` — role, hard rules (no execution, no invented ids/results, no secrets), working method.
- `workflow/workflow-builder.md` — node schema guidance for `propose_workflow_draft`.
- `execution/failure-explanation.md` — how to explain failures from `get_execution` data.

The prompts guide the model; enforcement is in Java (tool permissions, ownership, validation, approvals).
