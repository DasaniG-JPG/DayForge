const KEY='dayforge-v01';
const defaultData={
  prefs:{workStart:'07:00',workEnd:'22:00',bufferMin:20,googleClientId:''},
  tasks:[
    {id:'seed-ctf1',title:'September Hackerverse CTF #1 Participation & Reflection',course:'CYBR 220',due:'2026-10-01T23:59',minutes:45,priority:3,done:false},
    {id:'seed-c220m6',title:'Module 6 Applied Assignment: Regex Validation Gateway',course:'CYBR 220',due:'2026-10-04T23:59',minutes:90,priority:3,done:false},
    {id:'seed-c230m6',title:'Module 6 Knowledge Check',course:'CYBR 230',due:'2026-10-04T23:59',minutes:30,priority:2,done:false},
    {id:'seed-c221m6',title:'Module 6 Knowledge Check',course:'CYBR 221',due:'2026-10-04T19:59',minutes:30,priority:2,done:false},
    {id:'seed-c221case',title:'Security and Log Analysis Mini-Case',course:'CYBR 221',due:'2026-10-04T19:59',minutes:75,priority:3,done:false},
    {id:'seed-lab-ipv6',title:'Cisco 10.2.6 - IPv6 Address Representations',course:'CYBR 211L',due:'2026-10-04T19:59',minutes:35,priority:2,done:false},
    {id:'seed-lab-dhcp',title:'Cisco 11.2.3 - Configure DHCP on a Wireless Router',course:'CYBR 211L',due:'2026-10-04T19:59',minutes:40,priority:2,done:false},
    {id:'seed-lab6',title:'Lab 6 - Analyze Firewall Logs and Recommend Network Controls',course:'CYBR 211L',due:'2026-10-04T19:59',minutes:90,priority:3,done:false},
    {id:'seed-histmid',title:'HIST 130 Mid-term Examination',course:'HIST 130',due:'2026-10-08T14:55',minutes:120,priority:3,done:false},
    {id:'seed-c221mid',title:'CYBR 221 Midterm Exam',course:'CYBR 221',due:'2026-10-09T19:59',minutes:120,priority:3,done:false},
    {id:'seed-c221review',title:'Midterm Review Checklist',course:'CYBR 221',due:'2026-10-09T19:59',minutes:45,priority:2,done:false},
    {id:'seed-labmid',title:'Midterm Lab Practicum - Secure SOHO Network',course:'CYBR 211L',due:'2026-10-09T19:59',minutes:120,priority:3,done:false},
    {id:'seed-c230mid',title:'Midterm Examination - Modules 1–6',course:'CYBR 230',due:'2026-10-09T23:59',minutes:120,priority:3,done:false},
    {id:'seed-histquiz2',title:'HIST 130 Quiz 2 - The Slavery System in America',course:'HIST 130',due:'2026-10-11T23:59',minutes:45,priority:2,done:false}
  ],
  googleEvents:[]
};

const recurring={
  1:[['04:00','Wake up','routine',20],['05:00','Gym','routine',60],['10:00','CYBR 220 CodeAlchemy','class',50],['12:00','Lunch','meal',45],['13:00','CYBR 221 NetFusion','class',50],['14:00','HIST 130','class',50],['16:00','Professional Pathways','class',50],['18:00','Dinner','meal',45],['20:30','Meeting','meeting',60]],
  2:[['04:00','Wake up','routine',20],['05:00','Gym','routine',60],['12:00','Lunch','meal',45],['13:00','Spanish','class',75],['18:00','Dinner','meal',45],['19:00','Meeting','meeting',60]],
  3:[['04:00','Wake up','routine',20],['05:00','Gym','routine',60],['10:00','CYBR 220 CodeAlchemy','class',50],['12:00','Lunch','meal',45],['13:00','CYBR 221 NetFusion','class',50],['14:00','HIST 130','class',50],['16:00','Professional Pathways','class',50],['18:00','Dinner','meal',45],['20:30','Meeting','meeting',60]],
  4:[['12:00','Lunch','meal',45],['13:00','Spanish','class',75],['18:00','Dinner','meal',45],['19:00','Meeting','meeting',60]],
  5:[['10:00','CYBR 210L CodeAlchemy Lab','class',50],['12:00','Lunch','meal',45],['13:00','CYBR 211L NetFusion Lab','class',50],['14:00','HIST 130','class',50],['18:00','Dinner','meal',45],['20:30','Meeting','meeting',60]],
  6:[['12:00','Lunch','meal',45],['18:00','Dinner','meal',45]],
  0:[['12:00','Lunch','meal',45],['18:00','Dinner','meal',45]]
};

