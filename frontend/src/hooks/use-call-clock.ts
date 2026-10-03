'use client';
import {useEffect,useState} from 'react';
export function elapsedCallSeconds(start?:string|null,end?:string|null,now=Date.now()){
 if(!start)return 0;
 const seconds=Math.floor(((end?Date.parse(end):now)-Date.parse(start))/1000);
 return Number.isFinite(seconds)?Math.max(0,seconds):0;
}
export function useCallClock(start?:string|null,end?:string|null){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{if(!start||end)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[start,end]);
 return elapsedCallSeconds(start,end,now);
}
