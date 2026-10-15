import { query } from '../db.ts';

export interface SystemSettingsRow {
  key: string;
  value: any;
  updated_at: string;
}

export const settingsRepository = {
  async get(key: string): Promise<any> {
    const res = await query<SystemSettingsRow>(`
      SELECT value FROM system_settings WHERE key = $1 LIMIT 1;
    `, [key]);
    return res.rows[0]?.value || null;
  },

  async set(key: string, value: any): Promise<any> {
    const res = await query<SystemSettingsRow>(`
      INSERT INTO system_settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `, [key, JSON.stringify(value)]);
    return res.rows[0]?.value;
  },

  async getDatabaseProvider(): Promise<string> {
    const val = await this.get('database_provider');
    return val?.active || 'POSTGRESQL';
  },

  async getLogoConfig(): Promise<any> {
    const val = await this.get('system_logo');
    return val || {
      title: 'GIHS SYSTEMS',
      tagline: 'Enterprise System . 100% Monitorado',
      tagline_color: '#00A6FC',
      primary_color: '#00A6FC',
      secondary_color: '#0067FC',
      source: 'POSTGRESQL_DB',
      logo_url: '/gihs-logo.svg',
      is_custom: true,
      updated_at: new Date().toISOString()
    };
  },

  async setLogoConfig(config: any): Promise<any> {
    const payload = {
      ...config,
      source: 'POSTGRESQL_DB',
      updated_at: new Date().toISOString()
    };
    return await this.set('system_logo', payload);
  },

  async getPontoConfig(): Promise<any> {
    const val = await this.get('ponto_config');
    return val || {
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
  },

  async setPontoConfig(config: any): Promise<any> {
    const payload = {
      ...config,
      updated_at: new Date().toISOString()
    };
    return await this.set('ponto_config', payload);
  }
};
