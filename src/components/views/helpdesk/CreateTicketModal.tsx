import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  X,
  LifeBuoy,
  Building2,
  AlertTriangle,
  FileText,
  Clock,
  Layers,
  Sparkles,
  UserCheck,
  Check,
  Users
} from 'lucide-react';
import { SupportTicket, Sector, Priority, Collaborator } from '../../../types';
import { activitySyncService } from '../../../services/activitySyncService';
import { ticketService } from '../../../services/ticketService';
import { dbService } from '../../../services/dbService';
import { getServicesForSector, GLPI_SECTORS_CATALOG, getAllCatalogedServices } from '../../../data/glpiServiceCatalog';

interface CreateTicketModalProps {
  isOpen?: boolean;
  currentUser: Collaborator;
  prefilledSector?: string;
  prefilledClient?: string;
  onClose: () => void;
  onSuccess: (newTicket: SupportTicket, message: string) => void;
}

const COMMON_CLIENTS = [
  'Secretaria de Educação (SEDUC)',
  'Secretaria de Saúde (SES)',
  'Secretaria da Fazenda (SEFAZ)',
  'Secretaria de Administração e Planejamento (SAP)',
  'Secretaria de Infraestrutura (SEINFRA)',
  'Hospital Municipal São José (HMSJ)',
  'Companhia Águas de Joinville (CAJ)',
  'Detrans Joinville',
  'Interno • GIHS Matriz'
];

const AVAILABLE_SECTORS: { id: Sector; name: string; description: string; group: string }[] = [
  // Patrimônio
  { id: 'Patrimônio', name: 'Patrimônio & Gestão de Bens Públicos', description: 'Tombamento, inventário, termos de cautela, descarte e manutenção de bens', group: 'Patrimônio' },
  // DBA
  { id: 'DBA', name: 'DBA • Banco de Dados, Backups & BI', description: 'Instâncias PostgreSQL/Oracle, tuning, disaster recovery e migrações', group: 'Banco de Dados' },
  // Cyber Security
  { id: 'Cyber Security', name: 'Cyber Security • SOC & Segurança da Informação', description: 'Firewall, acessos/VPN, LGPD, resposta a incidentes e pentest', group: 'Segurança da Informação' },
  // Administração
  { id: 'Administrativo', name: 'Administrativo • Gestão Pública, RH & Compras', description: 'Protocolo de processos, RH/ponto, licitações, contratos e almoxarifado', group: 'Administração Geral' },
  // TI - Suporte
  { id: 'N1', name: 'Suporte N1 • Triagem & Atendimento ao Servidor', description: 'Primeiro nível, reset de senhas, impressoras e estações', group: 'Tecnologia da Informação' },
  { id: 'N2', name: 'Suporte N2 • Hardware, Redes & Telefonia IP', description: 'Manutenção de máquinas, Wi-Fi, pontos de rede e VoIP', group: 'Tecnologia da Informação' },
  { id: 'N3', name: 'Suporte N3 • Datacenter, Servidores & Core', description: 'Engenharia de infraestrutura crítica, virtualização e telecom core', group: 'Tecnologia da Informação' },
  // TI - Desenvolvimento
  { id: 'Front-End', name: 'Front-End • Portais do Cidadão & Transparência', description: 'Interfaces web públicas municipais, formulários e acessibilidade', group: 'Desenvolvimento Web' },
  { id: 'Back-End', name: 'Back-End • APIs & Microsserviços', description: 'APIs governamentais, integração e regras de negócio', group: 'Desenvolvimento Web' },
  // Outras Secretarias Municipais
  { id: 'Fazenda', name: 'Fazenda & Tributação Municipal', description: 'IPTU, ISS, Nota Fiscal Eletrônica e contabilidade pública', group: 'Secretarias Municipais' },
  { id: 'Saúde', name: 'Saúde • Prontuário e-SUS & UPAs', description: 'Sistemas de saúde municipal, regulação e postos de atendimento', group: 'Secretarias Municipais' },
  { id: 'Educação', name: 'Educação • Gestão Escolar & SEMED', description: 'Sistemas pedagógicos, matrículas online e laboratórios', group: 'Secretarias Municipais' },
  { id: 'Mobilidade Urbana', name: 'Mobilidade Urbana & Trânsito (DETRANS)', description: 'Frota municipal, rastreamento de veículos e sinalização viária', group: 'Secretarias Municipais' }
];

const SERVICE_TYPES = [
  'Suporte de Hardware & Periféricos',
  'Redes, Gateway & Conectividade',
  'Banco de Dados & Otimização de Queries',
  'Liberação de Acessos & VPN Segura',
  'Mobiliário & Patrimônio Físico',
  'Manutenção de Servidor / Cloud',
  'Sistemas Corporativos & ERP',
  'Desenvolvimento de Feature / Bugfix',
  'Outros / Solicitação Geral'
];

