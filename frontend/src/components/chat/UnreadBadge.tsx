import './chat.css';

export function UnreadBadge({count,className=''}:{count:number;className?:string}) {
  if(count<=0)return null;
  return <span className={`chat-unread-badge ${className}`} aria-label={`미읽음 메시지 ${count}개`}>{count>99?'99+':count}</span>;
}
