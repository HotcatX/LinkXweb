import assert from 'node:assert/strict';
import test from 'node:test';
async function render(){
 const {default:worker}=await import('../dist/server/index.js');
 return worker.fetch(new Request('http://localhost/',{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});
}
test('existing vinext target renders the redesigned public site without a request-bound API',async()=>{
 const response=await render();assert.equal(response.status,200);
 const html=await response.text();assert.match(html,/极链行服务/);assert.match(html,/寻找拼车/);assert.doesNotMatch(html,/Your site is taking shape/);
});
