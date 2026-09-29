const KEY='dayforge-v10';
const LEGACY_KEYS=['dayforge-v03','dayforge-v02','dayforge-v01'];
const defaultData={
  prefs:{workStart:'07:00',workEnd:'22:00',bufferMin:20,maxBlockMin:60,breakMin:10,googleClientId:''},
  tasks:[],
  anchors:[],
  localEvents:[],
  googleEvents:[],
  plans:{}
};

let data=loadData();
let googleToken=null;
let tokenClient=null;
let suggestedTaskId=null;

function loadData(){try{let raw=localStorage.getItem(KEY);if(!raw){for(const k of LEGACY_KEYS){raw=localStorage.getItem(k);if(raw)break}}const parsed=raw?JSON.parse(raw):null;return parsed?{...structuredClone(defaultData),...parsed,prefs:{...defaultData.prefs,...parsed.prefs},tasks:Array.isArray(parsed.tasks)?parsed.tasks:[],anchors:Array.isArray(parsed.anchors)?parsed.anchors:[],localEvents:Array.isArray(parsed.localEvents)?parsed.localEvents:[],googleEvents:Array.isArray(parsed.googleEvents)?parsed.googleEvents:[],plans:parsed.plans&&typeof parsed.plans==='object'?parsed.plans:{}}:structuredClone(defaultData)}catch{return structuredClone(defaultData)}}
function save(){localStorage.setItem(KEY,JSON.stringify(data))}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function minutes(t){const [h,m]=t.split(':').map(Number);return h*60+m}
function hhmm(total){const h=Math.floor(total/60)%24,m=total%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
function prettyTime(d){return new Intl.DateTimeFormat([], {hour:'numeric',minute:'2-digit'}).format(d)}
function prettyDate(d){return new Intl.DateTimeFormat([], {weekday:'short',month:'short',day:'numeric'}).format(d)}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function startOfDay(d=new Date()){const x=new Date(d);x.setHours(0,0,0,0);return x}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}

function baseFixedForDay(day=new Date()){
  const out=[];
  for(const a of (data.anchors||[]).filter(x=>Number(x.day)===day.getDay())){
    const start=new Date(day);const [h,m]=a.time.split(':').map(Number);start.setHours(h,m,0,0);
    const end=new Date(start.getTime()+(Number(a.duration)||60)*60000);out.push({title:a.title,kind:a.kind||'routine',start,end,source:'local'});
  }
  const dk=dateKey(day);
  for(const e of data.localEvents||[]){const s=new Date(e.start),en=new Date(e.end||e.start);if(dateKey(s)===dk)out.push({title:e.title||'Event',kind:e.kind||'meeting',start:s,end:en,source:'local'});}
  for(const e of data.googleEvents||[]){
    const s=new Date(e.start), en=new Date(e.end||e.start);
    if(dateKey(s)===dk) out.push({title:e.title||'Google Calendar event',kind:'google',start:s,end:en,source:'google'});
  }
  return out.sort((a,b)=>a.start-b.start);
}

function planForDay(day=new Date()){
  return (data.plans?.[dateKey(day)]||[]).map(b=>({...b,start:new Date(b.start),end:new Date(b.end),kind:'plan',source:'plan'}));
}
function fixedForDay(day=new Date()){return [...baseFixedForDay(day),...planForDay(day)].sort((a,b)=>a.start-b.start)}

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
  const base=startOfDay(day);const events=baseFixedForDay(day).map(e=>({s:(e.start-base)/60000-buffer,e:(e.end-base)/60000+buffer})).sort((a,b)=>a.s-b.s);
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
  for(const e of events){const isNow=now>=e.start&&now<=e.end;const div=document.createElement('div');div.className=`event ${e.kind} ${isNow?'now':''}`;const sourceLabel=e.source==='google'?'Google Calendar':e.source==='plan'?'DayForge plan':e.kind;div.innerHTML=`<div class="time">${prettyTime(e.start)}</div><div><div class="task-title">${escapeHtml(e.title)}</div><div class="kind">${sourceLabel}</div></div><span class="pill">${Math.max(1,Math.round((e.end-e.start)/60000))}m</span>`;tl.appendChild(div)}
  if(!events.length)tl.innerHTML='<div class="empty">No fixed events today.</div>';
  const gaps=availableGaps(now);document.getElementById('freeTimeText').textContent=`${Math.round(gaps.reduce((s,g)=>s+g[1]-g[0],0)/60*10)/10}h flexible`;renderPlanBlocks(now);
  const upcoming=[...data.tasks].filter(t=>!t.done&&t.due&&new Date(t.due)>=now).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,6);const up=document.getElementById('upcoming');up.innerHTML=upcoming.map(t=>`<div class="task"><div><div class="task-title">${escapeHtml(t.title)}</div><div class="kind">${escapeHtml(t.course||'General')} · due ${prettyDate(new Date(t.due))}</div></div><span class="pill">${t.minutes}m</span></div>`).join('')||'<div class="empty">Nothing due soon.</div>';
}

