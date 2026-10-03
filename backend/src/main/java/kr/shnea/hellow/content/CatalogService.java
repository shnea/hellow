package kr.shnea.hellow.content;

import static org.springframework.http.HttpStatus.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import kr.shnea.hellow.consultation.Consultation;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CatalogService {
  public static final String COMMON="__common__";
  public record Category(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String id,
      @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String parentId,@NotBlank @Size(max=100) String name,boolean active) {}
  public record Result(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String id,
      @NotBlank @Size(max=100) String name,boolean active) {}
  public record Catalog(@NotNull @Size(min=1,max=300) List<@NotNull @Valid Category> categories,
      @NotNull @Size(min=1,max=100) List<@NotNull @Valid Result> results) {}
  public record View(long version,long commonVersion,boolean inherited,String source,Catalog effective) {}
  public record Selection(String categoryId,String categoryPath,String main,String sub,String resultId,String resultName) {}
  private static final Catalog DEFAULT=new Catalog(List.of(new Category("general",null,"일반 상담",true),
      new Category("general-inquiry","general","일반 문의",true)),List.of(new Result("resolved","처리 완료",true),new Result("followup","후속 조치 필요",true)));
  private final ConsultationCatalogRepository catalogs;
  private final ObjectMapper json;
  public CatalogService(ConsultationCatalogRepository catalogs,ObjectMapper json){this.catalogs=catalogs;this.json=json;}
  public String encode(Catalog catalog){try{return json.writeValueAsString(catalog);}catch(Exception e){throw new IllegalStateException(e);}}
  private Catalog decode(String document){try{return json.readValue(document,Catalog.class);}catch(Exception e){throw new IllegalStateException("저장된 상담 분류를 읽을 수 없습니다.",e);}}
  public View view(String owner){
    var common=catalogs.findById(COMMON);var own=catalogs.findById(owner);
    boolean inherited=!COMMON.equals(owner)&&own.map(c->!c.isOverridden()).orElse(true);
    var effective=inherited?common:own;
    // Virtual defaults use 0; a persisted first version is 1, so first-save races are detectable.
    return new View(own.map(c->c.getVersion()+1).orElse(0L),common.map(c->c.getVersion()+1).orElse(0L),inherited,
        inherited?"COMMON":COMMON.equals(owner)?"COMMON":"ORGANIZATION",effective.map(c->decode(c.getDocument())).orElse(DEFAULT));
  }
  public void validate(Catalog catalog,Catalog previous){
    Map<String,Category> nodes=new LinkedHashMap<>();Set<String> names=new HashSet<>();
    for(var node:catalog.categories()){
      if(nodes.put(node.id(),node)!=null||!names.add(Objects.toString(node.parentId(),"")+":"+node.name().trim()))bad("분류 ID 또는 같은 단계의 이름이 중복됩니다.");
      if(!node.name().equals(node.name().trim()))bad("분류 이름 앞뒤 공백을 제거해 주세요.");
    }
    for(var node:nodes.values()){
      Set<String> visited=new HashSet<>();Category current=node;int depth=0;
      while(current!=null){
        if(!visited.add(current.id())||++depth>3)bad("분류는 순환 없이 최대 3단계여야 합니다.");
        if(node.active()&&!current.active())bad("비활성 상위 분류 아래에는 활성 분류를 둘 수 없습니다.");
        if(current.parentId()==null)break;
        current=nodes.get(current.parentId());if(current==null)bad("상위 분류가 없습니다.");
      }
    }
    Set<String> resultIds=new HashSet<>();names.clear();
    for(var result:catalog.results())if(!resultIds.add(result.id())||!names.add(result.name().trim())||!result.name().equals(result.name().trim()))bad("결과 ID·이름을 중복 없이 입력해 주세요.");
    if(nodes.values().stream().noneMatch(Category::active)||catalog.results().stream().noneMatch(Result::active))bad("활성 분류와 결과가 각각 하나 이상 필요합니다.");
    // Stable IDs cannot disappear from a configured list. Retire entries by deactivating them.
    if(previous!=null&&(!nodes.keySet().containsAll(previous.categories().stream().map(Category::id).toList())
        ||!resultIds.containsAll(previous.results().stream().map(Result::id).toList())))bad("기존 분류·결과는 삭제 대신 비활성화해 주세요.");
  }
  public Selection select(String org,String categoryId,String resultId,Consultation existing,
      String legacyMain,String legacySub,boolean complete){
    String path=null,main=null,sub=null;var effective=view(org).effective();
    if(categoryId==null){
      // Existing legacy labels survive editing; new records must use a stable catalog ID.
      if(existing==null||existing.getCategoryId()!=null||!Objects.equals(legacyMain,existing.getCategoryMain())||!Objects.equals(legacySub,existing.getCategorySub()))bad("상담 분류를 선택해 주세요.");
      main=existing.getCategoryMain();sub=existing.getCategorySub();path=existing.getCategoryPath();
    }else if(existing!=null&&categoryId.equals(existing.getCategoryId())){
      main=existing.getCategoryMain();sub=existing.getCategorySub();path=existing.getCategoryPath();
    }else{
      var nodes=effective.categories();Map<String,Category> indexed=new HashMap<>();nodes.forEach(n->indexed.put(n.id(),n));
      List<String> labels=new ArrayList<>();var node=indexed.get(categoryId);if(node==null)bad("선택한 분류가 없습니다. 목록을 다시 조회해 주세요.");
      while(node!=null){if(!node.active())bad("비활성 분류는 새로 선택할 수 없습니다.");labels.addFirst(node.name());node=node.parentId()==null?null:indexed.get(node.parentId());}
      main=labels.getFirst();sub=labels.getLast();path=encodePath(labels);
    }
    String resultName=null;
    if(resultId!=null){
      if(existing!=null&&resultId.equals(existing.getResultId()))resultName=existing.getResultName();
      else{var result=effective.results().stream().filter(r->r.id().equals(resultId)&&r.active()).findFirst().orElseThrow(()->new ResponseStatusException(BAD_REQUEST,"활성 상담 결과를 선택해 주세요."));resultName=result.name();}
    }else if(complete&&(categoryId!=null||existing==null||existing.getResultId()!=null||existing.getStatus()!=Consultation.ConsultationStatus.COMPLETED))bad("상담 완료 전에 처리 결과를 선택해 주세요.");
    return new Selection(categoryId,path,main,sub,resultId,resultName);
  }
  public Selection initial(String org){
    String id=view(org).effective().categories().stream().filter(Category::active).findFirst().orElseThrow().id();
    return select(org,id,null,null,"","",false);
  }
  private String encodePath(List<String> labels){try{return json.writeValueAsString(labels);}catch(Exception e){throw new IllegalStateException(e);}}
  private static void bad(String message){throw new ResponseStatusException(BAD_REQUEST,message);}
}
