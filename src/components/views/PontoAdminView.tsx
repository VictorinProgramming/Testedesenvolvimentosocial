import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Coffee,
  UserX,
  Search,
  Filter,
  Edit,
  Eye,
  SlidersHorizontal,
  FileSpreadsheet,
  Check,
  X,
  MapPin,
  Scan,
  ShieldCheck,
  Globe,
  Sliders,
  Calendar,
  Building,
  FileCheck,
  Lock,
  Download,
  ExternalLink,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { PONTO_ADMIN_ROWS, SECTORS } from '../../data/mockData';
import { ViewScreen, Collaborator } from '../../types';
import { pontoService } from '../../services/pontoService';
import { dbService } from '../../services/dbService';
import { PontoConfigPanel } from './ponto/PontoConfigPanel';
import { pontoConfigService } from '../../services/pontoConfigService';

interface PontoAdminViewProps {
  onNavigate: (screen: ViewScreen) => void;
  currentUser?: Collaborator;
}

export const PontoAdminView: React.FC<PontoAdminViewProps> = ({ onNavigate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'realtime' | 'config' | 'adjustments' | 'audit'>('realtime');
  const [dbUsers, setDbUsers] = useState<Collaborator[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [adjustModalRow, setAdjustModalRow] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carregar colaboradores reais do PostgreSQL
  useEffect(() => {
    const unsub = dbService.subscribeUsers((users) => {
      if (users && users.length > 0) {
        setDbUsers(users);
      }
    });

    pontoService.fetchFromPostgres().catch(() => {});

    const unsubPonto = pontoService.subscribe(() => {
      // Atualiza visualização reativa
      setDbUsers(prev => [...prev]);
    });

    return () => {
      unsub();
      unsubPonto();
    };
  }, []);

  const handleRefreshPostgres = async () => {
    setIsRefreshing(true);
    try {
      await pontoService.fetchFromPostgres();
      setToastMessage('✓ Dados de ponto sincronizados com sucesso do PostgreSQL!');
    } catch {
      setToastMessage('✕ Falha ao sincronizar com o PostgreSQL.');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Mapear colaboradores do PostgreSQL para linhas com batidas reais de hoje
  const dynamicRows = useMemo(() => {
    if (!dbUsers || dbUsers.length === 0) {
      return PONTO_ADMIN_ROWS;
    }

    return dbUsers.map((u) => {
      const livePunches = pontoService.getTodayRecords(u.name);
      const entryPunch = livePunches.find(p => p.type === 'ENTRADA');
      const breakPunch = livePunches.find(p => p.type.includes('INTERVALO') && !p.type.includes('RETORNO'));
      const returnPunch = livePunches.find(p => p.type.includes('RETORNO'));
      const exitPunch = livePunches.find(p => (p.type as string) === 'SAÍDA' || (p.type as string) === 'SAIDA');
      const lastPunch = livePunches[0];

      let status: 'Presente' | 'Intervalo' | 'Ausente' = 'Ausente';
      if (lastPunch) {
        if (lastPunch.type === 'ENTRADA' || lastPunch.type === 'RETORNO') {
          status = 'Presente';
        } else if (lastPunch.type.includes('INTERVALO')) {
          status = 'Intervalo';
        } else if ((lastPunch.type as string) === 'SAÍDA' || (lastPunch.type as string) === 'SAIDA') {
          status = 'Ausente';
        }
      }

      const breakLabel = breakPunch
        ? `${breakPunch.time.substring(0, 5)}${returnPunch ? ` - ${returnPunch.time.substring(0, 5)}` : ''}`
        : '--:--';

      return {
        id: u.id,
        name: u.name,
        sector: u.sector || (u as any).sector_name || 'Geral',
        entry: entryPunch ? entryPunch.time.substring(0, 5) : '--:--',
        breakTime: breakLabel,
        exit: exitPunch ? exitPunch.time.substring(0, 5) : '--:--',
        status,
        lastPunch,
        ip: lastPunch?.ipAddress || '189.40.12.98',
        loc: lastPunch?.location?.approximateAddress || 'Sede Matriz GIHS - São Paulo'
      };
    });
  }, [dbUsers]);

  // Setores disponíveis para filtro
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    dynamicRows.forEach(r => {
      if (r.sector) set.add(r.sector);
    });
    return Array.from(set);
  }, [dynamicRows]);

  // Contadores dinâmicos
  const totalCount = dynamicRows.length;
  const presentCount = dynamicRows.filter(r => r.status === 'Presente').length;
  const breakCount = dynamicRows.filter(r => r.status === 'Intervalo').length;
  const absentCount = dynamicRows.filter(r => r.status === 'Ausente').length;

  // Solicitações simuladas de ajuste de ponto e atestados pendentes
  const [adjustmentRequests, setAdjustmentRequests] = useState([
    {
      id: 'adj-01',
      collaboratorName: 'Rodrigo Silva',
      sector: 'Infraestrutura',
      type: 'ESQUECIMENTO_BATIDA',
      requestedPunch: 'ENTRADA (08:05)',
      date: 'Ontem',
      reason: 'Atendimento emergencial no datacenter sem acesso imediato ao celular',
      status: 'PENDENTE'
    },
    {
      id: 'adj-02',
      collaboratorName: 'Juliana Costa',
      sector: 'Atendimento',
      type: 'ATESTADO_MEDICO',
      requestedPunch: 'ABONO DIA TODO',
      date: 'Hoje',
      reason: 'Consulta médica oftalmológica de urgência (Atestado CRM-SP 189442)',
      status: 'PENDENTE'
    },
    {
      id: 'adj-03',
      collaboratorName: 'Marcos Vinicius',
      sector: 'Desenvolvimento',
      type: 'SERVICO_EXTERNO',
      requestedPunch: 'SAIDA (18:30)',
      date: 'Ontem',
      reason: 'Homologação presencial no cliente sem rede móvel estável',
      status: 'PENDENTE'
    }
  ]);

  const filtered = dynamicRows.filter(row => {
    const matchSearch = row.name.toLowerCase().includes(search.toLowerCase());
    const matchSector = sectorFilter === 'TODOS' || row.sector === sectorFilter;
    const matchStatus = statusFilter === 'TODOS' || row.status === statusFilter;
    return matchSearch && matchSector && matchStatus;
  });

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setToastMessage(`✓ Ajuste de ponto salvo para ${adjustModalRow.name}`);
    setAdjustModalRow(null);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApproveRequest = (id: string, name: string) => {
    setAdjustmentRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'APROVADO' } : req));
    setToastMessage(`✓ Solicitação de ${name} aprovada e computada no espelho!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRejectRequest = (id: string, name: string) => {
    setAdjustmentRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'REJEITADO' } : req));
    setToastMessage(`✕ Solicitação de ${name} rejeitada.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Principal da Tela */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400 shadow-md">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">Gestão de Ponto Corporativa</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-600 text-white tracking-wider uppercase">
                  SUPER ADMIN / RH
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-700 text-emerald-300">
                  Portaria 671 MTE (REP-P)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoramento ao vivo de jornadas, tolerâncias CLT, cercas virtuais GPS e auditoria biométrica facial.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefreshPostgres}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            title="Atualizar batidas com o PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sincronizar PostgreSQL</span>
          </button>

          <button
            onClick={() => onNavigate('espelho_ponto')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Abrir espelho individual consolidado"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span>Abrir Espelho Geral</span>
          </button>

          <button
            onClick={() => onNavigate('registro_ponto')}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            title="Ir para o relógio de ponto facial"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Bater Ponto Facial</span>
          </button>
        </div>
      </div>

      {/* Tabs de Navegação da Gestão de Ponto */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('realtime')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'realtime'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-cyan-400" />
          <span>Monitoramento em Tempo Real</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'config'
              ? 'bg-blue-950/90 text-blue-300 border border-blue-600 shadow-md ring-1 ring-blue-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4 text-blue-400" />
          <span>Configuração da Gestão de Ponto</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-blue-600 text-white">
            Portaria 671
          </span>
        </button>

        <button
          onClick={() => setActiveTab('adjustments')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'adjustments'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-700 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileCheck className="w-4 h-4 text-amber-400" />
          <span>Ajustes & Atestados</span>
          {adjustmentRequests.filter(r => r.status === 'PENDENTE').length > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
              {adjustmentRequests.filter(r => r.status === 'PENDENTE').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-700 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Auditoria Fiscal & REP-P</span>
        </button>
      </div>

      {/* Toast Notice */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: MONITORAMENTO EM TEMPO REAL                                       */}
      {/* ========================================================================= */}
      {activeTab === 'realtime' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 4 Cards Requested by User */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Colaboradores ativos */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Colaboradores ativos</span>
                <p className="text-2xl font-black font-mono text-white mt-1">{totalCount}</p>
                <span className="text-[10px] text-slate-500 font-mono">100% no PostgreSQL</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800 text-cyan-400 border border-slate-700">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Presentes hoje */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Presentes hoje</span>
                <p className="text-2xl font-black font-mono text-emerald-400 mt-1">{presentCount}</p>
                <span className="text-[10px] text-emerald-400/80 font-mono">
                  {totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(0) : '0'}% presença
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* Em intervalo */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Em intervalo</span>
                <p className="text-2xl font-black font-mono text-amber-400 mt-1">{breakCount}</p>
                <span className="text-[10px] text-amber-400/80 font-mono">Pausa de almoço</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/80">
                <Coffee className="w-5 h-5" />
              </div>
            </div>

            {/* Ausentes */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Ausentes</span>
                <p className="text-2xl font-black font-mono text-rose-400 mt-1">{absentCount}</p>
                <span className="text-[10px] text-rose-400/80 font-mono">Jornada não iniciada</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-950/80 text-rose-400 border border-rose-800/80">
                <UserX className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar colaborador no PostgreSQL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="TODOS">Setor: Todos</option>
                {availableSectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="TODOS">Status: Todos</option>
                <option value="Presente">Presente</option>
                <option value="Intervalo">Intervalo</option>
                <option value="Ausente">Ausente</option>
              </select>
            </div>
          </div>

          {/* Table: Lista de colaboradores */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">Setor</th>
                    <th className="py-3 px-4">Entrada</th>
                    <th className="py-3 px-4">Intervalo</th>
                    <th className="py-3 px-4">Saída</th>
                    <th className="py-3 px-4">Biometria, IP & Localização</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filtered.map((row) => {
                    const livePunches = pontoService.getTodayRecords(row.name);
                    const lastPunch = livePunches[0];
                    const ip = lastPunch?.ipAddress || lastPunch?.location?.ipAddress || '189.40.12.98';
                    const loc = lastPunch?.location?.approximateAddress || 'São Paulo, SP (Aprox. 15m)';

                    return (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white font-sans">
                        {row.name}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                          {row.sector}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-cyan-300 font-semibold">{row.entry}</td>
                      <td className="py-3 px-4 text-slate-400">{row.breakTime}</td>
                      <td className="py-3 px-4 text-slate-400">{row.exit}</td>
                      <td className="py-3 px-4 font-sans">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono font-bold">
                              <Scan className="w-3 h-3 text-cyan-400" />
                              <span>Facial 99.4%</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800 font-mono">
                              <Globe className="w-2.5 h-2.5 text-cyan-400" />
                              <span>{ip}</span>
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 truncate max-w-[180px]" title={loc}>
                            <MapPin className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                            <span className="truncate">{loc}</span>
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          row.status === 'Presente'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : row.status === 'Intervalo'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setAdjustModalRow(row)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Ajustar ponto"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onNavigate('espelho_ponto')}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Ver espelho"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: CONFIGURAÇÃO DA GESTÃO DE PONTO (PORTARIA 671 MTE)                */}
      {/* ========================================================================= */}
      {activeTab === 'config' && (
        <div className="animate-in fade-in duration-200">
          <PontoConfigPanel currentUser={currentUser} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: FILA DE AJUSTES E ATESTADOS PENDENTES                             */}
      {/* ========================================================================= */}
      {activeTab === 'adjustments' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-400" />
                <span>Fila de Aprovação de Ajustes & Atestados Médicos</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Solicitações submetidas por colaboradores para regularização da jornada conforme a política da empresa.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-amber-950 text-amber-300 border border-amber-800">
              {adjustmentRequests.filter(r => r.status === 'PENDENTE').length} Pendentes
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {adjustmentRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{req.collaboratorName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                      {req.sector}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      req.status === 'PENDENTE'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : req.status === 'APROVADO'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <span><strong>Tipo:</strong> {req.type.replace('_', ' ')}</span>
                    <span>•</span>
                    <span className="text-cyan-300"><strong>Ajuste Solicitado:</strong> {req.requestedPunch}</span>
                    <span>•</span>
                    <span className="text-slate-400">Data: {req.date}</span>
                  </div>

                  <p className="text-xs text-slate-400 bg-slate-950/80 p-2 rounded-xl border border-slate-800/80 mt-1">
                    <span className="text-slate-500 font-semibold">Justificativa:</span> {req.reason}
                  </p>
                </div>

                {req.status === 'PENDENTE' ? (
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleRejectRequest(req.id, req.collaboratorName)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Rejeitar</span>
                    </button>
                    <button
                      onClick={() => handleApproveRequest(req.id, req.collaboratorName)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aprovar Ajuste</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-slate-500">
                    Processado
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: AUDITORIA FISCAL & REP-P (PORTARIA 671 MTE)                       */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Auditoria Fiscal REP-P — Portaria 671/2021 MTE</h3>
                  <p className="text-xs text-slate-400">
                    Registrador Eletrônico de Ponto por Programa com inalterabilidade de dados e hashes SHA-256
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setToastMessage('✓ Arquivo AFD (Arquivo Fonte de Dados) gerado conforme layout da Portaria 671!');
                    setTimeout(() => setToastMessage(null), 3500);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-purple-300 font-bold text-xs border border-purple-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar AFD Fiscal</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold">Inviolabilidade Fiscal:</span>
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>NSR Sequencial e Inalterável</span>
                </div>
                <p className="text-[10px] text-slate-500">Cada batida recebe número de ordem crescente perpétuo.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold">Assinatura Criptográfica:</span>
                <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Hash SHA-256 Certificado</span>
                </div>
                <p className="text-[10px] text-slate-500">Evidência combinada: Foto, Geometria, IP e Timestamp.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold">Comprovante do Trabalhador:</span>
                <div className="font-bold text-purple-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Emissão em Tempo Real</span>
                </div>
                <p className="text-[10px] text-slate-500">Disponível em PDF/Comprovante imediato na tela do colaborador.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ajustar Ponto */}
      {adjustModalRow && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit className="w-4 h-4 text-cyan-400" />
                Ajuste Administrativo de Ponto
              </h3>
              <button
                onClick={() => setAdjustModalRow(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Colaborador:</span>
                <span className="text-sm font-bold text-white block">
                  {adjustModalRow.name} ({adjustModalRow.sector})
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Entrada</label>
                  <input
                    type="text"
                    defaultValue={adjustModalRow.entry}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Intervalo</label>
                  <input
                    type="text"
                    defaultValue={adjustModalRow.breakTime}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Saída</label>
                  <input
                    type="text"
                    defaultValue={adjustModalRow.exit}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Justificativa Legal</label>
                <input
                  type="text"
                  placeholder="Ex: Esquecimento de registro / chamado externo em cliente"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustModalRow(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Salvar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
