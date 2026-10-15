import React, { useState, useMemo, useEffect } from 'react';
import {
  Tag,
  Plus,
  Search,
  Printer,
  Sparkles,
  RefreshCw,
  Armchair,
  Table,
  Laptop,
  Monitor,
  Tv,
  Archive,
  HardDrive,
  Wind,
  CheckCircle2,
  Building2,
  Layers,
  Filter,
  Eye,
  Download,
  LifeBuoy,
  FileSpreadsheet,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Check,
  Trash2
} from 'lucide-react';
import { EQUIPMENT_DATA, SECTORS } from '../../data/mockData';
import { EquipmentItem, ViewScreen, Collaborator } from '../../types';
import { AssetLabelGenerator } from '../patrimonio/AssetLabelGenerator';
import { AssetLabelCard } from '../patrimonio/AssetLabelCard';
import { BarcodeSVG } from '../patrimonio/BarcodeSVG';
import { apiBackendService } from '../../services/apiBackendService';
import { InventoryAgentAdminView } from './InventoryAgentAdminView';

interface EquipmentViewProps {
  onNavigate?: (screen: ViewScreen) => void;
  currentUser?: Collaborator;
}

export const EquipmentView: React.FC<EquipmentViewProps> = ({ onNavigate, currentUser }) => {
  // Main view state - Inicializado vazio sem nenhum equipamento pré-carregado
  const [activeTab, setActiveTab] = useState<'inventory' | 'it_agent' | 'label_generator' | 'patrimony_team'>('inventory');
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [sectorFilter, setSectorFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [categoryFilter, setCategoryFilter] = useState('TODOS');

  // Item currently selected for generating/printing a label
  const [selectedItemForLabel, setSelectedItemForLabel] = useState<EquipmentItem | null>(null);

  // Load equipment from PostgreSQL
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const response = await apiBackendService.getEquipment();
        if (response && response.success && Array.isArray(response.data)) {
          const mapped: EquipmentItem[] = response.data.map((item: any) => ({
            id: item.id,
            tag: item.patrimony_tag || item.tag,
            type: item.category || 'Outros',
            category: (item.category as any) || 'Mobiliário',
            model: item.name || item.model || 'Ativo',
            sector: item.sector || 'Geral',
            location: item.location || 'Sede Principal',
            assignee: item.assigned_user_name || item.assignee || 'Disponível',
            valueBRL: item.value_brl ? `R$ ${Number(item.value_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00',
            status: item.status === 'OPERACIONAL' ? 'Em uso' : item.status === 'EM_ESTOQUE' ? 'Estoque' : 'Manutenção',
            deliveryDate: item.delivery_date || item.acquisition_date || '',
            agentId: item.agent_id,
            machineUuid: item.machine_uuid,
            lastAgentSync: item.last_agent_sync,
            agentStatus: item.agent_status,
            securityStatus: item.security_status,
            specifications: item.specifications,
            serialNumber: item.serial_number
          }));
          setEquipmentList(mapped);
        } else {
          setEquipmentList([]);
        }
      } catch (err) {
        console.warn('PostgreSQL equipment fetch info:', err);
        setEquipmentList([]);
      }
    };
    fetchEquipment();
  }, []);

  const computersWithAgent = useMemo(() => {
    return equipmentList.filter(i => !!i.agentId || i.category === 'Informática');
  }, [equipmentList]);

  const onlineAgentsCount = useMemo(() => {
    return equipmentList.filter(i => i.agentStatus === 'ONLINE').length;
  }, [equipmentList]);

  // Modal: + Cadastrar Ativo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New item form state
  const [newTag, setNewTag] = useState('');
  const [newType, setNewType] = useState('Cadeira');
  const [newCategory, setNewCategory] = useState<'Mobiliário' | 'Informática' | 'Rede & Infra' | 'Audiovisual' | 'Eletro & Escritório'>('Mobiliário');
  const [newModel, setNewModel] = useState('Cadeira Ergonômica NR17 Mesh Black');
  const [newSector, setNewSector] = useState('Financeiro');
  const [newLocation, setNewLocation] = useState('Andar 2 • Sala 204');
  const [newAssignee, setNewAssignee] = useState('Mariana Castro');
  const [newValueBRL, setNewValueBRL] = useState('R$ 1.280,00');
  const [printImmediately, setPrintImmediately] = useState(false);

  // Generate automated tag helper for modal
  const generateModalTag = () => {
    let maxNum = 28;
    equipmentList.forEach((item) => {
      const match = item.tag.match(/(\d+)/g);
      if (match) {
        const lastNum = parseInt(match[match.length - 1], 10);
        if (!isNaN(lastNum) && lastNum > maxNum && lastNum < 9000) {
          maxNum = lastNum;
        }
      }
    });
    return `PAT-2026-${String(maxNum + 1).padStart(4, '0')}`;
  };

  // Open modal with freshly generated tag
  const handleOpenModal = () => {
    setNewTag(generateModalTag());
    setIsModalOpen(true);
  };

  // Filter items
  const filtered = useMemo(() => {
    return equipmentList.filter(item => {
      const s = searchTerm.toLowerCase();
      const matchSearch =
        item.tag.toLowerCase().includes(s) ||
        item.model.toLowerCase().includes(s) ||
        item.type.toLowerCase().includes(s) ||
        item.assignee.toLowerCase().includes(s) ||
        (item.sector && item.sector.toLowerCase().includes(s)) ||
        (item.location && item.location.toLowerCase().includes(s));

      const matchType = typeFilter === 'TODOS' || item.type === typeFilter;
      const matchSector = sectorFilter === 'TODOS' || item.sector === sectorFilter;
      const matchStatus = statusFilter === 'TODOS' || item.status === statusFilter;
      const matchCategory = categoryFilter === 'TODOS' || item.category === categoryFilter;

      return matchSearch && matchType && matchSector && matchStatus && matchCategory;
    });
  }, [equipmentList, searchTerm, typeFilter, sectorFilter, statusFilter, categoryFilter]);

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = equipmentList.length;
    const mobiliario = equipmentList.filter(i => i.category === 'Mobiliário' || ['Mesa', 'Cadeira', 'Armário'].includes(i.type)).length;
    const informatica = equipmentList.filter(i => i.category === 'Informática' || ['Computador', 'Monitor', 'Notebook'].includes(i.type)).length;
    const redesAudiovisual = equipmentList.filter(i => ['Rede & Infra', 'Audiovisual'].includes(i.category || '') || ['Switch', 'Servidor', 'Televisão', 'Nobreak'].includes(i.type)).length;
    const emUso = equipmentList.filter(i => i.status === 'Em uso').length;
    const emEstoque = equipmentList.filter(i => i.status === 'Estoque').length;
    const manutencao = equipmentList.filter(i => i.status === 'Manutenção').length;

    return { total, mobiliario, informatica, redesAudiovisual, emUso, emEstoque, manutencao };
  }, [equipmentList]);

  // Handle register new equipment
  const handleCreateEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    const tagToUse = newTag || generateModalTag();
    const newItem: EquipmentItem = {
      id: `eq-${Date.now()}`,
      tag: tagToUse,
      type: newType,
      category: newCategory,
      model: newModel,
      sector: newSector,
      location: newLocation,
      assignee: newAssignee,
      valueBRL: newValueBRL,
      status: 'Em uso',
      deliveryDate: new Date().toLocaleDateString('pt-BR')
    };

    setEquipmentList([newItem, ...equipmentList]);
    setIsModalOpen(false);

    if (printImmediately) {
      setSelectedItemForLabel(newItem);
      setActiveTab('label_generator');
      setToastMessage(`✓ Ativo ${tagToUse} cadastrado! Abrindo gerador de etiquetas para impressão.`);
    } else {
      setToastMessage(`✓ Ativo ${tagToUse} (${newType} - ${newModel}) cadastrado e tombado com sucesso!`);
    }

    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handle remove all equipment from PostgreSQL and state
  const handleRemoveAllEquipment = async () => {
    try {
      await apiBackendService.deleteAllEquipment();
      setEquipmentList([]);
      setSelectedItemForLabel(null);
      setToastMessage('✓ Todos os equipamentos foram removidos com sucesso do sistema e do banco de dados PostgreSQL.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.warn('Erro ao remover equipamentos:', err);
      setEquipmentList([]);
      setSelectedItemForLabel(null);
      setToastMessage('✓ Todos os equipamentos foram limpos do inventário.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Helper to render type icon
  const renderTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'cadeira':
        return <Armchair className="w-4 h-4 text-amber-400" />;
      case 'mesa':
        return <Table className="w-4 h-4 text-amber-500" />;
      case 'computador':
      case 'notebook':
        return <Laptop className="w-4 h-4 text-cyan-400" />;
      case 'monitor':
        return <Monitor className="w-4 h-4 text-blue-400" />;
      case 'televisão':
      case 'tv':
        return <Tv className="w-4 h-4 text-purple-400" />;
      case 'armário':
      case 'gaveteiro':
        return <Archive className="w-4 h-4 text-emerald-400" />;
      case 'switch':
      case 'servidor':
      case 'nobreak':
        return <HardDrive className="w-4 h-4 text-indigo-400" />;
      case 'climatização':
        return <Wind className="w-4 h-4 text-teal-400" />;
      default:
        return <Tag className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Equipamentos Patrimoniados & Ativos
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                  Fase 8
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Controle generalizado de ativos: Mesas, Cadeiras, Computadores, Monitores, Televisões, Armários e Switches de todos os setores.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct trigger for Help Desk Patrimony queue */}
          {onNavigate && (
            <button
              onClick={() => onNavigate('chamados')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-semibold transition-all cursor-pointer"
              title="Acessar chamados da Equipe de Patrimônio no Help Desk"
            >
              <LifeBuoy className="w-4 h-4 text-amber-400" />
              <span>Chamados Patrimônio</span>
            </button>
          )}

          <button
            onClick={handleRemoveAllEquipment}
            id="btn-remover-todos-equipamentos"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Remover todos os equipamentos cadastrados no sistema e banco de dados"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Remover Todos</span>
          </button>

          {currentUser?.userRole === 'SUPER_ADMIN' && (
            <>
              <button
                onClick={() => setActiveTab('it_agent')}
                id="btn-patrimonio-agente-ti"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                  activeTab === 'it_agent'
                    ? 'bg-blue-600 text-white shadow-blue-600/30'
                    : 'bg-blue-950/80 hover:bg-blue-900 border border-blue-700/80 text-blue-200 hover:text-white'
                }`}
                title="Abrir tela de Agente de TI & Computadores diretamente no Patrimônio"
              >
                <Laptop className="w-4 h-4 text-blue-400" />
                <span>Agente de TI & Computadores</span>
                {onlineAgentsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              <a
                href={`/api/agent/install.bat?serverUrl=${encodeURIComponent(window.location.origin)}`}
                download="Instalar-Agente-GIHS.bat"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-blue-300 hover:text-white transition-all cursor-pointer shadow-sm"
                title="Baixar executável do Agente (.bat) para instalar neste computador"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Agente (.bat)</span>
              </a>

              <a
                href={`/api/agent/install.cmd?serverUrl=${encodeURIComponent(window.location.origin)}`}
                download="Instalar-Agente-GIHS.cmd"
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 hover:text-white transition-all cursor-pointer shadow-sm"
                title="Baixar executável do Agente (.cmd sem restrições de download)"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>.cmd</span>
              </a>

              <a
                href={`/api/agent/install.ps1?download=true&serverUrl=${encodeURIComponent(window.location.origin)}`}
                download="Instalar-Agente-GIHS.ps1"
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-purple-300 hover:text-white transition-all cursor-pointer shadow-sm"
                title="Baixar script PowerShell (.ps1)"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>.ps1</span>
              </a>
            </>
          )}

          <button
            onClick={() => {
              setSelectedItemForLabel(null);
              setActiveTab('label_generator');
            }}
            id="btn-gerar-etiqueta"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Gerador de Etiquetas</span>
          </button>

          <button
            onClick={handleOpenModal}
            id="btn-cadastrar-equipamento"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Cadastrar Ativo</span>
          </button>
        </div>
      </div>

      {/* 4 Cards de Métricas do Patrimônio Generalizado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            Total Geral de Ativos
          </span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xl font-black font-mono text-white">{metrics.total}</span>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
              {metrics.emUso} em uso
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Bens tombados com código de barras
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Armchair className="w-3.5 h-3.5 text-amber-400" />
            Mobiliário de Escritório
          </span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xl font-black font-mono text-amber-400">{metrics.mobiliario}</span>
            <span className="text-[10px] text-slate-400 font-mono">Mesas, Cadeiras, Armários</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Todos os setores e salas de reunião
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-cyan-400" />
            Informática & Audiovisual
          </span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xl font-black font-mono text-cyan-400">{metrics.informatica}</span>
            <span className="text-[10px] text-slate-400 font-mono">PCs, Monitores, Smart TVs</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Parque computacional e displays
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            Redes, Infra & Climatização
          </span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xl font-black font-mono text-indigo-400">{metrics.redesAudiovisual}</span>
            <span className="text-[10px] text-slate-400 font-mono">Switchs, Nobreaks, ACs</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Datacenter e infraestrutura predial
          </div>
        </div>
      </div>

      {/* Toast Notice */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-800 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Inventário Geral de Bens ({filtered.length})</span>
        </button>

        {currentUser?.userRole === 'SUPER_ADMIN' && (
          <button
            onClick={() => setActiveTab('it_agent')}
            id="tab-agente-ti"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'it_agent'
                ? 'bg-blue-950/90 text-blue-300 border border-blue-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Laptop className="w-4 h-4 text-blue-400" />
            <span>Agente de TI & Computadores ({computersWithAgent.length})</span>
            {onlineAgentsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/40 animate-pulse">
                {onlineAgentsCount} ONLINE
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => {
            setActiveTab('label_generator');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'label_generator'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-800 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Printer className="w-4 h-4 text-amber-400" />
          <span>Criador & Emissor de Etiquetas de Patrimônio</span>
        </button>

        <button
          onClick={() => setActiveTab('patrimony_team')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'patrimony_team'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-cyan-400" />
          <span>Equipe de Patrimônio & Vistorias</span>
        </button>

        {currentUser?.userRole === 'SUPER_ADMIN' && onNavigate && (
          <button
            onClick={() => onNavigate('inventario_ti')}
            id="btn-goto-inventario-ti"
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 ml-auto"
            title="Ir para a tela dedicada de Inventário de TI"
          >
            <span>Tela Dedicada do Agente</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* TAB 1: INVENTÁRIO GERAL DE BENS PATRIMONIADOS */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Pesquisar por Patrimônio (PAT), Modelo, Tipo (Mesa, Cadeira, TV...), Setor ou Responsável..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full md:w-auto px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="TODOS">Tipo de Bem: Todos</option>
                <option value="Cadeira">Cadeira</option>
                <option value="Mesa">Mesa</option>
                <option value="Computador">Computador / Notebook</option>
                <option value="Monitor">Monitor</option>
                <option value="Televisão">Televisão / Smart TV</option>
                <option value="Armário">Armário / Gaveteiro</option>
                <option value="Switch">Switch / Servidor</option>
                <option value="Climatização">Climatização / Ar</option>
                <option value="Audiovisual">Audiovisual / Projetor</option>
              </select>

              {/* Sector Filter */}
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="w-full md:w-auto px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="TODOS">Setor: Todos os Setores</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Administrativo">Administrativo</option>
                <option value="RH">Recursos Humanos (RH)</option>
                <option value="TI / Infraestrutura">TI / Infraestrutura</option>
                <option value="N1">Suporte N1</option>
                <option value="N2">Suporte N2</option>
                <option value="N3">Suporte N3</option>
                <option value="Desenvolvimento">Desenvolvimento</option>
                <option value="DBA">DBA & Dados</option>
                <option value="Comercial">Comercial</option>
                <option value="Diretoria">Diretoria</option>
                <option value="Geral">Salas de Reunião / Geral</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-auto px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="TODOS">Status: Todos</option>
                <option value="Em uso">Em uso</option>
                <option value="Estoque">Estoque</option>
                <option value="Manutenção">Manutenção</option>
              </select>
            </div>

            {/* Category Quick Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Filtrar Categoria:
              </span>
              {['TODOS', 'Mobiliário', 'Informática', 'Audiovisual', 'Rede & Infra', 'Eletro & Escritório'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-amber-600 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat === 'TODOS' ? 'Todas as Categorias' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Table: Full Generalized Asset Inventory */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                    <th className="py-3.5 px-4">Patrimônio / Código</th>
                    <th className="py-3.5 px-4">Tipo & Categoria</th>
                    <th className="py-3.5 px-4 min-w-[230px]">Modelo / Especificação</th>
                    <th className="py-3.5 px-4">Setor & Local</th>
                    <th className="py-3.5 px-4">Responsável / Custódia</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações da Etiqueta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Tag with miniature barcode */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-black text-amber-400">
                            {item.tag}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Tombamento OK
                          </span>
                        </div>
                      </td>

                      {/* Type and Category */}
                      <td className="py-3.5 px-4 font-sans text-slate-300">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                            {renderTypeIcon(item.type)}
                          </div>
                          <div>
                            <span className="font-bold text-white block leading-tight">{item.type}</span>
                            <span className="text-[10px] text-slate-400">{item.category || 'Geral'}</span>
                            {item.agentId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab('it_agent');
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 rounded text-[9px] font-bold bg-blue-950/90 text-blue-300 border border-blue-700/80 hover:bg-blue-900 transition-colors cursor-pointer"
                                title="Ver telemetria do Agente GIHS neste computador"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${item.agentStatus === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                                <span>Agente {item.agentStatus === 'ONLINE' ? 'Online' : 'Sincronizado'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Model */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white line-clamp-1">{item.model}</div>
                        {item.specifications && typeof item.specifications === 'object' && (
                          <div className="text-[10px] text-cyan-400 font-mono mt-0.5 line-clamp-1">
                            {[
                              item.specifications.processor,
                              item.specifications.ram_gb ? `${item.specifications.ram_gb}GB RAM` : null,
                              item.specifications.os
                            ].filter(Boolean).join(' • ')}
                          </div>
                        )}
                        {item.serialNumber && (
                          <div className="text-[9px] text-slate-500 font-mono">
                            SN: {item.serialNumber}
                          </div>
                        )}
                        {item.valueBRL && (
                          <span className="text-[10px] text-slate-500 font-mono block">
                            Valor: {item.valueBRL}
                          </span>
                        )}
                      </td>

                      {/* Sector & Location */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-cyan-300 block">{item.sector || 'Não informado'}</span>
                        <span className="text-[10px] text-slate-400 truncate block">{item.location || 'Sede'}</span>
                      </td>

                      {/* Assignee */}
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {item.assignee}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.status === 'Em uso'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : item.status === 'Estoque'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.agentId && (
                            <button
                              onClick={() => {
                                setActiveTab('it_agent');
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-800 text-blue-300 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                              title="Abrir telemetria e inventário deste computador no Agente"
                            >
                              <Laptop className="w-3.5 h-3.5 text-blue-400" />
                              <span>Telemetria</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedItemForLabel(item);
                              setActiveTab('label_generator');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            title="Gerar e imprimir etiqueta para este bem específico"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                            <span>Etiqueta</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhum bem patrimoniado encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AGENTE DE TI & COMPUTADORES (INTEGRADO DIRETAMENTE AO PATRIMÔNIO) */}
      {activeTab === 'it_agent' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <InventoryAgentAdminView
            currentUser={currentUser}
            onNavigate={(screen) => {
              if (screen === 'equipamentos') {
                setActiveTab('inventory');
              } else if (onNavigate) {
                onNavigate(screen);
              }
            }}
          />
        </div>
      )}

      {/* TAB 2: GERADOR & EMISSOR DE ETIQUETAS (Phase 8 Full Specification) */}
      {activeTab === 'label_generator' && (
        <AssetLabelGenerator
          initialItem={selectedItemForLabel}
          existingItems={equipmentList}
          onSaveToInventory={(newItem) => {
            // Update or add
            const exists = equipmentList.some(i => i.id === newItem.id || i.tag === newItem.tag);
            if (exists) {
              setEquipmentList(equipmentList.map(i => i.tag === newItem.tag ? newItem : i));
            } else {
              setEquipmentList([newItem, ...equipmentList]);
            }
          }}
          onClose={() => setActiveTab('inventory')}
        />
      )}

      {/* TAB 3: EQUIPE DE PATRIMÔNIO & VISTORIAS */}
      {activeTab === 'patrimony_team' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Central de Atendimento & Normas da Equipe de Patrimônio
                  </h3>
                  <p className="text-xs text-slate-400">
                    Processamento de chamados de tombamento, etiquetagem em lote e controle de bens
                  </p>
                </div>
              </div>

              {onNavigate && (
                <button
                  onClick={() => onNavigate('chamados')}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <LifeBuoy className="w-4 h-4" />
                  <span>Acessar Fila de Patrimônio no Help Desk</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  1. Entrada de Novos Equipamentos
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Todo equipamento de escritório (Mesa, Cadeira, Armário) e TI recebido na empresa deve receber o tombamento em até 24 horas antes do envio aos setores.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                  2. Etiquetagem e Impressão
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  A equipe de patrimônio emite a etiqueta física com código de barras Code 39 e logomarca GIHS System, colando em local padronizado para leitura ótica.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  3. Termo de Custódia
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ao entregar o bem ao colaborador ou sala, registra-se a custódia no inventário para acompanhamento de garantia, depreciação e manutenção.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: + Cadastrar Ativo */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Cadastrar Novo Bem Patrimoniado
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-3.5">
              {/* Tag & Auto Generate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Número de Patrimônio (Tag)
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewTag(generateModalTag())}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-mono font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Gerar Próximo
                  </button>
                </div>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-amber-400 font-mono font-bold tracking-wider"
                  required
                />
              </div>

              {/* Type and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tipo de Equipamento / Bem
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewType(val);
                      if (['Mesa', 'Cadeira', 'Armário'].includes(val)) setNewCategory('Mobiliário');
                      else if (['Computador', 'Monitor'].includes(val)) setNewCategory('Informática');
                      else if (['Televisão', 'Audiovisual'].includes(val)) setNewCategory('Audiovisual');
                      else if (['Switch', 'Servidor'].includes(val)) setNewCategory('Rede & Infra');
                      else if (val === 'Climatização') setNewCategory('Eletro & Escritório');
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="Cadeira">Cadeira (Mobiliário)</option>
                    <option value="Mesa">Mesa (Mobiliário)</option>
                    <option value="Armário">Armário / Gaveteiro (Mobiliário)</option>
                    <option value="Computador">Computador / Notebook</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Televisão">Televisão / Smart TV</option>
                    <option value="Switch">Switch / Conectividade</option>
                    <option value="Climatização">Climatização / Ar-condicionado</option>
                    <option value="Outros">Outros Equipamentos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Setor de Destino
                  </label>
                  <select
                    value={newSector}
                    onChange={(e) => setNewSector(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    {SECTORS.map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                    <option value="TI / Infraestrutura">TI / Infraestrutura</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Diretoria">Diretoria</option>
                    <option value="Geral">Salas de Reunião / Geral</option>
                  </select>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Modelo e Especificação Detalhada
                </label>
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="Ex: Cadeira Ergonômica NR17 Mesh Black"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  required
                />
              </div>

              {/* Location and Assignee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Responsável / Custodiante
                  </label>
                  <input
                    type="text"
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    placeholder="Ex: Mariana Castro"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Localização Exata / Sala
                  </label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ex: Andar 2 • Sala 204"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              {/* Checkbox: Print label immediately */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="chk-print"
                  checked={printImmediately}
                  onChange={(e) => setPrintImmediately(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="chk-print" className="text-xs text-slate-300 cursor-pointer">
                  Abrir Emissor de Etiquetas de Patrimônio imediatamente após salvar
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
                >
                  Salvar Ativo no Inventário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
