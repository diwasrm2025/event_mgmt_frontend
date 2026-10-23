const { test } = require('node:test');
const assert = require('node:assert/strict'); const fs = require('node:fs'); const ts = require('typescript');
function load() { const source = fs.readFileSync(require('node:path').join(__dirname,'../lib/action-feedback.ts'),'utf8'); const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText; const mod={exports:{}};new Function('exports','module',code)(mod.exports,mod);return mod.exports; }
test('duplicate stays in progress until request completes, then emits success', async()=> {
 const api=load();const states=[];const unsubscribe=api.subscribeProgress(s=>states.push(s));let resolve;
 const pending=api.withRequestFeedback('/events/id/duplicate','POST',()=>new Promise(r=>{resolve=r;}));
 assert.equal(states.at(-1).pending,1);assert.equal(states.at(-1).label,'Duplicating event');assert.equal(states.at(-1).success,'');
 resolve({id:'copy'});assert.deepEqual(await pending,{id:'copy'});assert.equal(states.at(-1).pending,0);assert.match(states.at(-1).success,/duplicated/);unsubscribe();
});
test('parallel requests keep feedback active until both finish', async()=> {
 const api=load();let state;api.subscribeProgress(s=>state=s);let remove,refresh;
 const deleting=api.withRequestFeedback('/qr-codes/id','DELETE',()=>new Promise(r=>remove=r));
 const loading=api.withRequestFeedback('/qr-codes','GET',()=>new Promise(r=>refresh=r));
 assert.equal(state.pending,2);assert.equal(state.label,'Deleting');remove({});await deleting;assert.equal(state.pending,1);refresh([]);await loading;assert.equal(state.pending,0);
});
test('failed mutation clears progress without a success notification', async()=> {
 const api=load();let state;api.subscribeProgress(s=>state=s);
 await assert.rejects(api.withRequestFeedback('/roles/id','DELETE',async()=>{throw Error('Denied');}),/Denied/);
 assert.equal(state.pending,0);assert.equal(state.success,'');
});
test('notification polling does not show blocking progress',async()=>{
 const api=load();let state;api.subscribeProgress(s=>state=s);
 await api.withRequestFeedback('/notifications/unread-count','GET',async()=>{assert.equal(state.pending,0);return 0;});
});
