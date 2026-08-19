import 'server-only';
import {evaluateBetaAcceptance} from './beta-acceptance.mjs';

export function readBetaAcceptance(environment=process.env){
  try{const parsed=JSON.parse(environment.BETA_ACCEPTANCE_JSON||'[]');return evaluateBetaAcceptance(Array.isArray(parsed)?parsed:[])}catch{return evaluateBetaAcceptance([])}
}
