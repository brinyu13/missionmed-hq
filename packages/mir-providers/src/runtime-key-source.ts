import { readFile } from "node:fs/promises";

export type OpenAICredentialSource = "runtime_environment" | "secret_provider" | "development_env_file" | "unavailable";

export interface OpenAISecretProvider {
  getSecret(name: "OPENAI_API_KEY"): Promise<string | undefined>;
}

export interface OpenAICredentialResolution {
  source: OpenAICredentialSource;
  value?: string;
}

export class OpenAICredentialResolver {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly secretProvider?: OpenAISecretProvider,
  ) {}

  async resolve(): Promise<OpenAICredentialResolution> {
    const automatedTestWithoutSpendGate = this.env.NODE_ENV === "test" && this.env.MIR_REAL_AI_TESTS !== "1";
    if (automatedTestWithoutSpendGate) return { source: "unavailable" };
    if (this.env.OPENAI_API_KEY?.trim()) return { source: "runtime_environment", value: this.env.OPENAI_API_KEY };

    const injected = await this.secretProvider?.getSecret("OPENAI_API_KEY");
    if (injected?.trim()) return { source: "secret_provider", value: injected };

    if (this.env.NODE_ENV === "development" && this.env.PRIQ_OPENAI_DEV_ENV_FILE?.trim()) {
      const fromFile = await this.readExplicitDevelopmentFile(this.env.PRIQ_OPENAI_DEV_ENV_FILE);
      if (fromFile) return { source: "development_env_file", value: fromFile };
    }

    return { source: "unavailable" };
  }

  private async readExplicitDevelopmentFile(path: string): Promise<string | undefined> {
    try {
      const text = await readFile(path, "utf8");
      const line = text.split(/\r?\n/).find((candidate) => candidate.trimStart().startsWith("OPENAI_API_KEY="));
      if (!line) return undefined;
      const value = line.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
      return value || undefined;
    } catch {
      throw new Error("OPENAI_CREDENTIAL_HEALTH_ERROR");
    }
  }
}
