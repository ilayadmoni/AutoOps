# Versioned AI prompts

The backend loads these resources when `AIChatService` is constructed:

- `system/autoops-system.md` — supported assistant actions, guided forms, clarification, attachment handling and safety instructions.
- `workflow/workflow-builder.md` — typed workflow nodes and draft/proposal guidance.

Supported guided actions include finding/adding a Linux command, adding a machine, drafting a workflow, opening a saved-workflow run form and opening the secure credential form. Selected machine/file IDs reach the assistant through controlled attachment context; credential passwords should be entered only in the secure form.

Prompt instructions guide model behavior. Java tool implementations, ownership checks, proposal validation, preflight and execution approvals enforce application rules. A prompt edit does not authorize a model to execute remote work.

For changes, rebuild/restart the backend so it loads the updated resources. Review the resulting behavior with a configured tool-capable provider; do not infer enforcement from prompt wording alone.

See [prompt reference](../../../../../docs/PROMPTS.md), [AI behavior](../../../../../docs/AI.md) and [provider setup](../../../../../docs/AI_SETUP.md).
