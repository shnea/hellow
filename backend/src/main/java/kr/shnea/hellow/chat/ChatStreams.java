package kr.shnea.hellow.chat;

import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.LongFunction;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Committed database rows are the replay source, including after a process restart. */
@Component
@org.springframework.scheduling.annotation.EnableScheduling
public class ChatStreams {
  @org.springframework.context.annotation.Bean(name="chatScheduler")
  public static org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler scheduler(){
    var scheduler=new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();scheduler.setPoolSize(2);scheduler.setThreadNamePrefix("chat-");return scheduler;
  }
  private final CopyOnWriteArrayList<Connection> connections=new CopyOnWriteArrayList<>();
  private static class Connection {
    final String key;final SseEmitter emitter;final LongFunction<ChatService.View> read;long cursor;
    Connection(String key,long cursor,LongFunction<ChatService.View> read){this.key=key;this.cursor=cursor;this.read=read;this.emitter=new SseEmitter(60000L);}
  }
  public synchronized SseEmitter open(String key,long after,LongFunction<ChatService.View> read){
    read.apply(after); // Fail invalid or unauthorized subscriptions before starting the response.
    if(connections.size()>=2000||connections.stream().filter(c->c.key.equals(key)).count()>=4)
      throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"열린 채팅 연결이 많습니다.");
    var c=new Connection(key,after,read);connections.add(c);
    c.emitter.onCompletion(()->connections.remove(c));c.emitter.onTimeout(()->{connections.remove(c);c.emitter.complete();});c.emitter.onError(e->connections.remove(c));
    return c.emitter;
  }
  @Scheduled(fixedDelay=1000,scheduler="chatScheduler")
  public void deliver(){
    for(var c:connections)try{
      var data=c.read.apply(c.cursor); // Re-check current session / membership / scope before every delivery.
      c.emitter.send(SseEmitter.event().name("conversation").id(Long.toString(data.cursor())).data(data));
      c.cursor=data.cursor();
      if(data.state().equals("CLOSED")&&!data.hasMore()){connections.remove(c);c.emitter.complete();}
    }catch(Exception e){
      connections.remove(c);
      try{c.emitter.send(SseEmitter.event().name("unavailable").data(java.util.Map.of("message","채팅 접근을 다시 확인해 주세요.")));}catch(Exception ignored){}
      c.emitter.complete();
    }
  }
}
