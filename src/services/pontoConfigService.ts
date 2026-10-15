export interface WorkScheduleConfig {
  standardEntry: string;
  standardBreakStart: string;
  standardBreakEnd: string;
  standardExit: string;
  weeklyHours: number;
  dailyHours: number;
  scheduleType: 'CLT_PADRAO' | 'CLT_40H' | 'ESCALA_12X36' | 'FLEXIVEL';
  workDays: string[];
  minimumBreakMinutes: number;
}

export interface PontoToleranceConfig {
  entryToleranceMinutes: number;
  dailyToleranceMinutes: number;
  exitToleranceMinutes: number;
  antiDuplicateMinutes: number;
  allowEarlyPunch: boolean;
  notifyApproachingBreakEnd: boolean;
}

export interface BiometryConfig {
  minConfidenceScore: number;
  requireAntiSpoofing: boolean;
  strictMode: boolean;
  allowFallbackManual: boolean;
  requireCameraFlashValidation: boolean;
}

export interface AuthorizedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isHeadquarters?: boolean;
}

export interface GeofencingConfig {
  requireGps: boolean;
  allowExternalPunch: boolean;
  maxAccuracyMeters: number;
  authorizedLocations: AuthorizedLocation[];
  corporateIpWhitelist: string[];
}

export interface OvertimeAndBankConfig {
  regime: 'BANCO_DE_HORAS' | 'HORAS_EXTRAS' | 'MISTO';
  maxDailyOvertimeMinutes: number;
  weekdayOvertimePercentage: number;
  weekendOvertimePercentage: number;
  bankCompensationMonths: number;
  closingDayOfMonth: number;
}

export interface AdjustmentPolicyConfig {
  maxDaysToRequestAdjustment: number;
  requireAttachmentForMedicalLeave: boolean;
  autoApproveWithinTolerance: boolean;
  approverRole: 'GESTOR_OU_ADMIN' | 'APENAS_SUPER_ADMIN' | 'RH_ADMIN';
}

export interface PontoConfiguration {
  workSchedule: WorkScheduleConfig;
  tolerances: PontoToleranceConfig;
  biometry: BiometryConfig;
  geofencing: GeofencingConfig;
  overtimeAndBank: OvertimeAndBankConfig;
  adjustmentPolicies: AdjustmentPolicyConfig;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_PONTO_CONFIG: PontoConfiguration = {
  workSchedule: {
    standardEntry: '08:00',
    standardBreakStart: '12:00',
    standardBreakEnd: '13:00',
    standardExit: '18:00',
    weeklyHours: 44,
    dailyHours: 8.8,
    scheduleType: 'CLT_PADRAO',
    workDays: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'],
    minimumBreakMinutes: 60
  },
  tolerances: {
    entryToleranceMinutes: 5,
    dailyToleranceMinutes: 10,
    exitToleranceMinutes: 5,
    antiDuplicateMinutes: 2,
    allowEarlyPunch: true,
    notifyApproachingBreakEnd: true
  },
  biometry: {
    minConfidenceScore: 85,
    requireAntiSpoofing: true,
    strictMode: false,
    allowFallbackManual: true,
    requireCameraFlashValidation: true
  },
  geofencing: {
    requireGps: true,
    allowExternalPunch: true,
    maxAccuracyMeters: 100,
    authorizedLocations: [
      {
        id: 'loc-matriz',
        name: 'Sede Matriz GIHS - São Paulo',
        address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
        latitude: -23.561684,
        longitude: -46.655981,
        radiusMeters: 250,
        isHeadquarters: true
      },
      {
        id: 'loc-datacenter',
        name: 'Polo Operacional & Data Center',
        address: 'Rua do Suporte Técnico, 250 - Tamboré, Barueri - SP',
        latitude: -23.501234,
        longitude: -46.852345,
        radiusMeters: 200,
        isHeadquarters: false
      }
    ],
    corporateIpWhitelist: ['189.40.12.98', '201.55.10.22', '127.0.0.1']
  },
  overtimeAndBank: {
    regime: 'BANCO_DE_HORAS',
    maxDailyOvertimeMinutes: 120,
    weekdayOvertimePercentage: 50,
    weekendOvertimePercentage: 100,
    bankCompensationMonths: 6,
    closingDayOfMonth: 25
  },
  adjustmentPolicies: {
    maxDaysToRequestAdjustment: 2,
    requireAttachmentForMedicalLeave: true,
    autoApproveWithinTolerance: false,
    approverRole: 'GESTOR_OU_ADMIN'
  },
  updated_at: new Date().toISOString()
};

const STORAGE_KEY = 'gihs_ponto_config_v2';

class PontoConfigService {
  private config: PontoConfiguration = DEFAULT_PONTO_CONFIG;
  private listeners: Array<(config: PontoConfiguration) => void> = [];
  private isLoadedFromBackend = false;

