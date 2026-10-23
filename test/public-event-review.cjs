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
 const media=fs.readdirSync('frontend/.next-review/static/media').find(n=>/\.jpg$/.test(n));
 const fixture={id:'fixture',slug:'fixture',title:'NEXT LEVEL / Campus Arena',category:'Gaming',date:'2027-12-17',time:'10:00',eventMode:'offline',onlineUrl:'',venue:'SRM Grand Auditorium',host:'SRM Campus Collective',description:'Step into a day built for bold ideas and unforgettable moments. Meet your community, challenge your limits, and be part of the next wave.\n\nFrom immersive sessions to live competitions, there is something here for every curious mind.',agenda:['10:00 AM - Doors open and welcome','11:00 AM - The main stage: ideas in motion','01:00 PM - Community lunch and connections','03:00 PM - Live arena and awards'],capacity:250,attendees:86,eventType:'free',price:0,status:'published',registrationDeadline:'2027-12-15T04:30:00Z',banners:media?['http://localhost:3107/_next/static/media/'+media]:[],fields:[{id:'f',name:'college',label:'College / Organization',type:'text',required:true,options:[],order:0}]};
 const source='const fixture='+JSON.stringify(fixture)+'; const original=window.fetch.bind(window);window.fetch=async (input,options)=>{const url=String(input);if(url.includes("/public/events"))return new Response(JSON.stringify(url.includes("/public/events/")?fixture:[fixture]),{headers:{"Content-Type":"application/json"}});return original(input,options);};';
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source});
 fs.mkdirSync('frontend/.next-review/screenshots',{recursive:true});
 for(const [name,width,path] of [['detail-desktop',1440,'/events/fixture'],['detail-mobile',390,'/events/fixture'],['list-desktop',1440,'/events']]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await send('Page.navigate',{url:'http://localhost:3107'+path});
  await wait('document.body?.innerText.includes("NEXT LEVEL")');await new Promise(r=>setTimeout(r,350));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true,name+' horizontal overflow');
  assert.equal(await evaluate('document.body.innerText.toLowerCase().includes("last date of registration")'),true,name+' deadline');
  if(path.includes('fixture')){assert.equal(await evaluate('!!document.querySelector(".experience-agenda")'),true);assert.equal(await evaluate('!!document.querySelector("#event-registration input")'),true);}
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync('frontend/.next-review/screenshots/'+name+'.png',Buffer.from(shot.data,'base64'));console.log(name+' passed');
 }
 ws.close();
})().catch(error=>{console.error(error);process.exit(1);});
