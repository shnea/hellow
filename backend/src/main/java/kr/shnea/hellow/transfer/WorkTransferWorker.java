package kr.shnea.hellow.transfer;

import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

/** Every organization reconciles in its own service transaction. */
@Component @EnableScheduling
@ConditionalOnProperty(name="hellow.work-transfer-enabled",havingValue="true",matchIfMissing=true)
public class WorkTransferWorker {
  private final WorkTransferRepository requests;private final WorkTransferService service;
  public WorkTransferWorker(WorkTransferRepository requests,WorkTransferService service){this.requests=requests;this.service=service;}
  @Scheduled(fixedDelay=2000,initialDelay=5000)
  public void tick(){
    for(var org:requests.findByStatusIn(WorkTransferService.PENDING).stream().map(WorkTransfer::getOrganizationId).distinct().toList())
      try{service.reconcile(org);}catch(Exception error){LoggerFactory.getLogger(getClass()).warn("Work transfer reconciliation pending for organization {}",org);}
  }
}
