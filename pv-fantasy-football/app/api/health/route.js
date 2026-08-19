import {NextResponse} from 'next/server';
import {evaluateProductionConfig} from '../../../lib/production-config.mjs';
import {evaluateDeploymentSafety} from '../../../lib/deployment-safety.mjs';
import {deploymentVersion} from '../../../lib/deployment-version.mjs';
export const dynamic='force-dynamic';
export async function GET(){const configuration=evaluateProductionConfig(process.env),deployment=evaluateDeploymentSafety(process.env);return NextResponse.json({status:'ok',environment:deployment.environment,release_mode:deployment.release_mode,configuration:configuration.status,deployment_safety:deployment.status,version:deploymentVersion()},{headers:{'Cache-Control':'no-store'}})}
