export type Role = 'USER' | 'ADMIN';
export type Risk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Me { id: number; username: string; role: Role }

export interface UserView { id: number; username: string; role: Role; status: 'ACTIVE' | 'DISABLED' | 'DELETED'; createdAt: string }

export interface Credential { id: number; name: string; username: string; authType: string; createdAt: string; updatedAt: string }

export type TrustStatus = 'UNTRUSTED' | 'TRUSTED' | 'KEY_CHANGED';

export interface Machine {
  id: number; name: string; hostname: string; sshPort: number; operatingSystem?: string; osVersion?: string;
  preferredCredentialId?: number | null; trustStatus: TrustStatus; hostKeyAlgorithm?: string; sshFingerprint?: string;
  fingerprintVerifiedAt?: string; mismatchFingerprint?: string; mismatchDetectedAt?: string;
  lastTestStatus?: string; lastTestedAt?: string; createdAt: string;
}

export interface Discovery {
  machineId: number; hostname: string; port: number; algorithm: string; fingerprint: string;
  currentTrustStatus: TrustStatus; trustedFingerprint?: string; matchesTrusted: boolean;
}

export interface MachineTest {
  ssh: string; hostVerification: string; authentication: string; os: string; sudo: string;
  osName?: string; osVersion?: string; rhelFamily: boolean; message: string;
}

export type ParamType = 'STRING' | 'INTEGER' | 'PATH' | 'SERVICE' | 'PACKAGE' | 'HOSTNAME' | 'ENUM';

export interface ParameterSpec {
  name: string; label?: string; type?: ParamType; required?: boolean; description?: string;
  allowedValues?: string[]; defaultValue?: string;
}

export interface Command {
  id: number; name: string; description?: string; category?: string; action?: string; resourceType?: string;
  commandTemplate: string; parameters: ParameterSpec[]; riskLevel: Risk; requiresApproval: boolean;
  status: 'APPROVED' | 'PENDING' | 'REJECTED'; source: string; rejectionReason?: string; ownedByCurrentUser: boolean;
  createdAt: string; approvedAt?: string;
}

export interface CommandPreview {
  commandId: number; resolvedCommand: string; executedForm: string; riskLevel: Risk; effectiveRiskLevel: Risk;
  requiresHighRiskAcknowledgement: boolean;
}

export interface SearchMatch { id: number; name: string; description?: string; category?: string; commandTemplate: string; riskLevel: Risk; score: number }

export interface SearchResult { confidence: 'MATCH' | 'AMBIGUOUS' | 'NO_CONFIDENT_MATCH'; matches: SearchMatch[] }

export interface RunOptions {
  machineIds: number[]; credentialId?: number | null; mode: 'MANUAL' | 'AUTOMATIC'; concurrency: number;
  failurePolicy: 'STOP_NEW_MACHINES' | 'CONTINUE';
}

export interface ExecutionSummary {
  id: number; type: 'COMMAND' | 'WORKFLOW'; title?: string; commandDefinitionId?: number; workflowId?: number;
  status: string; mode: string; riskLevel: Risk; concurrency: number; failurePolicy: string; machineCount: number;
  succeededMachines: number; failedMachines: number; pendingApprovals: number; failureReason?: string;
  cancelRequested: boolean; startedBy: number; createdAt: string; startedAt?: string; finishedAt?: string;
}

export interface Preflight {
  id: number; status: string; sshStatus?: string; hostVerificationStatus?: string; authenticationStatus?: string;
  osStatus?: string; sudoStatus?: string; filesStatus?: string; parametersStatus?: string; failureReason?: string;
  startedAt?: string; finishedAt?: string;
}

export interface StepRunView {
  id: number; workflowStepId?: number; stepKey?: string; stepType?: string; stepName?: string; riskLevel?: Risk;
  runWithSudo: boolean; status: string; originalCommand?: string; resolvedCommand?: string; stdout?: string;
  stderr?: string; exitCode?: number | null; failureReason?: string; attemptNumber: number; retryOfStepRunId?: number;
  retryable: boolean; startedAt?: string; finishedAt?: string;
}

