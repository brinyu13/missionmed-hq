export class ZoomAttendanceProvider {
  async listCompletedMeetings() {
    throw new Error('ZoomAttendanceProvider is not configured');
  }

  async listParticipants() {
    throw new Error('ZoomAttendanceProvider is not configured');
  }

  async ingestWindow() {
    return {
      state: 'not_connected',
      applied: false,
      message: 'Zoom ingestion remains feature-off pending provider credentials and authority.',
    };
  }
}
