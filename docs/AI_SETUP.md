# Set up the AI assistant

AutoOps uses an **OpenAI-compatible Chat Completions API with native function/tool calling**. OpenRouter is the default endpoint. An API key and model are required for chat; machine management, manual workflows and execution work without AI.

The backend sends `model`, `messages`, `tools` and `tool_choice: "auto"` to `<AI_BASE_URL>/chat/completions`. It expects `choices[].message`, native `tool_calls` and support for subsequent `tool`-role results. A generic text-generation URL, provider web login or an API supporting only another protocol is insufficient.

## Option A: OpenRouter

1. Create/sign in to an [OpenRouter account](https://openrouter.ai/).
2. Open [API keys](https://openrouter.ai/settings/keys) and create a key for your AutoOps installation. Keep the key private; it belongs on the backend, never in frontend code or screenshots.
3. Check your account's available credits, key limits and the model's current pricing/rate limits. A ChatGPT or other consumer-chat subscription is not an OpenRouter API key. Do not assume API calls or a particular model are free.
4. Browse [the model catalog](https://openrouter.ai/models), choose a model/provider route supporting **tools/function calling**, and copy its exact API model identifier. The display name is not necessarily the API ID. Availability and cost can change, so this guide does not pin a model.
5. In `services.backend.environment` in `deploy/docker-compose.yml`, set:

```yaml
AI_BASE_URL: "https://openrouter.ai/api/v1"
AI_API_KEY: "YOUR_OPENROUTER_KEY"
AI_MODEL: "YOUR_EXACT_OPENROUTER_MODEL_ID"
AI_SSL_VERIFY: "true"
AI_SSL_CERT_PATH: ""
```

Use your real key/model in the private file. AutoOps reads `AI_API_KEY`, **not** `OPENROUTER_API_KEY`. Do not append `/chat/completions` to `AI_BASE_URL`.

6. Start the stack using [installation](INSTALLATION.md), or recreate an existing backend:

```bash
docker compose -f deploy/docker-compose.yml up -d --pull never --force-recreate backend
```

7. Sign in, open the assistant and try the [first-workflow example](FIRST_RUN.md#build-the-same-workflow-with-ai). Confirm that it can ask a question or produce a workflow proposal, not only a text response.

Provider references: [OpenRouter quickstart](https://openrouter.ai/docs/quickstart) and [tool calling](https://openrouter.ai/docs/guides/features/tool-calling).

## Option B: another OpenAI-compatible provider

Keep the same five AutoOps variables, but use that provider's API base URL, key and exact tool-capable model ID:

```yaml
AI_BASE_URL: "https://YOUR_PROVIDER_HOST/v1"
AI_API_KEY: "YOUR_PROVIDER_KEY"
AI_MODEL: "YOUR_PROVIDER_MODEL_ID"
AI_SSL_VERIFY: "true"
AI_SSL_CERT_PATH: ""
```

The `/v1` suffix is an example, not a rule: follow the provider's Chat Completions documentation. Standard OpenAI's API base is `https://api.openai.com/v1`; [its Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) describes the required protocol. A provider's Messages-only API, Responses-only API or deployment-specific API requiring custom query parameters/headers is not automatically compatible with the current adapter.

Cloud models are not installed inside AutoOps. The backend calls your provider and must have outbound network/TLS access to it. Provider-side model permissions, credit limits and rate limits still apply.

## Option C: a local compatible inference server

A locally hosted model can work **if its server and the selected model implement the same tool-calling protocol**. AutoOps does not bundle, start or download an inference model. Size and provision that service separately and verify its tool support.

- Use an address reachable from the backend container. `localhost` inside the container refers to that container, not your computer.
- On Docker Desktop, a host service is commonly reachable as `http://host.docker.internal:<port>/v1`.
- On Linux Engine, use a reachable host/LAN address or explicitly configure Docker's host-gateway mapping; `host.docker.internal` is not universally preconfigured.
- Ensure the inference server binds to an address reachable through that route, with appropriate access controls.
- The current AutoOps provider requires a **nonempty** key and model to enable chat. For a server explicitly configured without authentication, use a nonempty dummy key only if it accepts/ignores the resulting Bearer header. Do not use a dummy key for an authenticated provider.

An endpoint accepting ordinary chat is not proof that it supports the tools AutoOps needs.

## Disable AI

```yaml
AI_BASE_URL: "https://openrouter.ai/api/v1"
AI_API_KEY: ""
AI_MODEL: ""
AI_SSL_VERIFY: "true"
AI_SSL_CERT_PATH: ""
```

Recreate the backend after changing these values. `/api/ai/status` reports `configured: false`; the UI offers manual paths. This endpoint is authenticated, so inspect it through a signed-in browser/network panel or an authenticated API client.

## TLS, timeouts and configuration checks

Keep certificate verification enabled. A private CA can be supplied through `AI_SSL_CERT_PATH` as described in [configuration](CONFIGURATION.md#provider-ca-certificates). Do not confuse that provider CA with the CA used for your browser's AutoOps HTTPS certificate. The chat client has a 10-second connection timeout and 120-second read timeout.

`/api/ai/status` checks only whether key and model are present. `configured: true` does not validate the key, model, credits, tool support or network connection; sending a real message is the functional check. For failures, inspect backend logs privately and use [troubleshooting](TROUBLESHOOTING.md#ai-chat-is-unavailable-or-returns-only-text).

## Chat AI versus embeddings

For a first installation, keep:

```yaml
EMBEDDING_PROVIDER: "LOCAL"
EMBEDDING_MODEL: ""
EMBEDDING_BASE_URL: ""
EMBEDDING_API_KEY: ""
```

`LOCAL` creates deterministic lexical/hash vectors without an external model. To use an external embedding provider, configure all three embedding values separately and ensure it returns **384-dimensional vectors**; the schema uses `vector(384)`. A chat model ID/key does not automatically configure embeddings.

## What is sent to the provider?

Chat messages, bounded conversation/draft context, selected machine metadata and controlled tool results can be included. Stored SSH passwords are excluded from tool responses. Do not put credentials in free-text prompts or assume command outputs contain no sensitive information. The assistant proposes changes; saving and starting an execution require explicit user actions in AutoOps. See [AI behavior](AI.md) and [security](SECURITY.md).
