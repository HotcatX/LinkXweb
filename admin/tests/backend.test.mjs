import test from 'node:test'
import assert from 'node:assert/strict'
import { createApi, resolveApiConfig } from '../src/api.js'
import { createImageURLCache, createImageRefresh } from '../src/image-urls.js'
import { blankDraft, draftPayload, contentDraft, templatePayload, communityPayload, normalizeEditableCommunity, cents } from '../src/model.js'
import { fromLegacyListing, toLegacyListing } from '../src/compat/cloudbase.js'
import { loadWorkspace, saveWorkspace, createWorkspaceLoader } from '../src/workspace.js'
import { createBatch, applyBatchResult, uncertainBatch } from '../src/batch.js'
import { marketRegions } from '../src/backend.js'
const storage = () => { const values = new Map(); return { getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k) } }
const reply = (data,status=200) => ({ ok: status < 400, status, json:async()=>status<400?{ok:true,data}:{ok:false,error:{code:data}} })
const session = username => ({token:'a'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString(),admin:{accountId:username,ownerKey:'synthetic-owner'}})
const draft = () => ({ ...blankDraft(), title:'Desk',price:'10.29',sellerName:'Test',sellerWechat:'test',regionState:'NJ',regionCounty:'Bergen',regionArea:'Fort Lee', images:[] })
function setup(handler) {
  const records=[]; const saved=storage(); const persistent=storage()
  const options={mode:'backend',endpoint:'https://backend.example/',storage:saved,operationStorage:persistent,fetcher:async(url,init)=>{
    const path = new URL(url).pathname; records.push({url,path,...init})
    if(path.endsWith('/auth/login')) return reply(session(JSON.parse(init.body).username))
    return handler(path,init,records)
  }}
  return {api:createApi(options),options,records,saved,persistent}
}
test('deployment defaults to CloudBase; backend mode requires origin and never interprets unknown mode',()=>{
 assert.deepEqual(resolveApiConfig({apiUrl:'https://legacy.example/admin-api'},'https://admin.example'),{mode:'cloudbase',endpoint:'https://legacy.example/admin-api'})
 assert.throws(()=>resolveApiConfig({mode:'backend'},'https://admin.example'))
 assert.throws(()=>resolveApiConfig({mode:'backend',backendOrigin:'https://backend.example/path'},'https://admin.example'))
 assert.throws(()=>createApi({mode:'automatic'}))
})
test('backend auth uses canonical envelope, isolated session namespace and no ambient cookies',async()=>{
 const s=setup(()=>reply({admin:{accountId:'admin'},expiresAt:new Date(Date.now()+50000).toISOString()}))
 await s.api.login('admin','synthetic-password')
 await s.api.call('session')
 assert.equal(s.records[0].path,'/api/v1/admin/auth/login'); assert.equal(s.records[0].headers.Authorization,undefined)
 assert.equal(s.records[1].method,'GET'); assert.equal(s.records[1].credentials,'omit'); assert.equal(s.records[1].redirect,'error')
 assert.equal(s.records[1].headers.Authorization,'Bearer '+'a'.repeat(64))
 assert.equal(createApi(s.options).getSession().admin.accountId,'admin')
 assert.equal(createApi({...s.options,endpoint:'https://other.example/'}).getSession(),null)
 assert.equal(createApi({...s.options,mode:'cloudbase'}).getSession(),null)
})
test('lost edit reply survives reload with exact version/body/key and rejects changed uncertain operation',async()=>{
 let lost=true
 const s=setup(()=>{if(lost)throw new TypeError('synthetic disconnect'); return reply({id:'listing',version:5,status:'online'})})
 await s.api.login('admin','synthetic-password')
 const input={id:'listing',expectedVersion:4,patch:{title:'new'}}
 await assert.rejects(s.api.call('updateItem',input),/连接/)
 const first=s.records.at(-1); const restored=createApi(s.options)
 await assert.rejects(restored.call('updateItem',{...input,patch:{title:'changed'}}),/上次保存/)
 assert.equal(s.records.length,2)
 lost=false; await restored.call('updateItem',input)
 assert.equal(s.records.at(-1).headers['Idempotency-Key'],first.headers['Idempotency-Key'])
 assert.equal(s.records.at(-1).body,first.body); assert.equal(restored.pendingOperations().length,0)
 assert.ok(s.records.every(r=>r.url.startsWith('https://backend.example/')))
})
test('unknown commit retains key even when a later retry rejects its old version',async()=>{
 let mode='invalid';const s=setup(()=>mode==='invalid'?reply({}):reply('LISTING_VERSION_CONFLICT',409))
 await s.api.login('admin','synthetic-password')
 await assert.rejects(s.api.call('updateItem',{id:'listing',expectedVersion:2,patch:{title:'x'}}),/响应无效/)
 assert.equal(s.api.pendingOperations().length,1)
 mode='conflict';await assert.rejects(s.api.recoverOperations());assert.equal(s.api.pendingOperations().length,1)
 const pending=s.api.pendingOperations()[0]
 await assert.rejects(s.api.call('updateItem',{id:'listing',expectedVersion:2,patch:{title:'x'}}))
 assert.equal(s.records.at(-1).headers['Idempotency-Key'],pending.key)
})
test('explicit recovery uses original community request; account changes never replay another admin operation',async()=>{
 let lost=true;const config=communityPayload(normalizeEditableCommunity())
 const s=setup(()=>{if(lost)throw Error('network');return reply({config,version:1})})
 await s.api.login('first','synthetic-password')
 await assert.rejects(s.api.call('updateCommunity',{expectedVersion:0,config}))
 await s.api.login('second','synthetic-password');assert.equal(s.api.pendingOperations().length,0)
 await s.api.login('first','synthetic-password');assert.equal(s.api.pendingOperations().length,1)
 lost=false;await s.api.recoverOperations();assert.equal(s.api.pendingOperations().length,0)
 assert.equal(JSON.parse(s.records.at(-1).body).expectedVersion,0)
})
test('blocked durable storage prevents writes before network dispatch',async()=>{
 const s=setup(()=>reply({id:'x',version:1}))
 const api=createApi({...s.options,operationStorage:{getItem(){return null},setItem(){throw Error('full')}}})
 await api.login('admin','synthetic-password')
 await assert.rejects(api.call('updateItem',{id:'x',expectedVersion:0,patch:{title:'x'}}),/本地存储/)
 assert.equal(s.records.length,1)
})
test('backend raw upload preserves bytes and acknowledged repeated content receives a new intent key',async()=>{
 const fileId='11111111-1111-4111-8111-111111111111';const s=setup(()=>reply({fileId,sizeBytes:4}))
 await s.api.login('admin','synthetic-password'); const bytes=new Uint8Array([0,255,10,47]);const image=new Blob([bytes],{type:'image/png'})
 await s.api.uploadImage(image,{purpose:'community'});await s.api.uploadImage(image)
 assert.deepEqual(new Uint8Array(s.records[1].body),bytes)
 assert.equal(s.records[1].headers['Content-Type'],'application/octet-stream')
 assert.notEqual(s.records[1].headers['Idempotency-Key'],s.records[2].headers['Idempotency-Key'])
 await assert.rejects(s.api.uploadImage(new Blob([new Uint8Array(2*1024*1024+1)])),/2 MB/)
 assert.equal(s.records.length,3)
})
test('backend supports every existing admin action using normal canonical routes',async()=>{
 const s=setup(path=>reply(path.endsWith('/templates')?{templates:[],template:{id:'template'}}:path.endsWith('/delete')?{id:'template',status:'deleted'}:path.endsWith('/community')?{config:{group:{},announcement:{}},version:2}:{items:[],id:'x',version:2}))
 await s.api.login('admin','synthetic-password')
 for(const [action,data,path,method] of [
 ['getItem',{id:'legacy_id'},'/market/listings/legacy_id','GET'],
 ['bulkCreate',{batchId:'batch',items:[]},'/market/batches','POST'],
 ['listTemplates',{},'/market/templates','GET'],['saveTemplate',{name:'x',data:{}},'/market/templates','POST'],
 ['deleteTemplate',{id:'template'},'/market/templates/template/delete','POST'],
 ['getCommunity',{},'/community','GET'],['updateCommunity',{expectedVersion:1,config:{}},'/community','POST'],
 ['getImageURLs',{fileIds:['id']},'/files/urls','POST']]){
  await s.api.call(action,data);assert.equal(s.records.at(-1).path,'/api/v1/admin'+path);assert.equal(s.records.at(-1).method,method)
 }
 assert.throws(()=>marketRegions({states:[]}))
 assert.deepEqual(marketRegions({states:[{key:'NY_NJ',label:'纽约/新泽西',areas:[{key:'fl',label:'Fort Lee',groupKey:'north',groupLabel:'北部'}]}]})[0].groups[0].areas,[{key:'fl',label:'Fort Lee'}])
})
test('canonical price/sublet/file payload round-trips without temporary URLs or legacy aliases',()=>{
 const value={...draft(),listingType:'sublet',category:'1B1B',deposit:'1000.29',roommateCount:'0',latitude:'40',longitude:'-74',images:[{fileId:'id',url:'https://signed.example',thumbFileId:'thumb'}]}
 const body=draftPayload(value)
 assert.equal(body.priceCents,1029);assert.equal(body.sublet.depositCents,100029);assert.equal(body.sublet.roommateCount,0)
 assert.equal(body.location.longitude,-74);assert.deepEqual(body.images,[{fileId:'id',thumbFileId:'thumb'}])
 assert.ok(!JSON.stringify(body).includes('signed.example'));assert.equal(body.imageFileIDs,undefined)
 assert.deepEqual(draftPayload(contentDraft(body,body.images)),body)
 assert.equal(templatePayload(value).images,undefined);assert.throws(()=>cents('1.009'))
})
test('legacy compatibility translates canonical goods/sublet/community and original image upload',async()=>{
 const payload=draftPayload({...draft(),listingType:'sublet',category:'Studio',deposit:'0',images:[{fileId:'cloud://image',thumbFileId:'cloud://thumb'}]})
 const legacy=toLegacyListing(payload);const canonical=fromLegacyListing({...legacy,version:7,_id:'item'})
 assert.deepEqual(canonical.content,((({images,...data})=>data)(payload)))
 assert.deepEqual(canonical.images,payload.images);assert.equal(canonical.version,7)
 const calls=[];const api=createApi({endpoint:'https://legacy.example/admin-api',storage:storage(),fetcher:async(_,init)=>{
  const body=JSON.parse(typeof init.body==='string'?init.body:new TextDecoder().decode(init.body));calls.push(body)
  return {ok:true,status:200,json:async()=>body.action==='login'?{ok:true,token:'a'.repeat(64),expiresAtMs:Date.now()+100000,admin:{username:'admin'}}:{ok:true,fileID:'cloud://upload'}}
 }})
 await api.login('admin','synthetic-password');await api.call('bulkCreate',{batchId:'batch',items:[{clientRequestId:'request',item:payload}]})
 assert.equal(calls[1].items[0].price,10.29);assert.equal(calls[1].items[0].clientRequestId,'request')
 await api.uploadImage(new Blob([new Uint8Array([0,255])],{type:'image/png'}),{purpose:'community',filename:'qr.png'})
 assert.equal(calls[2].base64,'AP8=');assert.equal(calls[2].purpose,'community')
})
test('workspace stores frozen retry identity before network, strips signatures, namespaces target/account',()=>{
 const store=storage();const row={...draft(),_key:'row',clientRequestId:'request',images:[{fileId:'id',url:'https://signed.example'}]}
 const batch=createBatch([row],'batch');saveWorkspace(store,'backend-admin',{queue:uncertainBatch([row],batch),dispatch:batch})
 const restored=loadWorkspace(store,'backend-admin');assert.equal(restored.queue[0]._status,'unconfirmed')
 assert.equal(restored.dispatch.items[0].clientRequestId,'request');assert.equal(restored.queue[0].images[0].url,undefined)
 assert.equal(loadWorkspace(store,'cloudbase-admin'),null);assert.equal(loadWorkspace(store,'backend-other'),null)
})
test('signed image URLs refresh before five minutes, in chunks <=50 and isolate accounts',async()=>{
 let now=100000,account='first',calls=[]
 const api={workspaceKey:()=>account,call:async(action,{fileIds})=>{calls.push(fileIds);return {items:fileIds.map(fileId=>({fileId,url:`https://images.example/${fileId}?time=${now}`})),expiresIn:300}}}
 const cache=createImageURLCache(api,()=>now),ids=Array.from({length:51},(_,i)=>`id${i}`)
 await cache.get(ids);assert.deepEqual(calls.map(c=>c.length),[50,1])
 now+=250000;await cache.get(ids);assert.equal(calls.length,2)
 now+=21000;await cache.get(ids);assert.equal(calls.length,4)
 account='second';await cache.get(ids.slice(0,1));assert.equal(calls.length,5)
 await cache.get(ids.slice(0,1),true);assert.equal(calls.length,6)
})

