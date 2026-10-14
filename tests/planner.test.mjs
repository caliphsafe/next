import test from 'node:test';
import assert from 'node:assert/strict';
import {seed as emptySeed,stateSchema,schedule,ranked,blocked,studioFor,earned} from '../lib/model.ts';
function seed(){const s=emptySeed();const ids=['sample-a','sample-b','sample-c','sample-d','sample-e','sample-f','album','release-one','sample-g','sample-h','event','sample-j','release-two'];s.projects=ids.map((id,i)=>({id,title:'Test campaign '+i,category:['album','release-one','release-two'].includes(id)?'Music':'Client',amount:i===1?300:0,certainty:'Agreed',deadline:i===0?'2026-10-19':'',deadlineNote:'',priority:'Auto',status:'Active',notes:'Test data only',dependency:id==='release-two'?'release-one':'',tasks:[0,1,2].map(j=>({id:id+'-'+j,title:'Test mission '+j,minutes:45,done:false}))}));s.order=ids;s.settings.studioOverrideDate='2026-10-19';s.settings.studioSkipDate='2026-10-20';s.settings.studioOverrideTitle='Test recording session';return s;}
test('initial amounts, completion state, and schema',()=>{const s=seed();assert.equal(s.projects.length,13);assert.equal(s.projects.find(p=>p.id==='sample-b').amount,300);assert.equal(s.projects.reduce((n,p)=>n+p.amount,0),300);assert.equal(earned(s),0);assert.equal(stateSchema.safeParse(s).success,true)});
test('priority override recalibrates work, waiting projects cannot enter queue',()=>{const s=seed();s.projects.find(p=>p.id==='sample-j').priority='Next';assert.equal(schedule(s,'2026-10-13').find(x=>x.kind==='work').projectId,'sample-j');s.projects.find(p=>p.id==='sample-j').status='Waiting';assert.notEqual(schedule(s,'2026-10-13').find(x=>x.kind==='work').projectId,'sample-j')});
test('manual order controls work without displacing studio',()=>{const s=seed();s.manual=true;s.order=['sample-d',...s.order.filter(x=>x!=='sample-d')];assert.equal(schedule(s,'2026-10-13').find(x=>x.kind==='work').projectId,'sample-d');assert.equal(schedule(s,'2026-10-13').find(x=>x.kind==='studio').start,1080)});
test('Second release stays locked until First release is finished',()=>{const s=seed(),p=s.projects.find(p=>p.id==='release-two');assert.ok(blocked(p,s));s.projects.find(p=>p.id==='release-one').status='Done';assert.equal(blocked(p,s),false)});
test('shower restriction, no work after 5, no overlapping scheduled blocks',()=>{for(const wake of ['06:00','06:15','07:00','09:00'])for(const date of ['2026-10-13','2026-10-14','2026-10-17']){const s=seed();s.settings.wake=wake;const plan=schedule(s,date),shower=plan.find(x=>x.id==='shower');if(shower)assert.ok(shower.start<=435||shower.start>=600);for(const x of plan.filter(x=>x.kind==='work'))assert.ok(x.end<=1020);for(let i=1;i<plan.length;i++)assert.ok(plan[i].start>=plan[i-1].end,`${date} ${wake}: ${plan[i-1].title} overlaps ${plan[i].title}`)}});
test('Special session replaces Tuesday and keeps three studio days that week',()=>{const s=seed();assert.ok(studioFor(s,'2026-10-19'));assert.equal(studioFor(s,'2026-10-20'),null);assert.ok(studioFor(s,'2026-10-22'));assert.ok(studioFor(s,'2026-10-24'))});
test('daily capacity includes already completed work',()=>{const s=seed(),p=s.projects.find(p=>p.id==='sample-a'),t=p.tasks[0];t.done=true;s.events.push({id:'task:'+t.id,title:t.title,date:'2026-10-13',xp:35,kind:'task'});const plan=schedule(s,'2026-10-13');assert.ok(plan.some(x=>x.taskId===t.id));assert.ok(plan.filter(x=>x.kind==='work').reduce((a,x)=>a+x.end-x.start,0)<=s.settings.focusHours*60)});
test('invalid amounts and task durations cannot be saved',()=>{const s=seed();s.projects[0].amount=-1;assert.equal(stateSchema.safeParse(s).success,false);s.projects[0].amount=0;s.projects[0].tasks[0].minutes=0;assert.equal(stateSchema.safeParse(s).success,false)});

