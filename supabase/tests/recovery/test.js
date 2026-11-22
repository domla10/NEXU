'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync(require('node:path').join(__dirname, '../../recovery-test/recovery.js'), 'utf8');
const makeJwt = method => ['e30', Buffer.from(JSON.stringify({iss:'https://hwckbmhfbsrwqohhmrom.supabase.co/auth/v1',amr:[{method}]})).toString('base64url'),'signature'].join('.');
async function run({query='?code=valid', hash='', event='PASSWORD_RECOVERY', method='recovery', invalid=false, getUserError=false}={}) {
 let callback; let clientOptions; let exchangeCalls=0; let verified=0; let updates=0;
 const handlers={}; const storage=new Map();
 const form= id => ({hidden:true, addEventListener:(_,fn)=>handlers[id]=fn,querySelector:()=>({disabled:false})});
 const elements={start:form('start'),form:form('form'), status:{textContent:''},email:{value:'test@example.com'},password:{value:'a'.repeat(20)},confirmation:{value:'a'.repeat(20)}};
 const auth={onAuthStateChange:fn=>{callback=fn},exchangeCodeForSession:async()=>{exchangeCalls++;if(invalid)return {error:{},data:{}};callback(event,{access_token:makeJwt(method)});return {error:null,data:{session:{access_token:makeJwt(method)}}}},getUser:async()=>{verified++;return getUserError?{error:{}}:{data:{user:{id:'test'}},error:null}},updateUser:async()=>{updates++;return {error:null}},resetPasswordForEmail:async()=>({error:null})};
 const context={URLSearchParams,atob:v=>Buffer.from(v,'base64').toString('binary'),
   window:{isSecureContext:true,location:{search:query,hash,pathname:'/nexu-test-recovery/'},history:{replaceState:()=>{}},localStorage:{get length(){return storage.size},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}},
   document:{getElementById:id=>elements[id]},supabase:{createClient:(_url,_key,opts)=>{clientOptions=opts;return {auth}}}};
 vm.runInNewContext(script,context);await new Promise(resolve=>setTimeout(resolve,10));
 return {elements,handlers,counts:()=>({exchangeCalls,verified,updates}),storage,adapter:clientOptions.auth.storage};
}
(async()=>{
 let p=await run();assert.equal(p.elements.form.hidden,false,'recovery opens after exchange');assert.equal(p.counts().verified,1,'validates session on server'); p.elements.confirmation.value='mismatch'; await p.handlers.form({preventDefault(){}});assert.equal(p.counts().updates,0); p.elements.confirmation.value='a'.repeat(20);await p.handlers.form({preventDefault(){}});assert.equal(p.counts().updates,1);assert.equal(p.elements.form.hidden,true);
 p=await run({query:''}); p.adapter.setItem('nexu-test-recovery-code-verifier','fixture-verifier');p.adapter.setItem('nexu-test-recovery','fixture-session');assert.equal(p.storage.size,1);assert.equal(p.adapter.getItem('nexu-test-recovery-code-verifier'),'fixture-verifier');assert.equal([...p.storage.values()].join('').includes('fixture-session'),false); p.storage.set('nexu-test-recovery-code-verifier', JSON.stringify({value:'old',expires:0}));assert.equal(p.adapter.getItem('nexu-test-recovery-code-verifier'),null);
 p=await run({event:'SIGNED_IN'});assert.equal(p.elements.form.hidden,true,'ordinary sign-in event rejected'); await p.handlers.form({preventDefault(){}}); assert.equal(p.counts().updates,0,'ordinary session cannot trigger update via hidden form');
 p=await run({method:'password'});assert.equal(p.elements.form.hidden,true,'password session rejected');
 p=await run({getUserError:true});assert.equal(p.elements.form.hidden,true,'invalid session rejected');
 p=await run({invalid:true});assert.equal(p.elements.form.hidden,true,'invalid or expired code rejected');
 p=await run({query:'',hash:'#type=recovery&access_token=bogus'});assert.equal(p.elements.form.hidden,true,'implicit forged fragment rejected');assert.equal(p.counts().exchangeCalls,0);
 console.log('PKCE recovery regression tests passed (mocked Auth).');
})().catch(e=>{console.error(e);process.exit(1)});
