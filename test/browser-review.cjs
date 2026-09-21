const fs = require('fs');
const assert = require('node:assert/strict');
(async () => {
 const tabs = await (await fetch('http://127.0.0.1:9337/json')).json();
 const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
 await new Promise(r => ws.addEventListener('open',r,{once:true}));
 let next=0; const pending=new Map();
 ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const [ok,fail]=pending.get(msg.id)||[];pending.delete(msg.id);if(ok)msg.error?fail(msg.error):ok(msg.result);}});
 const send=(method,params={})=>new Promise((ok,fail)=>{const id=++next;pending.set(id,[ok,fail]);ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
 const media=fs.readdirSync('frontend/.next/static/media').filter(n=>/\.(png|jpe?g)$/.test(n)).slice(0,2).map(n=>'http://localhost:3107/_next/static/media/'+n);
 const source=`(() => {
 const role=sessionStorage.getItem('test-role')||'VIEW';
 const user={id:'review-user',name:'Review User',email:'review@example.com',avatarUrl:null,role:'ORGANIZER',permissions:[]};
 localStorage.setItem('pulseframe:session',JSON.stringify(user));localStorage.setItem('pulseframe:token','test-only');
 const event={id:'fixture',slug:'fixture',title:'Community research symposium',category:'Conference',date:'2027-01-25',time:'10:00',venue:'Conference Hall',host:'Event team',description:'Join us for a day of research and discussion.',eventMode:'offline',onlineUrl:'',capacity:100,attendees:1,price:500,status:'published',banners:${JSON.stringify(media)},fields:[],agenda:[],isOwner:role==='owner',sharedPermissions:[role],wizardStep:6};
 const booking={id:'registration',name:'Sample Attendee',email:'sample@example.com',phone:'9876543210',amount:500,seats:1,createdAt:new Date().toISOString(),paymentMethod:'qr',paymentStatus:'pending',registrationStatus:'pending',status:'pending',responses:{},transactionId:'UTR123456',paymentProof:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',checkedIn:false};
 const original=window.fetch.bind(window);
 window.fetch=async (input,options)=>{const url=String(input);if(!url.includes('/api/'))return original(input,options);const path=new URL(url,location.href).pathname.replace(/^.*?\\/api/,'');let result=[];
 if(path.includes('/auth/me'))result=user;
 else if(path.includes('/public/events/')||path==='/events/fixture')result=event;
 else if(path==='/events')result=[event];
 else if(path.includes('/bookings/event/'))result={capabilities:{canApprovePayment:['PAYMENT_APPROVE','owner'].includes(role),canCheckIn:['ATTENDEE','owner'].includes(role)},items:[booking]};
 else if(path.includes('/notifications/unread'))result=0;
 return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});};
 })();`;
 new Function(source);
 await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://localhost:3107/dashboard/events/fixture/attendees'});
 await wait("document.querySelector('.attendee-table tbody strong')");
 for(const role of ['VIEW','EDIT','PAYMENT_APPROVE','ATTENDEE','owner']){
  await evaluate(`sessionStorage.setItem('test-role',${JSON.stringify(role)})`);await send('Page.reload');await wait("document.querySelector('.attendee-table tbody strong')");
  const headers=await evaluate("Array.from(document.querySelectorAll('th')).map(x=>x.textContent)");
  assert.equal(headers.includes('Payment approval'),['PAYMENT_APPROVE','owner'].includes(role),role+' payment column');
  assert.equal(headers.includes('Check-in management'),['ATTENDEE','owner'].includes(role),role+' check-in column');
  assert.equal(await evaluate("!!document.querySelector('.content-rail')"),false);
  console.log('Browser permissions passed: '+role);
 }
 for(const theme of ['light','dark']){
  await evaluate(`localStorage.setItem('pulseframe:theme','${theme}')`);await send('Page.reload');await wait("document.querySelector('.attendee-table tbody strong')");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Accept payment').click()");await wait("document.querySelector('.swal-dialog[open]')");
  assert.match(await evaluate("document.querySelector('.swal-title').textContent"),/Accept payment/);
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/ui-review/approval-'+theme+'.png',Buffer.from(shot.data,'base64'));
  await evaluate("document.querySelector('.swal-btn--cancel').click()");
  console.log('Browser approval alert passed: '+theme);
 }
 await send('Page.navigate',{url:'http://localhost:3107/events/fixture'});await wait("document.querySelector('.event-banner-controls')");
 const initial=await evaluate("document.querySelector('.event-banner-slider img').src");await evaluate("document.querySelector('[aria-label=\"Next event photo\"]').click()");
 assert.notEqual(await evaluate("document.querySelector('.event-banner-slider img').src"),initial);
 console.log('Browser multiple-photo slider passed');
 await evaluate("sessionStorage.setItem('test-role','VIEW')");await send('Page.navigate',{url:'http://localhost:3107/dashboard/events/fixture'});await wait("document.querySelector('.panel-body h1')");
 assert.equal(await evaluate("!!document.querySelector('.wizard-form')"),false);console.log('Browser view-only event details passed');
 await send('Page.navigate',{url:'http://localhost:3107/dashboard'});await wait("document.querySelector('.content-rail')");console.log('Browser dashboard-only right rail passed');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:'http://localhost:3107/dashboard/events/fixture/attendees'});await wait("document.querySelector('.attendee-table tbody strong')");
 assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),true,'No page-wide mobile overflow');
 console.log('Browser mobile layout passed');
 ws.close();
})().catch(error=>{console.error(error);process.exit(1)});
