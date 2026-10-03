/** Best effort on actual document exit. Server media observation handles crashes/offline exits. */
export function endCallOnPageExit(path:string,organizationId?:string){
 try {
  const headers=new Headers();
  if(organizationId){headers.set('X-Organization-ID',organizationId);const token=sessionStorage.getItem('hellow_access_token');if(token)headers.set('Authorization',`Bearer ${token}`);}
  void fetch(path,{method:'POST',headers,keepalive:true,cache:'no-store'}).catch(()=>{});
 }catch{/* A closing browser may refuse requests; the server detects participant departure. */}
}
