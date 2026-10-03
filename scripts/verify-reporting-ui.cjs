// Synthetic API browser acceptance. Run against a separately started production web server.
// NODE_PATH may point to the bundled workspace Playwright installation.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.HELLOW_REVIEW_URL||'http://127.0.0.1:30169';
const out=path.resolve('output/reporting-ui');fs.mkdirSync(out,{recursive:true});
const now='2026-10-04T03:00:00Z';
const totals={received:12,accepted:8,connected:6,waiting:2,processing:3,completed:5,cancelled:2,automatic_callbacks:1,unregistered:4,ongoing_calls:1,unconnected:1,measured_waits:7,unmeasured_waits:1,wait_seconds:210,current_wait_seconds:120,call_seconds:720,measured_calls:6,unmeasured_calls:0};
const section=(metrics)=>({totals:metrics,items:[{key:'2026-10-04',label:'2026-10-04',...metrics}],hasMore:false,page:0});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});const proof=[];
  try {
    for(const [device,width,height] of [['wide',2486,1283],['desktop',1440,900],['tablet',768,1024],['landscape',1024,768],['mobile',375,812]]){
      const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();const errors=[];let failure=false;let empty=false;let calls=[];
      page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.stack);});await page.addInitScript(()=>sessionStorage.setItem('hellow_access_token','synthetic-fixture'));
      await page.route('**/api/**',async route=>{
        const url=new URL(route.request().url());const api=url.pathname;calls.push(url.pathname+url.search);let data=[];
        if(api==='/api/me')data={issuer:'https://fixture.example',subject:'fixture',name:'검수 상담사(agent)',organizations:[{id:'fixture',name:'합성 검수 조직',permissions:['agent:monitor','report:read','consultation:read','consultation:write','customer:read','customer:write','queue:read','queue:accept'],scopes:{'consultation:read':'SELF','report:read':'TEAM','agent:monitor':'TEAM'}}]};
        else if(api==='/api/queue'||api==='/api/customers'||api==='/api/templates')data=[];
        else if(api==='/api/queue/history'||api==='/api/consultations')data={items:[],page:0,hasMore:false};
        else if(api.startsWith('/api/consultations/'))data=null;
        else if(api.startsWith('/api/agents/me'))data={state:'AWAY',availability:'AWAY',version:1,activeOrganizationId:'fixture'};
        else if(api==='/api/consultation-catalog')data={version:1,effective:{categories:[{id:'general',name:'일반 상담',parentId:null,active:true}],results:[{id:'resolved',name:'해결',active:true}]}};
        else if(api.endsWith('/options'))data={scope:'TEAM',members:[{id:1,name:'긴 이름의 상담사(상담사아이디)',teamId:'t'}],teams:[{id:'t',name:'고객지원팀'}],categories:[{id:'c',name:'["일반 상담","사용 안내"]'}],results:[{id:'r',name:'해결'}],hasMore:false};
        else if(api==='/api/reports/consultations'){
          if(failure){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'합성 일시 장애'})});return;}
          const q=empty?Object.fromEntries(Object.keys(totals).map(k=>[k,0])):totals;
          data={asOf:now,from:'2026-10-03T15:00:00Z',until:'2026-10-04T15:00:00Z',scope:'TEAM',timeZone:'Asia/Seoul',definitionVersion:1,report:{queues:section(q),trends:section(q),channels:{...section(q),items:empty?[]:[{key:'CALL',label:'CALL',received:9},{key:'TICKET',label:'TICKET',received:3}]},records:section({records:5,completed:3,in_progress:1,escalated:1}),attempts:empty?[]:[{label:'ACCEPTED',count:8},{label:'MISSED',count:3},{label:'TIMED_OUT',count:2}],transfers:{accepted:2}}};if(empty){data.report.queues.items=[];data.report.records={...section({records:0,completed:0,in_progress:0,escalated:0}),items:[]};}
        }
        else if(api==='/api/reports/followups')data={asOf:now,report:empty?{...section({callbacks:0}),items:[]}:section({callbacks:4,pending:1,assigned:1,scheduled:1,in_progress:0,completed:1,failed:0,cancelled:0})};
        else if(api==='/api/monitoring/summary')data={asOf:now,scope:'TEAM',queues:[{status:'WAITING',count:2},{status:'PROCESSING',count:3}],callbacks:[{status:'PENDING',count:1},{status:'ASSIGNED',count:1}]};
        else if(api==='/api/monitoring/agents')data={asOf:now,scope:'TEAM',page:0,hasMore:false,items:[{memberId:1,name:'긴 이름의 상담사(상담사아이디)',teamId:'t',state:'CALLING',heartbeatAt:now,leaseExpired:false},{memberId:2,name:'응답이 만료된 상담사(다른아이디)',teamId:'t',state:'AFTER_CALL',heartbeatAt:'2026-10-04T02:59:00Z',leaseExpired:true},{memberId:3,name:'자리비움 상담사(away)',teamId:'t',state:'AWAY',heartbeatAt:now,leaseExpired:false}]};
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      });
      await page.goto(base);
      const menu=page.getByRole('button',{name:width<768?'현황·통계':'상담 현황·통계',exact:true});
      try{await menu.waitFor();}catch(e){await page.screenshot({path:path.join(out,`${device}-shell-failure.png`)});console.error(page.url(),await page.locator('body').innerText());throw e;}
      const editor=page.locator('.interaction-editor [contenteditable=true]').last();
      if(width<1280)await page.getByRole('button',{name:'편집기',exact:true}).click();
      await page.screenshot({path:path.join(out,`${device}-draft-start.png`),fullPage:true});
      await editor.waitFor();await editor.fill('합성 검수 초안 보존');
      await menu.click();await page.getByRole('heading',{name:'접수·통화'}).waitFor();
      await page.getByLabel('15초 자동 갱신').uncheck();await page.locator('.report-workspace').evaluate(e=>{e.scrollTop=0;});await page.screenshot({path:path.join(out,`${device}-reports.png`),fullPage:true});
      const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,scroll:document.querySelector('.report-workspace').scrollHeight,client:document.querySelector('.report-workspace').clientHeight,tableOverflow:[...document.querySelectorAll('.report-table-scroll')].map(e=>e.scrollWidth>e.clientWidth)}));
      assert.equal(layout.overflow,false);assert.equal(errors.length,0);
      await page.getByRole('heading',{name:'채널별 접수',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${device}-charts.png`),fullPage:true});
      await page.locator('.report-workspace').evaluate(e=>{e.scrollTop=e.scrollHeight;});await page.screenshot({path:path.join(out,`${device}-reports-bottom.png`),fullPage:true});
      await page.locator('.report-workspace').evaluate(e=>{e.scrollTop=0;});
      await page.getByRole('button',{name:'상담 현황',exact:true}).click();await page.getByRole('heading',{name:'상담사 상태'}).waitFor();await page.locator('.report-workspace').evaluate(e=>{e.scrollTop=0;});await page.screenshot({path:path.join(out,`${device}-monitor.png`),fullPage:true});
      await page.getByRole('button',{name:'기간 통계',exact:true}).click();await page.getByRole('heading',{name:'접수·통화'}).waitFor();
      failure=true;await page.getByRole('button',{name:'새로고침',exact:true}).click();
      await page.getByText(/마지막 성공 결과를 표시/).waitFor();assert.equal(await page.getByRole('heading',{name:'접수·통화'}).count(),1);
      if(device==='desktop')await page.screenshot({path:path.join(out,'desktop-error.png'),fullPage:true});
      failure=false;empty=true;await page.getByRole('button',{name:'새로고침',exact:true}).click();await page.getByText('연결 통화 없음').waitFor();
      if(device==='desktop')await page.screenshot({path:path.join(out,'desktop-empty.png'),fullPage:true});
      await page.getByRole('button',{name:'상담 이력 열기'}).click();await page.getByRole('heading',{name:'My 상담 이력'}).waitFor();
      await page.getByRole('button',{name:width<768?'편집기':'상담 워크스페이스',exact:true}).click();assert.ok((await editor.innerText()).includes('합성 검수 초안 보존'));
      proof.push({device,...layout,pageErrors:errors,syntheticApi:true,draftPreserved:true,historySelf:true,errorRetainsData:true,apiCalls:calls.length});await context.close();
    }
    fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