let data=loadData();
let googleToken=null;
let tokenClient=null;
let suggestedTaskId=null;

function loadData(){try{const parsed=JSON.parse(localStorage.getItem(KEY));return parsed?{...structuredClone(defaultData),...parsed,prefs:{...defaultData.prefs,...parsed.prefs}}:structuredClone(defaultData)}catch{return structuredClone(defaultData)}}
function save(){localStorage.setItem(KEY,JSON.stringify(data))}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function minutes(t){const [h,m]=t.split(':').map(Number);return h*60+m}
function hhmm(total){const h=Math.floor(total/60)%24,m=total%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
function prettyTime(d){return new Intl.DateTimeFormat([], {hour:'numeric',minute:'2-digit'}).format(d)}
function prettyDate(d){return new Intl.DateTimeFormat([], {weekday:'short',month:'short',day:'numeric'}).format(d)}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function startOfDay(d=new Date()){const x=new Date(d);x.setHours(0,0,0,0);return x}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}

function fixedForDay(day=new Date()){
  const out=[];
  for(const [time,title,kind,duration] of recurring[day.getDay()]||[]){
    const start=new Date(day);const [h,m]=time.split(':').map(Number);start.setHours(h,m,0,0);
    const end=new Date(start.getTime()+duration*60000);out.push({title,kind,start,end,source:'local'});
  }
  const dk=dateKey(day);
  for(const e of data.googleEvents||[]){
    const s=new Date(e.start), en=new Date(e.end||e.start);
    if(dateKey(s)===dk) out.push({title:e.title||'Google Calendar event',kind:'google',start:s,end:en,source:'google'});
  }
  return out.sort((a,b)=>a.start-b.start);
}

function taskScore(task,now=new Date()){
  if(task.done)return -Infinity;
  const due=task.due?new Date(task.due):new Date(now.getTime()+14*864e5);
  const hours=Math.max(.25,(due-now)/36e5);
  const urgency=120/hours;
  const priority=task.priority*12;
  const sizePenalty=Math.max(0,(task.minutes-90)/30);
  return urgency+priority-sizePenalty;
}

function availableGaps(day=new Date()){
  const prefs=data.prefs;const workStart=minutes(prefs.workStart),workEnd=minutes(prefs.workEnd),buffer=Number(prefs.bufferMin)||0;
  const base=startOfDay(day);const events=fixedForDay(day).map(e=>({s:(e.start-base)/60000-buffer,e:(e.end-base)/60000+buffer})).sort((a,b)=>a.s-b.s);
  const gaps=[];let cursor=workStart;
  for(const ev of events){if(ev.e<workStart||ev.s>workEnd)continue;const s=Math.max(workStart,ev.s);if(s-cursor>=15)gaps.push([cursor,s]);cursor=Math.max(cursor,Math.min(workEnd,ev.e))}
  if(workEnd-cursor>=15)gaps.push([cursor,workEnd]);return gaps;
}

function recommendTask(now=new Date()){
  const open=data.tasks.filter(t=>!t.done && (!t.due || new Date(t.due)>=startOfDay(now)));
  if(!open.length)return null;
  const base=startOfDay(now);const nowMin=(now-base)/60000;const gaps=availableGaps(now).filter(g=>g[1]>nowMin).map(g=>[Math.max(g[0],nowMin),g[1]]);
  const ranked=[...open].sort((a,b)=>taskScore(b,now)-taskScore(a,now));
  for(const t of ranked){if(gaps.some(g=>g[1]-g[0]>=Math.min(t.minutes,25)))return {task:t,gap:gaps.find(g=>g[1]-g[0]>=Math.min(t.minutes,25))}}
  return {task:ranked[0],gap:null};
}

