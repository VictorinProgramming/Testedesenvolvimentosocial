import { query } from '../db.ts';
import type { SupportTicket, Priority } from '../../src/types.ts';

export interface TicketRow {
  id: string;
  protocol: string;
  client: string;
  subject: string;
  description?: string;
  sector: string;
  service_classification?: string;
  priority: string;
  status: string;
  assigned_to?: string;
  assigned_avatar?: string;
  assigned_user_id?: string;
  requester_name?: string;
  requester_email?: string;
  contact_email?: string;
  open_time?: string;
  sla_hours?: number;
  resolved_at?: string;
  resolved_by?: string;
  resolution_summary?: string;
  created_at: string;
  updated_at: string;
}

export function normalizePriority(p?: string): string {
  if (!p) return 'MEDIA';
  const clean = p.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean.includes('BAIXA')) return 'BAIXA';
  if (clean.includes('ALTA')) return 'ALTA';
  if (clean.includes('URG')) return 'URGENTE';
  if (clean.includes('CRIT')) return 'CRITICA';
  return 'MEDIA';
}

export function normalizeStatus(s?: string): string {
  if (!s) return 'ABERTO';
  const clean = s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean.includes('RESOLV') || clean.includes('CONCLU')) return 'RESOLVIDO';
  if (clean.includes('ATEND')) return 'EM_ATENDIMENTO';
  if (clean.includes('AGUARD')) return 'AGUARDANDO_CLIENTE';
  if (clean.includes('CANCEL')) return 'CANCELADO';
  return 'ABERTO';
}

export function mapPriorityToFrontend(p: string): Priority {
  if (p === 'CRITICA') return 'Crítica';
  if (p === 'URGENTE') return 'Urgente';
  if (p === 'ALTA') return 'Alta';
  if (p === 'BAIXA') return 'Baixa';
  return 'Média';
}

export function mapStatusToFrontend(s: string): 'Aberto' | 'Em atendimento' | 'Aguardando' | 'Resolvido' {
  if (s === 'RESOLVIDO') return 'Resolvido';
  if (s === 'EM_ATENDIMENTO') return 'Em atendimento';
  if (s === 'AGUARDANDO_CLIENTE') return 'Aguardando';
  return 'Aberto';
}