  constructor() {
    this.loadFromStorage();
    this.fetchFromBackend();
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.config = { ...DEFAULT_PONTO_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Erro ao ler config de ponto local:', e);
    }
  }

  private saveToStorage(config: PontoConfiguration) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Erro ao salvar config de ponto local:', e);
    }
  }

  public async fetchFromBackend(): Promise<PontoConfiguration> {
    try {
      const resp = await fetch('/api/ponto/config');
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.data) {
          this.config = {
            ...DEFAULT_PONTO_CONFIG,
            ...json.data,
            workSchedule: { ...DEFAULT_PONTO_CONFIG.workSchedule, ...(json.data.workSchedule || {}) },
            tolerances: { ...DEFAULT_PONTO_CONFIG.tolerances, ...(json.data.tolerances || {}) },
            biometry: { ...DEFAULT_PONTO_CONFIG.biometry, ...(json.data.biometry || {}) },
            geofencing: { ...DEFAULT_PONTO_CONFIG.geofencing, ...(json.data.geofencing || {}) },
            overtimeAndBank: { ...DEFAULT_PONTO_CONFIG.overtimeAndBank, ...(json.data.overtimeAndBank || {}) },
            adjustmentPolicies: { ...DEFAULT_PONTO_CONFIG.adjustmentPolicies, ...(json.data.adjustmentPolicies || {}) }
          };
          this.isLoadedFromBackend = true;
          this.saveToStorage(this.config);
          this.notify();
        }
      }
    } catch (err) {
      console.warn('Backend /api/ponto/config offline, usando cache local:', err);
    }
    return this.config;
  }

  public getConfig(): PontoConfiguration {
    return { ...this.config };
  }

  public async saveConfig(newConfig: PontoConfiguration, userEmail?: string): Promise<{ success: boolean; message: string }> {
    const payload: PontoConfiguration = {
      ...newConfig,
      updated_at: new Date().toISOString(),
      updated_by: userEmail || 'Administrador'
    };

    this.config = payload;
    this.saveToStorage(payload);
    this.notify();

    try {
      const resp = await fetch('/api/ponto/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        const json = await resp.json();
        return { success: true, message: json.message || 'Configurações de ponto salvas com sucesso no PostgreSQL!' };
      }
    } catch (err) {
      console.warn('Erro ao persistir no backend, salvo localmente:', err);
    }

    return { success: true, message: 'Configurações salvas e aplicadas!' };
  }

  public async resetToDefaults(): Promise<PontoConfiguration> {
    try {
      const resp = await fetch('/api/ponto/config/reset', { method: 'POST' });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.data) {
          this.config = json.data;
          this.saveToStorage(this.config);
          this.notify();
          return this.config;
        }
      }
    } catch {}

    this.config = { ...DEFAULT_PONTO_CONFIG, updated_at: new Date().toISOString() };
    this.saveToStorage(this.config);
    this.notify();
    return this.config;
  }

  public subscribe(listener: (config: PontoConfiguration) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (err) {
        console.error('Erro no listener de pontoConfig:', err);
      }
    });
  }
}

export const pontoConfigService = new PontoConfigService();
