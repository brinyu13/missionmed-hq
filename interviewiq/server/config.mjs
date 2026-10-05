import {MODEL_CONTEXT_TOKENS} from './loi-openai.mjs';
import {readResearchProofConfig} from './research-job-runtime.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AppError } from './errors.mjs';

export function readConfig(env = process.env) {
  const text = (key, fallback = '') => String(env[key] ?? fallback).trim();
  const bool = key => ['1', 'true'].includes(text(key).toLowerCase());
  const integer = (key, fallback, min, max) => {
    const value = text(key, String(fallback));
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max)
      throw new AppError(503, 'invalid_configuration', `${key} is invalid.`);
    return Number(value);
  };
  const config = {
    packageDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    host: text('INTERVIEWIQ_HOST', '0.0.0.0'),
    port: integer('PORT', 4186, 1, 65535),
    enabled: bool('INTERVIEWIQ_ENABLED'),
    coreOnly: text('INTERVIEWIQ_LAUNCH_MODE','core') !== 'full',
    deepResearch:{enabled:bool('INTERVIEWIQ_DEEP_RESEARCH_ENABLED'),ownerId:text('INTERVIEWIQ_DEEP_RESEARCH_OWNER_ID'),programId:text('INTERVIEWIQ_DEEP_RESEARCH_PROGRAM_ID'),requestSecret:text('INTERVIEWIQ_RESEARCH_JOB_REQUEST_SECRET')},
    researchProof:readResearchProofConfig(env),
    loi:{myerasEnabled:bool('INTERVIEWIQ_MYERAS_IMPORT_ENABLED'),targetsEnabled:bool('INTERVIEWIQ_LOI_TARGETS_ENABLED'),targetsOwnerId:text('INTERVIEWIQ_LOI_TARGETS_OWNER_ID'),enabled:bool('INTERVIEWIQ_LOI_ENABLED'),mode:text('INTERVIEWIQ_LOI_MODE','CANARY'),ownerId:text('INTERVIEWIQ_LOI_OWNER_ID'),programId:text('INTERVIEWIQ_LOI_PROGRAM_ID')},
    calendar:{enabled:bool('INTERVIEWIQ_CALENDAR_V2_ENABLED')},
    intake:{enabled:bool('INTERVIEWIQ_INTAKE_V2_ENABLED')},
    loiOpenai:{apiKey:text('INTERVIEWIQ_OPENAI_API_KEY')},
    loiComposition:{canaryOwnerId:text('INTERVIEWIQ_LOI_AI_CANARY_OWNER_ID'),lifetimeBudgetMicros:integer('INTERVIEWIQ_LOI_AI_LIFETIME_BUDGET_MICROS',0,0,25000000),enabled:bool('INTERVIEWIQ_LOI_COMPOSITION_ENABLED'),aiEnabled:bool('INTERVIEWIQ_LOI_AI_ENABLED'),authorizationId:text('INTERVIEWIQ_LOI_AI_AUTHORIZATION_ID'),model:text('INTERVIEWIQ_LOI_AI_MODEL'),maxInputTokens:integer('INTERVIEWIQ_LOI_AI_MAX_INPUT_TOKENS',MODEL_CONTEXT_TOKENS,256,MODEL_CONTEXT_TOKENS),maxOutputTokens:integer('INTERVIEWIQ_LOI_AI_MAX_OUTPUT_TOKENS',2048,128,8192),timeoutMs:integer('INTERVIEWIQ_LOI_AI_TIMEOUT_MS',20000,100,30000),maxCostMicros:integer('INTERVIEWIQ_LOI_AI_MAX_COST_MICROS',0,0,1000000),dailyBudgetMicros:integer('INTERVIEWIQ_LOI_AI_DAILY_BUDGET_MICROS',0,0,10000000),dailyRequests:integer('INTERVIEWIQ_LOI_AI_DAILY_REQUESTS',0,0,100)},
    researchMissionsEnabled: bool('INTERVIEWIQ_RESEARCH_MISSIONS_ENABLED'),
    rise: {enabled:bool('INTERVIEWIQ_RISE_ENABLED'),requestSecret:text('INTERVIEWIQ_RISE_REQUEST_SECRET'),researchCoverageEnabled:bool('INTERVIEWIQ_RESEARCH_MISSIONS_ENABLED')},
    databaseUrl: text('INTERVIEWIQ_DATABASE_URL'),
    publicOrigin: text('INTERVIEWIQ_PUBLIC_ORIGIN', 'https://missionmedinstitute.com'),
    jwtIssuer: text('INTERVIEWIQ_JWT_ISSUER', 'https://missionmedinstitute.com'),
    jwtAudience: 'interviewiq',
    jwtSecret: text('INTERVIEWIQ_JWT_SECRET'),
    ownerProofSecret: text('INTERVIEWIQ_OWNER_PROOF_SECRET'),
    ownerIntrospectionUrl: text('INTERVIEWIQ_OWNER_INTROSPECTION_URL', 'https://missionmedinstitute.com/wp-json/missionmed-interviewiq/v1/introspect'),
    ownerTimeoutMs: integer('INTERVIEWIQ_OWNER_TIMEOUT_MS', 5000, 500, 10000),
    release: text('INTERVIEWIQ_RELEASE', 'unreleased'),
    maxBodyBytes: integer('INTERVIEWIQ_MAX_BODY_BYTES', 262144, 1024, 1048576),
    gatewaySecret: text('INTERVIEWIQ_GATEWAY_SECRET'),
    speech: { enabled: bool('INTERVIEWIQ_SPEECH_ENABLED'), apiKey: text('INTERVIEWIQ_OPENAI_API_KEY'), model: 'gpt-4o-transcribe', fallback: 'whisper-1' },
    audio: {endpoint:text('INTERVIEWIQ_AUDIO_ENDPOINT'),region:text('INTERVIEWIQ_AUDIO_REGION','auto'),bucket:text('INTERVIEWIQ_AUDIO_BUCKET'),
      accessKeyId:text('INTERVIEWIQ_AUDIO_ACCESS_KEY_ID'),secretAccessKey:text('INTERVIEWIQ_AUDIO_SECRET_ACCESS_KEY'),prefix:text('INTERVIEWIQ_AUDIO_PREFIX','interviewiq-recordings')},
  };
  for (const field of ['publicOrigin', 'jwtIssuer', 'ownerIntrospectionUrl']) {
    let url; try { url = new URL(config[field]); } catch { throw new AppError(503, 'invalid_configuration', `${field} must be a URL.`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search)
      throw new AppError(503, 'invalid_configuration', `${field} must use a pinned HTTPS URL.`);
    if (field !== 'ownerIntrospectionUrl' && url.origin !== config[field])
      throw new AppError(503, 'invalid_configuration', `${field} must be an origin.`);
  }
  if (new URL(config.ownerIntrospectionUrl).origin !== config.jwtIssuer || config.jwtIssuer !== config.publicOrigin)
    throw new AppError(503, 'invalid_configuration', 'Identity and introspection must use the same MissionMed owner.');
  if (config.enabled && (!config.databaseUrl || [config.jwtSecret,config.ownerProofSecret,config.gatewaySecret].some(v => v.length < 32)))
      throw new AppError(503, 'invalid_configuration', 'Enabled InterviewIQ requires database and server-only authentication configuration.');
  if(config.enabled&&config.researchMissionsEnabled&&(!config.rise.enabled||Buffer.byteLength(config.rise.requestSecret)<32))
    throw new AppError(503,'invalid_configuration','Research missions require the configured authenticated RISE connection.');
  if(config.deepResearch.enabled){
    const d=config.deepResearch;
    if(!config.enabled||!config.rise.enabled||!config.researchProof.enabled||Buffer.byteLength(config.rise.requestSecret)<32||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$(?![\s\S])/.test(d.ownerId)||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$(?![\s\S])/.test(d.programId)||Buffer.byteLength(d.requestSecret)<32)
      throw new AppError(503,'invalid_configuration','Deep research requires the bounded owner, program and qualified owner connections.');
    for(const [key,value] of Object.entries(env))if(key!=='INTERVIEWIQ_RESEARCH_JOB_REQUEST_SECRET'&&/SECRET|TOKEN|HMAC|JWT|GATEWAY|SIGNING|API_KEY/.test(key)&&typeof value==='string'&&value.trim()===d.requestSecret)
      throw new AppError(503,'invalid_configuration','Research credentials must be separated.');
    for(const address of [config.databaseUrl,env.INTERVIEWIQ_RESEARCH_PROOF_DATABASE_URL]){let u;try{u=new URL(address);}catch{throw new AppError(503,'invalid_configuration','Research database configuration is invalid.');}if(decodeURIComponent(u.password)===d.requestSecret)throw new AppError(503,'invalid_configuration','Research credentials must be separated.');}
    config.rise.researchResultsEnabled=true;
  }
  const loi=config.loi,ownerValid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$(?![\s\S])/.test(loi.ownerId),programValid=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$(?![\s\S])/.test(loi.programId);
  if(!['CANARY','ELIGIBLE'].includes(loi.mode)||(loi.ownerId&&!ownerValid)||(loi.programId&&!programValid)||loi.enabled&&(!config.enabled||!config.rise.enabled||Buffer.byteLength(config.rise.requestSecret)<32||loi.mode==='CANARY'&&(!ownerValid||!programValid)))throw new AppError(503,'invalid_configuration','LOI requires an explicit valid scope and authenticated RISE connection.');
  if(loi.targetsOwnerId&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$(?![\s\S])/.test(loi.targetsOwnerId))throw new AppError(503,'invalid_configuration','Program letter rollout requires a valid owner scope.');
  if(config.loi.enabled)config.rise.researchResultsEnabled=true;
  Object.freeze(config.calendar);
  Object.freeze(config.intake);
  Object.freeze(config.loiOpenai);
  Object.freeze(config.loiComposition);
  Object.freeze(config.loi);
  Object.freeze(config.deepResearch);
  if (config.speech.enabled && !config.speech.apiKey)
    throw new AppError(503, 'invalid_configuration', 'Speech is enabled without provider configuration.');
  if(config.speech.enabled) {
    let url;try{url=new URL(config.audio.endpoint);}catch{throw new AppError(503,'invalid_configuration','Private audio storage is not configured.');}
    if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash ||
      !config.audio.bucket || !config.audio.accessKeyId || !config.audio.secretAccessKey || !/^interviewiq-recordings(?:\/[a-z0-9-]+)*$/.test(config.audio.prefix))
      throw new AppError(503,'invalid_configuration','Speech requires explicitly configured private InterviewIQ audio storage.');
  }
  return Object.freeze(config);
}
