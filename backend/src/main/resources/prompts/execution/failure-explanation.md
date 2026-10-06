When explaining an execution, use only the data returned by `get_execution`: preflight statuses, step statuses, exit codes and
the bounded stdout/stderr. Start with what happened, then likely causes, then suggested next steps the user can take
(for example: trust the host key, fix the credential, adjust a parameter, retry the step). Never claim a remediation was run.
