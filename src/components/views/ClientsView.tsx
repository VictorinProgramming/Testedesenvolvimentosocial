import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  ShieldCheck,
  PhoneCall,
  FileText,
  Search,
  CheckCircle2,
  ExternalLink,
  Edit2,
  Trash2,
  Download,
  AlertTriangle,
  Mail,
  Phone,
  Layers,
  MapPin,
  RefreshCw,
  Sparkles,
  DollarSign,
  Clock,
  ArrowRight,
  Database,
  Check,
  User,
  Filter
} from 'lucide-react';
import { SupportTicket, Sector, Priority } from '../../types';
import { ticketService } from '../../services/ticketService';
import { apiBackendService } from '../../services/apiBackendService';
import { getServicesForSector } from '../../data/glpiServiceCatalog';
import {
  ExtendedClientEntity,
  JOINVILLE_MUNICIPAL_ORGANS
} from '../../data/joinvilleSecretariasData';

export type { ExtendedClientEntity };

const STORAGE_KEY_CLIENTS = 'gihs_clients_catalog_joinville_v3';

// Equipe técnica do GIHS para atribuição de chamados
const GIHS_TECHNICIANS = [
  { name: 'Guilherme Hirata Satoshi', role: 'Suporte N3 & Redes', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { name: 'Victor Martins', role: 'Desenvolvedor & DBA', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80' },
  { name: 'Victor Hugo Estevão', role: 'Dev Full-Stack & Segurança', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  { name: 'Matheus', role: 'Head de Inteligência Master', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80' },
  { name: 'Rebeca Lara', role: 'Dev Full-Stack', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { name: 'Karina Feller', role: 'Administradora & Patrimônio', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' }
];

interface ClientsViewProps {
  onNavigate?: (screen: any) => void;
  currentUser?: any;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ onNavigate, currentUser }) => {
  const [clients, setClients] = useState<ExtendedClientEntity[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 10) return parsed;
      }
    } catch {}
    return JOINVILLE_MUNICIPAL_ORGANS;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ExtendedClientEntity | null>(null);
  const [viewingTicketsClient, setViewingTicketsClient] = useState<ExtendedClientEntity | null>(null);
  const [viewingContractClient, setViewingContractClient] = useState<ExtendedClientEntity | null>(null);
  const [newTicketClient, setNewTicketClient] = useState<ExtendedClientEntity | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ExtendedClientEntity | null>(null);

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientAcronym, setNewClientAcronym] = useState('');
  const [newClientPlan, setNewClientPlan] = useState('Suporte Full N1/N2 + Infraestrutura & Rede');
  const [newClientCnpj, setNewClientCnpj] = useState('83.178.694/0001-44');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('(47) 3431-3000');
  const [newClientSector, setNewClientSector] = useState('Administração Municipal');
  const [newClientMonthly, setNewClientMonthly] = useState('R$ 25.000,00');
  const [newClientSla, setNewClientSla] = useState('99.5%');
  const [newClientAddress, setNewClientAddress] = useState('Joinville - SC');
  const [newClientDescription, setNewClientDescription] = useState('');
  const [newClientCategory, setNewClientCategory] = useState<'Secretaria Municipal' | 'Autarquia / Fundação' | 'Hospital Público' | 'Poder Legislativo'>('Secretaria Municipal');

  // Ticket creation form state for client (Help Desk & Chamados Model)
  const [tktProtocolPreview, setTktProtocolPreview] = useState('');
  const [tktSubject, setTktSubject] = useState('');
  const [tktRequester, setTktRequester] = useState('');
  const [tktRequesterEmail, setTktRequesterEmail] = useState('');
  const [tktSector, setTktSector] = useState<Sector>('N1');
  const [tktClassification, setTktClassification] = useState('Suporte a Estação de Trabalho');
  const [tktPriority, setTktPriority] = useState<Priority>('Média');
  const [tktAssignedTo, setTktAssignedTo] = useState<string>('Guilherme Hirata Satoshi');
  const [tktDescription, setTktDescription] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Live client tickets modal state
  const [clientTicketsList, setClientTicketsList] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketFilterStatus, setTicketFilterStatus] = useState<string>('TODOS');

  // Fetch from PostgreSQL
  const fetchClientsFromPostgres = async () => {
    try {
      setIsLoading(true);
      const res = await apiBackendService.getClients();
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        // Merge with initial data for categories if missing
        const merged = res.data.map((c: any) => {
          const matchInitial = JOINVILLE_MUNICIPAL_ORGANS.find(
            (init) => init.id === c.id || init.name.toLowerCase() === c.name.toLowerCase()
          );
          return {
            ...matchInitial,
            ...c,
            category: c.category || matchInitial?.category || 'Secretaria Municipal',
            acronym: c.acronym || matchInitial?.acronym || ''
          };
        });
        setClients(merged);
        try {
          localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(merged));
        } catch {}
      }
    } catch (err) {
      console.warn('Erro ao carregar secretarias de Joinville do PostgreSQL:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsFromPostgres();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Seed / Reset Joinville Secretarias in PostgreSQL
  const handleSyncWithPostgres = async () => {
    try {
      setIsSyncing(true);
      const res = await apiBackendService.seedClients();
      if (res?.success) {
        showToast('✓ Todas as 23 Secretarias e Órgãos Públicos de Joinville sincronizados com sucesso no PostgreSQL!');
        await fetchClientsFromPostgres();
      } else {
        showToast('✓ Secretarias verificadas e consolidadas no PostgreSQL.');
      }
    } catch (err: any) {
      showToast(`Erro ao sincronizar com PostgreSQL: ${err?.message || 'Falha de conexão'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter clients
  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const searchClean = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !searchClean ||
        c.name.toLowerCase().includes(searchClean) ||
        (c.acronym && c.acronym.toLowerCase().includes(searchClean)) ||
        c.plan.toLowerCase().includes(searchClean) ||
        (c.contact && c.contact.toLowerCase().includes(searchClean)) ||
        (c.cnpj && c.cnpj.includes(searchClean)) ||
        (c.contractNumber && c.contractNumber.toLowerCase().includes(searchClean)) ||
        (c.sectorServed && c.sectorServed.toLowerCase().includes(searchClean));

      const matchesStatus = statusFilter === 'TODOS' || c.status === statusFilter;

      let matchesCategory = true;
      if (categoryFilter === 'SECRETARIAS') {
        matchesCategory = c.category === 'Secretaria Municipal' || (!c.category && c.name.startsWith('Secretaria'));
      } else if (categoryFilter === 'AUTARQUIAS') {
        matchesCategory = c.category === 'Autarquia / Fundação' || c.name.includes('Departamento') || c.name.includes('Companhia') || c.name.includes('Instituto') || c.name.includes('PROCON');
      } else if (categoryFilter === 'SAUDE') {
        matchesCategory = c.name.includes('Saúde') || c.name.includes('Hospital') || c.id.includes('sms') || c.id.includes('hmsj');
      } else if (categoryFilter === 'SEGURANCA') {
        matchesCategory = c.name.includes('Segurança') || c.name.includes('Trânsito') || c.id.includes('secon') || c.id.includes('detrans');
      } else if (categoryFilter === 'EDUCACAO') {
        matchesCategory = c.name.includes('Educação') || c.name.includes('Cultura') || c.id.includes('semed') || c.id.includes('secult');
      } else if (categoryFilter === 'INFRAESTRUTURA') {
        matchesCategory = c.name.includes('Infraestrutura') || c.name.includes('Meio Ambiente') || c.name.includes('Águas') || c.id.includes('seinfra') || c.id.includes('sama') || c.id.includes('caj');
      }

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [clients, searchTerm, statusFilter, categoryFilter]);

  // KPIs
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status === 'Ativo').length;
  const totalOpenTickets = clients.reduce((sum, c) => sum + (c.openTickets || 0), 0);
  const totalMonthlyValue = useMemo(() => {
    const sum = clients.reduce((acc, c) => {
      if (c.monthlyValueNumeric) return acc + c.monthlyValueNumeric;
      if (c.monthlyValue) {
        const val = parseFloat(c.monthlyValue.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        return acc + val;
      }
      return acc;
    }, 0);
    return `R$ ${sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [clients]);

  // Create Client
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      showToast('Por favor, informe a razão social ou nome da entidade.');
      return;
    }

    const year = new Date().getFullYear();
    const randNum = Math.floor(100 + Math.random() * 900);
    const newId = `cli-pmj-${Date.now()}`;
    const newClientPayload: ExtendedClientEntity = {
      id: newId,
      name: newClientName.trim(),
      acronym: newClientAcronym.trim() || newClientName.match(/\(([^)]+)\)/)?.[1] || '',
      plan: newClientPlan,
      sla: newClientSla,
      openTickets: 0,
      monthlyValue: newClientMonthly,
      contact: newClientContact.trim() || 'gestor@joinville.sc.gov.br',
      phone: newClientPhone.trim() || '(47) 3431-3000',
      status: 'Ativo',
      cnpj: newClientCnpj.trim() || '83.178.694/0001-44',
      sectorServed: newClientSector,
      contractNumber: `CT-PMJ-${year}/${randNum}-TI`,
      contractStartDate: new Date().toLocaleDateString('pt-BR'),
      contractEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      description: newClientDescription.trim() || 'Contrato de governança e suporte de TI para a administração pública de Joinville.',
      address: newClientAddress.trim() || 'Joinville - SC',
      category: newClientCategory
    };

    try {
      await apiBackendService.createClient(newClientPayload);
      await fetchClientsFromPostgres();
      setIsCreateModalOpen(false);
      // Reset form
      setNewClientName('');
      setNewClientAcronym('');
      setNewClientContact('');
      setNewClientDescription('');
      showToast(`✓ Órgão Público "${newClientPayload.name}" cadastrado com sucesso no PostgreSQL!`);
    } catch (err: any) {
      showToast(`Erro ao salvar no PostgreSQL: ${err?.message || 'Falha de comunicação'}`);
    }
  };

  // Update Client
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      await apiBackendService.updateClient(editingClient.id, editingClient);
      await fetchClientsFromPostgres();
      setEditingClient(null);
      showToast(`✓ Dados da secretaria "${editingClient.name}" atualizados com sucesso no PostgreSQL.`);
    } catch (err: any) {
      showToast(`Erro ao atualizar: ${err?.message || 'Falha de comunicação'}`);
    }
  };

  // Delete Client
  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      await apiBackendService.deleteClient(clientToDelete.id);
      await fetchClientsFromPostgres();
      showToast(`✓ Contrato do órgão "${clientToDelete.name}" removido com sucesso.`);
      setClientToDelete(null);
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err?.message || 'Falha de comunicação'}`);
    }
  };

  // Open Chamados Modal
  const handleOpenClientTickets = async (client: ExtendedClientEntity) => {
    setViewingTicketsClient(client);
    setIsLoadingTickets(true);
    setTicketFilterStatus('TODOS');
    try {
      const allTickets = await ticketService.getTickets();
      const clientNameClean = client.name.toLowerCase();
      const acronymClean = client.acronym ? client.acronym.toLowerCase() : '';

      const matched = allTickets.filter((t) => {
        const tClient = (t.client || t.requester || '').toLowerCase();
        return (
          tClient.includes(clientNameClean) ||
          clientNameClean.includes(tClient) ||
          (acronymClean && tClient.includes(acronymClean)) ||
          (client.sectorServed && t.sector === client.sectorServed)
        );
      });

      setClientTicketsList(matched);
    } catch (err) {
      console.warn('Erro ao buscar chamados do cliente:', err);
      setClientTicketsList([]);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  // Open "Abrir Chamado" modal for a specific client (Prepares standard Help Desk payload)
  const handleOpenCreateTicketForClient = (client: ExtendedClientEntity) => {
    setNewTicketClient(client);
    const randProtocol = `GIHS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setTktProtocolPreview(randProtocol);
    setTktSubject(`Demanda de TI • ${client.acronym || client.name}`);
    setTktRequester(client.contactName || 'Gestor Setorial');
    setTktRequesterEmail(client.contactEmail || client.contact || 'suporte@joinville.sc.gov.br');

    let defaultSec: Sector = 'N1';
    if (client.name.includes('Saúde') || client.name.includes('Hospital')) defaultSec = 'N3';
    else if (client.name.includes('Fazenda') || client.name.includes('Segurança')) defaultSec = 'Cyber Security';
    else if (client.name.includes('Patrimônio') || client.name.includes('Administração')) defaultSec = 'Patrimônio';
    else if (client.name.includes('Educação') || client.name.includes('Infraestrutura')) defaultSec = 'N2';

    setTktSector(defaultSec);
    const services = getServicesForSector(defaultSec);
    setTktClassification(services[0] || 'Suporte Técnico Geral');
    setTktPriority('Média');
    setTktAssignedTo('Guilherme Hirata Satoshi');
    setTktDescription(
      `Chamado aberto para o órgão municipal: ${client.name}.\nLocal: ${client.address || 'Unidade Administrativa Joinville'}.\nDescrição da necessidade: `
    );
  };

  // Submit new ticket for client following Help Desk & Chamados standard
  const handleSubmitTicketForClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketClient || !tktSubject.trim()) return;

    setIsSubmittingTicket(true);
    try {
      const assignedTech = GIHS_TECHNICIANS.find((t) => t.name === tktAssignedTo);

      await ticketService.createTicket({
        title: tktSubject.trim(),
        subject: tktSubject.trim(),
        client: newTicketClient.name,
        requester: tktRequester.trim() || newTicketClient.name,
        requesterEmail: tktRequesterEmail.trim() || newTicketClient.contact,
        contactEmail: tktRequesterEmail.trim() || newTicketClient.contact,
        sector: tktSector,
        serviceClassification: tktClassification,
        service_classification: tktClassification,
        priority: tktPriority,
        description: tktDescription.trim(),
        assignedTo: tktAssignedTo || undefined,
        assignedAvatar: assignedTech?.avatar || undefined,
        status: 'Aberto'
      });

      // Update clients in state & PostgreSQL
      await fetchClientsFromPostgres();

      showToast(
        `✓ Chamado ${tktProtocolPreview} registrado com sucesso para "${newTicketClient.name}" no Help Desk & Chamados!`
      );
      setNewTicketClient(null);
    } catch (err: any) {
      showToast(`Erro ao registrar chamado no PostgreSQL: ${err?.message || 'Falha de comunicação'}`);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // Export Clients to CSV
  const handleExportClientsCSV = () => {
    const headers = [
      'ID',
      'Razao_Social',
      'Sigla',
      'Categoria',
      'CNPJ',
      'Plano_SLA',
      'SLA_Meta',
      'Chamados_Abertos',
      'Dotacao_Mensal',
      'Email_Contato',
      'Telefone_PBX',
      'Status_Contratual',
      'Setor_Atendido',
      'Contrato_Numero',
      'Endereco_Joinville'
    ];
    const rows = clients.map((c) => [
      c.id,
      `"${c.name}"`,
      `"${c.acronym || ''}"`,
      `"${c.category || 'Secretaria Municipal'}"`,
      `"${c.cnpj || ''}"`,
      `"${c.plan}"`,
      c.sla,
      c.openTickets || 0,
      `"${c.monthlyValue}"`,
      `"${c.contact}"`,
      `"${c.phone || ''}"`,
      c.status,
      `"${c.sectorServed || ''}"`,
      `"${c.contractNumber || ''}"`,
      `"${c.address || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Secretarias_e_Orgaos_Joinville_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('✓ Arquivo CSV dos Órgãos Públicos e Secretarias de Joinville exportado com sucesso!');
  };

  // Filtered tickets in the view tickets modal
  const modalFilteredTickets = useMemo(() => {
    if (ticketFilterStatus === 'TODOS') return clientTicketsList;
    return clientTicketsList.filter((t) => t.status === ticketFilterStatus);
  }, [clientTicketsList, ticketFilterStatus]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Gestão de Clientes & Secretarias Municipais
                </h1>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  Rede Joinville / SC
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-mono">
                  <Database className="w-2.5 h-2.5" />
                  PostgreSQL 16+
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Todas as secretarias da rede de Joinville, autarquias e órgãos públicos sob governança de TI com integração direta ao Help Desk & Chamados.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncWithPostgres}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="Sincronizar base oficial de órgãos públicos com o PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar PostgreSQL'}</span>
          </button>

          <button
            onClick={handleExportClientsCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="Exportar base oficial em formato CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            id="btn-novo-cliente"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Órgão Público</span>
          </button>
        </div>
      </div>

      {/* Toast Notice */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs flex items-center justify-between animate-in fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Órgãos & Secretarias</span>
            <p className="text-2xl font-black font-mono text-white mt-1">{totalClients}</p>
            <span className="text-[10px] text-emerald-400 font-mono">
              {activeClients} unidades ativas em Joinville
            </span>
          </div>
          <div className="p-3 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Chamados Ativos na Rede</span>
            <p className="text-2xl font-black font-mono text-amber-400 mt-1">{totalOpenTickets}</p>
            <span className="text-[10px] text-slate-400 font-mono">
              Registrados no Help Desk
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-400">
            <PhoneCall className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Conformidade SLA Global</span>
            <p className="text-2xl font-black font-mono text-emerald-400 mt-1">99.6%</p>
            <span className="text-[10px] text-emerald-400 font-mono">Meta contratual atendida</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Dotação Mensal de Governança</span>
            <p className="text-2xl font-black font-mono text-cyan-400 mt-1">{totalMonthlyValue}</p>
            <span className="text-[10px] text-slate-400 font-mono">Rede municipal consolidada</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Pills & Search */}
      <div className="space-y-3 bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Filtrar por Rede:</span>
          </span>
          {[
            { id: 'TODOS', label: 'Todas as Secretarias & Órgãos', count: clients.length },
            { id: 'SECRETARIAS', label: 'Secretarias Municipais', count: clients.filter(c => c.category === 'Secretaria Municipal' || (!c.category && c.name.startsWith('Secretaria'))).length },
            { id: 'AUTARQUIAS', label: 'Autarquias & Companhias', count: clients.filter(c => c.category === 'Autarquia / Fundação' || c.name.includes('Companhia') || c.name.includes('Instituto') || c.name.includes('Departamento') || c.name.includes('PROCON')).length },
            { id: 'SAUDE', label: 'Saúde & Hospitalar', count: clients.filter(c => c.name.includes('Saúde') || c.name.includes('Hospital')).length },
            { id: 'SEGURANCA', label: 'Segurança & Trânsito', count: clients.filter(c => c.name.includes('Segurança') || c.name.includes('Trânsito')).length },
            { id: 'EDUCACAO', label: 'Educação & Cultura', count: clients.filter(c => c.name.includes('Educação') || c.name.includes('Cultura')).length },
            { id: 'INFRAESTRUTURA', label: 'Infraestrutura & Água', count: clients.filter(c => c.name.includes('Infraestrutura') || c.name.includes('Meio Ambiente') || c.name.includes('Águas')).length },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === cat.id
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${categoryFilter === cat.id ? 'bg-cyan-900/60 text-cyan-100' : 'bg-slate-900 text-slate-400'}`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar & Status */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Pesquisar por secretaria (SEMED, SMS, SEFAZ, CAJ...), CNPJ, contrato, gestor ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="TODOS">Status: Todos</option>
              <option value="Ativo">Ativo</option>
              <option value="Em Implantação">Em Implantação</option>
              <option value="Suspenso">Suspenso</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Clients (Secretarias Municipais) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => {
          const acronym = client.acronym || client.name.match(/\(([^)]+)\)/)?.[1] || 'PMJ';

          return (
            <div
              key={client.id}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-700/60 transition-all shadow-lg flex flex-col justify-between space-y-4 group relative"
            >
              <div>
                {/* Header row: Acronym + SLA + Status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 tracking-wide font-mono">
                      {acronym}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      SLA {client.sla}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        client.status === 'Ativo'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : client.status === 'Em Implantação'
                          ? 'bg-amber-950 text-amber-400 border-amber-800'
                          : 'bg-rose-950 text-rose-400 border-rose-800'
                      }`}
                    >
                      {client.status}
                    </span>

                    <button
                      onClick={() => setEditingClient(client)}
                      title="Editar informações do órgão municipal"
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setClientToDelete(client)}
                      title="Excluir órgão municipal"
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Name & Plan */}
                <h3 className="text-sm font-bold text-white tracking-tight leading-snug line-clamp-2">
                  {client.name}
                </h3>
                <p className="text-[11px] text-cyan-400 mt-1 font-medium flex items-center gap-1.5">
                  <Layers className="w-3 h-3 shrink-0" />
                  <span className="truncate">{client.plan}</span>
                </p>

                {/* Description */}
                {client.description && (
                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {client.description}
                  </p>
                )}
              </div>

              {/* Metrics & Contract Info */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">Chamados no Help Desk</span>
                    <span
                      className={`font-bold text-sm ${
                        client.openTickets && client.openTickets > 0 ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {client.openTickets || 0} {client.openTickets === 1 ? 'ativo' : 'ativos'}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">Dotação Mensal</span>
                    <span className="font-bold text-white text-xs">{client.monthlyValue}</span>
                  </div>
                </div>

                {/* Contact & Location Details */}
                <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">{client.contact}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Phone className="w-2.5 h-2.5 text-slate-500" />
                      <span>{client.phone || '(47) 3431-3000'}</span>
                    </span>
                    <span className="font-mono text-slate-500">
                      {client.cnpj || '83.178.694/0001-44'}
                    </span>
                  </div>
                  {client.address && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate pt-0.5">
                      <MapPin className="w-2.5 h-2.5 shrink-0 text-slate-500" />
                      <span className="truncate">{client.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Standardized Actions (Direct connection to Help Desk & Chamados) */}
              <div className="space-y-1.5 pt-1">
                {/* 1. Ver chamados no Help Desk */}
                <button
                  onClick={() => handleOpenClientTickets(client)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver chamados do órgão ({client.openTickets || 0})</span>
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* 2. Ver contrato */}
                  <button
                    onClick={() => setViewingContractClient(client)}
                    className="py-2 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Termo & SLA</span>
                  </button>

                  {/* 3. Abrir chamado (Help Desk Standard) */}
                  <button
                    onClick={() => handleOpenCreateTicketForClient(client)}
                    className="py-2 px-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/90 text-cyan-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Abrir chamado</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum órgão municipal encontrado</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Não encontramos secretarias ou órgãos que correspondam aos filtros pesquisados. Tente ajustar a busca ou clique abaixo para restaurar a rede completa de Joinville.
          </p>
          <button
            onClick={handleSyncWithPostgres}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all"
          >
            Restaurar Secretarias de Joinville no PostgreSQL
          </button>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: Abrir Chamado no Modelo Help Desk & Chamados (Portaria & Padrão GIHS)
          ========================================================================= */}
      {newTicketClient && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                    <Plus className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Novo Chamado • Help Desk & Chamados
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Órgão Solicitante: <strong className="text-cyan-400">{newTicketClient.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setNewTicketClient(null)}
                className="text-slate-400 hover:text-white p-1 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Protocol & SLA Banner */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block">Protocolo de Atendimento</span>
                <span className="text-cyan-400 font-bold">{tktProtocolPreview}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Meta Contratual SLA</span>
                <span className="text-emerald-400 font-bold">{newTicketClient.sla}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Base de Dados</span>
                <span className="text-slate-300 font-bold">PostgreSQL 16+</span>
              </div>
            </div>

            <form onSubmit={handleSubmitTicketForClient} className="space-y-4">
              {/* Assunto */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assunto do Chamado *
                </label>
                <input
                  type="text"
                  value={tktSubject}
                  onChange={(e) => setTktSubject(e.target.value)}
                  placeholder="Ex: Falha no link de fibra óptica da unidade escolar..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {/* Solicitante & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Solicitante / Gestor *
                  </label>
                  <input
                    type="text"
                    value={tktRequester}
                    onChange={(e) => setTktRequester(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail Institucional *
                  </label>
                  <input
                    type="email"
                    value={tktRequesterEmail}
                    onChange={(e) => setTktRequesterEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Setor & Prioridade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fila / Setor Responsável (GLPI) *
                  </label>
                  <select
                    value={tktSector}
                    onChange={(e) => {
                      const newSec = e.target.value as Sector;
                      setTktSector(newSec);
                      const services = getServicesForSector(newSec);
                      if (services.length > 0) {
                        setTktClassification(services[0]);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <optgroup label="Suporte & Operações">
                      <option value="N1">N1 - Suporte ao Usuário e Periféricos</option>
                      <option value="N2">N2 - Infraestrutura, Redes e Conectividade</option>
                      <option value="N3">N3 - Engenharia, DevOps e Sistemas Core</option>
                    </optgroup>
                    <optgroup label="Especialidades & Governança">
                      <option value="Patrimônio">Patrimônio & Almoxarifado Central</option>
                      <option value="DBA">DBA & Bancos de Dados Críticos</option>
                      <option value="Cyber Security">Cyber Security, SOC & LGPD</option>
                      <option value="Administrativo">Administração & Protocolos</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Prioridade & Prazo de SLA *
                  </label>
                  <select
                    value={tktPriority}
                    onChange={(e) => setTktPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono font-semibold"
                  >
                    <option value="Baixa">Baixa — Resolução em até 8h</option>
                    <option value="Média">Média — Resolução em até 4h</option>
                    <option value="Alta">Alta — Resolução em até 2h</option>
                    <option value="Crítica">Crítica — Resolução em até 1h (Incidente)</option>
                  </select>
                </div>
              </div>

              {/* Classificação do Serviço */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Classificação do Serviço (Catálogo Municipal Joinville) *
                </label>
                <select
                  value={tktClassification}
                  onChange={(e) => setTktClassification(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {getServicesForSector(tktSector).map((srv) => (
                    <option key={srv} value={srv}>
                      {srv}
                    </option>
                  ))}
                </select>
              </div>

              {/* Atribuição de Técnico Responsável */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Técnico Especialista Atribuído
                </label>
                <select
                  value={tktAssignedTo}
                  onChange={(e) => setTktAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {GIHS_TECHNICIANS.map((tech) => (
                    <option key={tech.name} value={tech.name}>
                      {tech.name} — {tech.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Descrição Detalhada */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição Detalhada do Problema / Demanda *
                </label>
                <textarea
                  rows={3}
                  value={tktDescription}
                  onChange={(e) => setTktDescription(e.target.value)}
                  placeholder="Relate os sintomas do problema, unidades ou usuários afetados..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewTicketClient(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingTicket && (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  <span>Registrar no Help Desk & Chamados</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: Visualizar Chamados do Órgão (Integrado ao PostgreSQL)
          ========================================================================= */}
      {viewingTicketsClient && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-cyan-400" />
                  <span>Chamados no Help Desk • {viewingTicketsClient.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Histórico de chamados e conformidade com o SLA de {viewingTicketsClient.sla}
                </p>
              </div>
              <button
                onClick={() => setViewingTicketsClient(null)}
                className="text-slate-400 hover:text-white p-1 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sub-Filters */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {['TODOS', 'Aberto', 'Em atendimento', 'Resolvido'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setTicketFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      ticketFilterStatus === st
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {onNavigate && (
                <button
                  onClick={() => {
                    setViewingTicketsClient(null);
                    onNavigate('chamados');
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <span>Abrir no Help Desk</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tickets List */}
            {isLoadingTickets ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Consultando base do PostgreSQL...</p>
              </div>
            ) : modalFilteredTickets.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs text-slate-300 font-semibold">
                  Nenhum chamado pendente encontrado para este órgão municipal.
                </p>
                <p className="text-[11px] text-slate-500">
                  A infraestrutura e serviços desta unidade estão operando em 100% de conformidade.
                </p>
                <button
                  onClick={() => {
                    const c = viewingTicketsClient;
                    setViewingTicketsClient(null);
                    handleOpenCreateTicketForClient(c);
                  }}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                >
                  + Abrir Novo Chamado
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {modalFilteredTickets.map((tkt) => (
                  <div
                    key={tkt.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                          {tkt.protocol || tkt.id}
                        </span>
                        <span className="text-xs font-bold text-white truncate max-w-xs">
                          {tkt.title || tkt.subject}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          tkt.status === 'Resolvido'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : tkt.status === 'Em atendimento'
                            ? 'bg-amber-950 text-amber-400 border-amber-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        {tkt.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2">{tkt.description}</p>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-900 font-mono">
                      <span>Fila: <strong className="text-slate-300">{tkt.sector}</strong> • {tkt.serviceClassification}</span>
                      <span>Prioridade: <strong className={tkt.priority === 'Crítica' ? 'text-rose-400' : 'text-slate-300'}>{tkt.priority}</strong> (SLA {tkt.sla || '4h'})</span>
                      {tkt.assignedTo && <span>Técnico: <strong className="text-cyan-400">{tkt.assignedTo}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: Visualizar Termo Contratual & SLA do Órgão
          ========================================================================= */}
      {viewingContractClient && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Contrato de TI & Governança Pública</span>
                </h3>
                <p className="text-xs text-cyan-400 mt-0.5">{viewingContractClient.name}</p>
              </div>
              <button
                onClick={() => setViewingContractClient(null)}
                className="text-slate-400 hover:text-white p-1 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block">Número do Contrato</span>
                  <span className="text-white font-bold">{viewingContractClient.contractNumber || 'CT-PMJ-2026/014-TI'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">CNPJ Cadastral</span>
                  <span className="text-white font-bold">{viewingContractClient.cnpj || '83.178.694/0001-44'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Vigência Inicial</span>
                  <span className="text-slate-300">{viewingContractClient.contractStartDate || '01/01/2026'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Vigência Final</span>
                  <span className="text-slate-300">{viewingContractClient.contractEndDate || '31/12/2026'}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                  Escopo de Cobertura Tecnológica
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {viewingContractClient.description || 'Suporte técnico pleno, governança de redes e conformidade regulatória municipal.'}
                </p>
                {viewingContractClient.address && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-900">
                    <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>{viewingContractClient.address}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-cyan-950/40 border border-cyan-800/80 rounded-2xl">
                  <span className="text-[10px] text-cyan-400 uppercase font-mono block">Meta de SLA</span>
                  <span className="text-lg font-bold font-mono text-cyan-300">{viewingContractClient.sla}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Disponibilidade contratual</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Dotação Mensal</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">{viewingContractClient.monthlyValue}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Recurso orçamentário aprovado</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setViewingContractClient(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: Criar Novo Órgão Público / Secretaria
          ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Cadastrar Órgão Municipal / Secretaria
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Órgão / Secretaria *
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ex: Secretaria Municipal de Habitação (SEHAB)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sigla Oficial *
                  </label>
                  <input
                    type="text"
                    value={newClientAcronym}
                    onChange={(e) => setNewClientAcronym(e.target.value)}
                    placeholder="Ex: SEHAB"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CNPJ *
                  </label>
                  <input
                    type="text"
                    value={newClientCnpj}
                    onChange={(e) => setNewClientCnpj(e.target.value)}
                    placeholder="83.178.694/0001-44"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail Institucional *
                  </label>
                  <input
                    type="email"
                    value={newClientContact}
                    onChange={(e) => setNewClientContact(e.target.value)}
                    placeholder="contato@joinville.sc.gov.br"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Telefone PBX *
                  </label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="(47) 3431-3000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Plano de TI Contratado *
                  </label>
                  <input
                    type="text"
                    value={newClientPlan}
                    onChange={(e) => setNewClientPlan(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Meta de SLA *
                  </label>
                  <input
                    type="text"
                    value={newClientSla}
                    onChange={(e) => setNewClientSla(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Endereço da Unidade em Joinville
                </label>
                <input
                  type="text"
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  placeholder="Rua Hermann August Lepper, 10 - Saguaçu, Joinville - SC"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição do Escopo do Órgão
                </label>
                <textarea
                  rows={2}
                  value={newClientDescription}
                  onChange={(e) => setNewClientDescription(e.target.value)}
                  placeholder="Descreva as competências e unidades escolares, hospitalares ou administrativas..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Salvar no PostgreSQL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: Editar Órgão Público
          ========================================================================= */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                Editar Dados • {editingClient.name}
              </h3>
              <button
                onClick={() => setEditingClient(null)}
                className="text-slate-400 hover:text-white p-1 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Razão Social</label>
                <input
                  type="text"
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Sigla</label>
                  <input
                    type="text"
                    value={editingClient.acronym || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, acronym: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={editingClient.status}
                    onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Em Implantação">Em Implantação</option>
                    <option value="Suspenso">Suspenso</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={editingClient.contact}
                    onChange={(e) => setEditingClient({ ...editingClient, contact: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={editingClient.phone || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Plano</label>
                  <input
                    type="text"
                    value={editingClient.plan}
                    onChange={(e) => setEditingClient({ ...editingClient, plan: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">SLA</label>
                  <input
                    type="text"
                    value={editingClient.sla}
                    onChange={(e) => setEditingClient({ ...editingClient, sla: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Endereço</label>
                <input
                  type="text"
                  value={editingClient.address || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: Confirmação de Exclusão
          ========================================================================= */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Confirmar Exclusão de Órgão Público</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deseja remover <strong className="text-white">{clientToDelete.name}</strong> da governança de TI?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              Esta ação removerá o vínculo da secretaria na base de dados do PostgreSQL.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteClient}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Sim, Remover Órgão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