function renderToday(){
  const now=new Date();document.getElementById('todayLabel').textContent=`${prettyDate(now)} · plan what matters, protect the rest.`;
  const rec=recommendTask(now);suggestedTaskId=rec?.task?.id||null;
  const title=document.getElementById('nextMoveTitle'),meta=document.getElementById('nextMoveMeta');
  if(!rec){title.textContent='You are clear 🎉';meta.textContent='No open tasks in the queue.'}else{title.textContent=rec.task.title;const gap=rec.gap?`Fits in a ${Math.round(rec.gap[1]-rec.gap[0])} min open block`:'No clean gap left today';const due=rec.task.due?`Due ${prettyDate(new Date(rec.task.due))} ${prettyTime(new Date(rec.task.due))}`:'No due date';meta.textContent=`${rec.task.course||'General'} · ~${rec.task.minutes} min · ${due} · ${gap}`}
  document.getElementById('completeSuggestedBtn').disabled=!rec;
  const dueSoon=data.tasks.filter(t=>!t.done&&t.due&&(new Date(t.due)-now)<7*864e5&&(new Date(t.due)-now)>-864e5);
  const mins=dueSoon.reduce((s,t)=>s+t.minutes,0);const level=mins>600?'Heavy':mins>300?'Busy':mins>120?'Moderate':'Light';
  document.getElementById('loadLabel').textContent=level;document.getElementById('loadCount').textContent=`${dueSoon.length} due in 7 days`;document.getElementById('loadMeter').style.width=`${Math.min(100,Math.max(10,mins/7))}%`;document.getElementById('loadHint').textContent=mins?`About ${Math.round(mins/60*10)/10} hours of estimated task work due soon.`:'No estimated workload due in the next week.';
  const events=fixedForDay(now);const tl=document.getElementById('timeline');tl.innerHTML='';
  for(const e of events){const isNow=now>=e.start&&now<=e.end;const div=document.createElement('div');div.className=`event ${e.kind} ${isNow?'now':''}`;div.innerHTML=`<div class="time">${prettyTime(e.start)}</div><div><div class="task-title">${escapeHtml(e.title)}</div><div class="kind">${e.source==='google'?'Google Calendar':e.kind}</div></div><span class="pill">${Math.max(1,Math.round((e.end-e.start)/60000))}m</span>`;tl.appendChild(div)}
  if(!events.length)tl.innerHTML='<div class="empty">No fixed events today.</div>';
  const gaps=availableGaps(now);document.getElementById('freeTimeText').textContent=`${Math.round(gaps.reduce((s,g)=>s+g[1]-g[0],0)/60*10)/10}h flexible`;
  const upcoming=[...data.tasks].filter(t=>!t.done&&t.due&&new Date(t.due)>=now).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,6);const up=document.getElementById('upcoming');up.innerHTML=upcoming.map(t=>`<div class="task"><div><div class="task-title">${escapeHtml(t.title)}</div><div class="kind">${escapeHtml(t.course||'General')} · due ${prettyDate(new Date(t.due))}</div></div><span class="pill">${t.minutes}m</span></div>`).join('')||'<div class="empty">Nothing due soon.</div>';
}

function renderTasks(){const mode=document.getElementById('taskFilter').value;let tasks=[...data.tasks].sort((a,b)=>(a.done-b.done)||((a.due?new Date(a.due):Infinity)-(b.due?new Date(b.due):Infinity)));if(mode==='open')tasks=tasks.filter(t=>!t.done);if(mode==='done')tasks=tasks.filter(t=>t.done);document.getElementById('taskList').innerHTML=tasks.map(t=>`<div class="task ${t.done?'done':''}"><div><div class="task-title">${escapeHtml(t.title)}</div><div class="kind">${escapeHtml(t.course||'General')} · ${t.due?`due ${prettyDate(new Date(t.due))} ${prettyTime(new Date(t.due))}`:'no due date'} · ~${t.minutes}m</div></div><span class="pill">P${t.priority}</span><div class="task-actions"><button class="ghost toggle-task" data-id="${t.id}">${t.done?'Undo':'Done'}</button><button class="ghost delete-task" data-id="${t.id}">×</button></div></div>`).join('')||'<div class="empty">No tasks here.</div>';document.querySelectorAll('.toggle-task').forEach(b=>b.addEventListener('click',()=>{const t=data.tasks.find(x=>x.id===b.dataset.id);t.done=!t.done;save();renderAll()}));document.querySelectorAll('.delete-task').forEach(b=>b.addEventListener('click',()=>{data.tasks=data.tasks.filter(x=>x.id!==b.dataset.id);save();renderAll()}))}

function renderWeek(){const names=['Monday','Tuesday','Wednesday','Thursday','Friday'];document.getElementById('weekGrid').innerHTML=names.map((name,i)=>{const day=i+1;const anchors=(recurring[day]||[]).map(([time,title,kind])=>`<div class="anchor"><strong>${time}</strong> ${escapeHtml(title)}<small>${kind}</small></div>`).join('');return `<div class="day-col"><h3>${name}</h3>${anchors}</div>`}).join('')}
function renderSettings(){document.getElementById('workStart').value=data.prefs.workStart;document.getElementById('workEnd').value=data.prefs.workEnd;document.getElementById('bufferMin').value=data.prefs.bufferMin;document.getElementById('clientIdInput').value=data.prefs.googleClientId||''}
function renderAll(){renderToday();renderTasks();renderWeek();renderSettings()}

