import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { usersRepository } from './repositories/usersRepository.ts';
import { pontoRepository } from './repositories/pontoRepository.ts';
import { ticketsRepository } from './repositories/ticketsRepository.ts';
import { equipmentRepository } from './repositories/equipmentRepository.ts';
import { tasksRepository } from './repositories/tasksRepository.ts';
import { settingsRepository } from './repositories/settingsRepository.ts';
import { knowledgeRepository } from './repositories/knowledgeRepository.ts';
import { onCallRepository } from './repositories/onCallRepository.ts';
import { mobilityRepository } from './repositories/mobilityRepository.ts';
import { clientsRepository } from './repositories/clientsRepository.ts';
import { KNOWLEDGE_BASE_DATA } from '../src/data/knowledgeBase.ts';
import { checkDatabaseConnection, query } from './db.ts';
import { recordSecurityAudit } from './security.ts';
import { runDatabaseMigration } from './migrate.ts';
import { syncController } from './controllers/syncController.ts';
import { authController } from './controllers/authController.ts';

export const handleSyncToPostgres = syncController.syncToPostgres.bind(syncController);
export const handleExportFromPostgres = syncController.exportFromPostgres.bind(syncController);
export const handleLogin = authController.login.bind(authController);
export const handleSeedMasters = authController.seedMasters.bind(authController);

/**
 * Health check & PostgreSQL status endpoint
 */
export async function getHealthStatus(req: Request, res: Response) {
  try {
    const dbStatus = await checkDatabaseConnection();

    res.json({
      status: 'ok',
      service: 'GIHS System Backend & AI Agents Core',
      version: '2.4.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        type: 'PostgreSQL 16+',
        connected: dbStatus.connected,
        latencyMs: dbStatus.latencyMs,
        version: dbStatus.version || null,
        error: dbStatus.error || null,
      },
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Internal server error',
    });
  }
}

/**
 * Trigger schema migration execution on PostgreSQL
 */
export async function handleRunMigration(req: Request, res: Response) {
  try {
    const result = await runDatabaseMigration();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Falha crítica ao executar migração',
      error: err.message,
    });
  }
}

/**
 * Inspect active database schema tables & row counts
 */
export async function getSchemaStatus(req: Request, res: Response) {
  try {
    const dbStatus = await checkDatabaseConnection();
    if (!dbStatus.connected) {
      return res.json({
        connected: false,
        error: dbStatus.error,
        tables: [],
      });
    }

    const tablesQuery = `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema IN ('public', 'gihs_core')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name;
    `;
    const tablesResult = await query(tablesQuery);

    const tablesInfo = [];
    for (const r of tablesResult.rows as any[]) {
      const fullName = `${r.table_schema}.${r.table_name}`;
      try {
        const countRes = await query(`SELECT count(*) FROM "${r.table_schema}"."${r.table_name}";`);
        tablesInfo.push({
          name: fullName,
          rowCount: parseInt(countRes.rows[0].count, 10),
        });
      } catch {
        tablesInfo.push({ name: fullName, rowCount: 0 });
      }
    }

    res.json({
      connected: true,
      tables: tablesInfo,
      totalTables: tablesInfo.length,
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message, tables: [] });
  }
}

/**
 * Database Provider Switcher
 */
export async function getProviderConfig(req: Request, res: Response) {
  try {
    const config = await settingsRepository.get('database_provider');
    res.json({
      success: true,
      provider: config?.active || 'POSTGRESQL',
      config: config || { active: 'POSTGRESQL', label: 'PostgreSQL Nativo', mode: 'STRICT_POSTGRES' }
    });
  } catch (err: any) {
    res.json({ success: true, provider: 'POSTGRESQL', config: { active: 'POSTGRESQL' } });
  }
}

