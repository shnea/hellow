export interface PendingChatImage {clientMessageId:string;name:string;file:Blob;}

// Keep the original bytes and UUID together so reload/retry cannot create a second message.
export async function chatImageOutbox(key:string,value?:PendingChatImage|null):Promise<PendingChatImage|null>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('hellow-chat-outbox',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('images');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('이미지 보관함을 열지 못했습니다.'));
  });
  try{return await new Promise((resolve,reject)=>{
    const transaction=db.transaction('images',value===undefined?'readonly':'readwrite'),store=transaction.objectStore('images');
    const request=value===undefined?store.get(key):value===null?store.delete(key):store.put(value,key);
    transaction.oncomplete=()=>resolve(value===undefined?(request.result as PendingChatImage|undefined)||null:value);
    transaction.onabort=()=>reject(transaction.error||new Error('이미지를 보관하지 못했습니다.'));
    transaction.onerror=()=>reject(transaction.error);
  });}finally{db.close();}
}
