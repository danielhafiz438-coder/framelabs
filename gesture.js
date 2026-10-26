export function attachSwipe(element, onSwipe, {threshold=48}={}){
  let start=null;
  const begin=e=>{
    if(e.touches.length!==1){start=null;return;}
    const t=e.touches[0];start={x:t.clientX,y:t.clientY};
  };
  const end=e=>{
    if(!start||e.changedTouches.length!==1){start=null;return;}
    const {clientX:x,clientY:y}=e.changedTouches[0],dx=x-start.x,dy=y-start.y;
    start=null;
    if(Math.abs(dx)<threshold||Math.abs(dx)<Math.abs(dy)*1.35)return;
    onSwipe(dx<0?1:-1);
  };
  const cancel=()=>{start=null;};
  element.addEventListener('touchstart',begin,{passive:true});
  element.addEventListener('touchend',end,{passive:true});
  element.addEventListener('touchcancel',cancel,{passive:true});
  return ()=>{element.removeEventListener('touchstart',begin);element.removeEventListener('touchend',end);element.removeEventListener('touchcancel',cancel);};
}
