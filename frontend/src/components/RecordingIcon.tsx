import {AudioLines,VolumeX,LoaderCircle,TriangleAlert} from 'lucide-react';
export function RecordingIcon({status}:{status?:string}){
 const ready=status==='READY',empty=!status||status==='NO_AUDIO',failed=status==='FAILED';
 const label=ready?'녹음 있음':empty?'녹음 없음':failed?'녹음 저장 확인 필요':'녹음 처리 중';
 const Icon=ready?AudioLines:empty?VolumeX:failed?TriangleAlert:LoaderCircle;
 return <span title={label} className={`inline-flex items-center ${ready?'text-indigo-300':'text-slate-400'}`}><Icon className="w-5 h-5" aria-hidden="true"/><span className="sr-only">{label}</span></span>;
}
