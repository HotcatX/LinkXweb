import test from 'node:test'
import assert from 'node:assert/strict'
import { createApi } from '../src/api.js'
import { createVisiblePoller, collectionStatus, hostSampledAt, historySeries } from '../src/monitor.js'
import { fieldInfo, tableInfo, isSuperadmin } from '../src/catalog.js'
const storage = () => { const values = new Map(); return { getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key) } }
const reply = data => ({ ok: true, status: 200, json: async () => ({ ok: true, data }) })
function setup(handler = () => ({})) {
 const requests=[],saved=storage(),persistent=storage()
 const options={endpoint:'https://admin.example/',storage:saved,operationStorage:persistent,fetcher:async(url,init)=>{
  requests.push({url,...init})
  if(new URL(url).pathname.endsWith('/auth/login')) return reply({token:'a'.repeat(64),expiresAt:new Date(Date.now()+100000).toISOString(),admin:{accountId:JSON.parse(init.body).username,role:JSON.parse(init.body).username==='superadmin'?'superadmin':'admin'}})
  return reply(await handler(new URL(url),init))
 }}
 return {api:createApi(options),options,requests,saved,persistent}
}
test('ordinary administrator never dispatches privileged console requests',async()=>{
 const s=setup();await s.api.login('admin','synthetic')
 for(const action of ['consoleStatus','consoleHistory','consoleTables','consoleRows','consoleRow','consoleEdit','consoleEvents']) await assert.rejects(s.api.call(action,{}),error=>error.code==='ADMIN_FORBIDDEN')
 assert.equal(s.requests.length,1)
 assert.equal(isSuperadmin(s.api.getSession()),false)
})
test('session read refreshes role in the same actor without disturbing durable recovery namespace',async()=>{
 const s=setup(()=>({admin:{accountId:'superadmin',role:'admin'}}));await s.api.login('superadmin','synthetic')
 const actor=s.api.getSession(),namespace=s.api.workspaceKey();assert.ok(isSuperadmin(actor))
 await s.api.call('session');assert.equal(s.api.getSession(),actor);assert.equal(isSuperadmin(actor),false);assert.equal(s.api.workspaceKey(),namespace)
 await assert.rejects(s.api.call('consoleStatus'));assert.equal(s.requests.length,2)
})
test('console reads keep fixed same-origin routes, encoded filters and keyset cursor',async()=>{
 const s=setup(()=>({items:[],nextCursor:null}));await s.api.login('superadmin','synthetic')
 await s.api.call('consoleRows',{table:'users',search:'id+scope',cursor:'a_bc-def'})
 const url=new URL(s.requests.at(-1).url);assert.equal(url.pathname,'/api/v1/admin/console/rows');assert.equal(url.searchParams.get('search'),'id+scope');assert.equal(url.searchParams.get('cursor'),'a_bc-def');assert.equal(url.searchParams.get('limit'),'30')
 await s.api.call('consoleEvents',{openid:'openid',from:0,to:999999,cursor:'next'})
 const events=new URL(s.requests.at(-1).url);assert.equal(events.searchParams.get('from'),'0');assert.equal(events.searchParams.get('to'),'999999');assert.equal(events.searchParams.get('openid'),'openid')
 await s.api.call('consoleRow',{table:'ride_members',key:'WyJhIiwiYiJd'});assert.equal(new URL(s.requests.at(-1).url).pathname,'/api/v1/admin/console/rows/ride_members/WyJhIiwiYiJd')
 await s.api.call('consoleHistory',{range:'month'});const history=new URL(s.requests.at(-1).url);assert.equal(history.pathname,'/api/v1/admin/console/history');assert.equal(history.searchParams.get('range'),'month');assert.equal(s.requests.at(-1).method,'GET')
 assert.ok(s.requests.every(item=>new URL(item.url).origin==='https://admin.example'))
})
test('lost database edit preserves original row version, patch and operation key after reload',async()=>{
 let lost=true;const s=setup(()=>{if(lost)throw new TypeError('lost reply');return {row:{name:'New'},version:'b'.repeat(64)}})
 await s.api.login('superadmin','synthetic');const body={table:'users',key:'WyJ1Il0',expectedVersion:'a'.repeat(64),patch:{name:'New'}}
 await assert.rejects(s.api.call('consoleEdit',body));const original=s.requests.at(-1),restored=createApi(s.options)
 await assert.rejects(restored.call('consoleEdit',{...body,patch:{name:'Changed'}}),/上次保存/)
 lost=false;await restored.recoverOperations();assert.equal(s.requests.at(-1).headers['Idempotency-Key'],original.headers['Idempotency-Key']);assert.equal(s.requests.at(-1).body,original.body);assert.equal(restored.pendingOperations().length,0)
})
test('batch deletion validates complete acknowledgement and keeps uncertain operations',async()=>{
 let valid=false;const s=setup(()=>({deleted:valid?[{id:'one',version:2,status:'deleted'},{id:'two',version:5,status:'deleted'}]:[{id:'one',version:2,status:'deleted'}]}));await s.api.login('admin','synthetic')
 const body={items:[{id:'one',expectedVersion:1},{id:'two',expectedVersion:4}]};await assert.rejects(s.api.call('deleteItems',body),/响应无效/);const first=s.requests.at(-1)
 valid=true;await s.api.recoverOperations();assert.equal(s.requests.at(-1).body,first.body);assert.equal(s.requests.at(-1).headers['Idempotency-Key'],first.headers['Idempotency-Key']);assert.equal(s.api.pendingOperations().length,0)
})
function fakeDocument() { const listeners=new Set();return {visibilityState:'visible',addEventListener:(name,callback)=>listeners.add(callback),removeEventListener:(name,callback)=>listeners.delete(callback),change(state){this.visibilityState=state;for(const callback of listeners)callback()}} }
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
test('monitor coalesces slow reads, schedules after completion, and stops in background',async()=>{
 const document=fakeDocument(),timers=new Map(),seen=[],errors=[];let calls=0,sequence=0;const wait=deferred()
 const task=createVisiblePoller(()=>{calls++;return wait.promise},{document,onResult:value=>seen.push(value),onError:error=>errors.push(error),schedule:(callback,delay)=>{assert.equal(delay,10000);const id=++sequence;timers.set(id,callback);return id},cancel:id=>timers.delete(id)})
 const first=task.refresh();for(let i=0;i<20;i++)void task.refresh();assert.equal(calls,1);assert.equal(timers.size,0)
 wait.resolve({sampledAt:1});await first;assert.equal(seen.length,1);assert.equal(timers.size,1)
 document.change('hidden');assert.equal(timers.size,0);await task.refresh();assert.equal(calls,1)
 document.change('visible');await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2)
 task.dispose();assert.equal(timers.size,0);document.change('visible');assert.equal(calls,2);assert.deepEqual(errors,[])
})
test('disposing monitor rejects late result and prevents follow-on polling; errors retain caller sample',async()=>{
 const document=fakeDocument(),wait=deferred(),seen=[],errors=[],timers=[]
 const task=createVisiblePoller(()=>wait.promise,{document,onResult:r=>seen.push(r),onError:e=>errors.push(e),schedule:callback=>{timers.push(callback);return timers.length},cancel:()=>{}})
 const pending=task.refresh();task.dispose();wait.resolve({private:'old account'});await pending;assert.deepEqual(seen,[]);assert.equal(timers.length,0)
 const failed=createVisiblePoller(async()=>{throw Error('unavailable')},{document,onResult:r=>seen.push(r),onError:e=>errors.push(e),schedule:callback=>{timers.push(callback);return timers.length},cancel:()=>{}})
 await failed.refresh();assert.equal(errors[0].message,'unavailable');assert.deepEqual(seen,[]);failed.dispose()
})
test('field catalogue explains identity and data meanings independently of server code',()=>{
 assert.match(fieldInfo('openid').description,/微信/);assert.match(fieldInfo('receivedAt').description,/接收/);assert.match(tableInfo('ride_completions').description,/明确回答/);assert.match(fieldInfo('unknown','text').description,/text/)
})

