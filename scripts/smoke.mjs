import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {run,commands,resolve} from './competency.mjs';
import {parseCsv} from './lib/csv.mjs';
import {page,table} from './lib/render.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'competency-test-'));
// Tests never connect to a working database, even when the shell has credentials.
delete process.env.DATABASE_URL;process.env.DATA_DIR=path.join(temp,'db');process.env.OUTPUT_DIR=temp;
let testSchema;
if(process.env.TEST_DATABASE_URL){
 const url=new URL(process.env.TEST_DATABASE_URL);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('TEST_DATABASE_URL must point to a disposable local test server');
 testSchema='competency_test_'+process.pid+'_'+Date.now();url.searchParams.set('options','-csearch_path='+testSchema);process.env.DATABASE_URL=url.toString();
}
const db=await getDb();
if(testSchema)await db.exec('create schema '+testSchema);
const seen=new Set();
const call=async(c,o={},a=[])=>{seen.add(c);return run(db,c,o,a);};
const actor={actor:'Smoke reviewer'};
const count=async t=>Number((await db.query(`select count(*) n from ${t}`))[0].n);
try{
 assert.equal((await migrate(db)).ran.length,1);assert.equal((await migrate(db)).ran.length,0);
 const seed=fs.readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8');await db.exec(seed);await db.exec(seed);assert.equal(await count('employees'),4);assert.equal(await count('results'),6);
 for(const c of ['employees','roles','skills','requirements','assignments','results','matrix','skills-gap','coverage','single-cover','renewals-due','approval-queue','training-plan','owner-load','attention','compliance','activity','import-history','help'])assert(Array.isArray(await call(c)));
 const matrix=await call('matrix');assert.equal(matrix.find(r=>r.employee_code==='EMP-01'&&r.skill==='Machine isolation').readiness,'current');assert.equal(matrix.find(r=>r.employee_code==='EMP-02'&&r.skill==='Machine isolation').readiness,'expired');assert.equal(matrix.find(r=>r.employee_code==='EMP-02'&&r.skill==='Packing quality check').readiness,'below level');assert.equal(matrix.find(r=>r.employee_code==='EMP-03'&&r.skill==='Packing quality check').readiness,'missing');assert.equal(matrix.find(r=>r.employee_code==='EMP-04').readiness,'missing evidence');
 const cover=(await call('coverage')).find(r=>r.skill==='Machine isolation');assert.equal(Number(cover.ready),1);assert.equal(Number(cover.ready_in_30_days),0);
 const review=await call('weekly-review');assert(review.attention.length&&review.coverage.length&&review.training.length);
 assert.equal((await call('employee',{},['aroha'])).employee.code,'EMP-01');await assert.rejects(()=>resolve(db,'employees','Ben'),/Ambiguous.*EMP-02.*EMP-04/);
 const e=await resolve(db,'employees','EMP-01');assert.equal((await resolve(db,'employees',e.id.slice(0,8))).id,e.id);
 await assert.rejects(()=>call('add',{...actor,kind:'employees',code:'BAD',name:'No site'}),/Required/);
 const before=await count('employees');await call('add',{...actor,kind:'employees',code:'DRY',name:'Dry',site:'Nowhere','dry-run':true});assert.equal(await count('employees'),before);
 await call('add',{...actor,kind:'employees',code:'EMP-99',name:'<script>alert(1)</script>',site:'Test'});
 await assert.rejects(()=>call('add',{...actor,kind:'employees',code:'IMP',name:'X',site:'Test',active:'perhaps'}),/Boolean/);
 await assert.rejects(()=>call('add',{...actor,kind:'assignments',code:'DUP',employee:'EMP-01',role:'ROLE-01',starts_on:'2026-01-01'}),/Overlapping/);
 const today=(await db.query('select current_date::text d'))[0].d;
 await assert.rejects(()=>call('add',{...actor,kind:'results',code:'BAD-RES',employee:'EMP-01',skill:'SK-01',level:'3.5',assessed_on:today,assessor:'Test'}),/integer/);
 await assert.rejects(()=>call('add',{...actor,kind:'results',code:'BAD-RES',employee:'EMP-01',skill:'SK-01',level:3,assessed_on:'2026-02-30',assessor:'Test'}),/real/);
 await assert.rejects(()=>call('add',{...actor,kind:'results',code:'BAD-RES',employee:'EMP-01',skill:'SK-01',level:3,assessed_on:'2999-01-01',assessor:'Test'}),/future/);
 await assert.rejects(()=>call('add',{...actor,kind:'results',code:'BAD-RES',employee:'EMP-01',skill:'SK-01',level:3,assessed_on:today,assessor:'Test',status:'approved'}),/evidence/);
 await call('add',{...actor,kind:'results',code:'RES-NEW',employee:'EMP-01',skill:'SK-01',level:4,assessed_on:today,expires_on:today,assessor:'Test',evidence:'test:observed'});
 assert.equal((await call('matrix')).find(r=>r.employee_code==='EMP-01'&&r.skill==='Machine isolation').readiness,'pending');
 await call('approve-result',{...actor,note:'Observed demonstration checked'},['RES-NEW']);assert.equal((await call('matrix')).find(r=>r.employee_code==='EMP-01'&&r.skill==='Machine isolation').readiness,'current');
 await assert.rejects(()=>call('approve-result',{...actor,note:'Again'},['RES-NEW']),/Only pending/);
 await call('revoke-result',{...actor,note:'Evidence withdrawn'},['RES-NEW']);assert.equal((await call('matrix')).find(r=>r.employee_code==='EMP-01'&&r.skill==='Machine isolation').readiness,'revoked');
 await assert.rejects(()=>call('complete-training',actor,['TRAIN-01']),/evidence/);
 await call('complete-training',{...actor,evidence:'test:attendance'},['TRAIN-01']);assert.equal((await call('training-plan')).length,0);assert.equal((await call('matrix')).find(r=>r.employee_code==='EMP-02'&&r.skill==='Machine isolation').readiness,'expired');
 await call('retire-employee',actor,['EMP-99']);assert.equal((await resolve(db,'employees','EMP-99')).active,false);
 const manifest=path.join(REPO_ROOT,'fixtures/ag5/manifest.json');const imp={...actor,manifest,source:'test-export'};
 await call('import',{...imp,'dry-run':true},['ag5']);assert.equal(await count('import_records'),0);
 let result=await call('import',imp,['ag5']);assert.equal(result.reduce((n,r)=>n+r.added,0),6);result=await call('import',imp,['ag5']);assert.equal(result.reduce((n,r)=>n+r.unchanged,0),6);
 // A changed duplicate is rejected and earlier records in that batch are rolled back.
 fs.writeFileSync(path.join(temp,'employees.csv'),'ID,Name,Site\nROLLBACK,New worker,Test\nIMP-E01,Changed name,Rotoroa\n');
 const changed={files:[{kind:'employees',file:'employees.csv',map:{code:'ID',name:'Name',site:'Site'}}]};fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(changed));
 await assert.rejects(()=>call('import',{...actor,manifest:path.join(temp,'manifest.json'),source:'test-export'},['ag5']),/Changed duplicate/);await assert.rejects(()=>resolve(db,'employees','ROLLBACK'),/No employees/);
 const {default:ExcelJS}=await import('exceljs');const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('People');ws.addRow(['ID','Name','Site']);ws.addRow(['XLS-01','Excel worker','South']);await wb.xlsx.writeFile(path.join(temp,'people.xlsx'));changed.files[0].file='people.xlsx';changed.files[0].sheet='People';fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(changed));await call('import',{...actor,manifest:path.join(temp,'manifest.json'),source:'excel'},['ag5']);assert.equal((await resolve(db,'employees','XLS-01')).name,'Excel worker');
 assert.equal(parseCsv('\uFEFFA,B\r\n"a,b","line1\nline2"\r\n')[0].B,'line1\nline2');assert.throws(()=>parseCsv('A,A\n1,2'),/unique/);assert.throws(()=>parseCsv('A,B\n"unterminated'),/unclosed/);
 const snapshot=await call('export');assert(snapshot.records.audit.length>0);assert.equal(snapshot.records.import_records.length,7);const exportPath=path.join(temp,'backup.json');await call('export',{file:exportPath});assert(fs.existsSync(exportPath));await assert.rejects(()=>call('export',{file:exportPath}),/EEXIST/);
 for(const command of ['draft-training-plan','draft-assessment-review']){const out=await call(command);assert(fs.readFileSync(out.file,'utf8').includes('working draft'));}
 const html=page({title:'<script>',sections:[{title:'<img>',html:table([{name:'<script>alert(1)</script>'}])}]});assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));
 const history=await call('activity');assert(history.some(r=>r.operation==='approve-result'));const a=(await db.query("select * from audit where operation='revoke-result'"))[0];assert.equal(a.before_record.status,'approved');assert.equal(a.after_record.status,'revoked');
 await assert.rejects(()=>call('retire-employee',{...actor,'dry_run':true},['EMP-01']),/Unknown option/);
 assert.equal(commands.filter(c=>!seen.has(c)).length,0,'Every CLI command must be exercised');
 await db.close();
 for(const script of ['docs.mjs','view.mjs']){const child=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',script)],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(child.status,0,child.stderr);}
 const bad=spawnSync(process.execPath,['scripts/competency.mjs','employee','Ben'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(bad.status,1);assert.match(bad.stderr,/Ambiguous/);
 const json=spawnSync(process.execPath,['scripts/competency.mjs','coverage','--json'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(json.status,0,json.stderr);assert(Array.isArray(JSON.parse(json.stdout)));
 console.log(`PASS: ${commands.length} commands; expiry, assessment precedence, approvals, coverage, evidence, audit, CSV/XLSX imports, rollback, exports and HTML.`);
}finally{await db.close().catch(()=>{});if(testSchema){const cleanup=await getDb();try{await cleanup.exec('drop schema '+testSchema+' cascade');}finally{await cleanup.close();}}fs.rmSync(temp,{recursive:true,force:true});}
