export function dateToSheetsSerial(date,timeZone='America/Chicago'){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second))/86400000+25569;
}
export function isBeforeKickoff(submittedAt,kickoffSerial){const submitted=dateToSheetsSerial(submittedAt);return Number.isFinite(kickoffSerial)&&submitted<kickoffSerial}
