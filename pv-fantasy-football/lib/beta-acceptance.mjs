export const BETA_ACCEPTANCE_CATEGORIES=Object.freeze([
  'REGISTRATION','RETURNING_LOGIN','VERIFICATION_CODE','LINEUP_CREATION','LINEUP_REPLACEMENT','LINEUP_LOCK',
  'RESULTS_WITHHOLDING','RESULTS_RELEASE','LEADERBOARD','MOBILE','TABLET','DESKTOP','ACCESSIBILITY','BACKEND_FAILURE_HANDLING',
]);
const allowed=new Set(['PASS','FAIL','PENDING']);

export function evaluateBetaAcceptance(records=[]){
  const byCategory=new Map(records.filter(record=>BETA_ACCEPTANCE_CATEGORIES.includes(record.category)).map(record=>[record.category,record]));
  const categories=BETA_ACCEPTANCE_CATEGORIES.map(category=>{const record=byCategory.get(category)||{};const status=allowed.has(record.status)?record.status:'PENDING';const checkedAt=Number.isFinite(Date.parse(record.checked_at))?new Date(record.checked_at).toISOString():null;const evidence=/^[A-Za-z0-9._:/#-]{1,200}$/.test(String(record.evidence||''))?String(record.evidence):null;return{category,status,checked_at:checkedAt,evidence};});
  return{status:categories.some(item=>item.status==='FAIL')?'FAIL':categories.every(item=>item.status==='PASS')?'PASS':'PENDING',passed:categories.filter(item=>item.status==='PASS').length,total:categories.length,categories};
}