test('open collector gate remains collecting and stale host sample never becomes a new sample',()=>{
 assert.equal(collectionStatus({status:'ready',collection:{restoreGate:'open',enabled:true}}),'正在采集')
 assert.equal(collectionStatus({status:'ready',collection:{restoreGate:'closed',enabled:true}}),'恢复中')
 assert.equal(collectionStatus({status:'ready',collection:{restoreGate:'open',enabled:false}}),'采集关闭')
 assert.equal(collectionStatus({status:'unavailable'}),'暂不可用')
 assert.equal(hostSampledAt({sampledAt:5000,host:{status:'stale',sampledAt:1000}}),1000)
 assert.equal(hostSampledAt({sampledAt:5000,host:{status:'unavailable'}}),null)
})

test('history polling remains independent of realtime sampling and pauses in background',async()=>{
 const document=fakeDocument(),timers=new Map(),seen=[];let sequence=0,currentReads=0,historyReads=0
 const options={document,onResult:value=>seen.push(value),onError:assert.fail,schedule:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,delay});return id},cancel:id=>timers.delete(id)}
 const current=createVisiblePoller(async()=>++currentReads,options),history=createVisiblePoller(async()=>++historyReads,{...options,interval:60000})
 await Promise.all([current.refresh(),history.refresh()]);assert.equal(currentReads,1);assert.equal(historyReads,1)
 assert.deepEqual([...timers.values()].map(item=>item.delay).sort((a,b)=>a-b),[10000,60000])
 for(let i=0;i<5;i++){const [id,item]=[...timers].find(([,item])=>item.delay===10000);timers.delete(id);item.callback();await new Promise(resolve=>setImmediate(resolve))}
 assert.equal(currentReads,6);assert.equal(historyReads,1)
 document.change('hidden');assert.equal(timers.size,0);await history.refresh();assert.equal(historyReads,1)
 current.dispose();history.dispose();assert.equal(timers.size,0)
})

