# First login and your first workflow

Complete [installation](INSTALLATION.md) and confirm the services are healthy before continuing. The frontend is **HTTPS on port 443** in Docker; the Vite development server is a separate setup.

## Sign in

Use the administrator username/password you set in `services.backend.environment` as `AUTOOPS_ADMIN_USERNAME` and `AUTOOPS_ADMIN_PASSWORD`. There is no universal default password or public self-registration flow. The administrator can create other users in the administration area.

Bootstrap only runs when no administrator exists. If you already have an administrator, changing those variables does not reset it. See [login troubleshooting](TROUBLESHOOTING.md#login-fails-or-the-session-disappears).

## Prepare a Linux machine

- SSH must be running on a reachable port (normally 22).
- Create/use a Linux account with a password that SSH accepts. Current stored credentials are username/password based, not private-key uploads.
- The **backend container** must be able to reach the machine. An address reachable from your Windows terminal may still be unreachable from Docker because of VPN, routing, NAT or firewall rules.
- Use the target's LAN/DNS address; `localhost` from inside the backend is the backend container itself.
- For tasks needing elevated privileges, ensure the account has the required sudo rights. A disk-space check with `df -h` normally does not need sudo.
- Commands must suit the target Linux distribution and installed tools. Package-manager commands are not interchangeable between distributions.

## Add credentials and machines

1. Open **Credentials** and create a credential with a recognizable label, the Linux SSH username and its password.
2. Open **Machines**, add the target hostname/IP, SSH port and credential. Use folders/favorites to organize larger inventories.
3. Discover the SSH host key, compare the fingerprint with a trusted value obtained on the host itself and explicitly confirm it. A host administrator can inspect its public host keys with:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Use the public key file matching the algorithm AutoOps displays. Do not copy a private host key into AutoOps.

4. Run the machine's connection test and inspect SSH, authentication, OS detection and sudo results.
5. Add a second reachable machine to try a multi-server workflow. Both machines can use the same credential only if those login details are valid on both.

Eligible newly added machines can also have their first observed key pinned automatically during **execution preflight**. This is trust on first use, not independent verification of server identity. Explicit confirmation is available before running. Changed keys, revoked trust and retargeted machines stay on the manual review path; do not treat a key mismatch as an ordinary connection failure.

## Run the manual example

1. In **Command Bank**, find a disk-space command using `df -h` and open the run dialog.
2. Select one or both machines and inspect the command preview/parameters. Leave sudo off for this check.
3. Start the run. AutoOps performs preflight before executing; approvals appear when the mode/risk requires them.
4. Open execution details to inspect each machine's status, stdout/stderr and exit code.

For a reusable plan, create a workflow with a **Command** step using the matching Command Bank entry or a reviewed custom `df -h` command, then save and run it. Custom commands are real shell code; review their content before running.

## Build the same workflow with AI

Configure [OpenRouter or another compatible provider](AI_SETUP.md) first.

1. Open the AI assistant.
2. Type `@` and **select each machine from the picker**. A selected machine becomes a tag/chip; plain text that looks like a tag does not attach a machine ID.
3. Ask: **"Build a workflow to check disk space with df -h on these servers."**
4. If the assistant asks a clarification question, choose the intended option.
5. Review the workflow preview: command text, sudo, timeout, branches and intended targets. The AI may propose a custom command when appropriate.
6. Save the workflow using the normal UI. An AI proposal alone does not persist or execute it.
7. Confirm the target machines and run options, then start the workflow.
8. Follow preflight and progress, complete any required approval, and compare both outputs in the execution history.

You can attach uploaded files/folder packages for file-transfer workflows, but the disk-space example needs no file upload. Neither successful AI chat nor saved workflow creation proves SSH is connected; the connection test/preflight verifies that separately.
