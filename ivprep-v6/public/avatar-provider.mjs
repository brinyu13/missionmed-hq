export class AvatarProvider {
  async createSession() { throw new Error('AvatarProvider.createSession not implemented'); }
  async start() { throw new Error('AvatarProvider.start not implemented'); }
  async enqueueAudio() { throw new Error('AvatarProvider.enqueueAudio not implemented'); }
  async attachAudioStream() { throw new Error('AvatarProvider.attachAudioStream not implemented'); }
  async interrupt() { throw new Error('AvatarProvider.interrupt not implemented'); }
  async stop() { throw new Error('AvatarProvider.stop not implemented'); }
  async reconnect() { throw new Error('AvatarProvider.reconnect not implemented'); }
  health() { return { available: false, state: 'unconfigured' }; }
  usage() { return { sessions: 0, seconds: 0 }; }
  async close() {}
}

export class UnavailableAvatarProvider extends AvatarProvider {
  constructor(reason = 'Avatar integration begins in Y1-Y2-CAM-V6-3402.') {
    super();
    this.reason = reason;
  }
  async createSession() { return { available: false, reason: this.reason }; }
  async start() { return { available: false, reason: this.reason }; }
  async enqueueAudio() { return { accepted: false, reason: this.reason }; }
  async attachAudioStream() { return { accepted: false, reason: this.reason }; }
  async interrupt() { return { interrupted: false, reason: this.reason }; }
  async stop() { return { stopped: true }; }
  async reconnect() { return { available: false, reason: this.reason }; }
  health() { return { available: false, state: 'not-implemented', reason: this.reason }; }
}
