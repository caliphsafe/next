import { z } from 'zod';
const id = z.string().min(1).max(120);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const taskSchema = z.object({ id, title: z.string().min(1).max(400), minutes: z.number().int().min(5).max(480), done: z.boolean() });
export const projectSchema = z.object({
 id, title: z.string().min(1).max(160), category: z.enum(['Client','Business','Music','Personal']),
 amount: z.number().min(0).max(10000000), certainty: z.enum(['Agreed','Potential','Unknown']),
 deadline: z.union([date,z.literal('')]), deadlineNote: z.string().max(500),
 priority: z.enum(['Next','High','Auto','Later']), status: z.enum(['Active','Waiting','Paused','Done']),
 notes: z.string().max(10000), dependency: z.string().max(120), tasks: z.array(taskSchema).max(200),
});
export const stateSchema = z.object({
 projects: z.array(projectSchema).max(300),
 inbox: z.array(z.object({id,text:z.string().min(1).max(10000),date})).max(500),
 events: z.array(z.object({id,date,title:z.string().max(400),xp:z.number().int().min(0).max(500),kind:z.enum(['task','routine','project','focus'])})).max(20000),
 payments: z.array(z.object({id,projectId:id,date,amount:z.number().positive().max(10000000)})).max(5000),
 settings: z.object({displayName:z.string().max(80).default('You'),studioOverrideDate:z.union([date,z.literal('')]).default(''),studioSkipDate:z.union([date,z.literal('')]).default(''),studioOverrideTitle:z.string().max(160).default('Special studio session'),studioOverrideStart:z.number().int().min(0).max(20).default(18),wake:z.string().regex(/^\d{2}:\d{2}$/),bed:z.string().regex(/^\d{2}:\d{2}$/),goal:z.number().min(1).max(10000000),water:z.number().int().min(1).max(12),energy:z.enum(['Gentle','Balanced','Focused']),focusHours:z.number().min(.5).max(6),studioDays:z.array(z.number().int().min(0).max(6)).max(3),studioWeekday:z.number().int().min(18).max(19),studioWeekend:z.number().int().min(8).max(12),reward:z.string().max(200)}),
 order: z.array(id).max(300), manual:z.boolean(),
});
export type State = z.infer<typeof stateSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Event = State['events'][number];
export function dayKey(now = new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export const addDays=(date:string,n:number)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export const weekday=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay();
export function blocked(p:Project,s:State) {return !!p.dependency && s.projects.some(q=>q.id===p.dependency&&q.status!=='Done');}
export function score(p:Project,date:string) {
 const days=p.deadline?(Date.parse(p.deadline)-Date.parse(date))/86400000:999;
 const urgency=days<=0?1000:days<=7?500-days*25:days<=21?180-days*4:0;
 return urgency + (p.priority==='Next'?10000:p.priority==='High'?300:p.priority==='Later'?-500:0) + (p.certainty==='Agreed'?80:0) + Math.min(p.amount/100,60) + (p.category==='Client'?30:0);
}
export function ranked(s:State,date:string) {return [...s.projects].sort((a,b)=>{
 const unavailable=(p:Project)=>p.status!=='Active'||blocked(p,s)?1:0;
 if(unavailable(a)!==unavailable(b)) return unavailable(a)-unavailable(b);
 if(s.manual) return (s.order.indexOf(a.id)<0?999:s.order.indexOf(a.id))-(s.order.indexOf(b.id)<0?999:s.order.indexOf(b.id));
 return score(b,date)-score(a,date);
});}
export function why(p:Project,s:State,date:string) {
 if(p.status!=='Active') return p.status==='Done'?'Campaign complete':`${p.status} · excluded from daily work`;
 if(blocked(p,s)) return `Waiting for ${s.projects.find(q=>q.id===p.dependency)?.title}`;
 if(s.manual) return 'Your custom order';
 if(p.priority==='Next') return 'Your next priority';
 if(p.deadline) return `Due ${p.deadline.slice(5)}${p.deadlineNote?' · proposed target':''}`;
 if(p.certainty==='Agreed'&&p.amount) return 'Agreed payment potential';
 return p.priority==='High'?'Priority boost':p.priority==='Later'?'Intentionally later':'Long-term progress';
}
export type Slot={id:string,start:number,end:number,title:string,detail:string,kind:'work'|'routine'|'break'|'studio',projectId?:string,taskId?:string};
export function studioFor(s:State,date:string) {
 const dow=weekday(date);
 if(date===s.settings.studioOverrideDate) return {start:s.settings.studioOverrideStart*60,title:s.settings.studioOverrideTitle,detail:'4 hours · special session; confirm timing with collaborators'};
 if(date===s.settings.studioSkipDate) return null;
 if(!s.settings.studioDays.includes(dow)) return null;
 return {start:(dow===0||dow===6?s.settings.studioWeekend:s.settings.studioWeekday)*60,title:'Studio session',detail:'4 hours · advance one track or recording milestone'};
}
export function schedule(s:State,date:string):Slot[] {
 const slots:Slot[]=[]; const [h,m]=s.settings.wake.split(':').map(Number);const wake=Math.max(0,Math.min(1439,h*60+m));
 const add=(id:string,start:number,end:number,title:string,detail:string,kind:Slot['kind']='routine')=>slots.push({id,start,end,title,detail,kind});
 const dow=weekday(date), weekend=dow===0||dow===6, studio=studioFor(s,date);
 add('wake',wake,wake+20,'Morning reset','Wake up, personal time, and a water check-in');
 const shower=wake+60<=435?wake+60:Math.max(600,wake+20);
 if([1,3,5].includes(dow)&&shower<=435&&shower-wake>=60) add('workout',wake+20,wake+60,'Workout','Build consistency · adjust intensity to your day');
 else if(shower<=435&&shower-wake>=40) add('movement',wake+20,wake+40,'Light movement','An easy start');
 add('shower',shower,shower+30,'Shower',shower<=435?'Before your 7:15 a.m. cutoff':'After 10 a.m.');
 const breakfast=shower>480?wake+20:shower+30;
 if(breakfast+25<=shower||breakfast>=shower+30) add('breakfast',breakfast,breakfast+25,'Breakfast','Eat and prepare for the day');
 let lunch=720; if(shower<780&&shower+30>720) lunch=shower+30;
 add('lunch',lunch,lunch+60,'Lunch & reset','Step away from work','break');
 let ready=Math.max(480,shower+30,breakfast+25);
 if(shower>435&&[1,3,5].includes(dow)&&ready+30<=720){add('workout',ready,ready+30,'Workout','A shorter session for a later start');ready+=30;}
 if(!weekend){
  const eligible=ranked(s,date).filter(p=>p.status==='Active'&&!blocked(p,s)&&p.category!=='Music'&&p.tasks.some(t=>!t.done)).slice(0,2);
  const finished=s.projects.flatMap(p=>p.tasks.filter(t=>t.done&&s.events.some(e=>e.id==='task:'+t.id&&e.date===date)).map(t=>({p,t})));
  const tasks=[...finished,...eligible.flatMap(p=>p.tasks.filter(t=>!t.done).map(t=>({p,t})))];
  let cursor=ready,budget=Math.round(s.settings.focusHours*60); const cap=s.settings.energy==='Gentle'?45:s.settings.energy==='Focused'?90:75;
  for(const {p,t} of tasks){
   let remaining=t.minutes;
   while(remaining>0&&budget>=10){
    if(cursor>=lunch&&cursor<lunch+60)cursor=lunch+60;
    const boundary=cursor<lunch?lunch:975;
    const len=Math.min(remaining,cap,budget,boundary-cursor);
    if(len<10){if(cursor<lunch){cursor=lunch+60;continue;}break;}
    slots.push({id:`${t.id}-${cursor}`,start:cursor,end:cursor+len,title:t.title,detail:p.title,kind:'work',projectId:p.id,taskId:t.id});
    remaining-=len;budget-=len;cursor+=len;
    if(cursor+15<=boundary){add(`break-${cursor}`,cursor,cursor+15,'Take a breather','Water, stretch, step away','break');cursor+=15;}
   }
   if(cursor>=975||budget<10)break;
  }
  if(ready<1020)add('shutdown',Math.max(975,ready),1020,'Close the day','Capture loose ends and choose tomorrow’s next step');
 }
 if(studio){
  for(let i=slots.length-1;i>=0;i--) if(slots[i].start<studio.start+240&&slots[i].end>studio.start)slots.splice(i,1);
  const music=ranked(s,date).find(p=>p.category==='Music'&&p.status==='Active'&&!blocked(p,s)&&p.tasks.some(t=>!t.done));
  slots.push({id:'studio',start:studio.start,end:studio.start+240,title:studio.title,detail:music?music.title+' · '+music.tasks.find(t=>!t.done)!.title:studio.detail,kind:'studio',projectId:music?.id});
  if(weekend)add('studio-meal',studio.start+240,studio.start+270,'Meal & recovery','Reset after the session','break');
 }
 add('dinner',studio&&!weekend?1020:1140,studio&&!weekend?1065:1185,'Dinner',studio&&!weekend?'Before studio · leave room for travel':'A proper evening meal');
 const [bh,bm]=s.settings.bed.split(':').map(Number);const bed=bh*60+bm+(bh<12?1440:0);
 add('winddown',Math.min(bed,Math.max(bed-45,studio?studio.start+240:0)),bed,'Wind down','Protect your bedtime','break');
 return slots.sort((a,b)=>a.start-b.start);
}
export const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export const clock=(min:number)=>{const h=Math.floor(min/60)%24,m=min%60;return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;};
export function earned(s:State){return s.events.reduce((n,e)=>n+e.xp,0);}
export function seed():State {
 return {projects:[],inbox:[],events:[],payments:[],order:[],manual:false,settings:{displayName:'You',studioOverrideDate:'',studioSkipDate:'',studioOverrideTitle:'Special studio session',studioOverrideStart:18,wake:'06:00',bed:'23:00',goal:5000,water:6,energy:'Balanced',focusHours:4.5,studioDays:[2,4,6],studioWeekday:18,studioWeekend:10,reward:'Choose a personal reward for reaching level 5'}};
}