function renderTasks(){const mode=document.getElementById('taskFilter').value;let tasks=[...data.tasks].sort((a,b)=>(a.done-b.done)||((a.due?new Date(a.due):Infinity)-(b.due?new Date(b.due):Infinity)));if(mode==='open')tasks=tasks.filter(t=>!t.done);if(mode==='done')tasks=tasks.filter(t=>t.done);document.getElementById('taskList').innerHTML=tasks.map(t=>`<div class="task ${t.done?'done':''}"><div><div class="task-title">${escapeHtml(t.title)}</div><div class="kind">${escapeHtml(t.course||'General')} · ${t.due?`due ${prettyDate(new Date(t.due))} ${prettyTime(new Date(t.due))}`:'no due date'} · ~${t.minutes}m</div></div><span class="pill">P${t.priority}</span><div class="task-actions"><button class="ghost toggle-task" data-id="${t.id}">${t.done?'Undo':'Done'}</button><button class="ghost delete-task" data-id="${t.id}">×</button></div></div>`).join('')||'<div class="empty">No tasks here.</div>';document.querySelectorAll('.toggle-task').forEach(b=>b.addEventListener('click',()=>{const t=data.tasks.find(x=>x.id===b.dataset.id);t.done=!t.done;save();renderAll()}));document.querySelectorAll('.delete-task').forEach(b=>b.addEventListener('click',()=>{data.tasks=data.tasks.filter(x=>x.id!==b.dataset.id);save();renderAll()}))}

function renderWeek(){
  const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  document.getElementById('weekGrid').innerHTML=names.map((name,day)=>{
    const anchors=(data.anchors||[]).filter(a=>Number(a.day)===day).sort((a,b)=>a.time.localeCompare(b.time)).map(a=>`<div class="anchor"><strong>${escapeHtml(a.time)}</strong> ${escapeHtml(a.title)}<small>${escapeHtml(a.kind||'routine')} · ${Number(a.duration)||60}m</small><button class="ghost remove-anchor" data-id="${a.id}" type="button">×</button></div>`).join('');
    return `<div class="day-col"><h3>${name}</h3>${anchors||'<div class="empty">No anchors</div>'}</div>`;
  }).join('');
  document.querySelectorAll('.remove-anchor').forEach(b=>b.addEventListener('click',()=>{data.anchors=data.anchors.filter(a=>a.id!==b.dataset.id);save();renderAll()}));
}
function renderSettings(){document.getElementById('workStart').value=data.prefs.workStart;document.getElementById('workEnd').value=data.prefs.workEnd;document.getElementById('bufferMin').value=data.prefs.bufferMin;document.getElementById('maxBlockMin').value=data.prefs.maxBlockMin||60;document.getElementById('breakMin').value=data.prefs.breakMin||10;document.getElementById('clientIdInput').value=data.prefs.googleClientId||'';const summary=document.getElementById('googleSyncSummary');if(summary) summary.textContent=`${(data.googleEvents||[]).length} external Google event${(data.googleEvents||[]).length===1?'':'s'} currently cached.`}
function renderAll(){renderToday();renderTasks();renderWeek();renderSettings()}

async function connectGoogle(){
  const clientId=data.prefs.googleClientId?.trim();const status=document.getElementById('googleStatus');
  if(!clientId){status.textContent='Add your Google OAuth Client ID in Settings first.';switchTab('settings');return}
  if(!window.google?.accounts?.oauth2){status.textContent='Google Identity Services has not loaded yet. Check your internet connection and retry.';return}
  if(!tokenClient) tokenClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/calendar.events',callback:''});
  tokenClient.callback=async(resp)=>{if(resp.error){status.textContent=`Google sign-in failed: ${resp.error}`;return}googleToken=resp.access_token;status.textContent='Google authorized. Pulling calendar events…';await syncGoogleEvents();};
  tokenClient.requestAccessToken({prompt:'consent'});
}