test('a delayed old-session 401 cannot log out a newly signed-in administrator',async()=>{
 let resolveResponse;const pending=new Promise(resolve=>{resolveResponse=resolve})
 const s=setup(()=>pending)
 await s.api.login('first','synthetic-password')
 const reading=s.api.call('session')
 await s.api.login('second','synthetic-password')
 resolveResponse(reply('ADMIN_UNAUTHORIZED',401));await assert.rejects(reading)
 assert.equal(s.api.getSession().admin.accountId,'second')
})
test('file preparation cannot silently switch its intended administrator',async()=>{
 let resolveBytes;class DelayedBlob extends Blob{arrayBuffer(){return new Promise(resolve=>{resolveBytes=resolve})}}
 const s=setup(()=>{throw Error('must not dispatch upload')})
 await s.api.login('first','synthetic-password')
 const sending=s.api.uploadImage(new DelayedBlob([new Uint8Array([1,2,3])]))
 await s.api.login('second','synthetic-password')
 resolveBytes(new Uint8Array([1,2,3]).buffer)
 await assert.rejects(sending,/登录账号已变化/)
 assert.equal(s.records.filter(r=>r.path.endsWith('/files/images')).length,0)
})
test('definitively rejected date or image ownership rows can be corrected without unlocking uncertain rows',()=>{
 const row={...draft(),_key:'a',clientRequestId:'request'};const batch=createBatch([row],'b')
 for(const code of ['INVALID_DATE_WINDOW','FILE_OWNER_MISMATCH','FILE_READONLY'])assert.equal(applyBatchResult([row],batch,{failures:[{index:0,error:code}]} )[0]._status,'failed')
 assert.equal(applyBatchResult([row],batch,{failures:[{index:0,error:'INTERNAL_ERROR'}]})[0]._status,'unconfirmed')
})