export interface MachineRunView {
  id: number; machineId: number; machineName: string; hostname?: string; credentialId?: number; credentialName?: string;
  status: string; failureReason?: string; startedAt?: string; finishedAt?: string; preflight?: Preflight | null;
  steps: StepRunView[];
}

export interface ApprovalView {
  id: number; executionId: number; executionTitle?: string; executionType?: string; machineRunId?: number;
  machineName?: string; stepRunId?: number; stepName?: string; scope: 'EXECUTION' | 'STEP' | 'RETRY'; riskLevel: Risk;
  reason?: string; status: string; requestedAt: string; decidedAt?: string; decidedBy?: number;
  highRiskAcknowledged: boolean; comment?: string;
}

export interface ExecutionDetail {
  summary: ExecutionSummary; parameters: Record<string, string>; runWithSudo: boolean;
  machines: MachineRunView[]; approvals: ApprovalView[];
}

export interface Page<T> { items: T[]; page: number; size: number; total: number }

export type NodeType = 'COMMAND' | 'FILE_TRANSFER' | 'WAIT_UNTIL';
export type CheckType = 'OUTPUT_CONTAINS' | 'EXIT_CODE' | 'FILE_EXISTS' | 'SERVICE_ACTIVE';

export interface WorkflowNode {
  key: string; type: NodeType; name: string; description?: string | null; requiresApproval?: boolean | null;
  successNext?: string | null; failureNext?: string | null;
  commandDefinitionId?: number | null; parameters?: Record<string, string> | null; runWithSudo?: boolean | null;
  timeoutSeconds?: number | null; storedFileId?: number | null; destinationPath?: string | null;
  overwrite?: boolean | null; useSudo?: boolean | null; checkType?: CheckType | null; expectedOutput?: string | null;
  expectedExitCode?: number | null; target?: string | null; intervalSeconds?: number | null;
}

export interface WorkflowView {
  id: number; name: string; description?: string; status: string; version: number; createdAt: string; updatedAt: string;
  nodes: WorkflowNode[];
}

export interface WorkflowSummary { id: number; name: string; description?: string; status: string; stepCount: number; version: number; updatedAt: string }

export interface WorkflowDraft { name: string; description?: string; nodes: WorkflowNode[]; version?: number }

export interface ValidationError { nodeKey?: string | null; field: string; message: string }

export interface ValidationResult { valid: boolean; errors: ValidationError[] }

export interface StoredFile { id: number; filename: string; size: number; checksum: string; contentType?: string; createdAt: string; referencedBy: string[] }

export interface MissingField { nodeKey?: string | null; field: string; message: string }

export interface AIOperation { type: 'REPLACE_WORKFLOW_DRAFT' | 'PROPOSE_COMMAND_RUN'; payload: Record<string, unknown>; missingFields: MissingField[] }

export interface ChatReply {
  conversationId: number; messageId: number; message: string; operations: AIOperation[];
  missingFields: MissingField[]; toolsUsed: string[];
}

export interface ConversationSummary { id: number; title: string; createdAt: string; updatedAt: string }

export interface ConversationMessage { id: number; role: 'user' | 'assistant'; content: string; operations: AIOperation[]; missingFields: MissingField[]; createdAt: string }

export interface ConversationView extends ConversationSummary { messages: ConversationMessage[] }

export interface DatasetView {
  id: number; filename: string; status: string; sizeBytes?: number; checksum?: string; totalRecords: number;
  candidateRecords: number; invalidRecords: number; nonRhelRecords: number; duplicateRecords: number;
  processedRecords: number; addedRecords: number; failedRecords: number; errorMessage?: string; approveUpTo?: string;
  embeddingProvider?: string; embeddingModel?: string; uploadedBy: number; reviewedBy?: number; reviewedAt?: string;
  createdAt: string; startedAt?: string; finishedAt?: string;
  analysis?: {
    columns: string[]; ignoredColumns: string[]; riskCounts: Record<string, number>;
    preview: { line: number; name: string; category: string; template: string; risk: Risk; parameters: string[] }[];
    issues: { line: number; kind: string; message: string }[];
  } | null;
}

export interface AuditEvent { id: number; userId?: number; action: string; entityType: string; entityId?: number; metadata?: string; createdAt: string }
