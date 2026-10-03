package kr.shnea.hellow.routing;
import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
@Configuration
public class RoutingConfiguration {
  @Bean @ConditionalOnMissingBean(Clock.class) Clock routingClock(){return Clock.systemUTC();}
  // Flyway seeds this row in PostgreSQL. Hibernate-only test databases also need the same lock.
  @Bean org.springframework.boot.ApplicationRunner initializeRoutingLock(RoutingLockRepository locks){
    return args->{if(!locks.existsById(1))locks.saveAndFlush(new RoutingLock(1));};
  }
}
