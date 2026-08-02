import type { MirProvider } from "../../mir-core/src/index.ts";

export interface AnthropicProvider extends MirProvider { readonly name: "anthropic" }
export interface LocalWorkerProvider extends MirProvider { readonly name: "local-worker" }

export class UnconfiguredProvider implements MirProvider {
  readonly restrictedDataApproved = false;
  constructor(readonly name: string) {}
  async health() { return { configured: false, detail: `${this.name} adapter contract exists; credentials/runtime not configured` }; }
  async invoke(): Promise<never> { throw new Error(`PROVIDER_NOT_CONFIGURED:${this.name}`); }
}
