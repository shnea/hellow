package kr.shnea.hellow.customer;

import java.util.*;
import kr.shnea.hellow.queue.QueueItem;
import kr.shnea.hellow.security.*;
import org.springframework.stereotype.Service;

/** Phone lookup assists staff; it never grants a public caller access to CRM data. */
@Service
public class CustomerIdentityService {
  private final CustomerRepository customers;
  private final CustomerHistoryService history;
  private final OrganizationRepository organizations;
  public CustomerIdentityService(CustomerRepository customers,CustomerHistoryService history,OrganizationRepository organizations){this.customers=customers;this.history=history;this.organizations=organizations;}
  public void lockOrganization(String id){organizations.lockById(id).orElseThrow();}
  public Optional<Customer> match(String org,String phone){
    String key=PhoneNumbers.key(phone);
    if(!identifiable(phone))return Optional.empty();
    var matches=customers.findByOrganizationId(org).stream().filter(c->c.isRegistered()&&PhoneNumbers.key(c.getPhoneNumber()).equals(key)).toList();
    return choose(matches,null);
  }
  private String name(String value){return value==null?"":value.trim().toLowerCase(Locale.ROOT);}
  private Optional<Customer> choose(List<Customer> candidates,String requestedName){
    if(candidates.isEmpty())return Optional.empty();
    if(candidates.stream().map(c->name(c.getName())).distinct().count()==1)return candidates.stream().min(Comparator.comparing(Customer::getCode));
    var exact=candidates.stream().filter(c->name(c.getName()).equals(name(requestedName))).toList();
    return exact.size()==1?Optional.of(exact.getFirst()):Optional.empty();
  }
  public Set<String> relatedCodes(Customer customer){
    var result=new HashSet<String>();result.add(customer.getCode());
    if(identifiable(customer.getPhoneNumber()))customers.findByOrganizationId(customer.getOrganizationId()).stream()
      .filter(c->PhoneNumbers.key(c.getPhoneNumber()).equals(PhoneNumbers.key(customer.getPhoneNumber()))&&name(c.getName()).equals(name(customer.getName())))
      .forEach(c->result.add(c.getCode()));
    return result;
  }
  public static boolean identifiable(String phone){return phone!=null&&phone.matches("[+0-9().\\s-]+")&&PhoneNumbers.key(phone).matches("[0-9]{7,15}");}
  public void identify(QueueItem q){if(q.getCustomerCode()==null&&identifiable(q.getPhoneNumber()))choose(customers.findByOrganizationId(q.getOrganizationId()).stream().filter(c->c.isRegistered()&&PhoneNumbers.key(c.getPhoneNumber()).equals(PhoneNumbers.key(q.getPhoneNumber()))).toList(),q.getCustomerName()).ifPresent(q::linkCustomer);}
  public void onSave(QueueItem q,WorkspaceAccess.Actor actor){
    if(q.getCustomerCode()!=null)return;
    if(!identifiable(q.getPhoneNumber())||q.getCustomerName()==null||!q.getCustomerName().matches(".*\\p{L}.*"))return;
    var candidates=customers.findByOrganizationId(q.getOrganizationId()).stream().filter(c->PhoneNumbers.key(c.getPhoneNumber()).equals(PhoneNumbers.key(q.getPhoneNumber()))).toList();
    var selected=choose(candidates,q.getCustomerName());
    if(!candidates.isEmpty()&&selected.isEmpty())return;
    Customer customer=candidates.isEmpty()?new Customer("cust-"+UUID.randomUUID(),q.getCustomerType(),true,q.getCustomerName(),q.getCompanyName(),null,null,"Standard",q.getPhoneNumber(),null,actor.name(),null,false):selected.orElseThrow();
    if(candidates.isEmpty()){customer.setOrganizationId(q.getOrganizationId());customer.copyOwner(q);customers.saveAndFlush(customer);}
    else if(!customer.isRegistered())customer.updateInfo(customer.getCustomerType(),customer.getName(),customer.getCompany(),customer.getDepartment(),customer.getTitle(),customer.getTier(),customer.getEmail(),customer.getCustomerNotes(),customer.isComplainant());
    q.linkCustomer(customer);history.synchronize(q,null,customer.getCode(),actor,false);
  }
}
