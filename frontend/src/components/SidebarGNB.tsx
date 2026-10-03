'use client';

import React, { useState } from 'react';
import { PhoneCall, Users, Ticket, BarChart3, Settings, ChevronUp, ExternalLink, LogIn } from 'lucide-react';
import { AgentStatus } from '../types';
import { buildLogoutUrl } from '@/lib/pkce';
import { apiJson } from '@/lib/api';

interface SidebarGNBProps {
  agentName: string;
  currentTab: string;
  onTabChange: (tab: string) => void;
  agentStatus: AgentStatus;
  statusLabel?:string;
  showSettings?: boolean;
  supportLink?: string;
}

export const SidebarGNB: React.FC<SidebarGNBProps> = ({
  agentName,
  currentTab,
  onTabChange,
  agentStatus,
  statusLabel,
  showSettings=false,
  supportLink,
}) => {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const menuItems = [
    { id: 'workspace', label: '상담 워크스페이스', icon: PhoneCall },
    { id: 'customers', label: '고객·거래처 디렉터리', icon: Users },
    { id: 'tickets', label: '티켓 & 상담 이력', icon: Ticket },
    { id: 'stats', label: '상담 통계·리포트', icon: BarChart3 },
    { id: 'settings', label: '시스템 설정', icon: Settings },
  ];

  const statusConfig: Record<AgentStatus, { label: string; color: string; bg: string }> = {
    online: { label: '온라인 (상담가능)', color: 'bg-emerald-500', bg: 'text-emerald-400' },
    busy: { label: '통화 중 (집중)', color: 'bg-rose-500', bg: 'text-rose-400' },
    away: { label: '자리비움 (휴식/식사)', color: 'bg-amber-500', bg: 'text-amber-400' },
    offline: { label: '퇴근 / 오프라인', color: 'bg-slate-500', bg: 'text-slate-400' },
  };

  return (
    <aside className="w-16 flex-shrink-0 bg-slate-950 text-slate-300 flex flex-col items-center py-3 border-r border-slate-800 select-none z-30">
      {/* Brand Logo */}
      <div className="flex flex-col items-center mb-6 group cursor-pointer" title="hellow CRM">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-950">
          <span className="text-lg tracking-tighter">h:</span>
        </div>
        <span className="text-[10px] font-semibold text-indigo-400 tracking-wider mt-1">hellow</span>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="flex-1 flex flex-col space-y-2 w-full px-2">
        {menuItems.filter(item=>item.id!=='settings'||showSettings).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative group w-full h-12 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <span className="absolute left-0 w-1 h-5 bg-white rounded-r-full" />
              )}
              {/* Tooltip on hover */}
              <span className="absolute left-16 ml-2 px-2.5 py-1 bg-slate-900 text-slate-100 text-xs rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity whitespace-nowrap z-50 border border-slate-700">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Customer Web Support Link */}
      {supportLink&&<div className="mb-3 px-2 w-full">
        <a
          href={supportLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative group w-full h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
          title="고객용 웹 상담창 열기 (새 탭)"
        >
          <ExternalLink className="w-4 h-4" />
          <span className="absolute left-16 ml-2 px-2.5 py-1 bg-slate-900 text-indigo-300 text-xs rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity whitespace-nowrap z-50 border border-indigo-900/50">
            고객용 웹 상담창 열기 ↗
          </span>
        </a>
      </div>}

      {/* Agent Profile & Status */}
      <div className="relative w-full px-2">
        <button
          onClick={() => setStatusMenuOpen(!statusMenuOpen)}
          className="relative w-full flex flex-col items-center p-1 rounded-xl hover:bg-slate-900 transition-colors"
          title="상담사 상태·로그아웃"
          aria-expanded={statusMenuOpen}
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
              {agentName}
            </div>
            {/* Live Status indicator dot */}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-slate-950 ${statusConfig[agentStatus].color}`}
            />
          </div>
          <ChevronUp className="w-3 h-3 text-slate-500 mt-1" />
        </button>

        {/* Status Dropdown Modal */}
        {statusMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setStatusMenuOpen(false)}
            />
            <div className="absolute bottom-14 left-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 text-xs z-50 text-slate-200">
              <div className="px-2 py-1.5 border-b border-slate-800 mb-1">
                <p className="font-semibold text-slate-100">
                  {agentName}
                </p>
                <p className="text-[11px] text-slate-400">{statusLabel||statusConfig[agentStatus].label}</p>
              </div>
              <div className="pt-1.5 mt-1.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={async () => {
                    const idToken = typeof window !== 'undefined' ? sessionStorage.getItem('hellow_id_token') : null;
                    await apiJson('/api/session/logout', {method:'POST'}).catch(()=>{});
                    document.cookie = 'hellow_logged_in=; path=/; max-age=0';
                    sessionStorage.clear();

                    try {
                      const configRes = await fetch('/api/platform/oidc-config');
                      const config = configRes.ok ? await configRes.json() : null;
                      const issuer = config?.issuer;
                      if(!issuer) throw new Error('OIDC issuer missing');
                      const clientId = config?.clientId || 'app';
                      const postLogoutRedirectUri = config?.postLogoutRedirectUri || `${window.location.origin}/`;

                      const logoutUrl = buildLogoutUrl(issuer, clientId, postLogoutRedirectUri, idToken);
                      window.location.href = logoutUrl;
                    } catch {
                      window.location.replace(new URL('/login', window.location.origin).href);
                    }
                  }}
                  className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg text-left text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 text-rose-400 rotate-180" />
                  <span>로그아웃</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