const SLA_MAPPING: Record<Priority, { time: string; badgeColor: string }> = {
  'Crítica': { time: '15 min', badgeColor: 'bg-rose-950 text-rose-300 border-rose-800' },
  'Urgente': { time: '30 min', badgeColor: 'bg-orange-950 text-orange-300 border-orange-800' },
  'Alta': { time: '45 min', badgeColor: 'bg-amber-950 text-amber-300 border-amber-800' },
  'Média': { time: '2 horas', badgeColor: 'bg-blue-950 text-blue-300 border-blue-800' },
  'Baixa': { time: '4 horas', badgeColor: 'bg-slate-900 text-slate-300 border-slate-700' }
};

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  currentUser,
  prefilledSector,
  prefilledClient,
  onClose,
  onSuccess
}) => {
  // Determine initial sector
  const initialSector = ((): Sector => {
    if (prefilledSector && prefilledSector !== 'TODOS') {
      const match = AVAILABLE_SECTORS.find(s => s.id.toLowerCase() === prefilledSector.toLowerCase());
      if (match) return match.id;
    }
    const userSec = (currentUser.sector || '').toLowerCase();
    const found = AVAILABLE_SECTORS.find(s => s.id.toLowerCase() === userSec);
    return found ? found.id : 'Patrimônio';
  })();

  const [subject, setSubject] = useState('');
  const [client, setClient] = useState(prefilledClient || '');
  const [sector, setSector] = useState<Sector>(initialSector);
  const [serviceClassification, setServiceClassification] = useState<string>(() => {
    const srvs = getServicesForSector(initialSector);
    return srvs.length > 0 ? srvs[0].id : 'Tombamento e Cadastro';
  });
  const [priority, setPriority] = useState<Priority>('Média');
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [description, setDescription] = useState('');
  const [assignToMe, setAssignToMe] = useState(false);
  const [availableCollaborators, setAvailableCollaborators] = useState<Collaborator[]>([]);
  const [participantCollaborator, setParticipantCollaborator] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = dbService.subscribeUsers((users) => {
      if (users && users.length > 0) {
        setAvailableCollaborators(users);
      }
    });
    return () => unsub();
  }, []);

  if (isOpen === false) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Por favor, informe o assunto / título do chamado.');
      return;
    }
    if (!client.trim()) {
      setError('Por favor, indique o cliente ou empresa solicitante.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const participantObj = availableCollaborators.find(c => c.name === participantCollaborator);

      // Validate and persist directly in PostgreSQL Database
      const newTicket = await ticketService.createTicket({
        subject: subject.trim(),
        title: subject.trim(),
        client: client.trim(),
        requester: client.trim(),
        requesterEmail: currentUser.email || 'colaborador@bycomp.com.br',
        sector,
        serviceClassification,
        service_classification: serviceClassification,
        priority,
        category: serviceType,
        serviceType,
        description: description.trim() || '',
        assignedTo: assignToMe ? (currentUser.name || 'Victor Estevão') : '',
        assignedAvatar: assignToMe ? (currentUser.avatar || '') : '',
        participantCollaborator: participantCollaborator.trim() || undefined,
        participantCollaboratorId: participantObj?.id,
        participantCollaboratorAvatar: participantObj?.avatar,
        participantRole: participantCollaborator.trim() ? 'Apoio Técnico / Coparticipante' : undefined,
        status: assignToMe ? 'Em atendimento' : 'Aberto',
        tags: [sector, priority]
      });

      // Synchronize with local state
      try {
        activitySyncService.addTicket(newTicket);
      } catch (errSync) {
        console.warn('Local sync notice:', errSync);
      }

      onSuccess(
        newTicket,
        `✓ Chamado ${newTicket.id} gravado no banco de dados com sucesso na fila [${newTicket.sector}]!`
      );
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar chamado no banco de dados.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#334b84]/10 border border-[#334b84]/20 flex items-center justify-center text-[#334b84] shadow-xs">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Abertura de Novo Chamado</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#334b84]/15 text-[#334b84] border border-[#334b84]/30">
                  Help Desk
                </span>
              </div>
              <p className="text-xs text-[#334b84] mt-0.5">
                Cadastre incidentes e solicitações com triagem setorial automática
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-white">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subject / Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Assunto / Título do Incidente *</span>
              <span className="text-[10px] text-slate-400 font-normal">Objetivo e conciso</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: Falha de conectividade no switch core do setor financeiro"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#334b84] focus:ring-1 focus:ring-[#334b84] transition-all"
            />
          </div>

          {/* Client Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#334b84]" />
                Cliente ou Empresa Solicitante *
              </span>
              <span className="text-[10px] text-slate-400">Selecione ou digite</span>
            </label>
            <input
              type="text"
              required
              value={client}
              onChange={(e) => {
                setClient(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: TechCorp Brasil ou Interno • GIHS"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#334b84] focus:ring-1 focus:ring-[#334b84] transition-all mb-2"
            />

            {/* Quick client suggestion chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CLIENTS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => {
                    setClient(c);
                    if (error) setError(null);
                  }}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    client === c
                      ? 'bg-[#334b84] text-white border-[#334b84] font-bold shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Sector Queue & Service Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sector Queue */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#37558d]" />
                Fila Setorial de Destino (Setores Municipais) *
              </label>
              <select
                value={sector}
                onChange={(e) => {
                  const newSec = e.target.value as Sector;
                  setSector(newSec);
                  const srvs = getServicesForSector(newSec);
                  if (srvs.length > 0) {
                    setServiceClassification(srvs[0].id);
                    setServiceType(srvs[0].name);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#334b84] transition-all"
              >
                {AVAILABLE_SECTORS.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.group}] {s.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                {AVAILABLE_SECTORS.find(s => s.id === sector)?.description}
              </p>
            </div>

            {/* Service Classification */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Classificação da Fila Técnica GLPI *</span>
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Prefeitura / Todos os Setores
                </span>
              </label>
              <select
                value={serviceClassification}
                onChange={(e) => {
                  setServiceClassification(e.target.value);
                  const allServices = getAllCatalogedServices();
                  const match = allServices.find(s => s.serviceId === e.target.value);
                  if (match) {
                    setServiceType(match.serviceName);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 font-bold focus:outline-none focus:border-[#334b84] transition-all"
              >
                <optgroup label={`⭐ Fila Direta do Setor ${sector} (Recomendada)`}>
                  {getServicesForSector(sector).map(srv => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} (SLA: {srv.defaultSlaHours}h)
                    </option>
                  ))}
                </optgroup>

                {Object.entries(GLPI_SECTORS_CATALOG).map(([secKey, secData]) => {
                  if (secKey.toLowerCase() === sector.toLowerCase()) return null;
                  return (
                    <optgroup key={secKey} label={`Catálogo GLPI: ${secData.label}`}>
                      {secData.services.map(srv => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name} (SLA: {srv.defaultSlaHours}h)
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <p className="text-[10px] text-blue-700 mt-1 font-medium">
                O chamado entrará exclusivamente na fila dos servidores/especialistas cadastrados nesta classificação.
              </p>
            </div>
          </div>

          {/* Service Type / Categoria */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              Tipo de Serviço / Detalhamento da Demanda
            </label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#334b84] transition-all"
            >
              {SERVICE_TYPES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Priority & SLA Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Nível de Prioridade & SLA
              </label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <Clock className="w-3 h-3 text-slate-500" />
                <span className="text-slate-500">SLA Previsto:</span>
                <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] border ${SLA_MAPPING[priority].badgeColor}`}>
                  {SLA_MAPPING[priority].time}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(['Baixa', 'Média', 'Alta', 'Urgente', 'Crítica'] as Priority[]).map((p) => {
                const isSelected = priority === p;
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? p === 'Crítica'
                          ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs font-bold'
                          : p === 'Urgente'
                            ? 'bg-orange-50 border-orange-300 text-orange-800 shadow-2xs font-bold'
                            : p === 'Alta'
                              ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs font-bold'
                              : 'bg-blue-50 border-blue-300 text-blue-800 shadow-2xs font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <span>{p}</span>
                    <span className="text-[9px] font-mono text-slate-500 font-normal">
                      {SLA_MAPPING[p].time}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Descrição Detalhada do Problema (Opcional)</span>
              <span className="text-[10px] text-slate-400">Histórico inicial</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva informações complementares, códigos de erro, IPs afetados ou passos para reprodução..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#334b84] focus:ring-1 focus:ring-[#334b84] transition-all resize-none"
            />
          </div>

          {/* Campo de Participação / Apoio Técnico */}
          <div className="p-3.5 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 border border-blue-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#334b84] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#334b84]" />
                <span>Campo de Colaboração (Técnico que auxiliará no chamado)</span>
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-[#334b84] font-bold border border-blue-300">
                Técnico Colaborador
              </span>
            </div>

            <select
              value={participantCollaborator}
              onChange={(e) => setParticipantCollaborator(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#334b84] focus:ring-1 focus:ring-[#334b84] transition-all cursor-pointer font-medium"
            >
              <option value="">Nenhum (Atendimento individual por {currentUser.name})</option>
              {availableCollaborators
                .filter((c) => c.name !== currentUser.name)
                .map((c) => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name} ({c.sector} • {c.role})
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-slate-500">
              O colaborador selecionado será registrado como apoio e terá o fechamento do chamado contabilizado em seus relatórios e métricas de desempenho.
            </p>
          </div>

          {/* Immediate Assignment Checkbox */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#334b84]/10 border border-[#334b84]/20 flex items-center justify-center text-[#334b84]">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800">Assumir atendimento imediatamente</div>
                <div className="text-[11px] text-slate-500">
                  Vincular chamado ao seu usuário (<span className="text-[#334b84] font-semibold">{currentUser.name}</span>) com status &quot;Em atendimento&quot;
                </div>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
              <input
                type="checkbox"
                checked={assignToMe}
                onChange={(e) => setAssignToMe(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#334b84]"></div>
            </label>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            Solicitante ativo: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.sector})
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-[#334b84] hover:bg-[#37558d] text-white font-bold rounded-xl text-xs shadow-md shadow-[#334b84]/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-white" />
              <span className="text-white">{isSubmitting ? 'Criando Chamado...' : 'Criar e Abrir Chamado'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