async function calendarApi(path,options={}){
  if(!googleToken) throw new Error('Google Calendar is not authorized in this browser session.');
  const res=await fetch(`https://www.googleapis.com/calendar/v3${path}`,{...options,headers:{Authorization:`Bearer ${googleToken}`,'Content-Type':'application/json',...(options.headers||{})}});
  if(!res.ok){let detail='';try{const j=await res.json();detail=j?.error?.message?`: ${j.error.message}`:''}catch{}throw new Error(`HTTP ${res.status}${detail}`)}
  if(res.status===204)return null;return res.json();
}

async function syncGoogleEvents(){
  const status=document.getElementById('googleStatus');if(!googleToken){status.textContent='Connect Google Calendar first.';return}
  const now=new Date(),later=new Date(now.getTime()+45*864e5);
  const q=new URLSearchParams({timeMin:now.toISOString(),timeMax:later.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'250'});
  try{
    const json=await calendarApi(`/calendars/primary/events?${q}`);
    const external=(json.items||[]).filter(e=>!e.extendedProperties?.private?.dayforgeSource);
    data.googleEvents=external.map(e=>{
      if(e.start?.dateTime)return {id:e.id,title:e.summary||'Busy',start:e.start.dateTime,end:e.end?.dateTime||e.start.dateTime,allDay:false};
      if(e.start?.date){const start=new Date(`${e.start.date}T00:00:00`),end=e.end?.date?new Date(`${e.end.date}T00:00:00`):new Date(start.getTime()+864e5);return {id:e.id,title:e.summary||'All-day event',start:start.toISOString(),end:end.toISOString(),allDay:true};}
      return null;
    }).filter(Boolean);
    save();status.textContent=`Pulled ${data.googleEvents.length} external event${data.googleEvents.length===1?'':'s'} from your primary Google Calendar.`;renderAll();
  }catch(err){status.textContent=`Calendar pull failed: ${err.message}`}
}

function nextWeekdayDate(targetDay,time){
  const d=new Date();d.setSeconds(0,0);const delta=(targetDay-d.getDay()+7)%7;d.setDate(d.getDate()+delta);const [h,m]=time.split(':').map(Number);d.setHours(h,m,0,0);if(d<new Date()){d.setDate(d.getDate()+7)}return d;
}

