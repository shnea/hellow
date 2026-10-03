package kr.shnea.hellow.routing;
import kr.shnea.hellow.security.OrganizationRepository;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

@Component @EnableScheduling
@ConditionalOnProperty(name="hellow.routing-enabled",havingValue="true",matchIfMissing=true)
public class RoutingWorker {
  private final OrganizationRepository organizations;private final RoutingService routing;
  public RoutingWorker(OrganizationRepository organizations,RoutingService routing){this.organizations=organizations;this.routing=routing;}
  @Scheduled(fixedDelay=2000,initialDelay=5000)
  public void tick(){for(var org:organizations.findAll())try{routing.route(org.getId());}catch(Exception error){LoggerFactory.getLogger(getClass()).warn("Routing retry pending for organization {}",org.getId(),error);}}
}
