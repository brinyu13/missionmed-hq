import { initializeAnalyticsUi } from './ui.mjs';

const bridge = window.V6Bridge;
if (!bridge) throw new Error('V6Bridge must initialize before communication analytics.');

window.V6CommunicationAnalytics = initializeAnalyticsUi(bridge);
