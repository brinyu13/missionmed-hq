export class AvatarProvider {
  async createSession() { throw new Error('AvatarProvider.createSession is not implemented.'); }
  async start() { throw new Error('AvatarProvider.start is not implemented.'); }
  async enqueueAudio() { throw new Error('AvatarProvider.enqueueAudio is not implemented.'); }
  async attachAudioStream() { throw new Error('AvatarProvider.attachAudioStream is not implemented.'); }
  async interrupt() { throw new Error('AvatarProvider.interrupt is not implemented.'); }
  async stop() { throw new Error('AvatarProvider.stop is not implemented.'); }
  async reconnect() { throw new Error('AvatarProvider.reconnect is not implemented.'); }
  health() { throw new Error('AvatarProvider.health is not implemented.'); }
  usage() { throw new Error('AvatarProvider.usage is not implemented.'); }
  async close() { throw new Error('AvatarProvider.close is not implemented.'); }
}

export class NullAvatarProvider extends AvatarProvider {
  constructor(reason = 'No live avatar provider is configured in Y1-Y2-CAM-V6-3401.') {
    super();
    this.reason = reason;
    this.closed = false;
  }

  async createSession() { return { status: 'unavailable', reason: this.reason }; }
  async start() { return { status: 'unavailable', reason: this.reason }; }
  async enqueueAudio() { return { accepted: false, reason: this.reason }; }
  async attachAudioStream() { return { accepted: false, reason: this.reason }; }
  async interrupt() { return { interrupted: false, reason: this.reason }; }
  async stop() { return { stopped: true }; }
  async reconnect() { return { status: 'unavailable', reason: this.reason }; }
  health() { return { provider: 'none', status: 'unavailable', reason: this.reason }; }
  usage() { return { provider: 'none', sessions: 0, minutes: 0 }; }
  async close() { this.closed = true; return { closed: true }; }
}
