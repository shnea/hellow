package kr.shnea.hellow.routing;
import jakarta.persistence.*;
@Entity @Table(name="routing_lock")
public class RoutingLock {
  @Id private Integer id;
  protected RoutingLock(){}
  public RoutingLock(int id){this.id=id;}
}
