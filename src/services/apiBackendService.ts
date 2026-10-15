import {
  Collaborator,
  SupportTicket,
  EquipmentItem,
  KnowledgeArticle,
  InventoryAgent,
  AgentSoftware,
  AgentInventoryHistory,
  AgentIdentityConflict,
  InventoryAgentMetrics
} from '../types';
import { PontoRecord } from './pontoService';

/**
 * Client-side service to communicate with the Node.js/PostgreSQL Backend API
 */
export class ApiBackendService {
  private baseUrl = '/api';

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || err.error || `HTTP error ${res.status}`);
    }

    return res.json();
  }

  // System & Health
  async getHealth() {
    return this.request<any>('/health');
  }

  async getDbStatus() {
    return this.request<any>('/db-status');
  }

  async getSchemaStatus() {
    return this.request<any>('/database/schema-status');
  }

  async runMigration() {
    return this.request<any>('/database/migrate', { method: 'POST' });
  }

  // Users & Collaborators
  async getUsers(): Promise<{ success: boolean; data: any[] }> {
    return this.request('/users');
  }

  async getUserById(id: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/users/${id}`);
  }

  async createUser(user: Partial<Collaborator>): Promise<{ success: boolean; data: any }> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        user_role: user.userRole || 'COLABORADOR',
        sector_name: user.sector,
        area: user.area,
        service_classification: user.serviceClassification || user.service_classification || 'Suporte',
        avatar_url: user.avatar,
        phone: user.phone,
        admission_date: user.admissionDate,
        status: user.status,
        current_task: user.currentTask,
        contract_type: user.contractType,
        salary_bracket: user.salaryBracket,
        work_schedule: user.workSchedule,
        emergency_contact: user.emergencyContact,
        is_blocked: user.isBlocked || false,
      }),
    });
  }

  async updateUser(id: string, updates: Partial<Collaborator> | Record<string, any>): Promise<{ success: boolean; data: any }> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(id: string): Promise<{ success: boolean }> {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  }

  // Facial Biometrics
  async getFacialBiometry(userId: string): Promise<{
    active: boolean;
    photoUrl?: string;
    biometricHash?: string;
    landmarksCount?: number;
    confidenceScore?: number;
    registeredAt?: string;
    notes?: string;
  } | null> {
    try {
      const res = await this.getUserById(userId);
      if (res?.success && res.data) {
        const u = res.data;
        if (u.facial_photo_url || u.facial_biometric_hash || u.facial_active) {
          return {
            active: u.facial_active !== false,
            photoUrl: u.facial_photo_url || u.avatar_url,
            biometricHash: u.facial_biometric_hash || `sha256:${userId}-bio`,
            landmarksCount: u.facial_landmarks_count || 68,
            confidenceScore: parseFloat(u.facial_confidence_score) || 99.4,
            registeredAt: u.facial_registered_at || new Date().toISOString(),
            notes: u.facial_notes || 'Biometria cadastrada no PostgreSQL'
          };
        }
      }
    } catch (err) {
      console.warn('apiBackendService getFacialBiometry error:', err);
    }

    try {
      const cached = localStorage.getItem(`bycomp_biometry_${userId}`);
      if (cached) return JSON.parse(cached);
    } catch {}

    return null;
  }

  async saveFacialBiometry(userId: string, data: {
    photoUrl?: string;
    biometricHash?: string;
    landmarksCount?: number;
    confidenceScore?: number;
    active?: boolean;
    notes?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      try {
        localStorage.setItem(`bycomp_biometry_${userId}`, JSON.stringify(data));
        localStorage.setItem('bycomp_latest_biometry', JSON.stringify({ userId, ...data }));
      } catch {}

      const payload = {
        facial_active: data.active !== false,
        facial_photo_url: data.photoUrl,
        avatar_url: data.photoUrl,
        facial_biometric_hash: data.biometricHash || `sha256:${Date.now()}`,
        facial_landmarks_count: data.landmarksCount || 68,
        facial_confidence_score: data.confidenceScore || 99.4,
        facial_registered_at: new Date().toISOString(),
        facial_notes: data.notes || 'Biometria atualizada via Configurações'
      };

      const res = await this.updateUser(userId, payload);
      return { success: true, data: res?.data || payload };
    } catch (err: any) {
      console.error('apiBackendService saveFacialBiometry error:', err);
      return { success: false, error: err?.message || 'Falha ao salvar no banco' };
    }
  }

  // Sectors
  async getSectors(): Promise<{ success: boolean; data: any[] }> {
    return this.request('/sectors');
  }

  async createSector(sector: any): Promise<{ success: boolean; data: any }> {
    return this.request('/sectors', {
      method: 'POST',
      body: JSON.stringify(sector),
    });
  }

  // Ponto Records (PostgreSQL REP-P)
  async getPontoRecords(options?: { limit?: number; userId?: string; name?: string; month?: string; date?: string } | number): Promise<{ success: boolean; data: any[] }> {
    if (typeof options === 'number') {
      return this.request(`/ponto?limit=${options}`);
    }
    const limit = options?.limit || 1000;
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (options?.userId) params.set('userId', options.userId);
    if (options?.name) params.set('name', options.name);
    if (options?.month) params.set('month', options.month);
    if (options?.date) params.set('date', options.date);
    return this.request(`/ponto?${params.toString()}`);
  }

  async getPontoByUserId(userId: string, limit = 500): Promise<{ success: boolean; data: any[] }> {
    return this.request(`/ponto/user/${userId}?limit=${limit}`);
  }

  async seedMonthPonto(userId?: string, month?: string): Promise<{ success: boolean; inserted: number; message: string }> {
    return this.request('/ponto/seed-month', {
      method: 'POST',
      body: JSON.stringify({ userId, month }),
    });
  }

  async createPontoRecord(record: Partial<PontoRecord>): Promise<{ success: boolean; data: any }> {
    return this.request('/ponto', {
      method: 'POST',
      body: JSON.stringify({
        id: record.id,
        nsr: record.nsr,
        user_id: record.collaboratorId,
        collaborator_name: record.collaboratorName,
        collaborator_sector: record.collaboratorSector,
        type: record.type,
        punch_date: record.date,
        punch_time: record.time,
        unix_timestamp: record.timestamp,
        photo_url: record.photoUrl,
        biometric_match_confidence: record.biometricMatchConfidence,
        sha256_hash: record.sha256Hash,
        device_type: record.deviceType,
        device_details: record.deviceDetails,
        ip_address: record.ipAddress,
        latitude: record.location?.latitude,
        longitude: record.location?.longitude,
        accuracy_meters: record.location?.accuracyMeters,
        approximate_address: record.location?.approximateAddress,
        city: record.location?.city,
        state: record.location?.state,
      }),
    });
  }

  async getPontoConfig(): Promise<{ success: boolean; data: any }> {
    return this.request('/ponto/config');
  }

  async updatePontoConfig(config: any): Promise<{ success: boolean; data: any; message?: string }> {
    return this.request('/ponto/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // Tickets
  async getTickets(status?: string): Promise<{ success: boolean; data: any[] }> {
    const queryStr = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request(`/tickets${queryStr}`);
  }

  async createTicket(ticket: Partial<SupportTicket>): Promise<{ success: boolean; data: any }> {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        id: ticket.id,
        protocol: (ticket as any).protocol,
        client: ticket.client || ticket.requester,
        subject: ticket.subject || ticket.title,
        description: ticket.description,
        sector: ticket.sector,
        service_classification: ticket.serviceClassification || (ticket as any).service_classification || 'Suporte',
        priority: ticket.priority,
        status: ticket.status,
        assigned_to: ticket.assignedTo,
        assigned_avatar: ticket.assignedAvatar,
        requester_name: ticket.requester,
        requester_email: ticket.requesterEmail,
        contact_email: ticket.contactEmail,
        open_time: ticket.openTime,
        sla_hours: ticket.slaLimitHours,
      }),
    });
  }

  async updateTicket(id: string, updates: Partial<SupportTicket>): Promise<{ success: boolean; data: any }> {
    return this.request(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTicket(id: string): Promise<{ success: boolean }> {
    return this.request(`/tickets/${id}`, { method: 'DELETE' });
  }

  async clearTickets(): Promise<{ success: boolean; message: string }> {
    return this.request('/tickets/clear', { method: 'POST' });
  }

  // Clientes & Secretarias Municipais (Joinville)
  async getClients(): Promise<{ success: boolean; data: any[]; count?: number }> {
    return this.request('/clients');
  }

  async getClientById(id: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/clients/${id}`);
  }

  async createClient(client: any): Promise<{ success: boolean; data: any }> {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(client),
    });
  }

  async updateClient(id: string, updates: any): Promise<{ success: boolean; data: any }> {
    return this.request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteClient(id: string): Promise<{ success: boolean }> {
    return this.request(`/clients/${id}`, { method: 'DELETE' });
  }

  async seedClients(): Promise<{ success: boolean; seededCount?: number; data?: any[] }> {
    return this.request('/clients/seed', { method: 'POST' });
  }

  // Knowledge Base (Base de Conhecimento)
  async getKnowledgeArticles(params?: { sector?: string; category?: string }): Promise<{ success: boolean; data: KnowledgeArticle[] }> {
    const queryParts: string[] = [];
    if (params?.sector && params.sector !== 'TODOS') {
      queryParts.push(`sector=${encodeURIComponent(params.sector)}`);
    }
    if (params?.category) {
      queryParts.push(`category=${encodeURIComponent(params.category)}`);
    }
    const queryStr = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return this.request(`/knowledge${queryStr}`);
  }

  async getKnowledgeArticleById(id: string): Promise<{ success: boolean; data: KnowledgeArticle }> {
    return this.request(`/knowledge/${id}`);
  }

  async createKnowledgeArticle(article: Partial<KnowledgeArticle>): Promise<{ success: boolean; data: KnowledgeArticle }> {
    return this.request('/knowledge', {
      method: 'POST',
      body: JSON.stringify(article),
    });
  }

  async markArticleUseful(id: string): Promise<{ success: boolean; data: KnowledgeArticle }> {
    return this.request(`/knowledge/${id}/useful`, { method: 'POST' });
  }

  // Equipment
  async getEquipment(): Promise<{ success: boolean; data: any[] }> {
    return this.request('/equipment');
  }

  async createEquipment(item: Partial<EquipmentItem>): Promise<{ success: boolean; data: any }> {
    return this.request('/equipment', {
      method: 'POST',
      body: JSON.stringify({
        id: item.id,
        patrimony_tag: item.tag,
        name: item.model || 'Equipamento',
        category: item.category || item.type || 'Informática',
        assigned_user_name: item.assignee,
        sector: item.sector,
        status: item.status === 'Em uso' ? 'Operacional' : item.status,
        acquisition_date: item.acquisitionDate || item.deliveryDate,
      }),
    });
  }

  async deleteAllEquipment(): Promise<{ success: boolean; message: string; deletedCount: number }> {
    return this.request('/equipment/all', {
      method: 'DELETE',
    });
  }

  // Tasks / Tarefas
  async getTasks(): Promise<{ success: boolean; count: number; data: any[] }> {
    return this.request('/tasks');
  }

  async getTaskById(id: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/tasks/${id}`);
  }

  async createTask(task: any): Promise<{ success: boolean; data: any }> {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(id: string, updates: any): Promise<{ success: boolean; data: any }> {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(id: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Bidirectional Synchronization
  async syncToPostgres(payload: {
    users?: any[];
    sectors?: any[];
    pontoRecords?: any[];
    tickets?: any[];
    equipment?: any[];
  }): Promise<{ success: boolean; message: string; stats?: any; error?: string }> {
    return this.request('/database/sync-to-postgres', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async exportFromPostgres(): Promise<{
    success: boolean;
    data: {
      users: any[];
      sectors: any[];
      pontoRecords: any[];
      tickets: any[];
      equipment: any[];
    };
    counts: Record<string, number>;
  }> {
    return this.request('/database/export-from-postgres');
  }

  // Provider configuration
  async getDatabaseProvider(): Promise<{ success: boolean; provider: string; config: any }> {
    return this.request('/database/provider');
  }

  async setDatabaseProvider(provider: 'POSTGRESQL' | 'FIREBASE', mode = 'STRICT_POSTGRES'): Promise<{ success: boolean; config: any }> {
    return this.request('/database/provider', {
      method: 'POST',
      body: JSON.stringify({ provider, mode }),
    });
  }

  // Master Users Authentication
  async login(email: string, password: string): Promise<{ success: boolean; message: string; user?: any; source?: string }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async seedMasters(): Promise<{ success: boolean; message: string; masters?: any[] }> {
    return this.request('/auth/seed-masters', {
      method: 'POST',
    });
  }

  // =========================================================================
  // ON-CALL (SOBREAVISO) METHODS
  // =========================================================================
  async getOnCallShifts(filters?: { sector_id?: string; user_id?: string; status?: string; from_date?: string; to_date?: string }) {
    const params = new URLSearchParams();
    if (filters?.sector_id) params.append('sector_id', filters.sector_id);
    if (filters?.user_id) params.append('user_id', filters.user_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.from_date) params.append('from_date', filters.from_date);
    if (filters?.to_date) params.append('to_date', filters.to_date);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ success: boolean; count: number; data: any[] }>(`/on-call/shifts${qs}`);
  }

  async getCurrentOnCallActive() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/on-call/active');
  }

  async getUpcomingOnCall(limit = 10) {
    return this.request<{ success: boolean; count: number; data: any[] }>(`/on-call/upcoming?limit=${limit}`);
  }

  async checkOnCallConflict(userId: string, startAt: string, endAt: string, excludeShiftId?: string) {
    return this.request<{ success: boolean; hasConflict: boolean; conflictingShift?: any }>('/on-call/check-conflict', {
      method: 'POST',
      body: JSON.stringify({ userId, startAt, endAt, excludeShiftId })
    });
  }

  async createOnCallShift(shift: any) {
    return this.request<{ success: boolean; data: any; error?: string }>('/on-call/shifts', {
      method: 'POST',
      body: JSON.stringify(shift)
    });
  }

  async updateOnCallShift(id: string, updates: any) {
    return this.request<{ success: boolean; data: any }>(`/on-call/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteOnCallShift(id: string, user_name?: string, user_id?: string) {
    return this.request<{ success: boolean; message: string }>(`/on-call/shifts/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_name, user_id })
    });
  }

  async auditPdfGeneration(payload: { user_id?: string; user_name: string; filter_period: string; sector?: string; total_shifts: number }) {
    return this.request<{ success: boolean; message: string }>('/on-call/audit-pdf', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // =========================================================================
  // MOBILITY (MOBILIDADE CORPORATIVA) METHODS
  // =========================================================================
  async getMobilityVehicles() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/mobility/vehicles');
  }

  async createMobilityVehicle(vehicle: any) {
    return this.request<{ success: boolean; data: any }>('/mobility/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicle)
    });
  }

  async deleteMobilityVehicle(id: string) {
    return this.request<{ success: boolean; message: string }>(`/mobility/vehicles/${id}`, {
      method: 'DELETE'
    });
  }

  async getMobilityDevices() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/mobility/devices');
  }

  async createMobilityDevice(device: any) {
    return this.request<{ success: boolean; data: any }>('/mobility/devices', {
      method: 'POST',
      body: JSON.stringify(device)
    });
  }

  async updateMobilityDevice(id: string, updates: any) {
    return this.request<{ success: boolean; data: any }>(`/mobility/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteMobilityDevice(id: string) {
    return this.request<{ success: boolean; message: string }>(`/mobility/devices/${id}`, {
      method: 'DELETE'
    });
  }

  async getMobilityAssignments(filters?: { user_id?: string; equipment_id?: string; status?: string }) {
    const params = new URLSearchParams();
    if (filters?.user_id) params.append('user_id', filters.user_id);
    if (filters?.equipment_id) params.append('equipment_id', filters.equipment_id);
    if (filters?.status) params.append('status', filters.status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ success: boolean; count: number; data: any[] }>(`/mobility/assignments${qs}`);
  }

  async createMobilityAssignment(assignment: any) {
    return this.request<{ success: boolean; data: any }>('/mobility/assignments', {
      method: 'POST',
      body: JSON.stringify(assignment)
    });
  }

  async returnMobilityAssignment(id: string, notes?: string, operator_name?: string, operator_id?: string) {
    return this.request<{ success: boolean; data: any }>(`/mobility/assignments/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ notes, operator_name, operator_id })
    });
  }

  async getMobilityTrips(filters?: { user_id?: string; device_id?: string; status?: string; vehicle_plate?: string; ticket_id?: string; from_date?: string; to_date?: string }) {
    const params = new URLSearchParams();
    if (filters?.user_id) params.append('user_id', filters.user_id);
    if (filters?.device_id) params.append('device_id', filters.device_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.vehicle_plate) params.append('vehicle_plate', filters.vehicle_plate);
    if (filters?.ticket_id) params.append('ticket_id', filters.ticket_id);
    if (filters?.from_date) params.append('from_date', filters.from_date);
    if (filters?.to_date) params.append('to_date', filters.to_date);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ success: boolean; count: number; data: any[] }>(`/mobility/trips${qs}`);
  }

  async getMobilityTripById(id: string) {
    return this.request<{ success: boolean; data: any }>(`/mobility/trips/${id}`);
  }

  async startMobilityTrip(trip: any) {
    return this.request<{ success: boolean; data: any }>('/mobility/trips', {
      method: 'POST',
      body: JSON.stringify(trip)
    });
  }

  async addMobilityRoutePoint(tripId: string, point: any) {
    return this.request<{ success: boolean; data: any }>(`/mobility/trips/${tripId}/points`, {
      method: 'POST',
      body: JSON.stringify(point)
    });
  }

  async finishMobilityTrip(tripId: string, options?: { end_km?: number; end_latitude?: number; end_longitude?: number; notes?: string }) {
    return this.request<{ success: boolean; data: any }>(`/mobility/trips/${tripId}/finish`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    });
  }

  async getMobilityMetrics() {
    return this.request<{ success: boolean; data: any }>('/mobility/metrics');
  }

  async clearAllMobilityData() {
    return this.request<{ success: boolean; message: string }>('/mobility/clear-all', {
      method: 'POST'
    });
  }

  // System Logo & Branding
  async getSystemLogo() {
    return this.request<{ success: boolean; data: any }>('/settings/logo');
  }

  async updateSystemLogo(config: any) {
    return this.request<{ success: boolean; data: any }>('/settings/logo', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async resetSystemLogo() {
    return this.request<{ success: boolean; data: any }>('/settings/logo/reset', {
      method: 'POST'
    });
  }

  // =========================================================================
  // Automated Inventory Agents (Windows C# .NET 8) — Acesso Exclusivo SUPER_ADMIN
  // =========================================================================
  async getInventoryAgents(params: {
    search?: string;
    status?: string;
    os?: string;
    security_status?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'ASC' | 'DESC';
  } = {}, currentUser?: Collaborator): Promise<{
    success: boolean;
    data: InventoryAgent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.os) query.append('os', params.os);
    if (params.security_status) query.append('security_status', params.security_status);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_order) query.append('sort_order', params.sort_order);

    return this.request(`/inventory-agents?${query.toString()}`, {
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async getInventoryAgentMetrics(currentUser?: Collaborator): Promise<{
    success: boolean;
    data: InventoryAgentMetrics;
  }> {
    return this.request('/inventory-agents/metrics', {
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async getInventoryAgentById(id: string, currentUser?: Collaborator): Promise<{
    success: boolean;
    data: InventoryAgent;
  }> {
    return this.request(`/inventory-agents/${id}`, {
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async getInventoryAgentSoftware(id: string, params: { search?: string; limit?: number; offset?: number } = {}, currentUser?: Collaborator): Promise<{
    success: boolean;
    data: AgentSoftware[];
    total: number;
  }> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', String(params.limit));
    if (params.offset) query.append('offset', String(params.offset));

    return this.request(`/inventory-agents/${id}/software?${query.toString()}`, {
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async getInventoryAgentHistory(id: string, currentUser?: Collaborator): Promise<{
    success: boolean;
    data: AgentInventoryHistory[];
  }> {
    return this.request(`/inventory-agents/${id}/history`, {
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async getInventoryAgentConflicts(currentUser?: Collaborator): Promise<{
    success: boolean;
    data: AgentIdentityConflict[];
  }> {
    return this.request('/inventory-agents/conflicts', {
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async resolveInventoryAgentConflict(conflictId: number, resolution: { notes?: string; action?: string }, currentUser?: Collaborator): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/inventory-agents/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolution),
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async forceInventoryAgentScan(id: string, currentUser?: Collaborator): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/inventory-agents/${id}/force-scan`, {
      method: 'POST',
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async forceInventoryAgentHeartbeat(id: string, currentUser?: Collaborator): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/inventory-agents/${id}/force-heartbeat`, {
      method: 'POST',
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async testInventoryAgent(data: { hostname?: string; manufacturer?: string; model?: string; username?: string; os?: string } = {}, currentUser?: Collaborator): Promise<{
    success: boolean;
    agentId?: string;
    assetId?: string;
    status?: string;
    message?: string;
    error?: string;
  }> {
    return this.request('/agent/v1/test-agent', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || ''
      }
    });
  }

  async ingestInventory(payload: any, currentUser?: Collaborator): Promise<{
    success: boolean;
    agentId?: string;
    assetId?: string;
    status?: string;
    message?: string;
  }> {
    return this.request('/agent/v1/inventory', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.userRole || '',
        'x-agent-key': 'GIHS-AGENT-SECURE-KEY-2026-ENTERPRISE'
      }
    });
  }
}

export const apiBackendService = new ApiBackendService();