function isoWithLocalOffset(d){
  const pad=n=>String(Math.abs(n)).padStart(2,'0');const off=-d.getTimezoneOffset();const sign=off>=0?'+':'-';const oh=Math.floor(Math.abs(off)/60),om=Math.abs(off)%60;
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(oh)}:${pad(om)}`;
}

async function findDayForgeEvent(key){
  const q=new URLSearchParams({privateExtendedProperty:`dayforgeKey=${key}`,maxResults:'10'});
  const json=await calendarApi(`/calendars/primary/events?${q}`);return (json.items||[]).find(e=>e.status!=='cancelled')||null;
}

async function pushDayForgeSchedule(){
  const status=document.getElementById('googleStatus');if(!googleToken){status.textContent='Connect Google Calendar first, then push the schedule.';return}
  const include={class:document.getElementById('syncClasses')?.checked!==false,routine:document.getElementById('syncRoutines')?.checked!==false,meal:document.getElementById('syncMeals')?.checked!==false,meeting:document.getElementById('syncMeetings')?.checked!==false};
  const anchors=[];
  for(const a of data.anchors||[]){if(include[a.kind]===false)continue;anchors.push({day:Number(a.day),time:a.time,title:a.title,kind:a.kind||'routine',duration:Number(a.duration)||60,id:a.id})}
  let created=0,skipped=0,failed=0;status.textContent=`Checking ${anchors.length} DayForge anchors for duplicates…`;
  for(let i=0;i<anchors.length;i++){
    const a=anchors[i];const key=`v10-anchor-${a.id||`${a.day}-${a.time}-${a.title}`}`.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
    try{
      if(await findDayForgeEvent(key)){skipped++;continue}
      const start=nextWeekdayDate(a.day,a.time),end=new Date(start.getTime()+a.duration*60000);
      const body={summary:a.title,start:{dateTime:isoWithLocalOffset(start),timeZone:'America/New_York'},end:{dateTime:isoWithLocalOffset(end),timeZone:'America/New_York'},recurrence:['RRULE:FREQ=WEEKLY;UNTIL=20261212T045959Z'],extendedProperties:{private:{dayforgeSource:'dayforge',dayforgeKey:key,dayforgeKind:a.kind}}};
      await calendarApi('/calendars/primary/events',{method:'POST',body:JSON.stringify(body)});created++;
    }catch(err){failed++;console.error('DayForge push failed',a,err)}
    status.textContent=`Syncing to Google… ${i+1}/${anchors.length}`;
  }
  status.textContent=`Google sync finished: ${created} created, ${skipped} already existed${failed?`, ${failed} failed`:''}.`; 
}

function switchTab(name){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.id===`tab-${name}`));document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name))}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
document.getElementById('refreshBtn').addEventListener('click',()=>{if(googleToken)syncGoogleEvents();else renderAll()});
document.getElementById('googleBtn').addEventListener('click',connectGoogle);
document.getElementById('pushGoogleBtn').addEventListener('click',pushDayForgeSchedule);
document.getElementById('pullGoogleBtn').addEventListener('click',syncGoogleEvents);
document.getElementById('newTaskBtn').addEventListener('click',()=>document.getElementById('taskDialog').showModal());
document.getElementById('cancelTaskBtn').addEventListener('click',()=>document.getElementById('taskDialog').close());
document.getElementById('taskForm').addEventListener('submit',e=>{e.preventDefault();const title=document.getElementById('taskTitle').value.trim();if(!title)return;data.tasks.push({id:uid(),title,course:document.getElementById('taskCourse').value.trim(),due:document.getElementById('taskDue').value||null,minutes:Number(document.getElementById('taskMinutes').value)||45,priority:Number(document.getElementById('taskPriority').value)||2,done:false});save();e.target.reset();document.getElementById('taskMinutes').value=45;document.getElementById('taskPriority').value='2';document.getElementById('taskDialog').close();renderAll()});
document.getElementById('taskFilter').addEventListener('change',renderTasks);
document.getElementById('completeSuggestedBtn').addEventListener('click',()=>{if(!suggestedTaskId)return;const t=data.tasks.find(x=>x.id===suggestedTaskId);if(t){t.done=true;save();renderAll()}});
document.getElementById('startTaskBtn').addEventListener('click',()=>{if(!suggestedTaskId)return;const t=data.tasks.find(x=>x.id===suggestedTaskId);if(t)alert(`Focus target: ${t.title}\n\nSet a ${Math.min(t.minutes,50)} minute timer and just get the first chunk moving.`)});
document.getElementById('savePrefsBtn').addEventListener('click',()=>{data.prefs.workStart=document.getElementById('workStart').value;data.prefs.workEnd=document.getElementById('workEnd').value;data.prefs.bufferMin=Number(document.getElementById('bufferMin').value)||0;data.prefs.maxBlockMin=Math.max(20,Number(document.getElementById('maxBlockMin').value)||60);data.prefs.breakMin=Math.max(0,Number(document.getElementById('breakMin').value)||10);save();renderAll()});
document.getElementById('saveClientBtn').addEventListener('click',()=>{data.prefs.googleClientId=document.getElementById('clientIdInput').value.trim();tokenClient=null;save();document.getElementById('googleStatus').textContent='Client ID saved. Click Connect Google Calendar.'});
document.getElementById('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dayforge-v1-backup.json';a.click();URL.revokeObjectURL(a.href)});
document.getElementById('resetBtn').addEventListener('click',()=>{if(confirm('Reset DayForge and remove all local tasks, anchors, plans, and settings from this browser?')){localStorage.removeItem(KEY);data=structuredClone(defaultData);renderAll()}});

function renderPlanBlocks(day=new Date()){
  const host=document.getElementById('plannedBlocks');if(!host)return;
  const blocks=planForDay(day).sort((a,b)=>a.start-b.start);
  host.innerHTML=blocks.length?blocks.map(b=>`<div class="plan-block"><div class="time">${prettyTime(b.start)}–${prettyTime(b.end)}</div><div><div class="task-title">${escapeHtml(b.title)}</div><div class="kind">${escapeHtml(b.course||'Focus block')}</div></div><button class="ghost remove-plan" data-id="${b.id}" type="button">Remove</button></div>`).join(''):'<div class="empty">No generated work blocks yet. Hit “Generate My Day.”</div>';
  host.querySelectorAll('.remove-plan').forEach(btn=>btn.addEventListener('click',()=>{const k=dateKey(day);data.plans[k]=(data.plans[k]||[]).filter(x=>x.id!==btn.dataset.id);save();renderAll()}));
}

function generateDayPlan({replan=false}={}){
  const now=new Date(), key=dateKey(now), dayStart=startOfDay(now);
  const previous=(data.plans[key]||[]).filter(b=>new Date(b.end)<=now);
  data.plans[key]=replan?previous:[];
  const gaps=availableGaps(now).map(([s,e])=>[Math.max(s,(now-dayStart)/60000),e]).filter(([s,e])=>e-s>=20);
  const open=data.tasks.filter(t=>!t.done&&(!t.due||new Date(t.due)>=now)).sort((a,b)=>taskScore(b,now)-taskScore(a,now));
  const remain=new Map(open.map(t=>[t.id,Math.max(10,Number(t.minutes)||45)]));
  const maxBlock=Math.max(20,Number(data.prefs.maxBlockMin)||60), breakMin=Math.max(0,Number(data.prefs.breakMin)||10);
  const blocks=[...(data.plans[key]||[])];
  for(const gap of gaps){
    let cursor=gap[0];
    while(gap[1]-cursor>=20){
      const candidates=open.filter(t=>(remain.get(t.id)||0)>0);
      if(!candidates.length)break;
      const t=candidates[0];
      const left=remain.get(t.id), chunk=Math.min(maxBlock,left,gap[1]-cursor);
      if(chunk<20 && left>20)break;
      const start=new Date(dayStart.getTime()+cursor*60000), end=new Date(start.getTime()+chunk*60000);
      blocks.push({id:uid(),taskId:t.id,title:t.title,course:t.course||'',start:start.toISOString(),end:end.toISOString()});
      remain.set(t.id,Math.max(0,left-chunk));cursor+=chunk+breakMin;
      // rotate task slightly so one giant task does not consume every gap first
      open.push(open.shift());
    }
  }
  data.plans[key]=blocks;save();renderAll();
  const future=blocks.filter(b=>new Date(b.end)>now).length;
  if(!future)alert('I could not find a clean work block today. Try shortening the transition buffer or extending your work window.');
}

function clearTodayPlan(){data.plans[dateKey(new Date())]=[];save();renderAll()}

function normalizeYear(y){const n=Number(y);return y&&String(y).length===2?2000+n:n||new Date().getFullYear()}
function parseNaturalCapture(text){
  const raw=(text||'').replace(/\r/g,'').trim();const lines=raw.split('\n').map(x=>x.trim()).filter(Boolean);let date=null,time=null,confidence=[];
  const months={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  let m=raw.match(/\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}|\d{2}))?/i);
  if(m){date=new Date(normalizeYear(m[3]),months[m[1].toLowerCase().replace('.','')],Number(m[2]));confidence.push('date');}
  if(!date){m=raw.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|\d{2})\b/);if(m){date=new Date(normalizeYear(m[3]),Number(m[1])-1,Number(m[2]));confidence.push('date')}}
  const tm=raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i)||raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if(tm){let h=Number(tm[1]),min=Number(tm[2]||0);if(tm[3]){const ap=tm[3].toLowerCase();if(ap.startsWith('p')&&h<12)h+=12;if(ap.startsWith('a')&&h===12)h=0}time=[h,min];confidence.push('time')}
  if(date){const [h,min]=time||[23,59];date.setHours(h,min,0,0)}
  const course=(raw.match(/\b(CYBR\s*\d{3}L?|HIST\s*\d{3}|SP\s*\d{3}|AA\s*\d{3}|MUS\s*\d{3}\w?)\b/i)||[])[1]||'';
  const dateLineIndex=lines.findIndex(x=>/\bdue\b/i.test(x)||/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|\d{1,2}[\/-]\d{1,2})/i.test(x));
  let title='';if(dateLineIndex>0)title=lines[dateLineIndex-1];if(!title)title=lines.find(x=>x.length>4&&!/^due\b/i.test(x))||'';
  title=title.replace(/\s+/g,' ').slice(0,140);
  if(title)confidence.push('title');
  return {title,course,due:date?toLocalDateTimeInput(date):'',confidence,raw};
}
function toLocalDateTimeInput(d){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function fillCapture(parsed){document.getElementById('captureTitle').value=parsed.title||'';document.getElementById('captureCourse').value=parsed.course||'';document.getElementById('captureDue').value=parsed.due||'';document.getElementById('captureRaw').value=parsed.raw||'';const c=parsed.confidence?.length||0;document.getElementById('parseConfidence').textContent=c>=3?'Looks solid':c>=2?'Check it':'Needs review'}
function captureTaskObject(){const title=document.getElementById('captureTitle').value.trim();if(!title)return null;return {id:uid(),title,course:document.getElementById('captureCourse').value.trim(),due:document.getElementById('captureDue').value||null,minutes:Number(document.getElementById('captureMinutes').value)||45,priority:2,done:false}}
async function addDeadlineToGoogle(task){if(!task.due)throw new Error('Add a due date first.');if(!googleToken)throw new Error('Connect Google Calendar first.');const start=new Date(task.due),end=new Date(start.getTime()+15*60000);const key=`task-${task.id}`;if(await findDayForgeEvent(key))return 'already existed';const body={summary:`DUE: ${task.title}`,description:`DayForge deadline${task.course?` · ${task.course}`:''}`,start:{dateTime:isoWithLocalOffset(start),timeZone:'America/New_York'},end:{dateTime:isoWithLocalOffset(end),timeZone:'America/New_York'},extendedProperties:{private:{dayforgeSource:'dayforge',dayforgeKey:key,dayforgeKind:'deadline'}}};await calendarApi('/calendars/primary/events',{method:'POST',body:JSON.stringify(body)});return 'created'}
async function addLocalEventToGoogle(event){
  if(!googleToken)throw new Error('Connect Google Calendar first.');
  const start=new Date(event.start),end=new Date(event.end);const key=`event-${event.id}`;
  if(await findDayForgeEvent(key))return 'already existed';
  const body={summary:event.title,description:`DayForge event${event.course?` · ${event.course}`:''}`,start:{dateTime:isoWithLocalOffset(start),timeZone:'America/New_York'},end:{dateTime:isoWithLocalOffset(end),timeZone:'America/New_York'},extendedProperties:{private:{dayforgeSource:'dayforge',dayforgeKey:key,dayforgeKind:'event'}}};
  await calendarApi('/calendars/primary/events',{method:'POST',body:JSON.stringify(body)});return 'created';
}
async function saveCapture(syncGoogle=false){
  const status=document.getElementById('captureStatus');const kind=document.getElementById('captureKind')?.value||'task';
  const title=document.getElementById('captureTitle').value.trim();if(!title){status.textContent='Give it a title first.';return}
  if(kind==='event'){
    const raw=document.getElementById('captureDue').value;if(!raw){status.textContent='Add the event date and time first.';return}
    const mins=Number(document.getElementById('captureMinutes').value)||60;const start=new Date(raw),end=new Date(start.getTime()+mins*60000);
    const event={id:uid(),title,course:document.getElementById('captureCourse').value.trim(),start:start.toISOString(),end:end.toISOString(),kind:'meeting'};data.localEvents.push(event);save();let msg='Event added to DayForge.';
    if(syncGoogle){try{const r=await addLocalEventToGoogle(event);msg+=` Google event ${r}.`}catch(e){msg+=` Calendar not added: ${e.message}`}}status.textContent=msg;renderAll();return;
  }
  const task=captureTaskObject();data.tasks.push(task);save();let msg='Task added to DayForge.';if(syncGoogle){try{const r=await addDeadlineToGoogle(task);msg+=` Google deadline ${r}.`}catch(e){msg+=` Calendar not added: ${e.message}`}}status.textContent=msg;renderAll();
}
async function readCaptureFile(){
  const input=document.getElementById('screenshotInput'),status=document.getElementById('ocrStatus');const file=input.files?.[0];if(!file)return;document.getElementById('ocrBtn').disabled=true;
  try{
    let text='';
    if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
      if(!window.pdfjsLib)throw new Error('PDF library did not load. Check internet and retry.');
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;const pages=Math.min(pdf.numPages,25);
      for(let i=1;i<=pages;i++){status.textContent=`Reading PDF · page ${i}/${pages}`;const page=await pdf.getPage(i),content=await page.getTextContent();text+=content.items.map(x=>x.str).join(' ')+'\n';}
    }else{
      if(!window.Tesseract)throw new Error('OCR library did not load. Check internet and retry.');
      const result=await Tesseract.recognize(file,'eng',{logger:m=>{if(m.status)status.textContent=`${m.status}${m.progress?` · ${Math.round(m.progress*100)}%`:''}`}});text=result.data.text||'';
    }
    fillCapture(parseNaturalCapture(text));status.textContent='File read finished. Review the fields below before saving.';
  }catch(e){status.textContent=`File reading failed: ${e.message}`}finally{document.getElementById('ocrBtn').disabled=false}
}
async function pushTaskDeadlines(){const status=document.getElementById('googleStatus');if(!googleToken){status.textContent='Connect Google first.';return}const tasks=data.tasks.filter(t=>!t.done&&t.due);let made=0,skip=0,fail=0;for(const t of tasks){try{const r=await addDeadlineToGoogle(t);r==='created'?made++:skip++}catch{fail++}}status.textContent=`Deadline sync: ${made} created, ${skip} already existed${fail?`, ${fail} failed`:''}.`}

const screenshotInput=document.getElementById('screenshotInput');
screenshotInput?.addEventListener('change',()=>{const file=screenshotInput.files?.[0],img=document.getElementById('screenshotPreview');if(!file){img.hidden=true;return}if(file.type.startsWith('image/')){img.src=URL.createObjectURL(file);img.hidden=false}else{img.hidden=true}document.getElementById('ocrBtn').disabled=false});
document.getElementById('ocrBtn')?.addEventListener('click',readCaptureFile);
document.getElementById('parseQuickBtn')?.addEventListener('click',()=>fillCapture(parseNaturalCapture(document.getElementById('quickCaptureText').value)));
document.getElementById('saveCaptureBtn')?.addEventListener('click',()=>saveCapture(false));
document.getElementById('saveCaptureGoogleBtn')?.addEventListener('click',()=>saveCapture(true));
document.getElementById('clearCaptureBtn')?.addEventListener('click',()=>{['captureTitle','captureCourse','captureDue','captureRaw','quickCaptureText'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});document.getElementById('captureStatus').textContent='';document.getElementById('parseConfidence').textContent='Waiting'});
document.getElementById('generateDayBtn')?.addEventListener('click',()=>generateDayPlan({replan:false}));
document.getElementById('replanDayBtn')?.addEventListener('click',()=>generateDayPlan({replan:true}));
document.getElementById('clearPlanBtn')?.addEventListener('click',clearTodayPlan);
document.getElementById('pushDeadlinesBtn')?.addEventListener('click',pushTaskDeadlines);
document.getElementById('addAnchorBtn')?.addEventListener('click',()=>{
  const title=document.getElementById('anchorTitle').value.trim();if(!title)return;
  data.anchors.push({id:uid(),day:Number(document.getElementById('anchorDay').value),time:document.getElementById('anchorTime').value||'09:00',title,kind:document.getElementById('anchorKind').value||'routine',duration:Number(document.getElementById('anchorDuration').value)||60});
  document.getElementById('anchorTitle').value='';save();renderAll();
});
document.getElementById('importInput')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed||typeof parsed!=='object')throw new Error('Invalid backup');data={...structuredClone(defaultData),...parsed,prefs:{...defaultData.prefs,...parsed.prefs},tasks:Array.isArray(parsed.tasks)?parsed.tasks:[],anchors:Array.isArray(parsed.anchors)?parsed.anchors:[],localEvents:Array.isArray(parsed.localEvents)?parsed.localEvents:[],googleEvents:Array.isArray(parsed.googleEvents)?parsed.googleEvents:[],plans:parsed.plans&&typeof parsed.plans==='object'?parsed.plans:{}};save();renderAll();alert('DayForge backup imported.');}catch(err){alert(`Could not import backup: ${err.message}`)}finally{e.target.value=''}
});
let deferredInstallPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById('installBtn');if(b)b.disabled=false});
document.getElementById('installBtn')?.addEventListener('click',async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null}else{alert('On iPhone/iPad: open DayForge in Safari, tap Share, then Add to Home Screen. On desktop/Android, your browser may show an Install option in its menu.')}});
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderAll();setInterval(renderToday,60000);
