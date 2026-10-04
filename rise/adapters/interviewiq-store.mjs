const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
const unavailable=()=>new Error('interviewiq_nonce_store_unavailable');

async function boundedConnection(pool) {
  let timer,expired=false;
  const pending=pool.connect().then(client=>{
    if(expired){client.release(true);throw unavailable();}return client;
  });
  try {
    return await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(unavailable());},5000);})]);
  } finally {clearTimeout(timer);}
}

// No pool, URL, credential or process-memory fallback is created here. The
// separately reviewed server composition must supply its qualified PG pool.
export function createInterviewiqStore({enabled=false,pool}={}) {
  return Object.freeze({
    async consumeNonce(input) {
      let client,transaction=false,discard=false;
      try {
        if(enabled!==true||!pool||typeof pool.connect!=='function'||
          !Number.isInteger(pool.options?.connectionTimeoutMillis)||pool.options.connectionTimeoutMillis<1||
          pool.options.connectionTimeoutMillis>5000)throw unavailable();
        if(!input||Object.getPrototypeOf(input)!==Object.prototype||
          Object.keys(input).sort().join(',')!=='expiresAt,issuer,nonce,requestHash'||input.issuer!=='interviewiq'||
          typeof input.nonce!=='string'||!UUID.test(input.nonce)||typeof input.requestHash!=='string'||!HASH.test(input.requestHash)||
          typeof input.expiresAt!=='string'||new Date(input.expiresAt).toISOString()!==input.expiresAt||
          Date.parse(input.expiresAt)<Date.now()-30000||Date.parse(input.expiresAt)>Date.now()+120000)throw unavailable();
        client=await boundedConnection(pool);
        const query=(text,values)=>client.query({text,values,query_timeout:5000});
        transaction=true;
        await query('BEGIN');
        await query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='1s'; SET LOCAL ROLE rise_app_runtime");
        const result=await query(`WITH admitted_clock AS MATERIALIZED (SELECT clock_timestamp() AS at)
          INSERT INTO rise_runtime.iiq_owner_request_nonces(issuer,nonce,request_sha256,created_at,expires_at)
          SELECT 'interviewiq',$1::uuid,$2,at,greatest($3::timestamptz,at+interval '90 seconds') FROM admitted_clock
          ON CONFLICT (issuer,nonce) DO NOTHING RETURNING nonce`,[input.nonce,input.requestHash,input.expiresAt]);
        await query('COMMIT');transaction=false;
        return result.rowCount===1;
      } catch {
        if(client&&transaction) {
          try {await client.query({text:'ROLLBACK',query_timeout:5000});}catch{discard=true;}
        }
        return false;
      } finally {if(client)client.release(discard);}
    },
  });
}