export async function setProviderConfig(req: Request, res: Response) {
  try {
    const { provider = 'POSTGRESQL', mode = 'STRICT_POSTGRES' } = req.body;
    const updated = await settingsRepository.set('database_provider', {
      active: 'POSTGRESQL',
      label: 'PostgreSQL Nativo',
      mode,
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * System Logo & Branding Controllers
 */
export async function getSystemLogo(req: Request, res: Response) {
  try {
    const config = await settingsRepository.getLogoConfig();
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.json({
      success: true,
      data: {
        title: 'GIHS SYSTEMS',
        tagline: 'Enterprise System . 100% Monitorado',
        tagline_color: '#00A6FC',
        primary_color: '#00A6FC',
        secondary_color: '#0067FC',
        logo_url: '/gihs-logo.svg',
        is_custom: true
      }
    });
  }
}

export async function setSystemLogo(req: Request, res: Response) {
  try {
    const updated = await settingsRepository.setLogoConfig(req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function resetSystemLogo(req: Request, res: Response) {
  try {
    const defaultConfig = {
      title: 'GIHS SYSTEMS',
      tagline: 'Enterprise System . 100% Monitorado',
      tagline_color: '#00A6FC',
      primary_color: '#00A6FC',
      secondary_color: '#0067FC',
      logo_url: '/gihs-logo.svg',
      is_custom: true,
      updated_at: new Date().toISOString()
    };
    const updated = await settingsRepository.setLogoConfig(defaultConfig);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Controller de Download do Dump Completo do Banco de Dados (Supabase / PostgreSQL)
 */
export async function downloadDatabaseDump(req: Request, res: Response) {
  try {
    const dumpPath = path.resolve(process.cwd(), 'server', 'gihs_supabase_complete_database.sql');
    if (!fs.existsSync(dumpPath)) {
      return res.status(404).json({ success: false, error: 'Arquivo de dump do banco de dados não encontrado.' });
    }
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gihs_supabase_complete_database.sql"');
    const fileStream = fs.createReadStream(dumpPath);
    fileStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * USERS CONTROLLER (CRUD)
 */
export async function getUsers(req: Request, res: Response) {
  try {
    const dbStatus = await checkDatabaseConnection();
    if (!dbStatus.connected) {
      return res.json({
        success: true,
        postgresLive: false,
        count: 0,
        data: [],
        message: 'PostgreSQL desconectado. Base zerada aguardando conexão com banco de dados.'
      });
    }

    const users = await usersRepository.findAll();
    res.json({
      success: true,
      postgresLive: true,
      count: users.length,
      data: users
    });
  } catch (err: any) {
    res.json({
      success: true,
      postgresLive: false,
      count: 0,
      data: [],
      error: err.message
    });
  }
}

/**
 * SECTORS CONTROLLER (Organograma & Matriz)
 */
export async function getSectors(req: Request, res: Response) {
  try {
    const dbStatus = await checkDatabaseConnection();
    if (!dbStatus.connected) {
      return res.json({
        success: true,
        postgresLive: false,
        count: 0,
        data: []
      });
    }

    try {
      const sectorsRes = await query(`
        SELECT 
          s.id,
          s.name,
          s.area,
          s.leader_name as "leaderName",
          s.description,
          s.sla_target as "slaTarget",
          COUNT(u.id)::int as "collaboratorsCount"
        FROM sectors s
        LEFT JOIN users u ON (u.sector_name = s.name OR u.sector_id = s.id) AND u.is_active = true
        GROUP BY s.id, s.name, s.area, s.leader_name, s.description, s.sla_target
        ORDER BY s.name ASC;
      `);
      return res.json({
        success: true,
        postgresLive: true,
        count: sectorsRes.rows.length,
        data: sectorsRes.rows
      });
    } catch {
      // Fallback: aggregate from users table if sectors table is not yet created
      const usersBySector = await query(`
        SELECT 
          sector_name as name,
          COALESCE(area, 'ADMINISTRATIVO') as area,
          COUNT(id)::int as "collaboratorsCount"
        FROM users
        WHERE sector_name IS NOT NULL
        GROUP BY sector_name, area
        ORDER BY sector_name ASC;
      `);
      return res.json({
        success: true,
        postgresLive: true,
        count: usersBySector.rows.length,
        data: usersBySector.rows.map((r, i) => ({
          id: `sec-${i + 1}`,
          name: r.name,
          area: r.area,
          leaderName: 'A definir',
          collaboratorsCount: r.collaboratorsCount,
          slaTarget: '99.0%',
          description: `Setor corporativo ${r.name}`
        }))
      });
    }
  } catch (err: any) {
    res.json({ success: true, postgresLive: false, count: 0, data: [] });
  }
}

export async function createSector(req: Request, res: Response) {
  try {
    const { id, name, area, leaderName, description, slaTarget } = req.body;
    const sectorId = id || `sec-${Date.now()}`;
    await query(`
      INSERT INTO sectors (id, name, area, leader_name, description, sla_target)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        area = EXCLUDED.area,
        leader_name = EXCLUDED.leader_name,
        description = EXCLUDED.description,
        sla_target = EXCLUDED.sla_target;
    `, [sectorId, name, area, leaderName || 'A definir', description || '', slaTarget || '99.0%']);
    res.status(201).json({
      success: true,
      data: { id: sectorId, name, area, leaderName, description, slaTarget }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getUserById(req: Request, res: Response) {
  try {
    const user = await usersRepository.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const created = await usersRepository.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const updated = await usersRepository.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

    // Se houve atualização de senha, registra auditoria de segurança corporativa
    if (req.body.password || req.body.password_hash || req.body.temporaryPassword) {
      recordSecurityAudit({
        action: 'SENHA_ALTERADA',
        category: 'AUTH',
        user_name: updated.name || req.params.id,
        user_id: updated.id,
        ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
        severity: 'Info',
        details: {
          encryption: 'PBKDF2-SHA512',
          iterations: 100000,
          saltLength: '128 bits',
          rulesVerified: ['min_8_chars', 'min_1_special', 'min_1_number', 'strong_entropy']
        }
      });
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    const isValidationError = err.message && (
      err.message.includes('requisitos de cyber-security') ||
      err.message.includes('requisitos de segurança')
    );
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: err.message,
      error: err.message
    });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const success = await usersRepository.delete(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PONTO RECORDS CONTROLLER (CRUD)
 */
export async function getPontoRecords(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 1000;
    const userId = req.query.userId as string;
    const name = (req.query.name || req.query.collaboratorName) as string;
    const month = req.query.month as string;
    const date = req.query.date as string;

    const records = await pontoRepository.findAll(limit, { userId, name, month, date });
    res.json({ success: true, count: records.length, data: records });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getPontoByUserId(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 500;
    const records = await pontoRepository.findByUserId(req.params.userId, limit);
    res.json({ success: true, count: records.length, data: records });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createPontoRecord(req: Request, res: Response) {
  try {
    const created = await pontoRepository.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function seedPontoMonth(req: Request, res: Response) {
  try {
    const { userId, month } = req.body;
    const result = await pontoRepository.seedMonthPunches(userId, month);
    res.json({
      success: true,
      inserted: result.inserted,
      message: `${result.inserted} batidas de ponto em conformidade CLT/Portaria 671 foram gravadas com sucesso no PostgreSQL!`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getPontoConfig(req: Request, res: Response) {
  try {
    const config = await settingsRepository.getPontoConfig();
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updatePontoConfig(req: Request, res: Response) {
  try {
    const updated = await settingsRepository.setPontoConfig(req.body);
    res.json({ success: true, data: updated, message: 'Configurações de ponto salvas com sucesso no PostgreSQL!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function resetPontoConfig(req: Request, res: Response) {
  try {
    const defaultConfig = {
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
    const updated = await settingsRepository.setPontoConfig(defaultConfig);
    res.json({ success: true, data: updated, message: 'Parâmetros legais da Portaria 671 MTE restaurados com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * TICKETS CONTROLLER (CRUD)
 */
export async function getTickets(req: Request, res: Response) {
  try {
    const status = req.query.status as string | undefined;
    const tickets = await ticketsRepository.findAll(status);
    res.json({ success: true, count: tickets.length, data: tickets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getTicketById(req: Request, res: Response) {
  try {
    const ticket = await ticketsRepository.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Chamado não encontrado' });
    res.json({ success: true, data: ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createTicket(req: Request, res: Response) {
  try {
    const created = await ticketsRepository.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateTicket(req: Request, res: Response) {
  try {
    const updated = await ticketsRepository.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Chamado não encontrado' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteTicket(req: Request, res: Response) {
  try {
    const success = await ticketsRepository.delete(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function clearTickets(req: Request, res: Response) {
  try {
    const success = await ticketsRepository.clearAll();
    res.json({ success, message: 'Todos os chamados foram limpos do PostgreSQL.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * KNOWLEDGE BASE CONTROLLER
 */
export async function getKnowledgeArticles(req: Request, res: Response) {
  try {
    // Auto-seed if empty
    await knowledgeRepository.seedIfEmpty(KNOWLEDGE_BASE_DATA);

    const sector = req.query.sector as string | undefined;
    const category = req.query.category as string | undefined;
    const articles = await knowledgeRepository.findAll(sector, category);
    res.json({ success: true, count: articles.length, data: articles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getKnowledgeArticleById(req: Request, res: Response) {
  try {
    const article = await knowledgeRepository.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Artigo não encontrado' });
    res.json({ success: true, data: article });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createKnowledgeArticle(req: Request, res: Response) {
  try {
    const article = await knowledgeRepository.create(req.body);
    res.status(201).json({ success: true, data: article });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function markArticleUseful(req: Request, res: Response) {
  try {
    const article = await knowledgeRepository.incrementUseful(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Artigo não encontrado' });
    res.json({ success: true, data: article });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * EQUIPMENT CONTROLLER (CRUD)
 */
export async function getEquipment(req: Request, res: Response) {
  try {
    const items = await equipmentRepository.findAll();
    res.json({ success: true, count: items.length, data: items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getEquipmentById(req: Request, res: Response) {
  try {
    const item = await equipmentRepository.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Equipamento não encontrado' });
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createEquipment(req: Request, res: Response) {
  try {
    const created = await equipmentRepository.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateEquipment(req: Request, res: Response) {
  try {
    const updated = await equipmentRepository.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Equipamento não encontrado' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteEquipment(req: Request, res: Response) {
  try {
    const success = await equipmentRepository.delete(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteAllEquipment(req: Request, res: Response) {
  try {
    const count = await equipmentRepository.deleteAll();
    res.json({ success: true, message: 'Todos os equipamentos foram removidos do PostgreSQL com sucesso.', deletedCount: count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * TASKS / TAREFAS CONTROLLER (CRUD)
 */
export async function getTasks(req: Request, res: Response) {
  try {
    const items = await tasksRepository.findAll();
    res.json({ success: true, count: items.length, data: items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getTaskById(req: Request, res: Response) {
  try {
    const item = await tasksRepository.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createTask(req: Request, res: Response) {
  try {
    const created = await tasksRepository.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateTask(req: Request, res: Response) {
  try {
    const updated = await tasksRepository.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteTask(req: Request, res: Response) {
  try {
    const success = await tasksRepository.delete(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Client network metadata inspection (IP, user agent)
 */
export function getClientNetwork(req: Request, res: Response) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  let clientIp = '';
  if (typeof xForwardedFor === 'string') {
    clientIp = xForwardedFor.split(',')[0].trim();
  } else if (Array.isArray(xForwardedFor)) {
    clientIp = xForwardedFor[0].trim();
  } else {
    clientIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
  }

  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }

  res.json({
    ip: clientIp,
    userAgent: req.headers['user-agent'] || '',
    timestamp: Date.now(),
    isp: 'Conexão Corporativa Segura',
    city: 'São Paulo',
    region: 'SP',
    country: 'Brasil',
  });
}

/**
 * Metrics & overview for the executive & operational dashboard (PostgreSQL Direct)
 */
export async function getDashboardMetrics(req: Request, res: Response) {
  try {
    const dbStatus = await checkDatabaseConnection();

    // Default zeroed statistics ready for PostgreSQL
    let stats = {
      activeCollaborators: 0,
      absentCollaborators: 0,
      intervalCollaborators: 0,
      totalCollaborators: 0,
      activeTasks: 0,
      pendingTasks: 0,
      delayedTasks: 0,
      doneTasks: 0,
      activeTickets: 0,
      openTickets: 0,
      inProgressTickets: 0,
      resolvedTickets: 0,
      todayTimeClockPunches: 0,
      workingPonto: 0,
      intervalPonto: 0,
      delayPonto: 0,
      overtimePonto: 0,
      registeredActivities: 0,
      slaCompliance: 0,
    };

    let sectorsProductivity: any[] = [];
    let recentActivities: any[] = [];
    let calendarEvents: any[] = [];
    let alerts: any[] = [];

    if (dbStatus.connected) {
      try {
        const usersCountRes = await query(`
          SELECT 
            count(*) as total,
            count(*) FILTER (WHERE status = 'Em atividade') as active,
            count(*) FILTER (WHERE status = 'Ausente') as absent,
            count(*) FILTER (WHERE status = 'Intervalo') as in_interval
          FROM users;
        `);
        if (usersCountRes.rows[0]) {
          const row = usersCountRes.rows[0];
          stats.totalCollaborators = parseInt(row.total || '0', 10);
          stats.activeCollaborators = parseInt(row.active || '0', 10);
          stats.absentCollaborators = parseInt(row.absent || '0', 10);
          stats.intervalCollaborators = parseInt(row.in_interval || '0', 10);
        }
      } catch {
        // Table not present yet in database
      }

      try {
        const ticketsRes = await query(`
          SELECT 
            count(*) as total,
            count(*) FILTER (WHERE status != 'RESOLVIDO' AND status != 'CANCELADO') as active,
            count(*) FILTER (WHERE status = 'ABERTO') as open,
            count(*) FILTER (WHERE status = 'EM_ATENDIMENTO') as in_progress,
            count(*) FILTER (WHERE status = 'RESOLVIDO') as resolved
          FROM tickets;
        `);
        if (ticketsRes.rows[0]) {
          const row = ticketsRes.rows[0];
          stats.activeTickets = parseInt(row.active || '0', 10);
          stats.openTickets = parseInt(row.open || '0', 10);
          stats.inProgressTickets = parseInt(row.in_progress || '0', 10);
          stats.resolvedTickets = parseInt(row.resolved || '0', 10);
        }
      } catch (tErr) {
        console.warn('Dashboard tickets query error:', tErr);
      }

      try {
        const tasksRes = await query(`
          SELECT 
            count(*) as total,
            count(*) FILTER (WHERE status != 'CONCLUIDO') as active,
            count(*) FILTER (WHERE status = 'A_FAZER') as pending,
            count(*) FILTER (WHERE is_delayed = true) as delayed,
            count(*) FILTER (WHERE status = 'CONCLUIDO') as done
          FROM tasks;
        `);
        if (tasksRes.rows[0]) {
          const row = tasksRes.rows[0];
          stats.activeTasks = parseInt(row.active || '0', 10);
          stats.pendingTasks = parseInt(row.pending || '0', 10);
          stats.delayedTasks = parseInt(row.delayed || '0', 10);
          stats.doneTasks = parseInt(row.done || '0', 10);
        }
      } catch (tskErr) {
        console.warn('Dashboard tasks query error:', tskErr);
      }

      try {
        const pontoRes = await query(`
          SELECT count(*) as today_punches
          FROM ponto_records
          WHERE punch_date = CURRENT_DATE;
        `);
        if (pontoRes.rows[0]) {
          stats.todayTimeClockPunches = parseInt(pontoRes.rows[0].today_punches || '0', 10);
          stats.workingPonto = stats.activeCollaborators;
          stats.intervalPonto = stats.intervalCollaborators;
        }
      } catch (pErr) {
        console.warn('Dashboard ponto query error:', pErr);
      }
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      sectorsProductivity,
      recentActivities,
      calendarEvents,
      alerts,
      postgresLive: dbStatus.connected,
      message: dbStatus.connected 
        ? 'Métricas carregadas dinamicamente do PostgreSQL.' 
        : 'PostgreSQL desconectado. Métricas zeradas aguardando conexão com banco de dados.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// =========================================================================
// ON-CALL (SOBREAVISO) CONTROLLERS
// =========================================================================

export async function getOnCallShifts(req: Request, res: Response) {
  try {
    const { sector_id, user_id, status, from_date, to_date } = req.query;
    const shifts = await onCallRepository.findAll({
      sector_id: sector_id as string,
      user_id: user_id as string,
      status: status as string,
      from_date: from_date as string,
      to_date: to_date as string,
    });
    res.json({ success: true, count: shifts.length, data: shifts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getOnCallShiftById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const shift = await onCallRepository.findById(id);
    if (!shift) return res.status(404).json({ success: false, error: 'Escala de sobreaviso não encontrada' });
    res.json({ success: true, data: shift });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getCurrentOnCallActive(req: Request, res: Response) {
  try {
    const active = await onCallRepository.getCurrentActiveShifts();
    res.json({ success: true, count: active.length, data: active });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getUpcomingOnCall(req: Request, res: Response) {
  try {
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const upcoming = await onCallRepository.getUpcomingShifts(limit);
    res.json({ success: true, count: upcoming.length, data: upcoming });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function checkOnCallConflict(req: Request, res: Response) {
  try {
    const { userId, startAt, endAt, excludeShiftId } = req.body;
    if (!userId || !startAt || !endAt) {
      return res.status(400).json({ success: false, error: 'Parâmetros incompletos para validação de conflito' });
    }
    const result = await onCallRepository.checkConflict(userId, startAt, endAt, excludeShiftId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createOnCallShift(req: Request, res: Response) {
  try {
    const { user_id, user_name, sector_id, sector_name, device_id, device_tag, device_phone, start_at, end_at, status, notes, created_by, created_by_name } = req.body;

    if (!user_id || !start_at || !end_at) {
      return res.status(400).json({ success: false, error: 'Dados obrigatórios não preenchidos' });
    }

    // Validação rígida de conflito
    const conflict = await onCallRepository.checkConflict(user_id, start_at, end_at);
    if (conflict.hasConflict) {
      return res.status(409).json({
        success: false,
        error: `Conflito de escala: O colaborador ${user_name || user_id} já possui sobreaviso entre ${new Date(conflict.conflictingShift!.start_at).toLocaleString('pt-BR')} e ${new Date(conflict.conflictingShift!.end_at).toLocaleString('pt-BR')}.`,
        conflictingShift: conflict.conflictingShift
      });
    }

    const created = await onCallRepository.create({
      user_id,
      user_name,
      sector_id,
      sector_name: sector_name || 'Geral',
      device_id,
      device_tag,
      device_phone,
      start_at,
      end_at,
      status: status || 'AGENDADO',
      notes,
      created_by,
      created_by_name
    });

    // Auditoria oficial
    await recordSecurityAudit({
      action: 'CRIACAO_ESCALA_SOBREAVISO',
      category: 'ON_CALL',
      user_name: created_by_name || 'Gestor de Escala',
      user_id: created_by,
      ip_address: req.ip || '127.0.0.1',
      details: { shiftId: created.id, user: user_name, sector: sector_name, period: `${start_at} até ${end_at}` }
    });

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateOnCallShift(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Se estiver alterando horários, revalida conflito
    if (updates.user_id && updates.start_at && updates.end_at) {
      const conflict = await onCallRepository.checkConflict(updates.user_id, updates.start_at, updates.end_at, id);
      if (conflict.hasConflict) {
        return res.status(409).json({
          success: false,
          error: `Conflito de escala: Já existe sobreaviso para o período informado.`,
          conflictingShift: conflict.conflictingShift
        });
      }
    }

    const updated = await onCallRepository.update(id, updates);
    if (!updated) return res.status(404).json({ success: false, error: 'Escala não encontrada' });

    await recordSecurityAudit({
      action: 'ALTERACAO_ESCALA_SOBREAVISO',
      category: 'ON_CALL',
      user_name: updates.updated_by_name || 'Gestor',
      user_id: updates.updated_by,
      ip_address: req.ip || '127.0.0.1',
      details: { shiftId: id, updates }
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteOnCallShift(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const deleted = await onCallRepository.delete(id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Escala não encontrada' });

    await recordSecurityAudit({
      action: 'CANCELAMENTO_ESCALA_SOBREAVISO',
      category: 'ON_CALL',
      user_name: req.body.user_name || 'Gestor',
      user_id: req.body.user_id,
      ip_address: req.ip || '127.0.0.1',
      details: { shiftId: id }
    });

    res.json({ success: true, message: 'Escala excluída/cancelada com sucesso' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function auditPdfGeneration(req: Request, res: Response) {
  try {
    const { user_id, user_name, filter_period, sector, total_shifts } = req.body;
    await recordSecurityAudit({
      action: 'EXPORTACAO_PDF_SOBREAVISO',
      category: 'ON_CALL',
      user_name: user_name || 'Colaborador',
      user_id: user_id,
      ip_address: req.ip || '127.0.0.1',
      details: { filter_period, sector, total_shifts, generatedAt: new Date().toISOString() }
    });
    res.json({ success: true, message: 'Auditoria de geração de PDF registrada no PostgreSQL' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// =========================================================================
// MOBILITY (MOBILIDADE CORPORATIVA) CONTROLLERS
// =========================================================================

export async function getMobilityVehicles(req: Request, res: Response) {
  try {
    const vehicles = await mobilityRepository.getVehicles();
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createMobilityVehicle(req: Request, res: Response) {
  try {
    const vehicle = await mobilityRepository.createVehicle(req.body);
    await recordSecurityAudit({
      action: 'CADASTRO_VEICULO_FROTA',
      category: 'MOBILITY',
      user_name: req.body.operator_name || 'Gestor de Frota',
      user_id: req.body.operator_id,
      ip_address: req.ip || '127.0.0.1',
      details: { model: vehicle.model, plate: vehicle.plate, km: vehicle.current_km, lastFuel: vehicle.last_fuel_date }
    });
    res.status(201).json({ success: true, data: vehicle });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteMobilityVehicle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const ok = await mobilityRepository.deleteVehicle(id);
    if (!ok) return res.status(404).json({ success: false, error: 'Veículo não encontrado' });
    await recordSecurityAudit({
      action: 'REMOCAO_VEICULO_FROTA',
      category: 'MOBILITY',
      user_name: 'Diretoria / Super Admin',
      ip_address: req.ip || '127.0.0.1',
      details: { vehicleId: id }
    });
    res.json({ success: true, message: 'Veículo removido com sucesso' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMobilityDevices(req: Request, res: Response) {
  try {
    const devices = await mobilityRepository.getDevices();
    res.json({ success: true, count: devices.length, data: devices });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMobilityDeviceById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const device = await mobilityRepository.getDeviceById(id);
    if (!device) return res.status(404).json({ success: false, error: 'Aparelho corporativo não encontrado' });
    res.json({ success: true, data: device });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createMobilityDevice(req: Request, res: Response) {
  try {
    const created = await mobilityRepository.createDevice(req.body);
    await recordSecurityAudit({
      action: 'CADASTRO_CELULAR_CORPORATIVO',
      category: 'MOBILITY',
      user_name: req.body.operator_name || 'Administrador',
      user_id: req.body.operator_id,
      ip_address: req.ip || '127.0.0.1',
      details: { tag: created.patrimony_tag, model: created.model, imei: created.specifications?.imei }
    });
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateMobilityDevice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updated = await mobilityRepository.updateDevice(id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Aparelho não encontrado' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteMobilityDevice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const ok = await mobilityRepository.deleteDevice(id);
    if (!ok) return res.status(404).json({ success: false, error: 'Aparelho não encontrado' });
    await recordSecurityAudit({
      action: 'REMOCAO_CELULAR_CORPORATIVO',
      category: 'MOBILITY',
      user_name: 'Diretoria / Super Admin',
      ip_address: req.ip || '127.0.0.1',
      details: { deviceId: id }
    });
    res.json({ success: true, message: 'Celular corporativo removido com sucesso' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMobilityAssignments(req: Request, res: Response) {
  try {
    const { user_id, equipment_id, status } = req.query;
    const assignments = await mobilityRepository.getAssignments({
      user_id: user_id as string,
      equipment_id: equipment_id as string,
      status: status as string
    });
    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createMobilityAssignment(req: Request, res: Response) {
  try {
    const assignment = await mobilityRepository.createAssignment(req.body);
    await recordSecurityAudit({
      action: 'ATRIBUICAO_CUSTODIA_CELULAR',
      category: 'MOBILITY',
      user_name: req.body.assigned_by_name || 'Responsável Entrega',
      user_id: req.body.assigned_by,
      ip_address: req.ip || '127.0.0.1',
      details: { equipmentId: req.body.equipment_id, toUser: req.body.user_name, purpose: req.body.purpose }
    });
    res.status(201).json({ success: true, data: assignment });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function returnMobilityAssignment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const returned = await mobilityRepository.returnAssignment(id, req.body.notes);
    if (!returned) return res.status(404).json({ success: false, error: 'Atribuição não encontrada' });

    await recordSecurityAudit({
      action: 'DEVOLUCAO_CUSTODIA_CELULAR',
      category: 'MOBILITY',
      user_name: req.body.operator_name || 'Responsável Devolução',
      user_id: req.body.operator_id,
      ip_address: req.ip || '127.0.0.1',
      details: { assignmentId: id, notes: req.body.notes }
    });
    res.json({ success: true, data: returned });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMobilityTrips(req: Request, res: Response) {
  try {
    const { user_id, device_id, status, vehicle_plate, ticket_id, from_date, to_date } = req.query;
    const trips = await mobilityRepository.getTrips({
      user_id: user_id as string,
      device_id: device_id as string,
      status: status as string,
      vehicle_plate: vehicle_plate as string,
      ticket_id: ticket_id as string,
      from_date: from_date as string,
      to_date: to_date as string
    });
    res.json({ success: true, count: trips.length, data: trips });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMobilityTripById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const trip = await mobilityRepository.getTripById(id);
    if (!trip) return res.status(404).json({ success: false, error: 'Viagem / deslocamento não encontrado' });
    res.json({ success: true, data: trip });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function startMobilityTrip(req: Request, res: Response) {
  try {
    const trip = await mobilityRepository.startTrip(req.body);
    await recordSecurityAudit({
      action: 'INICIO_DESLOCAMENTO_VEICULO',
      category: 'MOBILITY',
      user_name: trip.user_name,
      user_id: trip.user_id,
      ip_address: req.ip || '127.0.0.1',
      details: { tripId: trip.id, vehicle: trip.vehicle_model, plate: trip.vehicle_plate, destination: trip.destination }
    });
    res.status(201).json({ success: true, data: trip });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function addMobilityRoutePoint(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const point = await mobilityRepository.addRoutePoint(id, req.body);
    res.status(201).json({ success: true, data: point });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function finishMobilityTrip(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const finished = await mobilityRepository.finishTrip(id, req.body);
    if (!finished) return res.status(404).json({ success: false, error: 'Viagem não encontrada' });

    await recordSecurityAudit({
      action: 'ENCERRAMENTO_DESLOCAMENTO_VEICULO',
      category: 'MOBILITY',
      user_name: finished.user_name,
      user_id: finished.user_id,
      ip_address: req.ip || '127.0.0.1',
      details: { tripId: id, totalDistanceKm: finished.total_distance_km, durationSeconds: finished.duration_seconds }
    });
    res.json({ success: true, data: finished });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMobilityMetrics(req: Request, res: Response) {
  try {
    const metrics = await mobilityRepository.getMetrics();
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function clearMobilityData(req: Request, res: Response) {
  try {
    const result = await mobilityRepository.clearAllMobilityData();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// Gestão de Clientes & Secretarias Municipais (Joinville)
// ==========================================
export async function getClients(req: Request, res: Response) {
  try {
    const clients = await clientsRepository.findAll();
    res.json({ success: true, count: clients.length, data: clients });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getClientById(req: Request, res: Response) {
  try {
    const client = await clientsRepository.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, error: 'Órgão / Secretaria não encontrado' });
    res.json({ success: true, data: client });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createClient(req: Request, res: Response) {
  try {
    const created = await clientsRepository.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateClient(req: Request, res: Response) {
  try {
    const updated = await clientsRepository.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Órgão / Secretaria não encontrado' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteClient(req: Request, res: Response) {
  try {
    const deleted = await clientsRepository.delete(req.params.id);
    res.json({ success: deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function seedClients(req: Request, res: Response) {
  try {
    const result = await clientsRepository.seedAll();
    const clients = await clientsRepository.findAll();
    res.json({ success: true, ...result, data: clients });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}