test('unknown commit followed by missing resource keeps frozen key, while fresh validation rejection clears it',async()=>{
 let mode='lost';const s=setup(()=>{if(mode==='lost')throw new TypeError('lost');return mode==='missing'?reply('LISTING_NOT_FOUND',404):mode==='invalid'?reply('INVALID_INPUT',400):reply({id:'item',version:1})})
 await s.api.login('admin','synthetic-password')
 const body={id:'item',expectedVersion:0,patch:{title:'x'}}
 await assert.rejects(s.api.call('updateItem',body));const first=s.api.pendingOperations()[0]
 mode='missing';await assert.rejects(createApi(s.options).recoverOperations());assert.equal(s.api.pendingOperations()[0].key,first.key)
 mode='ok';await s.api.recoverOperations();assert.equal(s.records.at(-1).headers['Idempotency-Key'],first.key);assert.equal(s.api.pendingOperations().length,0)
 mode='invalid';await assert.rejects(s.api.call('updateItem',{...body,expectedVersion:1}));assert.equal(s.api.pendingOperations().length,0)
})


const tick=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
test('managed contact avatar survives title editing while reusable templates omit it',()=>{
 const original=draftPayload({...draft(),sellerAvatar:'https://images.example/contact-avatar.png'})
 const edited=draftPayload({...contentDraft(original),title:'Revised title'})
 assert.equal(edited.sellerContact.avatar,original.sellerContact.avatar)
 assert.equal(templatePayload({...contentDraft(original)}).sellerContact.avatar,'')
})
test('unknown upload keeps its key through reload and expired credentials; ACK permits a new intent',async()=>{
 let mode='lost';const fileId='11111111-1111-4111-8111-111111111111'
 const s=setup(()=>{if(mode==='lost')throw new TypeError('lost');return mode==='expired'?reply('ADMIN_UNAUTHORIZED',401):reply({fileId})})
 await s.api.login('admin','synthetic-password');const blob=new Blob([new Uint8Array([1,2,3])])
 await assert.rejects(s.api.uploadImage(blob));const first=s.records.at(-1)
 const restored=createApi(s.options);mode='expired';await assert.rejects(restored.uploadImage(blob))
 assert.equal(restored.getSession(),null);assert.equal(s.records.at(-1).headers['Idempotency-Key'],first.headers['Idempotency-Key'])
 mode='ok';await restored.login('admin','synthetic-password');await restored.uploadImage(blob)
 assert.equal(s.records.at(-1).headers['Idempotency-Key'],first.headers['Idempotency-Key']);assert.deepEqual(s.records.at(-1).body,first.body)
 await restored.uploadImage(blob);assert.notEqual(s.records.at(-1).headers['Idempotency-Key'],first.headers['Idempotency-Key'])
})
test('unknown edit followed by credential expiry and re-login preserves exact original body/key',async()=>{
 let mode='lost';const s=setup(()=>{if(mode==='lost')throw Error('lost');return mode==='expired'?reply('ADMIN_UNAUTHORIZED',401):reply({id:'item',version:2})})
 await s.api.login('admin','synthetic-password');const input={id:'item',expectedVersion:1,patch:{title:'Original intent'}}
 await assert.rejects(s.api.call('updateItem',input));const original=s.records.at(-1)
 mode='expired';await assert.rejects(s.api.recoverOperations());assert.equal(s.api.getSession(),null)
 await s.api.login('admin','synthetic-password');mode='ok';await s.api.recoverOperations()
 assert.equal(s.records.at(-1).body,original.body);assert.equal(s.records.at(-1).headers['Idempotency-Key'],original.headers['Idempotency-Key'])
})
test('bootstrap results from logout or an older account never repopulate the workspace',async()=>{
 const waits=[],seen=[];let actor={accountId:'first'}
 const api={getSession:()=>actor,call:async action=>{if(action==='session')return{};const wait=deferred();waits.push(wait);return wait.promise}}
 const loader=createWorkspaceLoader(api,{start:()=>{},loaded:result=>seen.push(result),error:()=>{},finish:()=>{}})
 const first=loader.load();await tick();loader.invalidate();actor=null;waits[0].resolve({private:'first'});await first;assert.deepEqual(seen,[])
 actor={accountId:'first'};const old=loader.load();await tick();actor={accountId:'second'};const fresh=loader.load();await tick()
 waits[2].resolve({private:'second'});await fresh;waits[1].resolve({private:'first'});await old;assert.deepEqual(seen,[{private:'second'}])
})
test('delayed logout cannot clear a newly authenticated account',async()=>{
 const wait=deferred(),s=setup(()=>wait.promise);await s.api.login('first','synthetic-password')
 const logout=s.api.logout();await s.api.login('second','synthetic-password');wait.resolve(reply({loggedOut:true}));await logout
 assert.equal(s.api.getSession().admin.accountId,'second')
})
test('image cache rejects missing/duplicate/expired/invalid URLs and uses dispatch time for expiry',async()=>{
 let now=100000,mode='ok',calls=0
 const api={workspaceKey:()=> 'admin',call:async(action,{fileIds})=>{calls++;if(mode==='slow')now+=280000;return{expiresIn:mode==='ttl'?301:300,items:mode==='missing'?[]:mode==='duplicate'?[{fileId:fileIds[0],url:'https://img.example/a'},{fileId:fileIds[0],url:'https://img.example/a'}]:fileIds.map(fileId=>({fileId,url:mode==='http'?'http://img.example/a':'https://img.example/a'}))}}}
 const cache=createImageURLCache(api,()=>now);await cache.get(['a']);now+=271000
 for(const invalid of ['missing','duplicate','ttl','http','slow']){mode=invalid;await assert.rejects(cache.get(invalid==='duplicate'?['a','b']:['a']),/图片链接/)}
 assert.equal(calls,6)
})
test('image refresh coalesces slow intervals and disposes queued work without follow-on requests',async()=>{
 let calls=0;const waits=[],seen=[],errors=[]
 const api={workspaceKey:()=> 'admin',call:()=>{calls++;const wait=deferred();waits.push(wait);return wait.promise}}
 const cache=createImageURLCache(api),task=createImageRefresh(cache,['a'],{onResult:r=>seen.push(r),onError:e=>errors.push(e)})
 const first=task.refresh();await tick();for(let i=0;i<100;i++)assert.equal(task.refresh(),first)
 assert.equal(calls,1)
 const queued=createImageRefresh(cache,['b'],{onResult:r=>seen.push(r),onError:e=>errors.push(e)})
 const second=queued.refresh();queued.dispose();task.dispose();waits[0].resolve({expiresIn:300,items:[{fileId:'a',url:'https://img.example/a'}]})
 await Promise.all([first,second]);assert.equal(calls,1);assert.deepEqual(seen,[]);assert.deepEqual(errors,[])
})

test('raw-upload journal is bounded and stores hashes/keys without image bytes',async()=>{
 const s=setup(()=>{throw Error('lost')});await s.api.login('admin','synthetic-password')
 for(let index=0;index<64;index++)await assert.rejects(s.api.uploadImage(new Blob([new Uint8Array([index,255])])),/lost/)
 const key='admin_image_operations:https://backend.example/:admin',pending=JSON.parse(s.persistent.getItem(key))
 assert.equal(Object.keys(pending).length,64)
 for(const [hash,record] of Object.entries(pending)) {assert.match(hash,/^[a-f0-9]{64}$/);assert.deepEqual(JSON.parse(record.body),{sha256:hash});assert.match(record.key,/^web_/)}
 const before=s.records.length;await assert.rejects(s.api.uploadImage(new Blob([new Uint8Array([65,255])])),/待确认图片过多/)
 assert.equal(s.records.length,before)
 // Original uncertain bytes remain retryable even while at the bound.
 await assert.rejects(s.api.uploadImage(new Blob([new Uint8Array([0,255])])),/lost/)
 assert.equal(s.records.at(-1).headers['Idempotency-Key'],s.records[1].headers['Idempotency-Key'])
})
