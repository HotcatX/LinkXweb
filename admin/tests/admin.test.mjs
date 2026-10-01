import test from 'node:test'
import assert from 'node:assert/strict'
import { blankDraft, draftPayload, validateDraft, communityPayload, normalizeEditableCommunity, validateCommunity, datetimeInput } from '../src/model.js'
import { createBatch, applyBatchResult, uncertainBatch } from '../src/batch.js'
import { resolveEndpoint } from '../src/api.js'
const goods = () => ({...blankDraft(), _key:'one', clientRequestId:'request-one', title:'Desk', price:'0', sellerName:'Cat', sellerWechat:'cat-test', regionState:'NJ', regionCounty:'Fort Lee', regionArea:'Fort Lee', images:[]})
test('goods validation accepts free goods, rejects partial coordinates and backwards dates', () => {
 assert.equal(validateDraft(goods()), '')
 assert.match(validateDraft({...goods(), latitude:'40'}), /经纬度/)
 assert.match(validateDraft({...goods(), price:'NaN'}), /价格/)
 assert.match(validateDraft({...goods(), pickupEndDate:'2020-01-01'}), /日期/)
})
test('payload preserves real address and does not promote missing thumbnails or internal IDs', () => {
 const value=draftPayload({...goods(), version:4, resultId:'id', detailAddress:'1 Main St', latitude:'40',longitude:'-74',images:[{fileId:'cloud://real',url:'https://temporary.invalid'}]})
 assert.equal(value.location.address,'1 Main St');assert.equal(value.location.latitude,40)
 assert.deepEqual(value.images,[{fileId:'cloud://real'}]); assert.equal(value.version,undefined); assert.equal(value.resultId,undefined)
 assert.equal(value.thumbFileIDs,undefined); assert.ok(!JSON.stringify(value).includes('temporary.invalid'))
})
test('retry snapshot stays unchanged after successful goods are edited', () => {
 const rows=[goods(),{...goods(),_key:'two',clientRequestId:'request-two'}]
 const batch=createBatch(rows,'batch-one')
 const state=applyBatchResult(rows,batch,{results:[{index:0,id:'published'}],failures:[{index:1,error:'item_save_failed'}]})
 state[0].title='Updated title'
 assert.equal(batch.items[0].item.title,'Desk'); assert.equal(state[1]._status,'unconfirmed')
 const recovered=applyBatchResult(state,batch,{results:[{index:0,id:'published'},{index:1,id:'second'}]})
 assert.equal(recovered[0].title,'Updated title'); assert.equal(recovered[1]._status,'success')
 assert.equal(uncertainBatch(recovered,batch)[0]._status,'success')
})
test('new batch excludes confirmed goods and retains uncertain request IDs', () => {
 const batch=createBatch([{...goods(),_status:'success'},{...goods(),_key:'two',_status:'unconfirmed'}],'new')
 assert.equal(batch.items.length,1);assert.equal(batch.items[0].clientRequestId,'request-one')
 const invalid=applyBatchResult([goods()],createBatch([goods()],'a'),{failures:[{index:0,error:'invalid_price'}]})
 assert.equal(invalid[0]._status,'failed')
})
test('community manual content works while auto display is off and dates preserve their instant', () => {
 const c=normalizeEditableCommunity({group:{enabled:true,imageFileId:'cloud://qr',expiresAt:'2030-09-17T00:00:00+08:00'},announcement:{enabled:false,id:'notice',body:'Hello'}})
 assert.equal(validateCommunity(c,Date.parse('2030-09-10T00:00:00Z')),'')
 assert.equal(communityPayload(c).announcement.enabled,false)
 assert.equal(new Date(datetimeInput(c.group.expiresAt)).getTime(),Date.parse(c.group.expiresAt))
 assert.match(validateCommunity({...c,group:{...c.group,expiresAt:'invalid'}}),/到期/)
 assert.equal(validateCommunity(normalizeEditableCommunity()),'')
})
test('API uses HTTPS and prevents embedded credentials',()=>{
 assert.equal(resolveEndpoint('https://admin.linkx.ink','https://example.com'),'https://admin.linkx.ink/')
 assert.throws(()=>resolveEndpoint('http://example.com', 'https://example.com'))
 assert.throws(()=>resolveEndpoint('https://user:secret@example.com','https://example.com'))
})
