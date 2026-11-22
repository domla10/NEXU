'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
assert.deepEqual(fs.readFileSync(path.join(__dirname,'../../recovery-test/supabase.js')),fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js')));
const {createClient}=require('@supabase/supabase-js');
const persistent=new Map(),memory=new Map(), requests=[];
const storage={getItem:k=>k.endsWith('-code-verifier')?persistent.get(k)??null:memory.get(k)??null,setItem:(k,v)=>k.endsWith('-code-verifier')?persistent.set(k,v):memory.set(k,v),removeItem:k=>k.endsWith('-code-verifier')?persistent.delete(k):memory.delete(k)};
const jwt=['e30',Buffer.from(JSON.stringify({sub:'00000000-0000-0000-0000-000000000001',exp:Math.floor(Date.now()/1000)+3600,iss:'https://hwckbmhfbsrwqohhmrom.supabase.co/auth/v1',amr:[{method:'recovery'}]})).toString('base64url'),'signature'].join('.');
const user={id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated'};
const mockFetch=async (url, options)=>{requests.push({url:String(url),options});let body={}; if(String(url).includes('/token?grant_type=pkce')) body={access_token:jwt,refresh_token:'refresh-fixture',expires_in:3600,token_type:'bearer',user}; else if(String(url).endsWith('/user')) body=user;return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}})};
const config={auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:false,storageKey:'nexu-test-recovery',storage},global:{fetch:mockFetch}};
(async()=>{
 const first=createClient('https://hwckbmhfbsrwqohhmrom.supabase.co','public-test-key',config);
 let result=await first.auth.resetPasswordForEmail('fixture@example.test',{redirectTo:'https://nexu-test-recovery.vercel.app/nexu-test-recovery/'});assert.equal(result.error,null);
 assert.equal(new URL(requests[0].url).searchParams.get('redirect_to'),'https://nexu-test-recovery.vercel.app/nexu-test-recovery/');
 const recover=JSON.parse(requests[0].options.body);assert.ok(recover.code_challenge);assert.equal(recover.code_challenge_method,'s256');
 assert.ok([...persistent.keys()].every(key=>key.endsWith('-code-verifier')));assert.ok(persistent.size>0);
 const second=createClient('https://hwckbmhfbsrwqohhmrom.supabase.co','public-test-key',config);let seen='';second.auth.onAuthStateChange(e=>{if(e==='PASSWORD_RECOVERY') seen=e});
 result=await second.auth.exchangeCodeForSession('fixture-code');assert.equal(result.error,null);assert.equal(seen,'PASSWORD_RECOVERY');
 result=await second.auth.getUser(jwt);assert.equal(result.error,null);
 assert.equal([...persistent.values()].some(v=>v.includes('refresh-fixture')||v.includes(jwt)),false);
 // SDK may retain alternate-flow PKCE verifiers; the page clears its namespace after exchange.
 assert.ok([...persistent.keys()].every(k=>k.endsWith('-code-verifier')));
 console.log('Official Supabase SDK PKCE integration passed (mocked server).');
})().catch(error=>{console.error(error);process.exit(1)});
