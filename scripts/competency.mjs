#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDb} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table as textTable} from './lib/format.mjs';
import {page,table,writeOut} from './lib/render.mjs';

export const kinds={
 employees:['code','name','site','active'], roles:['code','name'], skills:['code','name','evidence_required'],
 requirements:['code','role_id','skill_id','minimum_level','minimum_cover'], assignments:['code','employee_id','role_id','starts_on','ends_on'],
 results:['code','employee_id','skill_id','level','assessed_on','expires_on','assessor','evidence','status'],
 training:['code','employee_id','skill_id','due_on','owner','status','evidence']
};
const reads={
 employees:'select code,name,site,active from employees order by code',
 roles:'select code,name from roles order by code', skills:'select code,name,evidence_required from skills order by code',
 requirements:'select q.code,r.name role,s.name skill,q.minimum_level,q.minimum_cover from requirements q join roles r on r.id=q.role_id join skills s on s.id=q.skill_id order by q.code',
 assignments:'select a.code,e.name employee,r.name role,a.starts_on,a.ends_on from assignments a join employees e on e.id=a.employee_id join roles r on r.id=a.role_id order by a.code',
 results:'select r.code,e.name employee,s.name skill,r.level,r.assessed_on,r.expires_on,r.status,r.assessor,r.evidence from results r join employees e on e.id=r.employee_id join skills s on s.id=r.skill_id order by r.code',
 matrix:'select employee_code,employee,site,role,skill,minimum_level,level,readiness,expires_on from competency_matrix order by employee_code,skill',
 'skills-gap':"select employee_code,employee,role,skill,minimum_level,level,readiness from competency_matrix where readiness<>'current' order by employee_code,skill",
 coverage:'select * from coverage order by site,role,skill',
 'single-cover':'select * from coverage where ready<minimum_cover or ready_in_30_days<minimum_cover order by site,role,skill',
 'renewals-due':"select r.code,e.name employee,s.name skill,r.expires_on,r.status from latest_results r join employees e on e.id=r.employee_id join skills s on s.id=r.skill_id where e.active and r.expires_on<=current_date+60 order by r.expires_on,r.code",
 'approval-queue':"select r.code,e.name employee,s.name skill,r.level,r.assessed_on,r.evidence from results r join employees e on e.id=r.employee_id join skills s on s.id=r.skill_id where r.status='pending' order by r.assessed_on,r.code",
 'training-plan':'select * from training_due order by due_on,code',
 'owner-load':"select owner,count(*) open,count(*) filter(where due_on<current_date) overdue from training_due group by owner order by owner",
 attention:'select * from attention order by code,skill,issue',
 compliance:'select * from compliance_checks order by code,skill,rule',
 activity:'select actor,kind,operation,record_id,created_at from audit order by created_at,id',
 'import-history':'select source,kind,code,record_id,created_at from import_records order by created_at,code'
};
export const commands=[...Object.keys(reads),'employee','weekly-review','add','approve-result','revoke-result','complete-training','retire-employee','import','export','draft-training-plan','draft-assessment-review','help'];
function required(v,key){if(v===undefined||v===null||String(v).trim()==='')throw Error(`Required: ${key}`);return String(v).trim();}
function bool(v){if([true,'true'].includes(v))return true;if([false,'false'].includes(v))return false;throw Error('Boolean must be true or false');}
function integer(v,key,min,max){if(!/^\d+$/.test(String(v))||Number(v)<min||Number(v)>max)throw Error(`${key} must be an integer ${min}..${max}`);return Number(v);}
function date(v,key){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v))||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error(`${key} must be a real YYYY-MM-DD date`);return v;}
export async function resolve(db,kind,value){
 if(!kinds[kind])throw Error('Unknown record kind');const term=required(value,kind);
 const exact=await db.query(`select * from ${kind} where lower(code)=lower($1) or id::text=$1`,[term]);if(exact.length===1)return exact[0];
 const rows=await db.query(`select * from ${kind} where starts_with(id::text,$1) ${kinds[kind].includes('name')?'or position(lower($1) in lower(name))>0':''} order by code`,[term]);
 if(rows.length!==1)throw Error(rows.length?`Ambiguous ${kind}: ${rows.map(r=>r.code+' '+(r.name||'')+' '+r.id).join('; ')}`:`No ${kind} match: ${term}`);return rows[0];
}
async function audit(db,actor,kind,before,after,operation){await db.query('insert into audit(actor,kind,record_id,operation,before_record,after_record) values($1,$2,$3,$4,$5,$6)',[actor,kind,after.id,operation,before,after]);}
async function insert(db,kind,input,actor){
 if(!kinds[kind])throw Error('Unknown kind: '+kind);
 const allowed=new Set(kinds[kind].map(k=>k.replace(/_id$/,'')));for(const key of Object.keys(input))if(!allowed.has(key))throw Error('Unknown field: '+key);
 const data={code:required(input.code,'code')};if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(data.code))throw Error('Invalid code');
 for(const key of kinds[kind].slice(1)){
  const raw=input[key.replace(/_id$/,'')];
  if(key.endsWith('_id')){const type={employee_id:'employees',role_id:'roles',skill_id:'skills'}[key];data[key]=(await resolve(db,type,raw)).id;}
  else if(['active','evidence_required'].includes(key))data[key]=raw===undefined?true:bool(raw);
  else if(['minimum_level','level','minimum_cover'].includes(key))data[key]=integer(raw??(key==='minimum_cover'?2:undefined),key,key==='level'?0:1,key==='minimum_cover'?10000:5);
  else if(['ends_on','expires_on'].includes(key))data[key]=raw?date(raw,key):null;
  else if(['starts_on','assessed_on','due_on'].includes(key))data[key]=date(required(raw,key),key);
  else if(key==='status')data[key]=raw??(kind==='results'?'pending':'open');
  else if(key==='evidence')data[key]=String(raw??'').trim();
  else data[key]=required(raw,key);
 }
 if(kind==='results'){
  if(!['pending','approved','revoked'].includes(data.status))throw Error('Invalid result status');
  const today=(await db.query('select current_date::text today'))[0].today;
  if(data.assessed_on>today)throw Error('Assessment date cannot be in the future');
  if(data.status==='approved'){const skill=await resolve(db,'skills',data.skill_id);if(skill.evidence_required&&!data.evidence)throw Error('Approved assessment requires evidence');}
 }
 if(kind==='assignments'){
  const overlap=await db.query("select code from assignments where employee_id=$1 and role_id=$2 and starts_on<=coalesce($4::date,'infinity'::date) and coalesce(ends_on,'infinity'::date)>=$3::date",[data.employee_id,data.role_id,data.starts_on,data.ends_on]);
  if(overlap.length)throw Error('Overlapping role assignment: '+overlap[0].code);
 }
 if(kind==='training'&&data.status!=='open')throw Error('New training must be open; complete it with evidence separately');
 const keys=Object.keys(data);const [row]=await db.query(`insert into ${kind}(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(data));await audit(db,actor,kind,null,row,'add');return row;
}
async function workbookRows(file,sheet){
 if(/\.csv$/i.test(file))return parseCsv(fs.readFileSync(file,'utf8'));
 if(!/\.xlsx$/i.test(file))throw Error('Import files must be CSV or XLSX');
 const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);const ws=sheet?workbook.getWorksheet(sheet):workbook.worksheets[0];if(!ws)throw Error('Missing worksheet');
 const cellText=c=>{const v=c.value;if(v===null)return '';if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='object'){if(v.formula||v.sharedFormula)throw Error('Formula cells must be exported as values');if(v.richText)return v.richText.map(x=>x.text).join('');if(v.text)return v.text;throw Error('Unsupported spreadsheet cell');}return String(v);};
 const csv=[];ws.eachRow(row=>{const values=[];for(let i=1;i<=ws.columnCount;i++)values.push('"'+cellText(row.getCell(i)).replaceAll('"','""')+'"');csv.push(values.join(','));});return parseCsv(csv.join('\n'));
}
async function importAg5(db,opts,actor){
 const manifestPath=path.resolve(required(opts.manifest,'manifest'));const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));const source=required(opts.source,'source');
 if(!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Manifest needs files');
 const summary=[];
 for(const entry of manifest.files){
  if(!kinds[entry.kind]||!entry.map||typeof entry.map!=='object')throw Error('Manifest needs a known kind and column map');
  const rows=await workbookRows(path.resolve(path.dirname(manifestPath),entry.file),entry.sheet);let added=0,unchanged=0;
  for(const original of rows){
   const mapped={};for(const [field,column] of Object.entries(entry.map)){if(!(column in original))throw Error(`Missing column ${column}`);mapped[field]=original[column];}
   const code=required(mapped.code,'mapped code');const old=await db.query('select * from import_records where source=$1 and kind=$2 and code=$3',[source,entry.kind,code]);
   if(old.length){const same=(await db.query('select $1::jsonb=$2::jsonb same',[old[0].mapped,mapped]))[0].same;if(!same)throw Error(`Changed duplicate ${entry.kind}/${code}; reconcile before importing`);unchanged++;continue;}
   const record=await insert(db,entry.kind,mapped,actor);
   await db.query('insert into import_records(source,kind,code,original,mapped,record_id) values($1,$2,$3,$4,$5,$6)',[source,entry.kind,code,original,mapped,record.id]);added++;
  }
  summary.push({kind:entry.kind,added,unchanged});
 }
 return summary;
}
export async function run(db,command,opts={},args=[]){
 const mutationOptions=['actor','dry-run'];
 const optionSets={employee:['employee'],export:['file'],import:[...mutationOptions,'manifest','source'],add:[...mutationOptions,'kind',...Object.values(kinds).flat().map(k=>k.replace(/_id$/,''))],'approve-result':[...mutationOptions,'code','note'],'revoke-result':[...mutationOptions,'code','note'],'complete-training':[...mutationOptions,'code','evidence'],'retire-employee':[...mutationOptions,'code']};
 const allowed=new Set(['json',...(optionSets[command]||[])]);
 for(const key of Object.keys(opts))if(!allowed.has(key))throw Error('Unknown option for '+command+': '+key);
 if(args.length>(['employee','import','approve-result','revoke-result','complete-training','retire-employee'].includes(command)?1:0))throw Error('Unexpected positional argument');

 if(command==='help')return commands.map(command=>({command}));
 if(reads[command])return db.query(reads[command]);
 if(command==='employee'){
  const e=await resolve(db,'employees',args[0]||opts.employee);return {employee:e,matrix:await db.query('select * from competency_matrix where employee_id=$1 order by skill',[e.id]),results:await db.query('select * from results where employee_id=$1 order by assessed_on,created_at',[e.id]),training:await db.query('select * from training where employee_id=$1 order by due_on',[e.id])};
 }
 if(command==='weekly-review')return {coverage:await run(db,'coverage'),attention:await run(db,'attention'),training:await run(db,'training-plan')};
 if(command==='export'){
  const snapshot={format:'workforce-competency-v1',exported_at:new Date().toISOString(),records:{}};
  for(const kind of [...Object.keys(kinds),'audit','import_records'])snapshot.records[kind]=await db.query(`select * from ${kind} order by id`);
  if(opts.file){fs.writeFileSync(path.resolve(opts.file),JSON.stringify(snapshot,null,2)+'\n',{flag:'wx',mode:0o600});return {file:path.resolve(opts.file),counts:Object.fromEntries(Object.entries(snapshot.records).map(([k,v])=>[k,v.length]))};}return snapshot;
 }
 if(command==='draft-training-plan'||command==='draft-assessment-review'){
  const sections=command==='draft-training-plan'?[['Training due',await run(db,'training-plan')],['Skill gaps',await run(db,'skills-gap')]]:[['Assessments awaiting review',await run(db,'approval-queue')],['Record checks',await run(db,'compliance')]];
  const file=writeOut('drafts',command+'-'+Date.now(),page({title:command==='draft-training-plan'?'Training plan working draft':'Assessment review working draft',subtitle:'Fictional demo if seeded. A supervisor must review before use. No authorisation to work.',sections:sections.map(([title,rows])=>({title,html:table(rows)}))}));return {file};
 }
 const mutations=['add','approve-result','revoke-result','complete-training','retire-employee','import'];
 if(!mutations.includes(command))throw Error('Unknown command: '+command);
 const actor=required(opts.actor,'actor');await db.exec('BEGIN');
 try{
  let out;
  if(command==='add'){
   const kind=required(opts.kind,'kind');const input=Object.fromEntries(Object.entries(opts).filter(([k])=>!['kind','actor','dry-run','json'].includes(k)));out=await insert(db,kind,input,actor);
  }else if(command==='import'){
   if(args[0]!=='ag5')throw Error('Use import ag5');out=await importAg5(db,opts,actor);
  }else{
   const kind=command==='complete-training'?'training':command==='retire-employee'?'employees':'results';
   const before=await resolve(db,kind,args[0]||opts.code);let after;
   if(command==='approve-result'){
    if(before.status!=='pending')throw Error('Only pending assessments can be approved');
    const skill=await resolve(db,'skills',before.skill_id);if(skill.evidence_required&&!before.evidence)throw Error('Evidence required before approval');
    if(!before.assessor)throw Error('Assessor required');
    [after]=await db.query("update results set status='approved',review_note=$1 where id=$2 returning *",[required(opts.note,'note'),before.id]);
   }else if(command==='revoke-result'){
    if(before.status==='revoked')throw Error('Assessment is already revoked');
    [after]=await db.query("update results set status='revoked',review_note=$1 where id=$2 returning *",[required(opts.note,'note'),before.id]);
   }else if(command==='complete-training'){
    if(before.status!=='open')throw Error('Training is not open');
    [after]=await db.query("update training set status='completed',evidence=$1 where id=$2 returning *",[required(opts.evidence,'evidence'),before.id]);
   }else{
    if(!before.active)throw Error('Employee already inactive');
    [after]=await db.query('update employees set active=false where id=$1 returning *',[before.id]);
   }
   await audit(db,actor,kind,before,after,command);out=after;
  }
  await db.exec(opts['dry-run']?'ROLLBACK':'COMMIT');return opts['dry-run']?{dry_run:true,would_write:out}:out;
 }catch(error){await db.exec('ROLLBACK');throw error;}
}
export function output(value){
 if(Array.isArray(value))return value.length?textTable(value,Object.keys(value[0]).map(key=>({key,label:key,width:55,format:v=>typeof v==='object'&&v!==null?JSON.stringify(v):v}))):'(none)';
 if(value&&typeof value==='object')return Object.entries(value).map(([key,v])=>Array.isArray(v)?`${key}\n${output(v)}`:`${key}: ${typeof v==='object'?JSON.stringify(v):v}`).join('\n');return String(value);
}
function parse(argv){const opts={},args=[];for(const a of argv){if(a.startsWith('--')){const at=a.indexOf('=');if(at<0){if(!['--json','--dry-run'].includes(a))throw Error('Flags use --name=value');if(a.slice(2) in opts)throw Error('Duplicate option');opts[a.slice(2)]=true;}else{const k=a.slice(2,at).replaceAll('-','_');if(k in opts)throw Error('Duplicate option');opts[k]=a.slice(at+1);}}else args.push(a);}return {opts,args};}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{const command=process.argv[2]||'help';const {opts,args}=parse(process.argv.slice(3));db=await getDb();const result=await run(db,command,opts,args);console.log(opts.json?JSON.stringify(result,null,2):output(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}
}
