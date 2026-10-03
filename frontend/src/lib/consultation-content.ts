export interface Category {id:string;parentId:string|null;name:string;active:boolean;}
export interface ConsultationResult {id:string;name:string;active:boolean;}
export interface Catalog {categories:Category[];results:ConsultationResult[];}
export interface CatalogView {version:number;commonVersion:number;inherited:boolean;source:string;effective:Catalog;}
export interface TextTemplate {id:string;overrideId:string|null;name:string;body:string;active:boolean;version:number;commonVersion:number;scope:string;source:string;inherited:boolean;}
export interface Classification {categoryId?:string|null;categoryMain:string;categorySub:string;categoryPath?:string[];}
export const templateSource:Record<string,string>={COMMON:'공통',ORGANIZATION:'조직 공유',PERSONAL:'개인'};
export function categoryChain(categories:Category[],id?:string|null):Category[]{
  const chain:Category[]=[];const visited=new Set<string>();let node=categories.find(n=>n.id===id);
  while(node&&!visited.has(node.id)&&chain.length<3){visited.add(node.id);chain.unshift(node);node=categories.find(n=>n.id===node!.parentId);}
  return chain;
}
export function classify(categories:Category[],id:string):Classification {
  const chain=categoryChain(categories,id);const labels=chain.map(n=>n.name);
  return {categoryId:id,categoryMain:labels[0]||'',categorySub:labels.at(-1)||'',categoryPath:labels};
}
export function savedClassification(r:{categoryId?:string|null;categoryMain:string;categorySub:string;categoryPath?:string|null}):Classification {
  let path:string[]|undefined;try {const parsed=JSON.parse(r.categoryPath||'null');if(Array.isArray(parsed)&&parsed.every(p=>typeof p==='string'))path=parsed;}catch{/* Legacy records have no path. */}
  return {categoryId:r.categoryId??null,categoryMain:r.categoryMain,categorySub:r.categorySub,categoryPath:path};
}
