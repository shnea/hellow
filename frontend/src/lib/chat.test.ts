import {it,expect,vi,afterEach} from 'vitest';
import {chatFetch,readChatEvents,type ChatView} from './chat';
afterEach(()=>vi.unstubAllGlobals());
it('분할된 SSE와 CRLF를 읽고 제어 이벤트를 데이터와 구분한다',async()=>{
  const data={queueCode:'q',state:'OPEN',messages:[],cursor:2,hasMore:false,canSend:true,endedAt:null} as ChatView;
  const source=`event: conversation\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;const chunks=[source.slice(0,20),source.slice(20,35),source.slice(35)];
  const stream=new ReadableStream({start(controller){chunks.forEach(c=>controller.enqueue(new TextEncoder().encode(c)));controller.close();}});
  const receive=vi.fn();await readChatEvents(new Response(stream),receive);expect(receive).toHaveBeenCalledExactlyOnceWith(data);
});
it('고객 capability를 URL 대신 헤더로 전송한다',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetch);
  await chatFetch({kind:'customer',sessionId:'secret-session',storageKey:'storage'},'events?afterSequence=7');
  expect(fetch.mock.calls[0][0]).toBe('/api/support/chat/events?afterSequence=7');expect(new Headers(fetch.mock.calls[0][1].headers).get('X-Support-Session')).toBe('secret-session');
});
