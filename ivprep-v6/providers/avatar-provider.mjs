export class AvatarProvider {
  async configure() { throw new Error('AvatarProvider.configure is not implemented.'); }
  async createSession() { throw new Error('AvatarProvider.createSession is not implemented.'); }
  async start() { throw new Error('AvatarProvider.start is not implemented.'); }
  async enqueueAudio() { throw new Error('AvatarProvider.enqueueAudio is not implemented.'); }
  async attachAudioStream() { throw new Error('AvatarProvider.attachAudioStream is not implemented.'); }
  async interrupt() { throw new Error('AvatarProvider.interrupt is not implemented.'); }
  async stop() { throw new Error('AvatarProvider.stop is not implemented.'); }
  async reconnect() { throw new Error('AvatarProvider.reconnect is not implemented.'); }
  capabilities() { throw new Error('AvatarProvider.capabilities is not implemented.'); }
  health() { throw new Error('AvatarProvider.health is not implemented.'); }
  usage() { throw new Error('AvatarProvider.usage is not implemented.'); }
  async close() { throw new Error('AvatarProvider.close is not implemented.'); }
}

export class NullAvatarProvider extends AvatarProvider {
  constructor(reason = 'No live avatar provider is configured. The interview can continue in visible voice-only mode.', metadata = {}) {
    super();
    this.reason = reason;
    this.metadata = Object.freeze({ ...metadata });
    this.closed = false;
  }

  async configure() { return { status: 'unavailable', fallback: 'voice-only', reason: this.reason }; }
  async createSession() { return { status: 'unavailable', fallback: 'voice-only', reason: this.reason }; }
  async start() { return { status: 'unavailable', fallback: 'voice-only', reason: this.reason }; }
  async enqueueAudio() { return { accepted: false, fallback: 'voice-only', reason: this.reason }; }
  async attachAudioStream() { return { accepted: false, fallback: 'voice-only', reason: this.reason }; }
  async interrupt() { return { interrupted: false, fallback: 'voice-only', reason: this.reason }; }
  async stop() { return { stopped: true }; }
  async reconnect() { return { status: 'unavailable', fallback: 'voice-only', reason: this.reason }; }
  capabilities() { return this.metadata.capabilities || Object.freeze({}); }
  health() { return { provider: this.metadata.provider || 'none', status: 'unavailable', available: false, configured: false, mode: this.metadata.mode || null, deliveryProfileId: this.metadata.deliveryProfileId || null, capabilityVersion: this.metadata.capabilityVersion || null, implemented: this.metadata.implemented ?? false, blockedReason: this.metadata.blockedReason || null, intelligenceOwner: this.metadata.intelligenceOwner || null, capabilities: this.capabilities(), providerAdvertisedCapabilities: this.metadata.providerAdvertisedCapabilities || Object.freeze({}), fallback: 'voice-only', reason: this.reason }; }
  usage() { return { provider: this.metadata.provider || 'none', mode: this.metadata.mode || null, usageClass: this.metadata.usageClass || null, sessions: 0, minutes: 0 }; }
  async close() { this.closed = true; return { closed: true }; }
}
