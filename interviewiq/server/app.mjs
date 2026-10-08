import {createOwnerReadReceipts} from './owner-read-receipts.mjs';
import {createNativeLoiComposer} from './loi-openai.mjs';
import {createResearchJobRuntime} from './research-job-runtime.mjs';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {readConfig} from './config.mjs';
import {createDatabase} from './db.mjs';
import {createAuthorizer} from './auth.mjs';
import {createCommands} from './commands.mjs';
import {createOwnerServices} from './owner-services.mjs';
import {createHandler} from './http.mjs';
import {createPrivateAudioStorage} from './storage.mjs';
import {createPostgresRecordingStore,createRecordingTranscription,createRecordingsService} from './recordings.mjs';

export async function startApp({config=readConfig(),database,owners,authorize,recordings=null,loiComposer=null,logger=entry=>process.stderr.write(JSON.stringify(entry)+'\n')}={}) {
  const ownerReadReceipts=createOwnerReadReceipts({enabled:config.ownerReadReceiptsEnabled===true});
  owners ||= createOwnerServices(config,{ownerReadReceipts});
  if(config.enabled) {
    database ||= createDatabase(config);
    await database.verifyRuntimeRole();
  }
  const researchProof=await createResearchJobRuntime(config.researchProof);
  let commands,server;
  try {
  if(config.enabled && !config.coreOnly && config.speech?.enabled && !recordings) {
    const storage=await createPrivateAudioStorage(config.audio);
    recordings=createRecordingsService({store:createPostgresRecordingStore({database}),storage,
      transcription:createRecordingTranscription({apiKey:config.speech.apiKey}),bootstrap:actor=>commands.bootstrap(actor)});
  }
  loiComposer ??= createNativeLoiComposer(config);
  commands=config.enabled?createCommands({database,owners,config,loiComposer,speechAvailable:recordings?.available===true}):null;
  authorize ||= createAuthorizer(config);
  server=createServer(createHandler({config,database,authorize,commands,owners,recordings,researchProof,ownerReadReceipts,logger}));
  server.requestTimeout=50000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=40;
  server.on('clientError',(_error,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,resolve);});
  return {server,commands,database,async close(){await new Promise(resolve=>server.close(resolve));await researchProof.close();if(database)await database.close();}};
  }catch(error){if(server?.listening)await new Promise(resolve=>server.close(resolve));await researchProof.close().catch(()=>{});if(database)await database.close().catch(()=>{});throw error;}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  startApp().then(app=>{
    process.stdout.write(JSON.stringify({service:'interviewiq',event:'listening',address:app.server.address()})+'\n');
    for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
  }).catch(()=>{process.stderr.write('InterviewIQ startup failed; verify server configuration and database qualification.\n');process.exitCode=1;});
}
