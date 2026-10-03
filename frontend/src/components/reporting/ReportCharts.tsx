'use client';
import {useState} from 'react';
import {reportingLabel,nextReportingDay,type ReportSection,type Metrics} from '@/lib/reporting';

const palette=['#a5b4fc','#67e8f9','#6ee7b7'];
const series=[{key:'received',name:'접수'},{key:'accepted',name:'수락'},{key:'connected',name:'음성 연결'}];
export function DailyTrend({section,from,to}:{section:ReportSection;from:string;to:string}){
  const [selected,setSelected]=useState<string|null>(null);
  const rows:{day:string;values:number[]}[]=[];let day=from;
  // Complete the bounded date axis with true zero days; data still comes from server aggregates.
  while(day<=to&&rows.length<366){const item=section.items.find(r=>String(r.key)===day);rows.push({day,values:series.map(s=>Number(item?.[s.key]||0))});day=nextReportingDay(day);}
  const maximum=Math.max(1,...rows.flatMap(r=>r.values));const width=720,height=250,left=82,right=16,top=18,bottom=34;
  const x=(index:number)=>left+(rows.length===1 ? .5 : index/(rows.length-1))*(width-left-right);
  const y=(n:number)=>height-bottom-n/maximum*(height-top-bottom);
  const active=rows.find(r=>r.day===selected)||rows.at(-1);
  const ticks=[0,.25,.5,.75,1].map(v=>Math.ceil(v*maximum)).filter((v,i,a)=>a.indexOf(v)===i);
  return <section className="report-chart" aria-label="일별 접수 추이"><h2>일별 접수·연결 추이</h2>
    <p>접수한 날짜 기준입니다. 점을 선택하면 해당 날짜의 수치를 확인합니다.</p>
    {!section.totals.received?<p className="report-empty">이 기간에 접수한 상담이 없습니다.</p>:<>
      <svg className="report-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="접수·수락·음성 연결 일별 추이. 정확한 수치는 아래 날짜 선택과 표에서 확인할 수 있습니다.">
        {ticks.map(n=><g key={n}><line x1={left} y1={y(n)} x2={width-right} y2={y(n)} stroke="#334155"/><text className="report-axis-label" x={left-8} y={y(n)+4} fill="#cbd5e1" textAnchor="end" fontSize="12">{n}</text></g>)}
        {series.map((s,i)=><g key={s.key}><polyline fill="none" stroke={palette[i]} strokeWidth="2.5" strokeDasharray={i===1?'6 4':i===2?'2 4':undefined} points={rows.map((r,index)=>`${x(index)},${y(r.values[i])}`).join(' ')}/>{rows.map((r,index)=><circle key={r.day} cx={x(index)} cy={y(r.values[i])} r={r.day===active?.day?5:3} fill={palette[i]}><title>{r.day} {s.name} {r.values[i]}건</title></circle>)}</g>)}
        {[...new Set([0,Math.floor((rows.length-1)/2),rows.length-1])].map(i=><text className="report-axis-label" key={i} x={x(i)} y={height-10} fill="#cbd5e1" textAnchor={i===0?'start':i===rows.length-1?'end':'middle'} fontSize="12">{rows[i]?.day.slice(5)}</text>)}
        {rows.map((r,i)=><rect key={r.day} x={Math.max(left,x(i)-(width-left-right)/Math.max(rows.length,1)/2)} y={top} width={(width-left-right)/Math.max(rows.length,1)} height={height-top-bottom} fill="transparent" onMouseEnter={()=>setSelected(r.day)} onClick={()=>setSelected(r.day)}/>) }
      </svg>
      <div className="report-chart-detail"><label>날짜별 수치<select value={active?.day||from} onChange={e=>setSelected(e.target.value)}>{rows.map(r=><option key={r.day}>{r.day}</option>)}</select></label><dl>{series.map((s,i)=><div key={s.key}><dt><span aria-hidden="true" style={{background:palette[i]}}/>{s.name}</dt><dd>{active?.values[i]||0}건</dd></div>)}</dl></div>
    </>}
  </section>;
}
export function Distribution({title,rows,caption}:{title:string;rows:{label:string;value:number}[];caption:string}){
  const total=rows.reduce((sum,r)=>sum+r.value,0),max=Math.max(1,...rows.map(r=>r.value));
  return <section className="report-chart" aria-label={title}><h2>{title}</h2><p>{caption}</p>{total===0?<p className="report-empty">집계할 항목이 없습니다.</p>:<ul className="report-bars">{rows.map((r,i)=><li key={`${r.label}:${i}`}><span className="report-bar-label">{reportingLabel(r.label)}</span><div className="report-bar-track" aria-hidden="true"><span style={{width:`${r.value/max*100}%`}}/></div><span className="report-bar-value">{r.value.toLocaleString('ko-KR')}건 <small>({(r.value/total*100).toFixed(1)}%)</small></span></li>)}</ul>}</section>;
}
export function CallbackDistribution({totals}:{totals:Metrics}){
  const states={pending:'미배정',assigned:'담당 지정',scheduled:'예약',in_progress:'진행 중',completed:'완료',failed:'실패',cancelled:'취소'};
  return <Distribution title="콜백 처리 상태" caption="기간 내 생성한 콜백의 현재 상태 비중입니다. 재예약은 같은 요청으로 집계합니다." rows={Object.entries(states).map(([key,label])=>({label,value:totals[key]||0}))}/>;
}