async function connectGoogle(){
  const clientId=data.prefs.googleClientId?.trim();const status=document.getElementById('googleStatus');
  if(!clientId){status.textContent='Add your Google OAuth Client ID in Settings first.';switchTab('settings');return}
  if(!window.google?.accounts?.oauth2){status.textContent='Google Identity Services has not loaded yet. Check your internet connection and retry.';return}
  if(!tokenClient) tokenClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/calendar.readonly',callback:''});
  tokenClient.callback=async(resp)=>{if(resp.error){status.textContent=`Google sign-in failed: ${resp.error}`;return}googleToken=resp.access_token;status.textContent='Connected. Syncing upcoming events…';await syncGoogleEvents();};
  tokenClient.requestAccessToken({prompt:googleToken?'':'consent'});
}
async function syncGoogleEvents(){const status=document.getElementById('googleStatus');if(!googleToken){status.textContent='Connect Google Calendar first.';return}const now=new Date(),later=new Date(now.getTime()+30*864e5);const url=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');url.searchParams.set('timeMin',now.toISOString());url.searchParams.set('timeMax',later.toISOString());url.searchParams.set('singleEvents','true');url.searchParams.set('orderBy','startTime');url.searchParams.set('maxResults','250');try{const res=await fetch(url,{headers:{Authorization:`Bearer ${googleToken}`}});if(!res.ok)throw new Error(`HTTP ${res.status}`);const json=await res.json();data.googleEvents=(json.items||[]).filter(e=>e.start?.dateTime).map(e=>({id:e.id,title:e.summary||'Busy',start:e.start.dateTime,end:e.end?.dateTime||e.start.dateTime}));save();status.textContent=`Connected · ${data.googleEvents.length} timed events synced for the next 30 days.`;renderAll()}catch(err){status.textContent=`Calendar sync failed: ${err.message}`}}

function switchTab(name){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.id===`tab-${name}`));document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name))}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
document.getElementById('refreshBtn').addEventListener('click',()=>{if(googleToken)syncGoogleEvents();else renderAll()});
document.getElementById('googleBtn').addEventListener('click',connectGoogle);
document.getElementById('newTaskBtn').addEventListener('click',()=>document.getElementById('taskDialog').showModal());
document.getElementById('cancelTaskBtn').addEventListener('click',()=>document.getElementById('taskDialog').close());
document.getElementById('taskForm').addEventListener('submit',e=>{e.preventDefault();const title=document.getElementById('taskTitle').value.trim();if(!title)return;data.tasks.push({id:uid(),title,course:document.getElementById('taskCourse').value.trim(),due:document.getElementById('taskDue').value||null,minutes:Number(document.getElementById('taskMinutes').value)||45,priority:Number(document.getElementById('taskPriority').value)||2,done:false});save();e.target.reset();document.getElementById('taskMinutes').value=45;document.getElementById('taskPriority').value='2';document.getElementById('taskDialog').close();renderAll()});
document.getElementById('taskFilter').addEventListener('change',renderTasks);
document.getElementById('completeSuggestedBtn').addEventListener('click',()=>{if(!suggestedTaskId)return;const t=data.tasks.find(x=>x.id===suggestedTaskId);if(t){t.done=true;save();renderAll()}});
document.getElementById('startTaskBtn').addEventListener('click',()=>{if(!suggestedTaskId)return;const t=data.tasks.find(x=>x.id===suggestedTaskId);if(t)alert(`Focus target: ${t.title}\n\nSet a ${Math.min(t.minutes,50)} minute timer and just get the first chunk moving.`)});
document.getElementById('savePrefsBtn').addEventListener('click',()=>{data.prefs.workStart=document.getElementById('workStart').value;data.prefs.workEnd=document.getElementById('workEnd').value;data.prefs.bufferMin=Number(document.getElementById('bufferMin').value)||0;save();renderAll()});
document.getElementById('saveClientBtn').addEventListener('click',()=>{data.prefs.googleClientId=document.getElementById('clientIdInput').value.trim();tokenClient=null;save();document.getElementById('googleStatus').textContent='Client ID saved. Click Connect Google Calendar.'});
document.getElementById('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dayforge-backup.json';a.click();URL.revokeObjectURL(a.href)});
document.getElementById('resetBtn').addEventListener('click',()=>{if(confirm('Reset DayForge back to its starter data?')){localStorage.removeItem(KEY);data=structuredClone(defaultData);renderAll()}});
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderAll();setInterval(renderToday,60000);