test('long tasks rotate through three campaigns before returning to the first',()=>{
 const s=seed();s.projects.forEach(p=>p.tasks.forEach(t=>t.minutes=240));
 const work=schedule(s,'2026-10-13').filter(x=>x.kind==='work');
 assert.equal(new Set(work.slice(0,3).map(x=>x.projectId)).size,3);
 assert.equal(work[3].projectId,work[0].projectId);
 assert.ok(work.every(x=>x.end-x.start<=40));
 s.settings.projectsPerDay=4;assert.equal(new Set(schedule(s,'2026-10-13').filter(x=>x.kind==='work').slice(0,4).map(x=>x.projectId)).size,4);
});
test('assisted estimates change duration only when explicitly supplied',()=>{
 const s=seed(),p=s.projects[0];p.workMode='ChatGPT';p.tasks[0].assistedMinutes=15;
 let work=schedule(s,'2026-10-13').filter(x=>x.kind==='work');assert.equal(work[0].end-work[0].start,15);
 p.workMode='Solo';work=schedule(s,'2026-10-13').filter(x=>x.kind==='work');assert.equal(work[0].end-work[0].start,40);
});
test('logged blocks reserve daily capacity, preserve unfinished tasks, and advance rotation',()=>{
 const s=seed(),p=s.projects[0],t=p.tasks[0];s.sessions.push({id:'block',projectId:p.id,taskId:t.id,title:t.title,date:'2026-10-13',minutes:25});
 const work=schedule(s,'2026-10-13').filter(x=>x.kind==='work');
 assert.equal(work[0].completed,true);assert.equal(work[0].end-work[0].start,25);
 assert.notEqual(work.find(x=>!x.completed).projectId,p.id);assert.equal(t.done,false);
 assert.ok(work.reduce((a,x)=>a+x.end-x.start,0)<=s.settings.focusHours*60);
 assert.equal(work.filter(x=>!x.completed&&x.taskId===t.id).reduce((a,x)=>a+x.end-x.start,0),20);
});
test('legacy saved workspaces load with new defaults and unsafe chat URLs are rejected',()=>{
 const s=seed();delete s.sessions;delete s.settings.projectsPerDay;const parsed=stateSchema.parse(s);
 assert.equal(parsed.settings.projectsPerDay,3);assert.deepEqual(parsed.sessions,[]);assert.equal(parsed.projects[0].conversation.url,'');
 for(const url of ['javascript:alert(1)','https://chatgpt.com.evil.test/c/1','https://user:pass@chatgpt.com/c/1']){parsed.projects[0].conversation.url=url;assert.equal(stateSchema.safeParse(parsed).success,false);}
 parsed.projects[0].conversation.url='https://chatgpt.com/c/test';assert.equal(stateSchema.safeParse(parsed).success,true);
});
test('private context defaults apply once without overwriting saved edits or changed missions',async()=>{
 const {hydrateState}=await import('../lib/model.ts');const s=seed(),p=s.projects[0];const presets={[p.id]:{workMode:'ChatGPT',conversation:{title:'Test thread'},taskEstimates:{[p.tasks[0].id]:{title:p.tasks[0].title,minutes:20}}}};
 const loaded=hydrateState(s,presets);assert.equal(loaded.projects[0].conversation.title,'Test thread');assert.equal(loaded.projects[0].tasks[0].assistedMinutes,20);
 loaded.projects[0].conversation.title='My updated thread';assert.equal(hydrateState(loaded,presets).projects[0].conversation.title,'My updated thread');
});

