const fs = require('fs');
const assert = require('node:assert/strict');
(async () => {
 const tabs = await (await fetch('http://127.0.0.1:9337/json')).json();
 const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();ws.addEventListener('message', e=>{const msg=JSON.parse(e.data);if(msg.id){const handlers=pending.get(msg.id);pending.delete(msg.id);if(handlers)msg.error?handlers[1](msg.error):handlers[0](msg.result);}});
 const send=(method,params={})=>new Promise((ok,fail)=>{const next=++id;pending.set(next,[ok,fail]);ws.send(JSON.stringify({id:next,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out '+expression);};

 const user={id:'review',name:'Review Admin',email:'review@example.com',role:'ORGANIZER',permissions:['events:create']};
 const fixture={id:'original',slug:'fixture',title:'Action Feedback Event',category:'Conference',date:'2027-12-17',time:'10:00',eventMode:'offline',onlineUrl:'',venue:'Hall',host:'Team',description:'Event',agenda:['Welcome'],capacity:100,attendees:0,eventType:'free',price:0,status:'published',banners:[],fields:[],isOwner:true,wizardStep:4};
 const script = 'const user='+JSON.stringify(user)+';const fixture='+JSON.stringify(fixture)+';'+
 'localStorage.setItem("pulseframe:session",JSON.stringify(user));localStorage.setItem("pulseframe:token","test-token");'+
 'let records=[fixture,{...fixture,id:"draft",title:"Draft event",status:"draft"},{...fixture,id:"closed",title:"Closed event",registrationDeadline:"2020-01-01T00:00:00Z"}];const original=window.fetch.bind(window);window.fetch=async(input,options={})=>{const url=String(input);if(!url.includes("/api/"))return original(input,options);const path=new URL(url,location.href).pathname.replace(/^.*?\\/api/,"");let result=[];const method=options.method||"GET";if(path==="/auth/me")result=user;else if(path.includes("/notifications/unread"))result=0;else if(path.endsWith("/duplicate")){await new Promise(r=>setTimeout(r,2800));result={...fixture,id:"copy",slug:null,title:"Action Feedback Event copy",status:"draft"};records.push(result);}else if(method==="DELETE"){await new Promise(r=>setTimeout(r,2800));records=records.filter(r=>r.id!==path.split("/").pop());result={success:true};}else if(path==="/events")result=records;else if(path.endsWith("/dashboard"))result={owner:{name:user.name,email:user.email},sharedMembersCount:0,totalRegistrations:0,pendingRegistrations:0,updatedAt:new Date().toISOString()};else if(path==="/events/copy")result=records.find(r=>r.id==="copy");return new Response(JSON.stringify(result),{headers:{"Content-Type":"application/json"}});};';
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:script});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://localhost:3107/dashboard/events'});
 await wait('document.querySelectorAll("button[aria-label=Delete]").length===3');
 assert.equal(await evaluate('document.querySelectorAll(".event-status-published").length'),1);
 assert.equal(await evaluate('document.querySelectorAll(".event-status-draft").length'),1);
 assert.equal(await evaluate('document.querySelectorAll(".event-status-closed").length'),1);
 await evaluate('document.documentElement.dataset.theme="dark"');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".event-status-published")).color'),'rgb(110, 231, 183)');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".event-status-draft")).color'),'rgb(251, 191, 36)');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".event-status-closed")).color'),'rgb(253, 164, 175)');
 await evaluate('document.documentElement.dataset.theme="light"');

 await evaluate('document.querySelector("button[aria-label=Delete]").click()');
 await wait('!!document.querySelector(".swal-dialog[open] .swal-btn--danger")');
 await evaluate('document.querySelector(".swal-dialog[open] .swal-btn--danger").click()');
 await wait('!!document.querySelector(".activity-dialog[open]")');
 assert.equal(await evaluate('document.querySelector(".activity-dialog").innerText.includes("Deleting")'),true);
 fs.mkdirSync('frontend/.next-review/screenshots',{recursive:true});
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('frontend/.next-review/screenshots/delete-progress.png',Buffer.from(shot.data,'base64'));
 await wait('document.querySelectorAll("button[aria-label=Delete]").length===2 && !document.querySelector(".activity-dialog[open]")');
 await wait('!!document.querySelector(".toast-wrap")');
 console.log('Delete spinner, refresh, success notification, and status colors passed');
 await evaluate('document.querySelector("button[aria-label="+JSON.stringify("Duplicate event")+"]").click()');
 await wait('!!document.querySelector(".activity-dialog[open]")');
 assert.equal(await evaluate('document.querySelector(".activity-dialog").innerText.includes("Duplicating")'),true);
 await wait('location.pathname.includes("/events/copy") && !document.querySelector(".activity-dialog[open]")');
 await wait('!!document.querySelector(".action-success-toast")');
 console.log('Duplicate spinner, edit navigation, and success notification passed');
 ws.close();
})().catch(error=>{console.error(error);process.exit(1);});
