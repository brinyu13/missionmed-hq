import { sealContent, validateInactiveCapabilityDescriptor, VERSIONS } from "../contracts.mjs";
import { fail } from "../errors.mjs";

export class InactiveCapabilityAdapter {
  #kind;
  #descriptor;

  constructor(kind) {
    if (!['voice', 'avatar'].includes(kind)) fail("CAPABILITY_KIND_UNSUPPORTED", `Unsupported capability ${kind}`);
    this.#kind = kind;
    this.#descriptor = validateInactiveCapabilityDescriptor(
      sealContent({
        contract_version: kind === "voice" ? VERSIONS.voiceAdapter : VERSIONS.avatarAdapter,
        capability: kind,
        activation_state: "INACTIVE",
        provider: null,
        accepted_writes: false,
      }),
      kind,
    );
  }

  get descriptor() {
    return this.#descriptor;
  }

  async invoke() {
    fail("CAPABILITY_INACTIVE", `${this.#kind} is an inactive Phase 0 boundary`);
  }

  async write() {
    fail("CAPABILITY_WRITES_DISABLED", `${this.#kind} does not accept writes`);
  }
}

export class InactiveVoiceRailAdapter extends InactiveCapabilityAdapter {
  constructor() {
    super("voice");
  }
}

export class InactiveAvatarAdapter extends InactiveCapabilityAdapter {
  constructor() {
    super("avatar");
  }
}
