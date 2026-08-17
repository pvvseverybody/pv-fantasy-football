const buckets=new Map();
export function consumeAuthAttempt(key,{limit=8,windowMs=15*60*1000,now=Date.now()}={}){
  const id=String(key||'unknown');const recent=(buckets.get(id)||[]).filter(time=>now-time<windowMs);
  if(recent.length>=limit){buckets.set(id,recent);return false}
  recent.push(now);buckets.set(id,recent);
  if(buckets.size>5000)for(const [entry,times] of buckets)if(!times.some(time=>now-time<windowMs))buckets.delete(entry);
  return true;
}
export function authRequestKey(request,purpose){const forwarded=request.headers.get('x-forwarded-for')||'';const ip=forwarded.split(',')[0].trim()||request.headers.get('x-real-ip')||'unknown';return`${purpose}:${ip}`;}