test('11am early finish refills from next ranked campaigns without charging old estimates',()=>{
 const s=seed(),date='2026-10-14';
 const initial=ranked(s,date).filter(p=>p.category!=='Music').slice(0,3);
 for(const p of initial)for(const t of p.tasks){t.done=true;s.events.push({id:'task:'+t.id,title:t.title,date,xp:35,kind:'task',atMinute:650});}
 s.settings.focusHours=.5;
 const work=schedule(s,date,{minute:660}).filter(x=>x.kind==='work');
 assert.ok(work.length>0);assert.equal(work[0].start,660);
 assert.ok(work.every(x=>!initial.some(p=>p.id===x.projectId)&&!x.completed));
 assert.ok(work.reduce((n,x)=>n+x.end-x.start,0)>30,'Live refill is not blocked by forecast target');
 assert.equal(work[0].projectId,ranked(s,date).find(p=>p.category!=='Music'&&p.tasks.some(t=>!t.done)).id);
});
test('planning rolls beyond the initial roster when short mission queues are exhausted',()=>{
 const s=seed();s.projects.forEach(p=>{p.tasks=p.tasks.slice(0,1);p.tasks[0].minutes=5;});
 const work=schedule(s,'2026-10-14',{minute:660}).filter(x=>x.kind==='work');
 assert.ok(new Set(work.map(x=>x.projectId)).size>3);
});
test('manual reranking and waiting status immediately change live upcoming work',()=>{
 const s=seed(),date='2026-10-14',p=s.projects.find(p=>p.id==='sample-j');
 s.manual=true;s.order=[p.id,...s.order.filter(id=>id!==p.id)];
 assert.equal(schedule(s,date,{minute:660}).find(x=>x.kind==='work').projectId,p.id);
 p.status='Waiting';assert.notEqual(schedule(s,date,{minute:660}).find(x=>x.kind==='work').projectId,p.id);
});
test('a running mission remains pinned while the next ranked mission changes',()=>{
 const s=seed(),date='2026-10-14',p=s.projects[0],promoted=s.projects.find(p=>p.id==='sample-j');
 promoted.priority='Next';
 const work=schedule(s,date,{minute:660,active:{projectId:p.id,taskId:p.tasks[0].id,minutes:20}}).filter(x=>x.kind==='work');
 assert.equal(work[0].active,true);assert.equal(work[0].projectId,p.id);assert.equal(work[0].end,680);
 assert.equal(work[1].projectId,promoted.id);
});
test('live time never backfills the morning or overlaps lunch, breaks, studio, and shutdown',()=>{
 for(const minute of [480,660,665,719,720,750,780,970,975,1020]){
  const s=seed(),date='2026-10-14';s.events.push({id:'task:finished',title:'Finished',date,xp:35,kind:'task',atMinute:660});
  const plan=schedule(s,date,{minute}),work=plan.filter(x=>x.kind==='work');
  assert.ok(work.every(x=>x.start>=minute&&x.end<=975));
  if(minute>=975)assert.equal(work.length,0);
  if(minute===665)assert.equal(work[0].start,670);
  if(minute===750)assert.equal(work[0].start,780);
  for(let i=1;i<plan.length;i++)assert.ok(plan[i].start>=plan[i-1].end,`${minute}: ${plan[i-1].title} overlaps ${plan[i].title}`);
 }
});
test('New York live clock follows daylight saving time and uses midnight as zero',async()=>{
 const {minuteOfDay}=await import('../lib/model.ts');
 assert.equal(minuteOfDay(new Date('2026-10-14T15:00:00Z')),660);
 assert.equal(minuteOfDay(new Date('2026-12-14T16:00:00Z')),660);
 assert.equal(minuteOfDay(new Date('2026-10-14T04:00:00Z')),0);
});
