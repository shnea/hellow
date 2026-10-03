'use client';
import {useCallClock} from '@/hooks/use-call-clock';
export function CallReconnectNotice({since,ended}:{since?:string|null;ended?:boolean}){
 const elapsed=useCallClock(since);
 if(!since||ended)return null;
 return <p role="status" className="shrink-0 px-4 py-3 bg-amber-950 text-amber-100 text-sm">음성 연결이 끊겼습니다. 재연결을 기다리는 중입니다. · {Math.max(0,30-elapsed)}초 남음. 원하면 통화 종료 버튼으로 바로 종료할 수 있습니다.</p>;
}
