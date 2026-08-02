# AI runtime implementation

MIR routes by capability rather than product code. Every invocation checks the kill switch, role/feature/subject scope, data classes, provider restricted-data approval, and budget before calling a provider. Successful outputs must pass a declared JSON schema; runs record hashes, token counts, model/provider/prompt metadata, cost, and latency without raw prompts.

OpenAI uses `/v1/responses`, `store:false`, strict `text.format` JSON schema, explicit reasoning effort, timeout, and a safety identifier. Anthropic and local-worker are fail-closed contracts until configured. The deterministic provider is hard-blocked outside `NODE_ENV=test`.