export function mapRowToSupportTicket(row: any): SupportTicket {
  return {
    id: row.id,
    protocol: row.protocol,
    client: row.client,
    subject: row.subject,
    title: row.subject,
    description: row.description || '',
    sector: row.sector,
    serviceClassification: row.service_classification || 'Suporte',
    service_classification: row.service_classification || 'Suporte',
    priority: mapPriorityToFrontend(row.priority),
    status: mapStatusToFrontend(row.status),
    assignedTo: row.assigned_to || undefined,
    assignedAvatar: row.assigned_avatar || undefined,
    requester: row.requester_name || row.client,
    requesterEmail: row.requester_email || row.contact_email || undefined,
    contactEmail: row.contact_email || undefined,
    openTime: row.open_time || (row.created_at ? new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '09:00'),
    sla: `${row.sla_hours || 4}h`,
    slaLimitHours: row.sla_hours || 4,
    resolvedAt: row.resolved_at || undefined,
    resolvedBy: row.resolved_by || undefined,
    resolutionSummary: row.resolution_summary || undefined,
    participantCollaborator: row.participant_collaborator || undefined,
    participantCollaboratorId: row.participant_user_id || undefined,
    participantCollaboratorAvatar: row.participant_avatar || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const ticketsRepository = {
  async seedInitialTickets(): Promise<void> {
    const initialTickets = [
      {
        id: 'CHM-2026-1021',
        protocol: 'GIHS-2026-1021',
        client: 'Secretaria Municipal de Educação (SEMED)',
        subject: 'Falha de Conectividade no Laboratório de Informática da EM Prof. Orestes Guimarães',
        description: 'Switch de distribuição do bloco B apresentou perda intermitente de pacotes afetando 32 computadores durante aplicação de prova online.',
        sector: 'N2',
        service_classification: 'Configuração e Troca de Switch / VLAN Escolar',
        priority: 'ALTA',
        status: 'EM_ATENDIMENTO',
        assigned_to: 'Guilherme Hirata Satoshi',
        assigned_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        requester_name: 'Profª. Helena Souza',
        requester_email: 'educacao.suporte@joinville.sc.gov.br',
        contact_email: 'educacao.suporte@joinville.sc.gov.br',
        open_time: '08:30',
        sla_hours: 2
      },
      {
        id: 'CHM-2026-1045',
        protocol: 'GIHS-2026-1045',
        client: 'Secretaria Municipal de Saúde (SMS)',
        subject: 'Lentidão Crítica no Acesso ao Banco de Dados e-SUS na UPA Leste',
        description: 'Médicos e triagem relatando timeout de 45s ao salvar prontuários de atendimento de urgência. Suspeita de lock em transação no PostgreSQL de produção.',
        sector: 'N3',
        service_classification: 'Otimização de Query e Pool de Conexões DBA',
        priority: 'CRITICA',
        status: 'EM_ATENDIMENTO',
        assigned_to: 'Victor Martins',
        assigned_avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
        requester_name: 'Dr. Roberto Silveira',
        requester_email: 'saude.ti@joinville.sc.gov.br',
        contact_email: 'saude.ti@joinville.sc.gov.br',
        open_time: '09:15',
        sla_hours: 1
      },
      {
        id: 'CHM-2026-1082',
        protocol: 'GIHS-2026-1082',
        client: 'Secretaria da Fazenda (SEFAZ)',
        subject: 'Revisão e Renovação de Certificado Digital A1 ICP-Brasil para NFS-e',
        description: 'Certificado raiz utilizado pelo WebService de emissão de Nota Fiscal de Serviços Eletrônica expira em 5 dias úteis. Necessário deploy no cluster seguro.',
        sector: 'Segurança & LGPD',
        service_classification: 'Gestão de Certificados Digitais e Criptografia',
        priority: 'ALTA',
        status: 'ABERTO',
        assigned_to: 'Victor Hugo Estevão',
        assigned_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        requester_name: 'Dr. Renato Farias',
        requester_email: 'fazenda.ti@joinville.sc.gov.br',
        contact_email: 'fazenda.ti@joinville.sc.gov.br',
        open_time: '10:00',
        sla_hours: 2
      },
      {
        id: 'CHM-2026-1110',
        protocol: 'GIHS-2026-1110',
        client: 'Secretaria de Administração e Planejamento (SAP)',
        subject: 'Tombamento e Inventário Patrimonial de 40 Novos Notebooks Dell Latitude',
        description: 'Entrada física no Almoxarifado Central. Gerar etiquetas de tombamento com QR Code e vincular termos de cautela aos novos servidores.',
        sector: 'Patrimônio',
        service_classification: 'Tombamento e Cadastro Patrimonial',
        priority: 'MEDIA',
        status: 'ABERTO',
        assigned_to: 'Karina Feller',
        assigned_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        requester_name: 'Carlos Mendes',
        requester_email: 'administracao.ti@joinville.sc.gov.br',
        contact_email: 'administracao.ti@joinville.sc.gov.br',
        open_time: '10:45',
        sla_hours: 4
      },
      {
        id: 'CHM-2026-1155',
        protocol: 'GIHS-2026-1155',
        client: 'Secretaria de Proteção Civil e Segurança Pública (SECON)',
        subject: 'Alinhamento de Rádio Digital e Monitoramento de Câmera OCR Rua Dr. João Colin',
        description: 'Câmera 14 do cerco de segurança perdeu comunicação telemática com a sala do CICC após tempestade de vento na madrugada.',
        sector: 'N2',
        service_classification: 'Restauração de Link de Rádio e Fibra',
        priority: 'ALTA',
        status: 'EM_ATENDIMENTO',
        assigned_to: 'Matheus',
        assigned_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
        requester_name: 'Comandante Eduardo Silveira',
        requester_email: 'secon.operacoes@joinville.sc.gov.br',
        contact_email: 'secon.operacoes@joinville.sc.gov.br',
        open_time: '11:20',
        sla_hours: 2
      },
      {
        id: 'CHM-2026-1190',
        protocol: 'GIHS-2026-1190',
        client: 'Companhia Águas de Joinville (CAJ)',
        subject: 'Telemetria do Sensor de Pressão da Estação de Tratamento Cubatão',
        description: 'Falha intermitente na telemetria do canal Modbus/TCP enviando dados com latência para o SCADA central.',
        sector: 'N3',
        service_classification: 'Diagnóstico de Rede Industrial e Automação',
        priority: 'ALTA',
        status: 'ABERTO',
        assigned_to: 'Guilherme Hirata Satoshi',
        assigned_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        requester_name: 'Engª. Larissa Moretto',
        requester_email: 'ti.redes@aguasdejoinville.com.br',
        contact_email: 'ti.redes@aguasdejoinville.com.br',
        open_time: '12:00',
        sla_hours: 2
      },
      {
        id: 'CHM-2026-1230',
        protocol: 'GIHS-2026-1230',
        client: 'Hospital Municipal São José (HMSJ)',
        subject: 'Integração de Estação de Imagem PACS com Tomógrafo da Emergência',
        description: 'Estação de trabalho do setor de imagem não está consolidando o DICOM no servidor central após upgrade de firmware.',
        sector: 'N2',
        service_classification: 'Suporte a Sistemas Hospitalares e PACS',
        priority: 'CRITICA',
        status: 'EM_ATENDIMENTO',
        assigned_to: 'Victor Martins',
        assigned_avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
        requester_name: 'Dr. Alexandre Bittencourt',
        requester_email: 'hmsj.ti@joinville.sc.gov.br',
        contact_email: 'hmsj.ti@joinville.sc.gov.br',
        open_time: '13:10',
        sla_hours: 1
      },
      {
        id: 'CHM-2026-1275',
        protocol: 'GIHS-2026-1275',
        client: 'Departamento de Trânsito de Joinville (DETRANS)',
        subject: 'Sincronização de Semáforos Inteligentes no Corredor da Av. Rolf Colin',
        description: 'Ajuste fino no plano ciclo de temporização semafórica para liberar fluxo durante horário de pico matutino e vespertino.',
        sector: 'N1',
        service_classification: 'Configuração de Controladores Semafóricos',
        priority: 'MEDIA',
        status: 'RESOLVIDO',
        assigned_to: 'Rebeca Lara',
        assigned_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        requester_name: 'Inspetor Vanderlei Santos',
        requester_email: 'detrans.operacoes@joinville.sc.gov.br',
        contact_email: 'detrans.operacoes@joinville.sc.gov.br',
        open_time: '07:40',
        sla_hours: 4
      }
    ];

    for (const t of initialTickets) {
      await query(`
        INSERT INTO tickets (
          id, protocol, client, subject, description, sector, service_classification,
          priority, status, assigned_to, assigned_avatar,
          requester_name, requester_email, contact_email, open_time, sla_hours
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::enum_ticket_priority, $9::enum_ticket_status, $10, $11,
          $12, $13, $14, $15, $16
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        t.id, t.protocol, t.client, t.subject, t.description, t.sector, t.service_classification,
        t.priority, t.status, t.assigned_to, t.assigned_avatar,
        t.requester_name, t.requester_email, t.contact_email, t.open_time, t.sla_hours
      ]);
    }
  },

  async findAll(status?: string): Promise<SupportTicket[]> {
    if (status) {
      const normalized = normalizeStatus(status);
      const res = await query<any>(`
        SELECT * FROM tickets
        WHERE status = $1
        ORDER BY created_at DESC;
      `, [normalized]);
      return res.rows.map(mapRowToSupportTicket);
    }
    const res = await query<any>(`
      SELECT * FROM tickets
      ORDER BY created_at DESC;
    `);

    if (res.rows.length === 0) {
      await this.seedInitialTickets();
      const after = await query<any>(`
        SELECT * FROM tickets
        ORDER BY created_at DESC;
      `);
      return after.rows.map(mapRowToSupportTicket);
    }

    return res.rows.map(mapRowToSupportTicket);
  },

  async findById(id: string): Promise<SupportTicket | null> {
    const res = await query<any>(`
      SELECT * FROM tickets WHERE id = $1 LIMIT 1;
    `, [id]);
    if (!res.rows[0]) return null;
    return mapRowToSupportTicket(res.rows[0]);
  },

  async create(ticket: any): Promise<SupportTicket> {
    const year = new Date().getFullYear();
    const id = ticket.id || `CHM-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    const protocol = ticket.protocol || `GIHS-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    const priority = normalizePriority(ticket.priority);
    const status = normalizeStatus(ticket.status);

    let slaHours = ticket.slaLimitHours || ticket.sla_hours || 4;
    if (priority === 'CRITICA') slaHours = 1;
    else if (priority === 'ALTA') slaHours = 2;
    else if (priority === 'BAIXA') slaHours = 8;

    const res = await query<any>(`
      INSERT INTO tickets (
        id, protocol, client, subject, description, sector, service_classification,
        priority, status, assigned_to, assigned_avatar,
        requester_name, requester_email, contact_email, open_time, sla_hours,
        participant_collaborator, participant_user_id, participant_avatar
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8::enum_ticket_priority, $9::enum_ticket_status, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19
      )
      RETURNING *;
    `, [
      id,
      protocol,
      ticket.client || ticket.requester || 'Cliente Corporativo',
      ticket.subject || ticket.title || 'Atendimento Geral',
      ticket.description || '',
      ticket.sector || 'N1',
      ticket.serviceClassification || ticket.service_classification || 'Suporte',
      priority,
      status,
      ticket.assignedTo || ticket.assigned_to || null,
      ticket.assignedAvatar || ticket.assigned_avatar || null,
      ticket.requester || ticket.requester_name || null,
      ticket.requesterEmail || ticket.requester_email || null,
      ticket.contactEmail || ticket.contact_email || null,
      ticket.openTime || ticket.open_time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      slaHours,
      ticket.participantCollaborator || ticket.participant_collaborator || null,
      ticket.participantCollaboratorId || ticket.participant_user_id || null,
      ticket.participantCollaboratorAvatar || ticket.participant_avatar || null
    ]);

    // Also record initial history entry if ticket_history table exists
    try {
      await query(`
        INSERT INTO ticket_history (ticket_id, action, user_name, user_sector, details)
        VALUES ($1, $2, $3, $4, $5);
      `, [id, 'ABERTURA', ticket.requester || 'Solicitante', ticket.sector || 'N1', 'Chamado aberto no sistema corporativo']);
    } catch {}

    return mapRowToSupportTicket(res.rows[0]);
  },

  async update(id: string, updates: any): Promise<SupportTicket | null> {
    const keyMap: Record<string, string> = {
      serviceClassification: 'service_classification',
      service_classification: 'service_classification',
      assignedTo: 'assigned_to',
      assignedAvatar: 'assigned_avatar',
      assignedUserId: 'assigned_user_id',
      requesterName: 'requester_name',
      requesterEmail: 'requester_email',
      contactEmail: 'contact_email',
      openTime: 'open_time',
      slaHours: 'sla_hours',
      resolutionSummary: 'resolution_summary',
      resolvedBy: 'resolved_by',
      resolvedAt: 'resolved_at',
      participantCollaborator: 'participant_collaborator',
      participantCollaboratorId: 'participant_user_id',
      participantCollaboratorAvatar: 'participant_avatar'
    };

    const allowedColumns = new Set([
      'client', 'subject', 'description', 'sector', 'service_classification', 'priority', 'status',
      'assigned_to', 'assigned_avatar', 'assigned_user_id', 'requester_name',
      'requester_email', 'contact_email', 'open_time', 'sla_hours',
      'resolved_at', 'resolved_by', 'resolution_summary',
      'participant_collaborator', 'participant_user_id', 'participant_avatar'
    ]);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (key === 'id' || key === 'created_at' || key === 'updated_at' || key === 'history') continue;
      const col = keyMap[key] || key;
      if (!allowedColumns.has(col)) continue;

      if (col === 'priority') {
        fields.push(`priority = $${idx}::enum_ticket_priority`);
        values.push(normalizePriority(val as string));
      } else if (col === 'status') {
        fields.push(`status = $${idx}::enum_ticket_status`);
        values.push(normalizeStatus(val as string));
      } else {
        fields.push(`${col} = $${idx}`);
        values.push(val);
      }
      idx++;
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const sql = `
      UPDATE tickets
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const res = await query<any>(sql, values);
    if (!res.rows[0]) return null;

    // Record history
    try {
      const action = updates.status ? `STATUS_${updates.status}` : 'ATUALIZACAO';
      await query(`
        INSERT INTO ticket_history (ticket_id, action, user_name, details)
        VALUES ($1, $2, $3, $4);
      `, [id, action, updates.resolvedBy || updates.assignedTo || 'Operador', JSON.stringify(updates)]);
    } catch {}

    return mapRowToSupportTicket(res.rows[0]);
  },

  async delete(id: string): Promise<boolean> {
    const res = await query(`DELETE FROM tickets WHERE id = $1;`, [id]);
    return (res.rowCount ?? 0) > 0;
  },

  async clearAll(): Promise<boolean> {
    await query(`DELETE FROM ticket_history;`).catch(() => {});
    const res = await query(`DELETE FROM tickets;`);
    return (res.rowCount ?? 0) >= 0;
  }
};
