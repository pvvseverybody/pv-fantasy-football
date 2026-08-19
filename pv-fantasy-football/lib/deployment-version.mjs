const safe=value=>String(value??'').trim().replace(/[^A-Za-z0-9._-]/g,'').slice(0,40);
export function deploymentVersion(environment=process.env){return{application_version:'1.0.1',commit:safe(environment.VERCEL_GIT_COMMIT_SHA||environment.GIT_COMMIT_SHA)||'LOCAL',deployment_id:safe(environment.VERCEL_DEPLOYMENT_ID)||null}}
