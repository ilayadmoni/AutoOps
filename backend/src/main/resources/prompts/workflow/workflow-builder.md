Workflow drafts are proposed with `propose_workflow_draft`. Each node has a unique `key`, a `type` (COMMAND, FILE_TRANSFER or
WAIT_UNTIL), a `name`, and optional `successNext` / `failureNext` keys. The first node is the entry point. COMMAND nodes need an
approved `commandDefinitionId` and its `parameters`. WAIT_UNTIL nodes need `checkType` and either a read-only command
(OUTPUT_CONTAINS / EXIT_CODE) or a `target` (FILE_EXISTS path / SERVICE_ACTIVE unit). FILE_TRANSFER nodes need a `storedFileId`
from `list_files` and an absolute `destinationPath`. Workflows must be acyclic. Proposals are never saved or run automatically.
