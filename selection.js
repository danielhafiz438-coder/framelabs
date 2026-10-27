// Pure helpers for FrameLabs v3 selection and per-photo editing.
export function selectionEntry(file, id) {
  return {id, file, status:'Menunggu', overrides:{}};
}
export function moveEntry(items, from, to) {
  if(from<0||from>=items.length||to<0||to>=items.length||from===to)return [...items];
  const next=[...items], [entry]=next.splice(from,1);next.splice(to,0,entry);return next;
}
export function selectionBytes(items){return items.reduce((total,item)=>total+item.file.size,0);}
export function settingsForPhoto(global, metadata, mode, overrides={}) {
  return {...global,...(mode==='auto'&&metadata?metadata:{}),...overrides};
}
export function afterRemove(items,activeId){
  if(items.some(item=>item.id===activeId))return activeId;
  return items[0]?.id??null;
}
