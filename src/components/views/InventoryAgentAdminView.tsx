import React, { useState, useEffect, useMemo } from 'react';
import {
  Laptop,
  Search,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  HardDrive,
  Cpu,
  Layers,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  ChevronRight,
  ChevronLeft,
  X,
  Filter,
  Download,
  Terminal,
  Database,
  ExternalLink,
  Lock,
  ArrowUpDown,
  Sparkles,
  RotateCw,
  RotateCcw,
  Box,
  Key,
  FolderOpen,
  Play,
  Copy,
  Check,
  Upload,
  FileText,
  Clipboard
} from 'lucide-react';
import {
  Collaborator,
  ViewScreen,
  InventoryAgent,
  AgentSoftware,
  AgentInventoryHistory,
  AgentIdentityConflict,
  InventoryAgentMetrics
} from '../../types';
import { apiBackendService } from '../../services/apiBackendService';
import { useTheme } from '../../contexts/ThemeContext';

interface InventoryAgentAdminViewProps {
  currentUser?: Collaborator;
  onNavigate?: (screen: ViewScreen) => void;
}

export const InventoryAgentAdminView: React.FC<InventoryAgentAdminViewProps> = ({
  currentUser,
  onNavigate
}) => {
  const { cardColor, isCardLight, primaryColor, isLight, isDark } = useTheme();

  // 1. DUPLA CAMADA DE SEGURANÇA: Se não for SUPER_ADMIN, bloqueia e renderiza tela de Acesso Proibido
  const isSuperAdmin = currentUser?.userRole === 'SUPER_ADMIN';

  // Estados principais
  const [activeTab, setActiveTab] = useState<'agents' | 'conflicts' | 'deploy'>('agents');
  const [agents, setAgents] = useState<InventoryAgent[]>([]);
  const [metrics, setMetrics] = useState<InventoryAgentMetrics | null>(null);
  const [conflicts, setConflicts] = useState<AgentIdentityConflict[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [osFilter, setOsFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [securityFilter, setSecurityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('last_heartbeat');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal / Drawer de Detalhes do Dispositivo
  const [selectedAgent, setSelectedAgent] = useState<InventoryAgent | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<
    'overview' | 'os' | 'memory' | 'storage' | 'software' | 'security' | 'history' | 'agent'
  >('overview');
  const [softwareList, setSoftwareList] = useState<AgentSoftware[]>([]);
  const [softwareSearch, setSoftwareSearch] = useState('');
  const [softwareTotal, setSoftwareTotal] = useState(0);
  const [isSoftwareLoading, setIsSoftwareLoading] = useState(false);
  const [agentHistory, setAgentHistory] = useState<AgentInventoryHistory[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Estados do Modal de Teste / Simulação do Agente GIHS Windows
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testPreset, setTestPreset] = useState<'notebook' | 'desktop' | 'workstation' | 'custom'>('notebook');
  const [testForm, setTestForm] = useState({
    hostname: 'TI-NOTE-DELL-01',
    manufacturer: 'Dell Inc.',
    model: 'Latitude 5440 Enterprise Core i7',
    username: 'victor.hugo (Super Admin)',
    os: 'Windows 11 Pro 64-bit (23H2)'
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; agentId?: string; assetId?: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Helper para presets rápidos de teste
  const applyPreset = (preset: 'notebook' | 'desktop' | 'workstation' | 'custom') => {
    setTestPreset(preset);
    if (preset === 'notebook') {
      setTestForm({
        hostname: `TI-NOTE-DELL-${Math.floor(10 + Math.random() * 90)}`,
        manufacturer: 'Dell Inc.',
        model: 'Latitude 5440 Enterprise Core i7',
        username: 'colaborador.ti',
        os: 'Windows 11 Pro 64-bit (23H2)'
      });
    } else if (preset === 'desktop') {
      setTestForm({
        hostname: `FIN-DESK-HP-${Math.floor(10 + Math.random() * 90)}`,
        manufacturer: 'HP',
        model: 'ProDesk 400 G9 Mini Core i5',
        username: 'analista.financeiro',
        os: 'Windows 11 Pro 64-bit (23H2)'
      });
    } else if (preset === 'workstation') {
      setTestForm({
        hostname: `ENG-CAD-LENOVO-${Math.floor(10 + Math.random() * 90)}`,
        manufacturer: 'Lenovo',
        model: 'ThinkStation P360 Tower Xeon/RTX',
        username: 'engenharia.projetos',
        os: 'Windows 11 Enterprise (23H2)'
      });
    }
  };

  // Executa o teste de coleta com retorno em tempo real
  const handleRunTest = async (overrideForm?: typeof testForm) => {
    setIsTesting(true);
    setTestResult(null);
    const targetPayload = overrideForm || testForm;
    try {
      const res = await apiBackendService.testInventoryAgent(targetPayload, currentUser);
      if (res && res.success) {
        setTestResult(res);
        showToast(`Coleta do Agente GIHS concluída com 100% de sucesso! Computador "${targetPayload.hostname}" registrado e associado ao patrimônio.`);
        await loadData();
        if (res.agentId) {
          const detail = await apiBackendService.getInventoryAgentById(res.agentId, currentUser).catch(() => null);
          if (detail && detail.data) {
            setSelectedAgent(detail.data);
            setActiveDrawerTab('overview');
          }
        }
      } else {
        const errMsg = res?.error || res?.message || 'Erro durante a coleta de teste.';
        setTestResult({ success: false, message: errMsg });
        showToast(`Erro no teste: ${errMsg}`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Falha de comunicação com o servidor';
      setTestResult({ success: false, message: msg });
      showToast(`Erro: ${msg}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Estados do Modal de Importação de Coleta Real (.json / Clipboard)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleParseImportJson = (text: string) => {
    setImportJsonText(text);
    setImportError(null);
    try {
      if (!text.trim()) {
        setImportPreview(null);
        return;
      }
      const parsed = JSON.parse(text);
      if (!parsed.identity && !parsed.hostname) {
        setImportError('JSON inválido: não contém dados de identidade do computador.');
        setImportPreview(null);
        return;
      }
      setImportPreview(parsed);
    } catch {
      setImportError('Texto não é um JSON válido. Cole o conteúdo do arquivo GIHS-Inventario-Real.json.');
      setImportPreview(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleParseImportJson(content);
      }
    };
    reader.readAsText(file);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleParseImportJson(text);
        showToast('Dados colados da área de transferência!');
      } else {
        showToast('Área de transferência vazia.');
      }
    } catch {
      showToast('Permissão de clipboard não concedida. Cole manualmente na caixa.');
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const res = await apiBackendService.ingestInventory(importPreview, currentUser);
      if (res && res.success) {
        showToast(`Computador ${importPreview.identity?.hostname || 'Real'} importado com sucesso!`);
        setIsImportModalOpen(false);
        setImportJsonText('');
        setImportPreview(null);
        loadData();
      } else {
        setImportError(res?.message || 'Falha ao processar telemetria no servidor.');
      }
    } catch (err: any) {
      setImportError(err?.message || 'Erro de conexão ao enviar dados.');
    } finally {
      setIsImporting(false);
    }
  };

  // Helper Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Download e Cópia do Instalador / Agente Real
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [copiedFullScript, setCopiedFullScript] = useState(false);
  const [forceHeartbeatModalAgent, setForceHeartbeatModalAgent] = useState<InventoryAgent | null>(null);
  const [copiedHeartbeatCmd, setCopiedHeartbeatCmd] = useState(false);

  const handleDownloadForceHeartbeatScript = async (format: 'bat' | 'cmd' = 'bat') => {
    try {
      setIsDownloading(true);
      const endpoint = `/api/agent/force-heartbeat.${format}?serverUrl=${encodeURIComponent(window.location.origin)}`;
      const resp = await fetch(endpoint);
      if (!resp.ok) throw new Error('Não foi possível obter o arquivo');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Forcar-Heartbeat.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`Arquivo Forcar-Heartbeat.${format} baixado com sucesso!`);
    } catch {
      window.open(`/api/agent/force-heartbeat.${format}?serverUrl=${encodeURIComponent(window.location.origin)}`, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadScript = async (format: 'bat' | 'cmd' | 'ps1') => {
    try {
      setIsDownloading(true);
      let endpoint = `/api/agent/install.${format}?serverUrl=${encodeURIComponent(window.location.origin)}`;
      if (format === 'ps1') {
        endpoint = `/api/agent/install.ps1?download=true&serverUrl=${encodeURIComponent(window.location.origin)}`;
      }
      const resp = await fetch(endpoint);
      if (!resp.ok) throw new Error('Não foi possível obter o arquivo');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Instalar-Agente-GIHS.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`Arquivo Instalar-Agente-GIHS.${format} baixado com sucesso!`);
    } catch (err: any) {
      showToast('Tentando download alternativo direto...');
      window.open(`/api/agent/install.${format}?serverUrl=${encodeURIComponent(window.location.origin)}`, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyFullScript = async () => {
    try {
      const resp = await fetch(`/api/agent/install.ps1?serverUrl=${encodeURIComponent(window.location.origin)}`);
      const text = await resp.text();
      await navigator.clipboard.writeText(text);
      setCopiedFullScript(true);
      showToast('Código PowerShell completo copiado! Abra o PowerShell e cole.');
      setTimeout(() => setCopiedFullScript(false), 4000);
    } catch {
      showToast('Erro ao copiar código. Use os botões de download.');
    }
  };

  // Carrega agentes e métricas do Backend
  const loadData = async () => {
    if (!isSuperAdmin) return;
    setIsLoading(true);
    try {
      const [agentsRes, metricsRes, conflictsRes] = await Promise.all([
        apiBackendService.getInventoryAgents({
          search: searchTerm,
          os: osFilter,
          status: statusFilter,
          security_status: securityFilter,
          page,
          limit: 10,
          sort_by: sortBy,
          sort_order: sortOrder
        }, currentUser),
        apiBackendService.getInventoryAgentMetrics(currentUser).catch(() => ({ success: false, data: null })),
        apiBackendService.getInventoryAgentConflicts(currentUser).catch(() => ({ success: false, data: [] }))
      ]);

      if (agentsRes && agentsRes.success) {
        setAgents(agentsRes.data || []);
        setTotalPages(agentsRes.totalPages || 1);
        setTotalCount(agentsRes.total || 0);
      }
      if (metricsRes && metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      if (conflictsRes && conflictsRes.success && Array.isArray(conflictsRes.data)) {
        setConflicts(conflictsRes.data);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar agentes de inventário:', err?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, osFilter, statusFilter, securityFilter, sortBy, sortOrder, page]);

  // Carrega softwares do agente selecionado
  const loadSoftware = async (agentId: string) => {
    setIsSoftwareLoading(true);
    try {
      const res = await apiBackendService.getInventoryAgentSoftware(agentId, {
        search: softwareSearch,
        limit: 50,
        offset: 0
      }, currentUser);
      if (res && res.success) {
        setSoftwareList(res.data || []);
        setSoftwareTotal(res.total || 0);
      }
    } catch (err) {
      console.warn('Erro ao carregar softwares:', err);
    } finally {
      setIsSoftwareLoading(false);
    }
  };

  // Carrega histórico do agente selecionado
  const loadHistory = async (agentId: string) => {
    try {
      const res = await apiBackendService.getInventoryAgentHistory(agentId, currentUser);
      if (res && res.success) {
        setAgentHistory(res.data || []);
      }
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err);
    }
  };

  const handleOpenDrawer = (agent: InventoryAgent) => {
    setSelectedAgent(agent);
    setActiveDrawerTab('overview');
    loadSoftware(agent.id);
    loadHistory(agent.id);
  };

  const handleForceScan = async (agentId: string) => {
    setIsActionLoading(true);
    try {
      const res = await apiBackendService.forceInventoryAgentScan(agentId, currentUser);
      if (res && res.success) {
        showToast(res.message || 'Varredura completa solicitada com sucesso!');
        loadData();
      } else {
        showToast('Erro ao solicitar varredura.');
      }
    } catch (err: any) {
      showToast(err.message || 'Falha na comunicação.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleForceHeartbeat = async (agentId: string) => {
    setIsActionLoading(true);
    try {
      const res = await apiBackendService.forceInventoryAgentHeartbeat(agentId, currentUser);
      if (res && res.success) {
        showToast(res.message || 'Heartbeat forçado e atualizado com sucesso no servidor!');
        loadData();
        if (selectedAgent && selectedAgent.id === agentId) {
          setSelectedAgent(prev => prev ? { ...prev, agent_status: 'ONLINE', last_heartbeat: new Date().toISOString() } : null);
        }
      } else {
        showToast('Erro ao forçar heartbeat.');
      }
    } catch (err: any) {
      showToast(err.message || 'Falha na comunicação.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResolveConflict = async (conflictId: number) => {
    try {
      const res = await apiBackendService.resolveInventoryAgentConflict(conflictId, {
        notes: 'Conflito analisado e resolvido via painel de administração',
        action: 'ACCEPT_NEW_UUID'
      }, currentUser);
      if (res && res.success) {
        showToast('Conflito resolvido com sucesso!');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao resolver conflito.');
    }
  };

  // Formatação de bytes para GB / TB legível
  const formatBytes = (bytes: number | undefined | null) => {
    if (!bytes || bytes <= 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(1)} TB`;
    }
    return `${gb.toFixed(1)} GB`;
  };

  // Formatação de tempo relativo (ex: "há 2 minutos")
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Nunca';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Online agora';
    if (diffSec < 90) return 'há 1 min';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays}d`;
  };

  // Se o usuário não for SUPER_ADMIN, proteção real contra navegação direta
  if (!isSuperAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/95 border border-rose-500/40 p-8 rounded-3xl text-center space-y-4 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white tracking-wide">
            Acesso Restrito: Exclusivo SUPER_ADMIN
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            O módulo administrativo de <strong>Inventário de TI e Agentes Windows</strong> é de visualização e controle exclusivo de Super Administradores.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate?.('equipamentos')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-700 cursor-pointer"
            >
              Voltar para Gestão de Ativos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER DA TELA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-md">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Inventário de TI & Agentes Windows
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white tracking-wider uppercase">
                  SUPER ADMIN
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 border border-emerald-700 text-emerald-300">
                  C# .NET 8 Worker
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Coleta técnica automatizada de computadores Windows, deduplicação em tempo real e integração ao PostgreSQL.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* BOTÃO PRINCIPAL: INSTALAÇÃO E DOWNLOAD DO AGENTE REAL */}
          <button
            onClick={() => setDownloadModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg flex items-center gap-2 cursor-pointer border border-blue-400/50"
            title="Abrir opções de instalação no computador real (.BAT, .CMD, .PS1 ou comando de 1 linha)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar no Computador Real</span>
          </button>

          {/* BOTÃO DE CARREGAR COLETA REAL (COLAR / ARQUIVO) */}
          <button
            onClick={() => {
              setIsImportModalOpen(true);
              setImportJsonText('');
              setImportPreview(null);
              setImportError(null);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg flex items-center gap-2 cursor-pointer border border-emerald-400/50"
            title="Importar dados coletados do computador real (Clipboard ou arquivo GIHS-Inventario-Real.json)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Carregar Coleta Real</span>
          </button>

          <button
            onClick={() => {
              const cmd = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}; (New-Object Net.WebClient).DownloadString("${window.location.origin}/api/agent/install.ps1") | iex`;
              navigator.clipboard.writeText(cmd);
              setCopiedCmd(true);
              showToast('Comando PowerShell Universal copiado! (Domínio & Fora de Domínio)');
              setTimeout(() => setCopiedCmd(false), 3000);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
            title="Copiar comando PowerShell universal (funciona dentro e fora de domínio, com ou sem proxy)"
          >
            {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedCmd ? 'Copiado!' : 'Copiar 1-Linha PS'}</span>
          </button>

          <button
            onClick={() => {
              setIsTestModalOpen(true);
              setTestResult(null);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Abrir tela de simulação e homologação rápida do agente nativo"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simulação Rápida</span>
          </button>

          <button
            onClick={() => onNavigate?.('equipamentos')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>Ver em Patrimônio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div style={{ backgroundColor: cardColor }} className="p-4 rounded-2xl border border-slate-800 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Computadores</span>
            <Laptop className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{metrics?.totalAgents ?? totalCount}</div>
          <div className="text-[11px] text-slate-400">Total inventariado</div>
        </div>

        <div style={{ backgroundColor: cardColor }} className="p-4 rounded-2xl border border-slate-800 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Agentes Online</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{metrics?.onlineCount ?? 0}</div>
          <div className="text-[11px] text-slate-400">Heartbeat a cada 1:00 hora</div>
        </div>

        <div style={{ backgroundColor: cardColor }} className="p-4 rounded-2xl border border-slate-800 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Segurança OK</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">{metrics?.protectedCount ?? 0}</div>
          <div className="text-[11px] text-slate-400">Antivírus & BitLocker</div>
        </div>

        <div style={{ backgroundColor: cardColor }} className="p-4 rounded-2xl border border-slate-800 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Conflitos</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">{conflicts.length}</div>
          <div className="text-[11px] text-slate-400">Requer triagem</div>
        </div>

        <div style={{ backgroundColor: cardColor }} className="p-4 rounded-2xl border border-slate-800 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>RAM Gerenciada</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300">{formatBytes(metrics?.totalRamBytes)}</div>
          <div className="text-[11px] text-slate-400">Memória total</div>
        </div>

        <div style={{ backgroundColor: cardColor }} className="p-4 rounded-2xl border border-slate-800 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Softwares</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300">{metrics?.totalSoftwareTracked ?? 0}</div>
          <div className="text-[11px] text-slate-400">Instalações ativas</div>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO DA TELA */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'agents'
              ? 'bg-blue-950/80 text-blue-300 border border-blue-700 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Laptop className="w-4 h-4 text-blue-400" />
          <span>Dispositivos Inventariados ({totalCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('conflicts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'conflicts'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-700 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Conflitos de Identidade ({conflicts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('deploy')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'deploy'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-700 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Terminal className="w-4 h-4 text-purple-400" />
          <span>Instalação & Guia de Deploy (.NET 8)</span>
        </button>
      </div>

      {/* TAB 1: LISTA DE DISPOSITIVOS INVENTARIADOS */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          {/* BANNER DE ALERTA: COMPUTADORES COM ÚLTIMO HEARTBEAT PENDENTE (1:00 HORA) */}
          {agents.some(a => a.agent_status === 'OFFLINE' || (a.last_heartbeat && (Date.now() - new Date(a.last_heartbeat).getTime()) > 60 * 60 * 1000)) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-pink-950/50 border border-amber-600/40 text-amber-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg animate-in fade-in duration-200">
              <div className="flex items-start md:items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Último Heartbeat não coletado no ciclo de 1:00 hora</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Ciclo: 1h Automático
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    O agente no Windows coleta dados de hardware e transmite o pulso a cada 1:00 hora a partir de <code className="text-pink-300 bg-slate-950 px-1 py-0.5 rounded font-mono text-[10px] border border-slate-800">C:\ProgramData\GIHS\Agent\GIHS-Inventario-Real.json</code>.
                    Caso o pulso não tenha sido recebido, acesse o computador instalado para forçar o heartbeat em tempo real.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                <button
                  onClick={() => {
                    const targetAgent = agents.find(a => a.agent_status === 'OFFLINE' || (a.last_heartbeat && (Date.now() - new Date(a.last_heartbeat).getTime()) > 60 * 60 * 1000)) || agents[0];
                    if (targetAgent) setForceHeartbeatModalAgent(targetAgent);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Activity className="w-4 h-4" />
                  <span>Acessar Agente e Forçar Heartbeat</span>
                </button>
                <button
                  onClick={() => handleDownloadForceHeartbeatScript('bat')}
                  disabled={isDownloading}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Baixar Forcar-Heartbeat.bat para executar na máquina"
                >
                  <Download className="w-3.5 h-3.5 text-pink-400" />
                  <span>Baixar .BAT</span>
                </button>
              </div>
            </div>
          )}

          {/* BARRA DE FILTROS & BUSCA */}
          <div style={{ backgroundColor: cardColor }} className="p-4 rounded-2xl border border-slate-800 space-y-3 shadow-md">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por Hostname, Serial, Usuário, Modelo, Fabricante, IP ou Patrimônio..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Filtro de SO */}
                <select
                  value={osFilter}
                  onChange={(e) => { setOsFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-700/80 text-slate-300 text-xs focus:outline-none"
                >
                  <option value="ALL">Todos os Sistemas</option>
                  <option value="Windows 11">Windows 11</option>
                  <option value="Windows 10">Windows 10</option>
                  <option value="Windows Server">Windows Server</option>
                </select>

                {/* Filtro Status Agente */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-700/80 text-slate-300 text-xs focus:outline-none"
                >
                  <option value="ALL">Status do Agente (Todos)</option>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="ALERT">Alerta</option>
                  <option value="CONFLICT">Conflito</option>
                </select>

                {/* Filtro Segurança */}
                <select
                  value={securityFilter}
                  onChange={(e) => { setSecurityFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-700/80 text-slate-300 text-xs focus:outline-none"
                >
                  <option value="ALL">Segurança (Todos)</option>
                  <option value="PROTEGIDO">Protegido</option>
                  <option value="ALERTA">Alerta</option>
                  <option value="VULNERAVEL">Vulnerável</option>
                </select>

                {/* Ordenação */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-700/80 text-slate-300 text-xs focus:outline-none"
                >
                  <option value="last_heartbeat">Último Contato</option>
                  <option value="hostname">Nome do Computador</option>
                  <option value="last_inventory">Último Inventário</option>
                  <option value="software_count">Qtd Aplicativos</option>
                </select>

                <button
                  onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
                  className="p-2 rounded-xl bg-slate-950/60 border border-slate-700/80 text-slate-300 hover:text-white transition-colors"
                  title="Inverter Ordem"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* TABELA DE DISPOSITIVOS INVENTARIADOS */}
          <div style={{ backgroundColor: cardColor }} className="rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4">Computador / Host</th>
                    <th className="py-3.5 px-3">Sistema Operacional</th>
                    <th className="py-3.5 px-3">Usuário Atual</th>
                    <th className="py-3.5 px-3">Memória RAM</th>
                    <th className="py-3.5 px-3">Armazenamento</th>
                    <th className="py-3.5 px-3 text-center">Softwares</th>
                    <th className="py-3.5 px-3">Segurança</th>
                    <th className="py-3.5 px-3">Último Contato</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                        Carregando inventário de dispositivos do PostgreSQL...
                      </td>
                    </tr>
                  ) : agents.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <div className="max-w-xl mx-auto space-y-4 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl">
                          <div className="w-14 h-14 rounded-2xl bg-blue-950/90 border border-blue-700/80 flex items-center justify-center mx-auto text-blue-400 shadow-lg shadow-blue-950/40">
                            <Laptop className="w-7 h-7" />
                          </div>
                          
                          <div className="space-y-1.5">
                            <div className="font-black text-white text-base">Nenhum computador conectado ainda</div>
                            <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                              Pronto para realizar a homologação e teste no <strong>computador real que você está usando agora</strong>!
                              Baixe o executável para Windows ou cole o comando de 1-linha no PowerShell.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            <button
                              onClick={() => setDownloadModalOpen(true)}
                              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xl inline-flex items-center gap-2 cursor-pointer border border-blue-400/50"
                              title="Abrir instalador para o seu Windows"
                            >
                              <Download className="w-4 h-4" />
                              <span>Instalar no Computador Real</span>
                            </button>

                            <button
                              onClick={() => {
                                setIsImportModalOpen(true);
                                setImportJsonText('');
                                setImportPreview(null);
                                setImportError(null);
                              }}
                              className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xl inline-flex items-center gap-2 cursor-pointer border border-emerald-400/50"
                              title="Carregar relatório ou colar dados do computador real"
                            >
                              <Upload className="w-4 h-4" />
                              <span>Carregar Coleta Real</span>
                            </button>

                            <button
                              onClick={() => {
                                const cmd = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}; (New-Object Net.WebClient).DownloadString("${window.location.origin}/api/agent/install.ps1") | iex`;
                                navigator.clipboard.writeText(cmd);
                                setCopiedCmd(true);
                                showToast('Comando PowerShell Universal copiado!');
                                setTimeout(() => setCopiedCmd(false), 3000);
                              }}
                              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700 inline-flex items-center gap-2 cursor-pointer"
                              title="Copiar comando de 1-linha compatível com Domínio, Workgroup e computadores fora de domínio"
                            >
                              {copiedCmd ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                              <span>{copiedCmd ? 'Comando Copiado!' : 'Copiar 1-Linha PS'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setIsTestModalOpen(true);
                                setTestResult(null);
                              }}
                              className="px-3.5 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all border border-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Ou Teste Simulado</span>
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-800/80 leading-normal">
                            Assim que você executar no seu computador, ele aparecerá instantaneamente nesta tela com telemetria 24/7 e também na tela de <strong>Patrimônio (Gestão de Bens de TI)</strong>.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    agents.map((agent) => {
                      const totalRam = agent.memory_info?.total_bytes;
                      const ramPct = agent.memory_info?.used_percentage;
                      const mainVol = agent.storage_info?.volumes?.[0];
                      const isOnline = agent.agent_status === 'ONLINE';

                      return (
                        <tr
                          key={agent.id}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          onClick={() => handleOpenDrawer(agent)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                              <span>{agent.hostname}</span>
                              {agent.asset_tag && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                                  {agent.asset_tag}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {agent.manufacturer} {agent.model} • {agent.ip_address || 'IP n/d'}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="text-white font-medium">
                              {agent.os_info?.name || 'Windows'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {agent.os_info?.version || ''} ({agent.os_info?.build || 'Build n/d'})
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5 text-slate-200">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{agent.current_user || '—'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="text-slate-200 font-medium">
                              {formatBytes(totalRam)}
                            </div>
                            {ramPct !== undefined && (
                              <div className="text-[10px] text-slate-400">
                                {ramPct}% em uso
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-3">
                            {mainVol ? (
                              <div className="space-y-1 w-28">
                                <div className="flex justify-between text-[10px] text-slate-300">
                                  <span>{mainVol.drive_letter}</span>
                                  <span>{formatBytes(mainVol.free_bytes)} livres</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      mainVol.used_percentage > 90 ? 'bg-rose-500' : mainVol.used_percentage > 75 ? 'bg-amber-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(100, mainVol.used_percentage)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 font-mono">
                              {agent.software_count || 0}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            {agent.security_status === 'PROTEGIDO' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                Protegido
                              </span>
                            ) : agent.security_status === 'ALERTA' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                                <ShieldAlert className="w-3 h-3 text-amber-400" />
                                Alerta
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                                <ShieldX className="w-3 h-3 text-rose-400" />
                                Vulnerável
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                              <span className="text-slate-200">{formatRelativeTime(agent.last_heartbeat)}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Agente v{agent.agent_version}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            {agent.agent_status === 'ONLINE' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                ONLINE
                              </span>
                            ) : agent.agent_status === 'CONFLICT' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                CONFLITO
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-500/10 text-slate-400 border border-slate-500/30">
                                OFFLINE
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setForceHeartbeatModalAgent(agent)}
                                className="px-2.5 py-1 rounded-xl bg-pink-950/60 hover:bg-pink-900 border border-pink-700/60 text-pink-300 hover:text-white transition-all flex items-center gap-1.5 text-[11px] font-bold shadow-sm cursor-pointer"
                                title="Forçar Heartbeat em tempo real (Origem: C:\ProgramData\GIHS\Agent\GIHS-Inventario-Real.json)"
                              >
                                <Activity className="w-3.5 h-3.5 text-pink-400" />
                                <span>Forçar Heartbeat</span>
                              </button>

                              <button
                                onClick={() => handleOpenDrawer(agent)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                title="Ver Detalhes Técnicos Completos"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Mostrando página {page} de {totalPages} ({totalCount} computadores)
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-mono">{page}</span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CONFLITOS DE IDENTIDADE */}
      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          <div style={{ backgroundColor: cardColor }} className="p-5 rounded-2xl border border-amber-900/40 bg-amber-950/20 text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>Deduplicação e Prevenção de Conflitos de Hardware</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Conforme as diretrizes de integridade de patrimônio do GIHS: Quando um novo agente se conecta com um número de série já existente, mas com UUID de máquina diferente, o sistema **NÃO sobrescreve automaticamente o ativo** para evitar contaminação de dados. Os conflitos são registrados abaixo para validação do Super Administrador.
            </p>
          </div>

          {conflicts.length === 0 ? (
            <div style={{ backgroundColor: cardColor }} className="p-12 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
              <div className="text-white font-bold">Nenhum conflito de identidade pendente</div>
              <div className="text-xs">Todos os computadores e agentes estão com suas identidades íntegras e associadas.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {conflicts.map((c) => (
                <div key={c.id} style={{ backgroundColor: cardColor }} className="p-5 rounded-2xl border border-amber-700/60 space-y-3 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Conflito #{c.id} — {c.hostname}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {c.conflict_type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        Serial: {c.serial_number} • Machine UUID: {c.machine_uuid}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolveConflict(c.id)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md cursor-pointer"
                      >
                        Aprovar & Vincular
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Registrado em: {new Date(c.created_at).toLocaleString('pt-BR')} • Status: {c.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INSTALAÇÃO & GUIA DE DEPLOY */}
      {activeTab === 'deploy' && (
        <div className="space-y-6">
          {/* Card Principal: Comando 1-Linha */}
          <div style={{ backgroundColor: cardColor }} className="p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Terminal className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Instalação e Ativação do Agente Windows 10 & 11 x64</h3>
                  <p className="text-xs text-slate-400">Executável nativo C# .NET 8 LTS com execução 24/7 em segundo plano (Serviço Windows).</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/agent/install.bat?serverUrl=${encodeURIComponent(window.location.origin)}`}
                  download="Instalar-Agente-GIHS.bat"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer border border-blue-400/40"
                  title="Baixar instalador em lote (.BAT com elevação automática de Administrador)"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar .BAT (1-Clique)</span>
                </a>

                <a
                  href={`/api/agent/install.cmd?serverUrl=${encodeURIComponent(window.location.origin)}`}
                  download="Instalar-Agente-GIHS.cmd"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer border border-indigo-400/40"
                  title="Baixar instalador .CMD (sem bloqueio de navegadores)"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar .CMD</span>
                </a>

                <a
                  href={`/api/agent/install.ps1?download=true&serverUrl=${encodeURIComponent(window.location.origin)}`}
                  download="Instalar-Agente-GIHS.ps1"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
                  title="Baixar script de instalação direta em PowerShell"
                >
                  <Download className="w-4 h-4 text-purple-400" />
                  <span>Script .PS1</span>
                </a>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <span>1. Execução Imediata via PowerShell (Como Administrador):</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                    Universal: Domínio & Workgroup
                  </span>
                </div>
                <button
                  onClick={() => {
                    const cmd = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}; (New-Object Net.WebClient).DownloadString("${window.location.origin}/api/agent/install.ps1") | iex`;
                    navigator.clipboard.writeText(cmd);
                    setCopiedCmd(true);
                    showToast('Comando PowerShell Universal copiado!');
                    setTimeout(() => setCopiedCmd(false), 3000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-all border border-slate-700"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedCmd ? 'Copiado!' : 'Copiar Comando'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto select-all">
                {`[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}; (New-Object Net.WebClient).DownloadString("${window.location.origin}/api/agent/install.ps1") | iex`}
              </pre>
              <div className="text-[11px] text-slate-400">
                * 100% compatível com computadores em Domínio (AD), Workgroup, redes isoladas e computadores fora de domínio. Ativa TLS 1.2/1.3 nativo e comunica sem travar em proxy.
              </div>

              <div className="text-xs font-bold text-slate-200 pt-2">2. Arquivo de Configuração do Agente (appsettings.json):</div>
              <pre className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-300 border border-slate-800 overflow-x-auto">
{`{
  "GIHS_Agent": {
    "ServerBaseUrl": "${window.location.origin}",
    "AgentApiKey": "GIHS-AGENT-SECURE-KEY-2026-ENTERPRISE",
    "HeartbeatIntervalSeconds": 60,
    "FullInventoryIntervalHours": 4,
    "OfflineDatabasePath": "C:\\\\ProgramData\\\\GIHS\\\\Agent\\\\offline_queue.db",
    "MaxRetryAttempts": 3
  }
}`}
              </pre>
            </div>
          </div>

          {/* Card: Monitoramento Contínuo do Agente GIHS */}
          <div style={{ backgroundColor: cardColor }} className="p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Arquitetura de Monitoramento Corporativo Contínuo (Agente Nativo GIHS)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 pt-1">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Heartbeat & Telemetria 24/7</span>
                </div>
                <p>
                  O agente envia pulsos periódicos de heartbeat a cada 60 segundos com uso atual de CPU, memória RAM, usuário ativo e IP.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Auditoria Completa de Softwares</span>
                </div>
                <p>
                  Varre chaves x86 e x64 do Registro e WMI, identificando versões, fornecedores, datas de instalação e strings de desinstalação.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span>Postura de Segurança</span>
                </div>
                <p>
                  Verifica status em tempo real do Microsoft Defender, Firewall do Windows, Criptografia BitLocker e integridade de Secure Boot.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-slate-800/80">
              <span className="text-xs text-slate-400">Quer homologar a coleta agora mesmo sem esperar o instalador?</span>
              <button
                onClick={() => {
                  setIsTestModalOpen(true);
                  setTestResult(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>Simular / Testar Agente Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL LATERAL DE DETALHES DO DISPOSITIVO */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            style={{ backgroundColor: cardColor }}
            className="w-full max-w-2xl h-full flex flex-col shadow-2xl border-l border-slate-800 animate-in slide-in-from-right duration-250 overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedAgent.hostname}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${selectedAgent.agent_status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                      {selectedAgent.agent_status}
                    </span>
                  </h3>
                  <div className="text-xs text-slate-400">
                    {selectedAgent.manufacturer} {selectedAgent.model} • UUID: {selectedAgent.machine_uuid}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setForceHeartbeatModalAgent(selectedAgent)}
                  disabled={isActionLoading}
                  className="px-3 py-1.5 rounded-xl bg-pink-950/70 hover:bg-pink-900/90 text-pink-300 border border-pink-700/60 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  title="Forçar Heartbeat a partir de C:\ProgramData\GIHS\Agent\GIHS-Inventario-Real.json"
                >
                  <Activity className="w-3.5 h-3.5 text-pink-400" />
                  <span>Forçar Heartbeat</span>
                </button>

                <button
                  onClick={() => handleForceScan(selectedAgent.id)}
                  disabled={isActionLoading}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Forçar varredura completa no próximo heartbeat"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
                  <span>Forçar Varredura</span>
                </button>

                <button
                  onClick={() => setSelectedAgent(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Nav Tabs */}
            <div className="flex items-center gap-1 px-4 border-b border-slate-800 bg-slate-950/20 overflow-x-auto">
              {[
                { id: 'overview', label: 'Resumo', icon: Box },
                { id: 'os', label: 'Sistema Operacional', icon: Server },
                { id: 'memory', label: 'Memória', icon: Cpu },
                { id: 'storage', label: 'Armazenamento', icon: HardDrive },
                { id: 'software', label: `Aplicativos (${selectedAgent.software_count})`, icon: Layers },
                { id: 'security', label: 'Segurança', icon: Shield },
                { id: 'history', label: 'Histórico', icon: Clock },
                { id: 'agent', label: 'Agente', icon: Terminal }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeDrawerTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDrawerTab(tab.id as any)}
                    className={`py-3 px-3 text-xs font-bold whitespace-nowrap border-b-2 flex items-center gap-1.5 cursor-pointer transition-all ${
                      isActive
                        ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300">
              {/* TAB 1: RESUMO */}
              {activeDrawerTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <div className="text-slate-500 text-[11px]">Hostname</div>
                      <div className="text-white font-bold">{selectedAgent.hostname}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <div className="text-slate-500 text-[11px]">Número de Série</div>
                      <div className="text-white font-mono">{selectedAgent.serial_number || 'Não informado'}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <div className="text-slate-500 text-[11px]">Fabricante & Modelo</div>
                      <div className="text-white">{selectedAgent.manufacturer} {selectedAgent.model}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <div className="text-slate-500 text-[11px]">Domínio / Workgroup</div>
                      <div className="text-white">{selectedAgent.domain_workgroup || 'WORKGROUP'}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <div className="text-slate-500 text-[11px]">Usuário Atualmente Logado</div>
                      <div className="text-white">{selectedAgent.current_user || '—'}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <div className="text-slate-500 text-[11px]">Endereço IP Local</div>
                      <div className="text-white font-mono">{selectedAgent.ip_address || '—'}</div>
                    </div>
                  </div>

                  {/* Vínculo com Ativo de Patrimônio */}
                  <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/60 space-y-2">
                    <div className="text-blue-300 font-bold flex items-center justify-between">
                      <span>Ativo de Informática Vinculado</span>
                      <button
                        onClick={() => onNavigate?.('equipamentos')}
                        className="text-xs text-blue-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        Abrir Patrimônio <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Tag Patrimonial: <strong>{selectedAgent.asset_tag || 'PAT-AUTO'}</strong></div>
                      <div>Nome: <strong>{selectedAgent.asset_name || selectedAgent.hostname}</strong></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SISTEMA OPERACIONAL */}
              {activeDrawerTab === 'os' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="text-white font-bold text-sm">{selectedAgent.os_info?.name || 'Windows'}</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-400">
                      <div>Edição: <span className="text-white">{selectedAgent.os_info?.edition || 'Professional'}</span></div>
                      <div>Versão: <span className="text-white">{selectedAgent.os_info?.version || '23H2'}</span></div>
                      <div>Build: <span className="text-white">{selectedAgent.os_info?.build || '—'}</span></div>
                      <div>Arquitetura: <span className="text-white">{selectedAgent.os_info?.architecture || 'x64'}</span></div>
                      <div>Instalado em: <span className="text-white">{selectedAgent.os_info?.installed_at ? new Date(selectedAgent.os_info.installed_at).toLocaleDateString('pt-BR') : '—'}</span></div>
                      <div>Último Boot: <span className="text-white">{selectedAgent.os_info?.last_boot ? new Date(selectedAgent.os_info.last_boot).toLocaleString('pt-BR') : '—'}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MEMÓRIA RAM */}
              {activeDrawerTab === 'memory' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex justify-between font-bold text-white">
                      <span>Capacidade Total: {formatBytes(selectedAgent.memory_info?.total_bytes)}</span>
                      <span>{selectedAgent.memory_info?.used_percentage}% em uso</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{ width: `${selectedAgent.memory_info?.used_percentage || 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                      <span>Usada: {formatBytes(selectedAgent.memory_info?.used_bytes)}</span>
                      <span>Livre: {formatBytes(selectedAgent.memory_info?.available_bytes)}</span>
                    </div>
                  </div>

                  {selectedAgent.memory_info?.modules?.length ? (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-300">Módulos Físicos de Memória (DIMMs):</div>
                      {selectedAgent.memory_info.modules.map((m: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white">{m.bank_label || `Slot ${idx + 1}`} • {formatBytes(m.capacity_bytes)}</div>
                            <div className="text-[11px] text-slate-400">{m.manufacturer} {m.part_number} • Serial: {m.serial_number}</div>
                          </div>
                          <div className="text-blue-400 font-mono">{m.speed_mhz ? `${m.speed_mhz} MHz` : ''}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 4: ARMAZENAMENTO */}
              {activeDrawerTab === 'storage' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300">Volumes Lógicos e Partições:</div>
                    {selectedAgent.storage_info?.volumes?.map((v: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <div className="flex justify-between text-white font-bold">
                          <span>Volume {v.drive_letter} ({v.file_system || 'NTFS'})</span>
                          <span>{v.used_percentage}% ({formatBytes(v.used_bytes)} / {formatBytes(v.total_bytes)})</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${v.used_percentage > 90 ? 'bg-rose-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, v.used_percentage)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-400">Espaço Livre Disponível: {formatBytes(v.free_bytes)}</div>
                      </div>
                    ))}
                  </div>

                  {selectedAgent.storage_info?.physical_disks?.length ? (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-300">Discos Físicos Instalados:</div>
                      {selectedAgent.storage_info.physical_disks.map((d: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white">{d.model}</div>
                            <div className="text-[11px] text-slate-400">
                              {d.media_type || 'Disco'} • Serial: {d.serial_number || 'n/d'}
                            </div>
                          </div>
                          <div className="text-slate-200 font-bold">{formatBytes(d.total_capacity_bytes)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 5: APLICATIVOS INSTALADOS */}
              {activeDrawerTab === 'software' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar aplicativos instalados..."
                      value={softwareSearch}
                      onChange={(e) => {
                        setSoftwareSearch(e.target.value);
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-xs focus:outline-none"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-[10px] uppercase text-slate-400">
                        <tr>
                          <th className="p-2.5">Nome do Aplicativo</th>
                          <th className="p-2.5">Versão</th>
                          <th className="p-2.5">Fornecedor</th>
                          <th className="p-2.5">Instalado em</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {isSoftwareLoading ? (
                          <tr><td colSpan={4} className="p-4 text-center text-slate-400">Carregando aplicativos...</td></tr>
                        ) : softwareList.filter(s => s.name.toLowerCase().includes(softwareSearch.toLowerCase())).length === 0 ? (
                          <tr><td colSpan={4} className="p-4 text-center text-slate-400">Nenhum aplicativo encontrado.</td></tr>
                        ) : (
                          softwareList
                            .filter(s => s.name.toLowerCase().includes(softwareSearch.toLowerCase()))
                            .map((sw, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/30">
                                <td className="p-2.5 font-medium text-white">{sw.name}</td>
                                <td className="p-2.5 font-mono text-slate-300">{sw.version || '—'}</td>
                                <td className="p-2.5 text-slate-400">{sw.publisher || '—'}</td>
                                <td className="p-2.5 text-slate-400">{sw.install_date || '—'}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: SEGURANÇA */}
              {activeDrawerTab === 'security' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Antivírus & Proteção em Tempo Real</span>
                      <span className="text-emerald-400 font-bold">Ativo</span>
                    </div>
                    <div className="text-slate-400">{selectedAgent.security_info?.antivirus?.name || 'Windows Defender Antivirus'}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Firewall do Windows</span>
                      <span className="text-emerald-400 font-bold">Ativo</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">BitLocker / Criptografia de Disco</span>
                      <span className="text-blue-400 font-bold">{selectedAgent.security_info?.bitlocker?.status || 'Ativo'}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Secure Boot (UEFI)</span>
                      <span className="text-emerald-400 font-bold">Habilitado</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: HISTÓRICO */}
              {activeDrawerTab === 'history' && (
                <div className="space-y-2">
                  {agentHistory.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">Nenhum evento registrado no histórico.</div>
                  ) : (
                    agentHistory.map((h) => (
                      <div key={h.id} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1">
                        <div className="flex justify-between font-bold text-white">
                          <span>{h.event_type}</span>
                          <span className="text-slate-500">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="text-slate-400">{h.summary}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 8: AGENTE */}
              {activeDrawerTab === 'agent' && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div>Versão Instalada: <strong>v{selectedAgent.agent_version}</strong></div>
                  <div>ID do Agente: <strong className="font-mono">{selectedAgent.id}</strong></div>
                  <div>UUID da Máquina: <strong className="font-mono">{selectedAgent.machine_uuid}</strong></div>
                  <div>Primeira Conexão: <strong>{new Date(selectedAgent.first_seen).toLocaleString('pt-BR')}</strong></div>
                  <div>Último Heartbeat: <strong>{new Date(selectedAgent.last_heartbeat).toLocaleString('pt-BR')}</strong></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HOMOLOGAÇÃO & TESTE DE COLETA DO AGENTE GIHS */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            style={{ backgroundColor: cardColor }}
            className="w-full max-w-xl rounded-3xl border border-slate-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Homologação & Teste do Agente GIHS</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      100% FUNCIONAL
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Simula o ciclo do agente C# .NET 8 no Windows com persistência no PostgreSQL.</p>
                </div>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Banner: Teste no Computador Real */}
            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-blue-400" />
                  <span>Realizar Teste no seu Computador Real (100% Nativo)</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-200 border border-blue-700/60">
                  Recomendado
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Você pode baixar o executável para rodar na sua máquina agora, ou copiar o comando direto de uma linha no PowerShell:
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={`/api/agent/install.bat?serverUrl=${encodeURIComponent(window.location.origin)}`}
                  download="Instalar-Agente-GIHS.bat"
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar .BAT</span>
                </a>

                <a
                  href={`/api/agent/install.cmd?serverUrl=${encodeURIComponent(window.location.origin)}`}
                  download="Instalar-Agente-GIHS.cmd"
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar .CMD</span>
                </a>

                <a
                  href={`/api/agent/install.ps1?download=true&serverUrl=${encodeURIComponent(window.location.origin)}`}
                  download="Instalar-Agente-GIHS.ps1"
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-bold inline-flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar .PS1</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    const cmd = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}; (New-Object Net.WebClient).DownloadString("${window.location.origin}/api/agent/install.ps1") | iex`;
                    navigator.clipboard.writeText(cmd);
                    setCopiedCmd(true);
                    showToast('Comando PowerShell Universal copiado!');
                    setTimeout(() => setCopiedCmd(false), 3000);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedCmd ? 'Copiado!' : 'Copiar 1-Linha PS (Universal)'}</span>
                </button>
              </div>
            </div>

            {/* Divisor Ou Simular */}
            <div className="flex items-center gap-3 text-slate-500 text-xs">
              <div className="h-px bg-slate-800 flex-1" />
              <span>ou homologue com dados simulados abaixo</span>
              <div className="h-px bg-slate-800 flex-1" />
            </div>

            {/* Presets Rápidos */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Escolha um Perfil Corporativo de Teste:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('notebook')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    testPreset === 'notebook'
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">Notebook Dell</div>
                  <div className="text-[10px] opacity-75">TI Corporativa (i7)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('desktop')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    testPreset === 'desktop'
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">Desktop HP</div>
                  <div className="text-[10px] opacity-75">Financeiro (i5)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('workstation')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    testPreset === 'workstation'
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">Workstation Lenovo</div>
                  <div className="text-[10px] opacity-75">Engenharia (Xeon/CAD)</div>
                </button>
              </div>
            </div>

            {/* Campos de Configuração */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Hostname do Computador</label>
                <input
                  type="text"
                  value={testForm.hostname}
                  onChange={(e) => setTestForm({ ...testForm, hostname: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Usuário Logado no Windows</label>
                <input
                  type="text"
                  value={testForm.username}
                  onChange={(e) => setTestForm({ ...testForm, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Fabricante & Modelo</label>
                <input
                  type="text"
                  value={`${testForm.manufacturer} ${testForm.model}`}
                  onChange={(e) => setTestForm({ ...testForm, model: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Sistema Operacional</label>
                <input
                  type="text"
                  value={testForm.os}
                  onChange={(e) => setTestForm({ ...testForm, os: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Informações Coletadas Automaticamente */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <div className="font-bold text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>O teste executa o ciclo completo de monitoramento técnico:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Hardware: CPU, Memória RAM (DIMMs Samsung 4800MHz), SSDs NVMe e volumes lógicos.</li>
                <li>Inventário de softwares corporativos (Chrome, Office 365, VS Code, FortiClient VPN).</li>
                <li>Segurança: Microsoft Defender, Firewall ativo, Criptografia BitLocker e Secure Boot.</li>
                <li>Criação e vinculação automática ao Ativo de TI em Patrimônio com chave primária única.</li>
              </ul>
            </div>

            {/* Resultado do Teste */}
            {testResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-1.5 animate-in fade-in ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-600/80 text-rose-200'
              }`}>
                <div className="font-bold flex items-center gap-2">
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                  <span>{testResult.success ? 'Coleta executada com 100% de sucesso!' : 'Falha na execução do teste'}</span>
                </div>
                <div>{testResult.message}</div>
                {testResult.agentId && (
                  <div className="font-mono text-[11px] text-slate-400">
                    ID Agente: <strong>{testResult.agentId}</strong> • Ativo Vinculado: <strong>{testResult.assetId}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={() => handleRunTest()}
                disabled={isTesting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isTesting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                <span>{isTesting ? 'Executando Coleta...' : 'Executar Coleta de Teste Agora'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE OPÇÕES DE DOWNLOAD E EXECUÇÃO DO AGENTE REAL */}
      {downloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-blue-500/40 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Instalação no Computador Real</h2>
                  <p className="text-xs text-slate-400">Escolha como deseja executar no seu Windows (100% Nativo)</p>
                </div>
              </div>
              <button
                onClick={() => setDownloadModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* CARACTERÍSTICAS CORPORATIVAS DO AGENTE GIHS (ESTILO OCS) */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-blue-500/30 text-xs text-blue-200 space-y-2">
                <div className="font-bold flex items-center gap-2 text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Recursos Nativos Configurados Automaticamente:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                    <span><strong>Ícone na Bandeja</strong> (Estilo OCS)</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                    <RotateCw className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Inicialização no Boot</strong> (Com o Windows)</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                    <span><strong>Admin Pré-definido</strong> (Sem UAC no boot)</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Reinício Opcional</strong> (Aplica no final)</span>
                  </div>
                </div>
              </div>

              {/* OPÇÃO 1: COMANDO DE 1 LINHA NO POWERSHELL (SEM BAIXAR ARQUIVO) */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-blue-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    <span>Opção 1: Executar Direto no PowerShell (Sem Download de Arquivo)</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700">
                    Recomendado
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Abra o <strong>PowerShell</strong> (ou Terminal) e cole este comando de uma linha. Funciona em máquinas em Domínio (AD), Workgroup e fora de rede de domínio:
                </p>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400 flex items-center justify-between gap-2 overflow-x-auto">
                  <span className="truncate">
                    {`[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}; (New-Object Net.WebClient).DownloadString("${window.location.origin}/api/agent/install.ps1") | iex`}
                  </span>
                  <button
                    onClick={() => {
                      const cmd = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}; (New-Object Net.WebClient).DownloadString("${window.location.origin}/api/agent/install.ps1") | iex`;
                      navigator.clipboard.writeText(cmd);
                      setCopiedCmd(true);
                      showToast('Comando PowerShell copiado!');
                      setTimeout(() => setCopiedCmd(false), 3000);
                    }}
                    className="shrink-0 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                    title="Copiar Comando"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* OPÇÃO 2: DOWNLOAD DE EXECUTÁVEL / SCRIPT */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Opção 2: Baixar Arquivo Instalador para Windows</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Escolha o formato ideal para o seu ambiente. O arquivo auto-eleva privilégios de Administrador (UAC):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleDownloadScript('bat')}
                    disabled={isDownloading}
                    className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar .BAT</span>
                    <span className="text-[10px] font-normal opacity-80">Padrão Windows</span>
                  </button>

                  <button
                    onClick={() => handleDownloadScript('cmd')}
                    disabled={isDownloading}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar .CMD</span>
                    <span className="text-[10px] font-normal opacity-80">Sem Bloqueio de Navegador</span>
                  </button>

                  <button
                    onClick={() => handleDownloadScript('ps1')}
                    disabled={isDownloading}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar .PS1</span>
                    <span className="text-[10px] font-normal opacity-80">PowerShell Nativo</span>
                  </button>
                </div>
              </div>

              {/* OPÇÃO 3: COPIAR CÓDIGO FONTE COMPLETO */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span>Opção 3: Copiar Código PowerShell Completo</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300">
                  Copia todo o código-fonte do coletor. Você pode colar diretamente no PowerShell ou salvar manualmente em um arquivo.
                </p>
                <button
                  type="button"
                  onClick={handleCopyFullScript}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-700/60 text-purple-200 font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedFullScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedFullScript ? 'Código Completo Copiado!' : 'Copiar Código PowerShell Completo'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDownloadModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO DE COLETA REAL (CLIPBOARD / ARQUIVO) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Carregar Coleta do Computador Real</h2>
                  <p className="text-xs text-slate-400">Importe os dados coletados no seu Windows para sincronizar imediatamente</p>
                </div>
              </div>
              <button
                onClick={() => { setIsImportModalOpen(false); setImportJsonText(''); setImportPreview(null); }}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 text-xs text-emerald-200 space-y-2">
              <div className="font-bold flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>Como funciona a importação direta:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Ao rodar o script no seu Windows, os dados são <strong>automaticamente copiados para sua Área de Transferência</strong> e salvos na sua <strong>Área de Trabalho</strong> como <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300">GIHS-Inventario-Real.json</code> e em <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300">C:\ProgramData\GIHS\Agent\</code>.
              </p>
            </div>

            {/* Ações Rápidas de Ingestão */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Clipboard className="w-4 h-4" />
                <span>Colar da Área de Transferência</span>
              </button>

              <label className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-2 cursor-pointer">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Selecionar Arquivo .json</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Caixa de Texto do JSON */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Conteúdo do Inventário Técnico (JSON):</label>
              <textarea
                rows={6}
                value={importJsonText}
                onChange={(e) => handleParseImportJson(e.target.value)}
                placeholder='Cole aqui o JSON gerado pelo agente ou clique em "Colar da Área de Transferência"...'
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-[11px] focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Erro de parsing */}
            {importError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{importError}</span>
              </div>
            )}

            {/* Preview Técnico do Computador Real */}
            {importPreview && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-600/60 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4" />
                    <span>Computador Identificado com Sucesso</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
                    100% Real
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Hostname:</div>
                    <div className="font-bold text-white font-mono">{importPreview.identity?.hostname || 'N/A'}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Usuário:</div>
                    <div className="font-bold text-white">{importPreview.identity?.current_user || 'N/A'}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Fabricante / Modelo:</div>
                    <div className="font-bold text-white truncate">{importPreview.identity?.manufacturer || ''} {importPreview.identity?.model || 'PC'}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Sistema Operacional:</div>
                    <div className="font-bold text-white truncate">{importPreview.operating_system?.name || 'Windows'}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Memória RAM:</div>
                    <div className="font-bold text-white">
                      {importPreview.memory?.total_bytes ? `${Math.round(importPreview.memory.total_bytes / (1024*1024*1024))} GB` : 'N/A'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Softwares Detectados:</div>
                    <div className="font-bold text-emerald-400">{importPreview.software?.installed_apps?.length || 0} instalados</div>
                  </div>
                </div>
              </div>
            )}

            {/* Ações do Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsImportModalOpen(false); setImportJsonText(''); setImportPreview(null); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!importPreview || isImporting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isImporting ? 'Sincronizando com PostgreSQL...' : 'Salvar no Inventário e Patrimônio'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FORÇAR HEARTBEAT EM TEMPO REAL */}
      {forceHeartbeatModalAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-pink-500/40 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-600/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <span>Forçar Heartbeat em Tempo Real</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-700">
                      Ciclo: 1:00h
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Computador: <strong className="text-slate-200">{forceHeartbeatModalAgent.hostname}</strong> ({forceHeartbeatModalAgent.ip_address || 'IP n/d'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setForceHeartbeatModalAgent(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Card Informativo do Ciclo de 1:00 hora */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pink-950/60 to-purple-950/60 border border-pink-500/30 text-xs text-pink-200 space-y-2">
                <div className="font-bold flex items-center gap-2 text-white">
                  <Clock className="w-4 h-4 text-pink-400" />
                  <span>Configuração do Ciclo Automático e Origem Local:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Intervalo Automático:</span>
                    <div className="font-bold text-emerald-400">A cada 1:00 hora (Automático)</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Último Heartbeat:</span>
                    <div className="font-bold text-white">{formatRelativeTime(forceHeartbeatModalAgent.last_heartbeat)}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 sm:col-span-2 font-mono text-[10px] text-slate-300">
                    <span className="text-slate-400 font-sans">Arquivo de Origem em Tempo Real:</span>
                    <div className="text-pink-300 font-bold truncate">C:\ProgramData\GIHS\Agent\GIHS-Inventario-Real.json</div>
                  </div>
                </div>
              </div>

              {/* OPÇÃO 1: NO COMPUTADOR INSTALADO */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Opção 1: No Computador Instalado (Bandeja, Pasta Local ou Download)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Caso acesse diretamente a máquina do usuário (presencialmente ou por RDP/AnyDesk), force o heartbeat imediatamente lendo o arquivo em tempo real:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 pl-1">
                  <li>
                    Clique com o botão direito no ícone do <strong>GIHS Agent</strong> na barra de tarefas (ao lado do relógio ou na setinha <code className="text-slate-200">^</code>) e selecione <strong className="text-pink-400">"❤️ Forçar Heartbeat Agora (Sincronizar JSON Real)"</strong>.
                  </li>
                  <li>
                    Ou acesse o atalho rápido dando duplo clique em: <code className="text-pink-300 font-mono text-[10px] bg-slate-900 px-1 py-0.5 rounded">C:\ProgramData\GIHS\Agent\Forcar-Heartbeat.bat</code>.
                  </li>
                  <li>
                    O script lê <code className="text-pink-300 font-mono text-[10px]">C:\ProgramData\GIHS\Agent\GIHS-Inventario-Real.json</code> e sincroniza o computador como ONLINE no servidor.
                  </li>
                </ul>

                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-400">Baixar atalho para executar na máquina:</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadForceHeartbeatScript('bat')}
                    disabled={isDownloading}
                    className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    title="Baixar Forcar-Heartbeat.bat para executar na máquina"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Forcar-Heartbeat.bat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadForceHeartbeatScript('cmd')}
                    disabled={isDownloading}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                    title="Baixar Forcar-Heartbeat.cmd para executar na máquina"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Forcar-Heartbeat.cmd</span>
                  </button>
                </div>
              </div>

              {/* OPÇÃO 2: COMANDO RÁPIDO NO POWERSHELL DA MÁQUINA */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    <span>Opção 2: Comando PowerShell de 1-Linha na Máquina</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700">
                    Atalho Remoto
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Abra o PowerShell como Administrador e cole este comando para forçar a leitura do JSON e envio imediato:
                </p>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400 flex items-center justify-between gap-2 overflow-x-auto">
                  <span className="truncate">
                    {`& "C:\\ProgramData\\GIHS\\Agent\\Forcar-Heartbeat.bat"`}
                  </span>
                  <button
                    onClick={() => {
                      const cmd = `& "C:\\ProgramData\\GIHS\\Agent\\Forcar-Heartbeat.bat"`;
                      navigator.clipboard.writeText(cmd);
                      setCopiedHeartbeatCmd(true);
                      showToast('Comando de forçar heartbeat copiado!');
                      setTimeout(() => setCopiedHeartbeatCmd(false), 3000);
                    }}
                    className="shrink-0 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                    title="Copiar Comando"
                  >
                    {copiedHeartbeatCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* OPÇÃO 3: IMPORTAR O ARQUIVO JSON / FORÇAR NO SERVIDOR */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-pink-500/30 space-y-3">
                <div className="font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-pink-400" />
                  <span>Opção 3: Sincronizar pelo Painel Agora Mesmo</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Você pode forçar a reativação do heartbeat diretamente no servidor ou importar o arquivo salvo na máquina:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      handleForceHeartbeat(forceHeartbeatModalAgent.id);
                      setForceHeartbeatModalAgent(null);
                    }}
                    disabled={isActionLoading}
                    className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Activity className="w-4 h-4" />
                    <span>Forçar Heartbeat no Servidor Agora</span>
                  </button>

                  <button
                    onClick={() => {
                      setForceHeartbeatModalAgent(null);
                      setIsImportModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Carregar Arquivo GIHS-Inventario-Real.json</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setForceHeartbeatModalAgent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