test('history charts preserve time spacing and distinguish missing samples from zero usage',()=>{
 const point=(at,cpuPercent)=>({at,cpuPercent,memoryUsedBytes:512,memoryTotalBytes:1024,diskUsedBytes:2048,diskTotalBytes:4096})
 const history={from:0,to:720000,points:[point(1000,12),point(2000,0),point(3000,null),point(4000,20),point(7000,30),point(11000,40)]}
 const cpu=historySeries(history,'cpu');assert.equal(cpu.maximum,100);assert.equal(cpu.count,5);assert.deepEqual(cpu.segments.map(segment=>segment.map(point=>point.value)),[[12,0],[20,30],[40]])
 assert.equal(cpu.segments[0][1].y,170);assert.ok(Math.abs(cpu.segments[1][1].x-cpu.segments[1][0].x-650*3000/720000)<1e-10);assert.equal(cpu.latest.at,11000)
 const memory=historySeries(history,'memory'),disk=historySeries(history,'disk');assert.equal(memory.count,6);assert.equal(memory.maximum,1024);assert.equal(memory.latest.value,512);assert.equal(disk.maximum,4096);assert.equal(disk.latest.value,2048)
 assert.equal(historySeries({from:0,to:720000,points:[point(1000,null)]},'cpu').count,0)
 assert.deepEqual(historySeries({from:0,to:720000,points:[]},'cpu').segments,[])
 assert.equal(historySeries({from:0,to:720000,points:[point(720001,99)]},'cpu').latest,null)
 assert.equal(historySeries({from:0,to:720000,points:[{...point(1000,0),memoryUsedBytes:0,memoryTotalBytes:0}]},'memory').latest,null)
})

test('rapid history range changes queue only the latest range after the in-flight request',async()=>{
 const document=fakeDocument(),first=deferred(),last=deferred(),calls=[],seen=[],timers=new Map();let range='day',sequence=0,active=0,maxActive=0
 const task=createVisiblePoller(async()=>{const input=range;calls.push(input);active++;maxActive=Math.max(maxActive,active);try{return await(input==='day'?first.promise:last.promise)}finally{active--}},{document,interval:60000,onResult:value=>{if(value.range===range)seen.push(value.range)},onError:assert.fail,schedule:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,delay});return id},cancel:id=>timers.delete(id)})
 const pending=task.refresh();range='week';void task.refresh(true);range='month';void task.refresh(true);assert.deepEqual(calls,['day'])
 first.resolve({range:'day'});await pending;assert.deepEqual(calls,['day','month']);assert.deepEqual(seen,[]);assert.equal(timers.size,0)
 last.resolve({range:'month'});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(seen,['month']);assert.equal(maxActive,1);assert.equal(timers.size,1)
 task.dispose();assert.equal(timers.size,0)
})
