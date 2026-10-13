import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { workspaces } from '../../../db/schema';
import { and,eq } from 'drizzle-orm';
import { seed,stateSchema } from '../../../lib/model';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:'Sign in to load your workspace.'},401);
 const db=getDb();
 await db.insert(workspaces).values({userId:user.userId,payload:JSON.stringify(env.INITIAL_WORKSPACE_JSON ? stateSchema.parse(JSON.parse(env.INITIAL_WORKSPACE_JSON)) : seed()),revision:0}).onConflictDoNothing();
 const [row]=await db.select().from(workspaces).where(eq(workspaces.userId,user.userId));
 const stored=JSON.parse(row.payload);
  const initial=env.INITIAL_WORKSPACE_JSON?stateSchema.parse(JSON.parse(env.INITIAL_WORKSPACE_JSON)):seed();
  return json({state:stateSchema.parse({...stored,settings:{...initial.settings,...stored.settings}}),revision:row.revision});
}
export async function PUT(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Sign in to save changes.'},401);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Invalid origin.'},403);
 const raw=await req.text();if(raw.length>2000000)return json({error:'Workspace too large.'},413);
 let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid request.'},400)}
 const parsed=stateSchema.safeParse(body.state);
 if(!parsed.success||!Number.isInteger(body.revision)||body.revision<0)return json({error:'Invalid workspace data.'},400);
 const rows=await getDb().update(workspaces).set({payload:JSON.stringify(parsed.data),revision:body.revision+1}).where(and(eq(workspaces.userId,user.userId),eq(workspaces.revision,body.revision))).returning({revision:workspaces.revision});
 if(!rows.length)return json({error:'This workspace changed on another device. Reload to get the latest version.'},409);
 return json({revision:rows[0].revision});
}
