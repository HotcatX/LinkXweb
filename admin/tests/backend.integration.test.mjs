import test from 'node:test'
import assert from 'node:assert/strict'
import { scryptSync } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createApi } from '../src/api.js'
import { blankDraft, draftPayload, templatePayload, communityPayload, normalizeEditableCommunity, contentDraft } from '../src/model.js'
import { createBatch, applyBatchResult } from '../src/batch.js'
const source = process.env.BACKEND_SOURCE_DIR
const storage = () => { const map=new Map(); return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)} }

test('real PostgreSQL/backend: browser admin login, all business contracts, raw images, lost replies, optimistic conflicts and revocation', {
 skip: !source || !process.env.BACKEND_TEST_DATABASE_URL, timeout: 30000
}, async t => {
 const backend = resolve(source); const load = p => import(pathToFileURL(resolve(backend,p)).href)
 const [{createApp},{createTestDatabase}] = await Promise.all([load('src/app.ts'),load('test/helpers/database.ts')])
 const require=createRequire(resolve(backend,'package.json'));const sharp=require('sharp')
 const db=await createTestDatabase();const appId='web-client-contract';const origin='https://admin.client.test'
 const objects=new Map();let puts=0
 const provider={bucket:'synthetic-123456',objects:{
  async put(locator,body,mediaType){ puts++;objects.set(locator,{body:Buffer.from(body),mediaType}) },
  async read(locator){return objects.get(locator)||null}
 },async readUrl(file,ttl){assert.equal(ttl,300);return `https://images.client.test/${file.id}?ttl=${ttl}`}}
 const app=await createApp({pool:db.pool,config:{databaseUrl:'',host:'127.0.0.1',port:3100,appId,businessMode:'active',sessionTtlSeconds:3600},storage:provider,exchange:async()=>{throw Error('not used')}})
 t.after(async()=>{await app.close();await db.close()})
 const password='synthetic-client-password',salt=Buffer.alloc(32,2)
 await db.pool.query('INSERT INTO admin_accounts(app_id,id,owner_key,enabled,credential_version,password_salt,password_hash) VALUES($1,$2,$3,true,1,$4,$5)',[appId,'web_admin','synthetic-owner',salt,scryptSync(password,salt,64)])
 await db.pool.query('INSERT INTO admin_origins VALUES($1,$2)',[appId,origin])
 let losePath='';const seen=[];const saved=storage(),journal=storage()
 const options={mode:'backend',endpoint:'https://backend.client.test/',storage:saved,operationStorage:journal,fetcher:async(url,init)=>{
  const path=new URL(url).pathname;seen.push({path,...init})
  const result=await app.inject({method:init.method,url:path,headers:{...init.headers,origin},payload:init.body instanceof ArrayBuffer?Buffer.from(init.body):init.body})
  if(losePath===path){losePath='';throw new TypeError('synthetic reply lost after commit')}
  return {ok:result.statusCode<400,status:result.statusCode,json:async()=>result.json()}
 }}
 const api=createApi(options);await api.login('web_admin',password)
 assert.equal((await api.call('session')).admin.accountId,'web_admin')
 // The public directory is the market catalogue, not the profile CITY_TREE.
 const initial=await api.call('bootstrap');assert.ok(initial.regionTree.some(state=>state.key==='NY_NJ'))
 const preflight=await app.inject({method:'OPTIONS',url:'/api/v1/admin/market/templates',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'authorization,content-type,idempotency-key'}})
 assert.equal(preflight.statusCode,204);assert.equal(preflight.headers['access-control-allow-origin'],origin)
 const bytes=await sharp({create:{width:4,height:4,channels:3,background:{r:20,g:50,b:70}}}).png().toBuffer()
 const image=new Blob([bytes],{type:'image/png'});losePath='/api/v1/admin/files/images'
 await assert.rejects(api.uploadImage(image));let uploaded=await api.uploadImage(image)
 assert.equal(puts,1);assert.deepEqual([...objects.values()][0].body,bytes)
 // A later new upload must not be permanently coupled to a deleted reservation.
 const oldKey=seen.at(-1).headers['Idempotency-Key'],oldId=uploaded.fileId
 const {queueFileDeletion}=await load('src/files/service.ts');const connection=await db.pool.connect()
 try {await connection.query('BEGIN ISOLATION LEVEL READ COMMITTED');await queueFileDeletion(connection,{appId,fileId:oldId});await connection.query('COMMIT')}finally{connection.release()}
 const staleUpload=await app.inject({method:'POST',url:'/api/v1/admin/files/images',headers:{origin,authorization:`Bearer ${api.getSession().token}`,'content-type':'application/octet-stream','idempotency-key':oldKey},payload:bytes})
 assert.equal(staleUpload.statusCode,409);assert.equal(staleUpload.json().error.code,'FILE_NOT_PENDING')
 uploaded=await api.uploadImage(image);assert.notEqual(uploaded.fileId,oldId);assert.equal(puts,2)
 const signed=await api.call('getImageURLs',{fileIds:[uploaded.fileId]});assert.equal(signed.expiresIn,300);assert.match(signed.items[0].url,/^https:/)
 const form={...blankDraft(),_key:'row1',clientRequestId:'client_request_1',title:'Synthetic desk',price:'12.29',category:'家具',regionState:'NJ',regionCounty:'Bergen',regionArea:'Fort Lee',sellerName:'Test',sellerWechat:'synthetic',sellerAvatar:'https://images.client.test/managed-avatar.png',images:[{fileId:uploaded.fileId}]}
 const sublet={...form,_key:'row2',clientRequestId:'client_request_2',listingType:'sublet',category:'Studio',title:'Synthetic room',deposit:'500.50',roommateCount:'0'}
 const batch=createBatch([form,sublet],'client_batch_1');losePath='/api/v1/admin/market/batches'
 await assert.rejects(api.call('bulkCreate',{batchId:batch.batchId,items:batch.items}))
 const result=await api.call('bulkCreate',{batchId:batch.batchId,items:batch.items});assert.equal(result.success,2)
 const rows=applyBatchResult([form,sublet],batch,result);assert.ok(rows.every(row=>row._status==='success'))
 assert.equal((await db.pool.query('SELECT count(*) FROM market_listings')).rows[0].count,'2')
 const listing=await api.call('getItem',{id:rows[0].resultId});assert.equal(listing.version,0);assert.equal(listing.content.priceCents,1229)
 const edit={id:listing.id,expectedVersion:listing.version,patch:draftPayload({...contentDraft(listing.content,listing.images),title:'Updated desk'})}
 losePath=`/api/v1/admin/market/listings/${listing.id}/edit`;await assert.rejects(api.call('updateItem',edit))
 const restored=createApi(options);await restored.recoverOperations();assert.equal(restored.pendingOperations().length,0)
 const afterEdit=await restored.call('getItem',{id:listing.id});assert.equal(afterEdit.version,1);assert.equal(afterEdit.content.sellerContact.avatar,form.sellerAvatar)
 await assert.rejects(restored.call('updateItem',{...edit,patch:{title:'stale change'}}),error=>error.code==='LISTING_VERSION_CONFLICT')
 const template=await restored.call('saveTemplate',{name:'Synthetic template',data:templatePayload(form)})
 assert.equal((await restored.call('listTemplates')).templates.length,1)
 await restored.call('deleteTemplate',{id:template.template.id});assert.equal((await restored.call('listTemplates')).templates.length,0)
 const community=normalizeEditableCommunity(initial.community)
 community.group={enabled:true,title:'Synthetic group',imageFileId:uploaded.fileId,expiresAt:new Date(Date.now()+86400000).toISOString()}
 community.announcement={...community.announcement,enabled:false,id:'manual_notice',body:'Synthetic announcement',showGroupImage:true}
 const config=communityPayload(community);losePath='/api/v1/admin/community'
 await assert.rejects(restored.call('updateCommunity',{expectedVersion:community.version,config}))
 await restored.recoverOperations();const current=await restored.call('getCommunity');assert.equal(current.version,1);assert.equal(current.config.group.imageFileId,uploaded.fileId)
 assert.equal((await db.pool.query('SELECT count(*) FROM community_revisions')).rows[0].count,'1')
 assert.ok(seen.every(row=>row.path.startsWith('/api/v1/')))
 await restored.logout();assert.equal(restored.getSession(),null)
 await assert.rejects(restored.call('session'),/登录已过期/)
})
