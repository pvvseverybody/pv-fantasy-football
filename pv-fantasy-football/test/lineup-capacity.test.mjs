import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const slots=['RB','WR','TE','Offensive Flex','DL','LB','DB','Defensive Flex'];
async function writerHarness() {
  let source=await readFile(new URL('../lib/authoritative-lineups.js',import.meta.url),'utf8');
  source=source.replace(/import[\s\S]*?from\s+'[^']+';/g,'').replace(/export \{[^}]+\} from '[^']+';/g,'').replace(/export /g,'');
  return new Function('readSheetRange','getSpreadsheetMetadata','batchUpdateSpreadsheet','LINEUP_SLOTS','dateToSheetsSerial',source+';return {promoteLineupSubmission,AUTHORITATIVE_SCHEMAS};');
}
for(const gridRows of [1000,10000])test(`lineup crosses old row limit with grid size ${gridRows}`,async()=>{
  const factory=await writerHarness();let plan;
  const schema=factory(()=>{},()=>{},()=>{},slots,()=>1).AUTHORITATIVE_SCHEMAS;
  const state=Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,[headers]]));
  state.Participants.push(['participant','PV vs Everybody','pv@example.com','YES','','','pv@example.com','','VERIFIED']);
  state.Picks.push(...Array.from({length:992},(_,i)=>['prior-'+i]));
  const metadata={sheets:Object.keys(schema).map((title,sheetId)=>({properties:{title,sheetId,gridProperties:{rowCount:title==='Picks'?gridRows:1000}}}))};
  const writer=factory(async range=>state[range.match(/'([^']+)'/)[1]],async()=>metadata,async requests=>{plan=requests;throw new Error('PLAN_CAPTURED');},slots,()=>1);
  await assert.rejects(writer.promoteLineupSubmission({submissionId:'new',email:'pv@example.com',gameId:'game',week:'W9',kickoffSerial:2,picks:Object.fromEntries(slots.map((s,i)=>[s,'p'+i])),submittedAt:new Date()}),/PLAN_CAPTURED/);
  const picks=plan.filter(r=>r.updateCells?.range.sheetId===1&&r.updateCells.range.endColumnIndex===15);
  assert.equal(picks.length,8);
  assert.equal(picks.at(-1).updateCells.range.endRowIndex,1003);
  assert.equal(plan.filter(r=>r.appendDimension).length,gridRows===1000?1:0);
  const projection=plan.find(r=>r.updateCells?.range.endColumnIndex===21);
  assert.match(JSON.stringify(projection),/Picks!\$L\$4:\$L\$10000/);
});
