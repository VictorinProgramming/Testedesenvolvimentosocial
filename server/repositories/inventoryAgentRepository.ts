import { query } from '../db.ts';
import { equipmentRepository } from './equipmentRepository.ts';

export interface InventoryAgentRow {
  id: string;
  asset_id?: string | null;
  hostname: string;
  machine_uuid: string;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  domain_workgroup?: string | null;
  current_user?: string | null;
  agent_version: string;
  agent_status: 'ONLINE' | 'OFFLINE' | 'ALERT' | 'CONFLICT';
  security_status: 'PROTEGIDO' | 'ALERTA' | 'VULNERAVEL';
  ip_address?: string | null;
  mac_addresses?: string[];
  os_info?: any;
  memory_info?: any;
  storage_info?: any;
  security_info?: any;
  software_count: number;
  request_full_inventory: boolean;
  last_heartbeat: string;
  last_inventory: string;
  first_seen: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  asset_tag?: string;
  asset_name?: string;
}

export interface AgentSoftwareRow {
  id: number;
  agent_id: string;
  name: string;
  version?: string;
  publisher?: string;
  install_date?: string;
  installed_user?: string;
  install_location?: string;
  uninstall_string?: string;
  architecture?: string;
  created_at: string;
}

export interface AgentConflictRow {
  id: number;
  agent_id: string;
  existing_asset_id?: string | null;
  hostname?: string;
  machine_uuid?: string;
  serial_number?: string;
  conflict_type: string;
  payload_data: any;
  status: 'PENDING' | 'RESOLVED' | 'IGNORED';
  resolved_by?: string;
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
}

export const inventoryAgentRepository = {
  /**
   * Lista todos os agentes com paginação, busca e filtros
   */
  async findAll(params: {
    search?: string;
    status?: string;
    os?: string;
    securityStatus?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: InventoryAgentRow[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const offset = (page - 1) * limit;
    const sortOrder = params.sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(a.hostname) LIKE $${idx} OR 
        LOWER(COALESCE(a.serial_number, '')) LIKE $${idx} OR 
        LOWER(COALESCE(a."current_user", '')) LIKE $${idx} OR 
        LOWER(COALESCE(a.model, '')) LIKE $${idx} OR 
        LOWER(COALESCE(a.manufacturer, '')) LIKE $${idx} OR 
        LOWER(COALESCE(a.ip_address, '')) LIKE $${idx} OR
        LOWER(COALESCE(e.patrimony_tag, '')) LIKE $${idx}
      )`);
      values.push(q);
      idx++;
    }

    if (params.status && params.status !== 'ALL') {
      conditions.push(`a.agent_status = $${idx}`);
      values.push(params.status.toUpperCase());
      idx++;
    }

    if (params.securityStatus && params.securityStatus !== 'ALL') {
      conditions.push(`a.security_status = $${idx}`);
      values.push(params.securityStatus.toUpperCase());
      idx++;
    }

    if (params.os && params.os !== 'ALL') {
      conditions.push(`LOWER(COALESCE(a.os_info->>'name', '')) LIKE $${idx}`);
      values.push(`%${params.os.toLowerCase()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Mapeamento seguro de colunas de ordenação
    let sortCol = 'a.last_heartbeat';
    if (params.sortBy === 'hostname') sortCol = 'a.hostname';
    else if (params.sortBy === 'last_inventory') sortCol = 'a.last_inventory';
    else if (params.sortBy === 'agent_status') sortCol = 'a.agent_status';
    else if (params.sortBy === 'security_status') sortCol = 'a.security_status';
    else if (params.sortBy === 'software_count') sortCol = 'a.software_count';

    const countSql = `
      SELECT COUNT(*) as total 
      FROM gihs_core.inventory_agents a
      LEFT JOIN gihs_core.equipment e ON a.asset_id = e.id
      ${whereClause};
    `;

    const countRes = await query<{ total: string }>(countSql, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit) || 1;

    const dataSql = `
      SELECT 
        a.id,
        a.asset_id,
        a.hostname,
        a.machine_uuid,
        a.serial_number,
        a.manufacturer,
        a.model,
        a.domain_workgroup,
        a."current_user",
        a.agent_version,
        CASE 
          WHEN a.agent_status = 'CONFLICT' THEN 'CONFLICT'
          WHEN a.last_heartbeat < (NOW() - INTERVAL '75 minutes') THEN 'OFFLINE'
          ELSE a.agent_status
        END AS agent_status,
        a.security_status,
        a.ip_address,
        a.mac_addresses,
        a.os_info,
        a.memory_info,
        a.storage_info,
        a.security_info,
        a.software_count,
        a.request_full_inventory,
        a.last_heartbeat,
        a.last_inventory,
        a.first_seen,
        a.created_at,
        a.updated_at,
        e.patrimony_tag AS asset_tag,
        e.name AS asset_name
      FROM gihs_core.inventory_agents a
      LEFT JOIN gihs_core.equipment e ON a.asset_id = e.id
      ${whereClause}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $${idx} OFFSET $${idx + 1};
    `;

    values.push(limit, offset);
    const dataRes = await query<InventoryAgentRow>(dataSql, values);

    return {
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages
    };
  },

  /**
   * Consulta um agente pelo ID com detalhes completos
   */
  async findById(id: string): Promise<InventoryAgentRow | null> {
    const res = await query<InventoryAgentRow>(`
      SELECT 
        a.*,
        e.patrimony_tag AS asset_tag,
        e.name AS asset_name,
        e.sector AS asset_sector,
        e.status AS asset_status
      FROM gihs_core.inventory_agents a
      LEFT JOIN gihs_core.equipment e ON a.asset_id = e.id
      WHERE a.id = $1
      LIMIT 1;
    `, [id]);

    return res.rows[0] || null;
  },

  /**
   * Consulta um agente por UUID de hardware
   */
  async findByMachineUuid(uuid: string): Promise<InventoryAgentRow | null> {
    const res = await query<InventoryAgentRow>(`
      SELECT * FROM gihs_core.inventory_agents WHERE machine_uuid = $1 LIMIT 1;
    `, [uuid]);
    return res.rows[0] || null;
  },

  /**
   * Consulta um agente por Número de Série
   */
  async findBySerialNumber(serial: string): Promise<InventoryAgentRow | null> {
    if (!serial || serial.trim().length < 3) return null;
    const res = await query<InventoryAgentRow>(`
      SELECT * FROM gihs_core.inventory_agents WHERE serial_number = $1 LIMIT 1;
    `, [serial.trim()]);
    return res.rows[0] || null;
  },

  /**
   * Painel de Indicadores / Métricas do Inventário de TI
   */
  async getMetrics(): Promise<{
    totalAgents: number;
    onlineCount: number;
    offlineCount: number;
    conflictCount: number;
    protectedCount: number;
    alertCount: number;
    totalRamBytes: number;
    totalDiskBytes: number;
    totalSoftwareTracked: number;
  }> {
    const res = await query(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(CASE WHEN agent_status = 'CONFLICT' THEN 1 END) as conflict_count,
        COUNT(CASE WHEN agent_status != 'CONFLICT' AND last_heartbeat >= (NOW() - INTERVAL '75 minutes') THEN 1 END) as online_count,
        COUNT(CASE WHEN agent_status != 'CONFLICT' AND (last_heartbeat < (NOW() - INTERVAL '75 minutes') OR agent_status = 'OFFLINE') THEN 1 END) as offline_count,
        COUNT(CASE WHEN security_status = 'PROTEGIDO' THEN 1 END) as protected_count,
        COUNT(CASE WHEN security_status IN ('ALERTA', 'VULNERAVEL') THEN 1 END) as alert_count,
        COALESCE(SUM((memory_info->>'total_bytes')::BIGINT), 0) as total_ram_bytes,
        COALESCE(SUM(software_count), 0) as total_software_count
      FROM gihs_core.inventory_agents;
    `);

    const row = res.rows[0] || {};
    return {
      totalAgents: parseInt(row.total_agents || '0', 10),
      onlineCount: parseInt(row.online_count || '0', 10),
      offlineCount: parseInt(row.offline_count || '0', 10),
      conflictCount: parseInt(row.conflict_count || '0', 10),
      protectedCount: parseInt(row.protected_count || '0', 10),
      alertCount: parseInt(row.alert_count || '0', 10),
      totalRamBytes: parseInt(row.total_ram_bytes || '0', 10),
      totalDiskBytes: 0, // Calculado por partições
      totalSoftwareTracked: parseInt(row.total_software_count || '0', 10)
    };
  },

  /**
   * Registro rápido de Heartbeat (Ping Periódico do Agente)
   */
  async recordHeartbeat(params: {
    agentId: string;
    machineUuid: string;
    hostname?: string;
    agentVersion?: string;
    currentUser?: string;
    ipAddress?: string;
  }): Promise<{ success: boolean; requestFullInventory: boolean }> {
    const existing = await query<{ id: string; request_full_inventory: boolean }>(`
      SELECT id, request_full_inventory 
      FROM gihs_core.inventory_agents 
      WHERE id = $1 OR machine_uuid = $2 
      LIMIT 1;
    `, [params.agentId, params.machineUuid]);

    if (!existing.rows.length) {
      // Agente ainda não possui inventário inicial registrado; sinaliza para enviar inventário completo
      return { success: true, requestFullInventory: true };
    }

    const agent = existing.rows[0];

    await query(`
      UPDATE gihs_core.inventory_agents
      SET 
        last_heartbeat = CURRENT_TIMESTAMP,
        agent_status = CASE WHEN agent_status = 'CONFLICT' THEN 'CONFLICT' ELSE 'ONLINE' END,
        agent_version = COALESCE($1, agent_version),
        hostname = COALESCE($2, hostname),
        "current_user" = COALESCE($3, "current_user"),
        ip_address = COALESCE($4, ip_address),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5;
    `, [
      params.agentVersion || null,
      params.hostname || null,
      params.currentUser || null,
      params.ipAddress || null,
      agent.id
    ]);

    return {
      success: true,
      requestFullInventory: agent.request_full_inventory || false
    };
  },

  /**
   * Força a atualização de Heartbeat de um agente existente (via painel administrativo)
   */
  async recordManualHeartbeat(id: string): Promise<boolean> {
    const res = await query(`
      UPDATE gihs_core.inventory_agents
      SET 
        last_heartbeat = CURRENT_TIMESTAMP,
        agent_status = CASE WHEN agent_status = 'CONFLICT' THEN 'CONFLICT' ELSE 'ONLINE' END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id;
    `, [id]);
    return (res.rowCount || 0) > 0;
  },

  /**
   * Ingestão Completa de Inventário Técnico do Agente C# .NET 8
   * Inclui deduplicação, detecção de conflitos e sincronização com patrimônio
   */
  async upsertInventory(payload: {
    agent_id: string;
    agent_version: string;
    collected_at?: string;
    identity: {
      hostname: string;
      machine_uuid: string;
      serial_number?: string | null;
      manufacturer?: string | null;
      model?: string | null;
      domain_workgroup?: string | null;
      current_user?: string | null;
      ip_address?: string | null;
      mac_addresses?: string[];
    };
    operating_system: {
      name: string;
      edition?: string;
      version?: string;
      build?: string;
      architecture?: string;
      installed_at?: string | null;
      last_boot?: string | null;
    };
    memory: {
      total_bytes: number;
      used_bytes: number;
      available_bytes: number;
      used_percentage: number;
      modules?: Array<{
        bank_label?: string;
        capacity_bytes: number;
        manufacturer?: string;
        speed_mhz?: number;
        part_number?: string;
        serial_number?: string;
      }>;
    };
    storage: {
      physical_disks?: Array<{
        model?: string;
        serial_number?: string;
        manufacturer?: string;
        media_type?: string;
        interface_type?: string;
        total_capacity_bytes: number;
      }>;
      volumes?: Array<{
        drive_letter: string;
        file_system?: string;
        total_bytes: number;
        used_bytes: number;
        free_bytes: number;
        used_percentage: number;
      }>;
    };
    software?: Array<{
      name: string;
      version?: string;
      publisher?: string;
      install_date?: string;
      installed_for_user?: string;
      install_location?: string;
      uninstall_string?: string;
      architecture?: string;
    }>;
    security?: {
      antivirus?: {
        name?: string;
        enabled: boolean;
        up_to_date: boolean;
      };
      firewall?: {
        enabled: boolean;
      };
      secure_boot?: {
        enabled: boolean;
      };
      bitlocker?: {
        status: string;
        protection_enabled: boolean;
      };
    };
  }): Promise<{
    success: boolean;
    agentId: string;
    assetId?: string | null;
    status: 'ONLINE' | 'CONFLICT';
    message: string;
  }> {
    const id = payload.identity;
    const cleanUuid = (id.machine_uuid || '').trim().slice(0, 110);
    const cleanSerial = (id.serial_number || '').trim().slice(0, 110);
    const cleanHostname = (id.hostname || 'DESK-PC').trim().slice(0, 170);
    const agentId = (payload.agent_id || `agt_${cleanUuid.replace(/-/g, '').slice(0, 16)}`).slice(0, 60);

    const safeManufacturer = id.manufacturer ? String(id.manufacturer).trim().slice(0, 170) : null;
    const safeModel = id.model ? String(id.model).trim().slice(0, 170) : null;
    const safeDomain = id.domain_workgroup ? String(id.domain_workgroup).trim().slice(0, 170) : null;
    const safeCurrentUser = id.current_user ? String(id.current_user).trim().slice(0, 170) : null;
    const safeAgentVersion = payload.agent_version ? String(payload.agent_version).slice(0, 30) : '1.0.0';
    const safeIpAddress = id.ip_address ? String(id.ip_address).trim().slice(0, 60) : null;

    // 1. ANÁLISE DE DEDUPLICAÇÃO & CONFLITOS DE IDENTIDADE
    // Regra mandatória da instrução: Em caso de conflito (ex: mesmo serial com UUID diferente),
    // NÃO sobrescrever automaticamente um ativo sem validação. Registrar conflito para análise administrativa.
    if (cleanSerial && cleanSerial.length > 3) {
      const conflictingAgent = await query<{ id: string; machine_uuid: string; hostname: string }>(`
        SELECT id, machine_uuid, hostname 
        FROM gihs_core.inventory_agents 
        WHERE serial_number = $1 AND machine_uuid != $2 
        LIMIT 1;
      `, [cleanSerial, cleanUuid]);

      if (conflictingAgent.rows.length > 0) {
        const other = conflictingAgent.rows[0];
        console.warn(`[Agent Conflict Detected] Serial ${cleanSerial} já associado a UUID ${other.machine_uuid}, tentativa de sobrescrita por ${cleanUuid}`);

        // Registra o conflito de identidade na tabela auditável
        await query(`
          INSERT INTO gihs_core.agent_identity_conflicts (
            agent_id, hostname, machine_uuid, serial_number, conflict_type, payload_data, status
          ) VALUES ($1, $2, $3, $4, 'DUPLICATE_SERIAL_DIFFERENT_UUID', $5, 'PENDING');
        `, [
          agentId,
          cleanHostname,
          cleanUuid,
          cleanSerial,
          JSON.stringify({ incoming: payload, existing_other: other })
        ]);

        // Grava o agente com status CONFLICT para que o SUPER_ADMIN veja na tela
        await query(`
          INSERT INTO gihs_core.inventory_agents (
            id, hostname, machine_uuid, serial_number, manufacturer, model,
            domain_workgroup, "current_user", agent_version, agent_status,
            security_status, ip_address, mac_addresses, os_info, memory_info,
            storage_info, security_info, software_count, last_heartbeat, last_inventory
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, 'CONFLICT',
            'ALERTA', $10, $11, $12, $13,
            $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (machine_uuid) DO UPDATE SET
            agent_status = 'CONFLICT',
            security_status = 'ALERTA',
            last_heartbeat = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP;
        `, [
          agentId, cleanHostname, cleanUuid, cleanSerial, id.manufacturer || null, id.model || null,
          id.domain_workgroup || null, id.current_user || null, payload.agent_version || '1.0.0',
          id.ip_address || null, JSON.stringify(id.mac_addresses || []), JSON.stringify(payload.operating_system || {}),
          JSON.stringify(payload.memory || {}), JSON.stringify(payload.storage || {}),
          JSON.stringify(payload.security || {}), payload.software?.length || 0
        ]);

        return {
          success: false,
          agentId,
          status: 'CONFLICT',
          message: `Conflito de identidade detectado: O Serial ${cleanSerial} já pertence ao dispositivo ${other.hostname}. Registro enviado para triagem do Super Admin.`
        };
      }
    }

    // 2. STATUS DE SEGURANÇA CONSOLIDADO
    let securityStatus: 'PROTEGIDO' | 'ALERTA' | 'VULNERAVEL' = 'PROTEGIDO';
    if (payload.security) {
      const av = payload.security.antivirus;
      const fw = payload.security.firewall;
      if (!av?.enabled || !fw?.enabled) {
        securityStatus = 'VULNERAVEL';
      } else if (!av?.up_to_date) {
        securityStatus = 'ALERTA';
      }
    }

    // 3. SINCRONIZAÇÃO / VINCULAÇÃO COM A TABELA DE ATIVOS DE INFORMÁTICA (EQUIPMENT)
    // Verifica se já existe um equipamento com esse serial ou vinculado a este machine_uuid/agent_id
    let assetId: string | null = null;
    let existingEquipment = null;

    if (cleanSerial && cleanSerial.length > 3) {
      const eqRes = await query<{ id: string }>(`
        SELECT id FROM gihs_core.equipment 
        WHERE serial_number = $1 OR machine_uuid = $2 OR agent_id = $3
        LIMIT 1;
      `, [cleanSerial, cleanUuid, agentId]);
      if (eqRes.rows.length > 0) {
        existingEquipment = eqRes.rows[0];
        assetId = existingEquipment.id;
      }
    } else {
      const eqRes = await query<{ id: string }>(`
        SELECT id FROM gihs_core.equipment 
        WHERE machine_uuid = $1 OR agent_id = $2
        LIMIT 1;
      `, [cleanUuid, agentId]);
      if (eqRes.rows.length > 0) {
        existingEquipment = eqRes.rows[0];
        assetId = existingEquipment.id;
      }
    }

    // Se não existir patrimônio cadastrado, cria automaticamente na categoria 'Informática'
    if (!assetId) {
      const newTag = `PAT-TI-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const eqName = `${id.manufacturer || 'PC'} ${id.model || cleanHostname}`;
      const category = (id.model || '').toLowerCase().includes('laptop') || (id.model || '').toLowerCase().includes('notebook')
        ? 'Notebook' : 'Desktop';

      const specs = {
        os: payload.operating_system?.name || 'Windows 11',
        processor: (payload as any).processor?.name || (id as any).processor || 'Processador x64',
        ram_gb: Math.round((payload.memory?.total_bytes || 0) / (1024 * 1024 * 1024)),
        storage_summary: (payload.storage?.volumes || []).map(v => `${v.drive_letter} (${Math.round(v.total_bytes / (1024*1024*1024))}GB)`).join(', '),
        agent_id: agentId,
        machine_uuid: cleanUuid,
        current_user: id.current_user || null,
        ip_address: id.ip_address || null,
        discovered_by: 'GIHS Windows Agent'
      };

      try {
        const created = await equipmentRepository.create({
          id: `eq-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          patrimony_tag: newTag,
          name: eqName,
          category: 'Informática',
          serial_number: cleanSerial || `SN-${cleanUuid.slice(0, 12)}`,
          sector: 'TI',
          status: 'OPERACIONAL',
          specifications: specs
        });

        assetId = created.id;
      } catch (createErr: any) {
        // Se houve colisão de serial ou chave, tenta recuperar equipamento existente
        console.warn('[InventoryAgent] Falha ao criar novo equipamento, recuperando existente:', createErr?.message);
        const fallbackEq = await query<{ id: string }>(`
          SELECT id FROM gihs_core.equipment 
          WHERE serial_number = $1 OR machine_uuid = $2 OR agent_id = $3
          LIMIT 1;
        `, [cleanSerial, cleanUuid, agentId]);
        if (fallbackEq.rows.length > 0) {
          assetId = fallbackEq.rows[0].id;
        }
      }

      // Vincula os campos de agente no equipment se tiver assetId
      if (assetId) {
        await query(`
          UPDATE gihs_core.equipment
          SET agent_id = $1, machine_uuid = $2, last_agent_sync = CURRENT_TIMESTAMP
          WHERE id = $3;
        `, [agentId, cleanUuid, assetId]);
      }
    } else {
      // Atualiza o equipamento existente com os dados mais recentes do inventário
      await query(`
        UPDATE gihs_core.equipment
        SET 
          agent_id = $1,
          machine_uuid = $2,
          last_agent_sync = CURRENT_TIMESTAMP,
          serial_number = COALESCE($3, serial_number),
          specifications = specifications || $4::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5;
      `, [
        agentId,
        cleanUuid,
        cleanSerial || null,
        JSON.stringify({
          last_agent_scan: new Date().toISOString(),
          os: payload.operating_system?.name,
          ram_gb: Math.round((payload.memory?.total_bytes || 0) / (1024 * 1024 * 1024)),
          agent_version: payload.agent_version
        }),
        assetId
      ]);
    }

    // 4. UPSERT NA TABELA PRINCIPAL DE AGENTES DE INVENTÁRIO
    const agentSql = `
      INSERT INTO gihs_core.inventory_agents (
        id, asset_id, hostname, machine_uuid, serial_number, manufacturer,
        model, domain_workgroup, "current_user", agent_version, agent_status,
        security_status, ip_address, mac_addresses, os_info, memory_info,
        storage_info, security_info, software_count, request_full_inventory,
        last_heartbeat, last_inventory, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, 'ONLINE',
        $11, $12, $13, $14, $15,
        $16, $17, $18, FALSE,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (machine_uuid) DO UPDATE SET
        id = EXCLUDED.id,
        asset_id = EXCLUDED.asset_id,
        hostname = EXCLUDED.hostname,
        serial_number = EXCLUDED.serial_number,
        manufacturer = EXCLUDED.manufacturer,
        model = EXCLUDED.model,
        domain_workgroup = EXCLUDED.domain_workgroup,
        "current_user" = EXCLUDED."current_user",
        agent_version = EXCLUDED.agent_version,
        agent_status = 'ONLINE',
        security_status = EXCLUDED.security_status,
        ip_address = EXCLUDED.ip_address,
        mac_addresses = EXCLUDED.mac_addresses,
        os_info = EXCLUDED.os_info,
        memory_info = EXCLUDED.memory_info,
        storage_info = EXCLUDED.storage_info,
        security_info = EXCLUDED.security_info,
        software_count = EXCLUDED.software_count,
        request_full_inventory = FALSE,
        last_heartbeat = CURRENT_TIMESTAMP,
        last_inventory = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, asset_id;
    `;

    const agentRes = await query<{ id: string; asset_id: string }>(agentSql, [
      agentId,
      assetId,
      cleanHostname,
      cleanUuid,
      cleanSerial || null,
      safeManufacturer,
      safeModel,
      safeDomain,
      safeCurrentUser,
      safeAgentVersion,
      securityStatus,
      safeIpAddress,
      JSON.stringify(id.mac_addresses || []),
      JSON.stringify(payload.operating_system || {}),
      JSON.stringify(payload.memory || {}),
      JSON.stringify(payload.storage || {}),
      JSON.stringify(payload.security || {}),
      payload.software?.length || 0
    ]);

    const finalAgentId = agentRes.rows[0]?.id || agentId;

    // 5. REGISTRO DE APLICATIVOS INSTALADOS (ATUALIZAÇÃO ATÔMICA)
    if (payload.software && Array.isArray(payload.software) && payload.software.length > 0) {
      await query(`DELETE FROM gihs_core.agent_software WHERE agent_id = $1;`, [finalAgentId]);

      // Inserção em lotes de até 50 aplicativos por instrução para otimizar I/O
      const batchSize = 50;
      for (let i = 0; i < payload.software.length; i += batchSize) {
        const batch = payload.software.slice(i, i + batchSize);
        const rowsValues: any[] = [];
        const placeholders: string[] = [];

        batch.forEach((sw, bIdx) => {
          const base = bIdx * 9;
          placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`);
          rowsValues.push(
            finalAgentId,
            String(sw.name || 'Desconhecido').slice(0, 250),
            sw.version ? String(sw.version).slice(0, 115) : null,
            sw.publisher ? String(sw.publisher).slice(0, 250) : null,
            sw.install_date ? String(sw.install_date).slice(0, 60) : null,
            sw.installed_for_user ? String(sw.installed_for_user).slice(0, 175) : null,
            sw.install_location ? String(sw.install_location).slice(0, 2000) : null,
            sw.uninstall_string ? String(sw.uninstall_string).slice(0, 2000) : null,
            sw.architecture ? String(sw.architecture).slice(0, 30) : 'x64'
          );
        });

        const insertSwSql = `
          INSERT INTO gihs_core.agent_software (
            agent_id, name, version, publisher, install_date, installed_user,
            install_location, uninstall_string, architecture
          ) VALUES ${placeholders.join(', ')};
        `;

        await query(insertSwSql, rowsValues);
      }
    }

    // 6. REGISTRO DE EVENTO NO HISTÓRICO DE AUDITORIA
    await query(`
      INSERT INTO gihs_core.agent_inventory_history (
        agent_id, event_type, summary, details
      ) VALUES ($1, 'FULL_INVENTORY', $2, $3);
    `, [
      finalAgentId,
      `Inventário técnico completo recebido do host ${cleanHostname} (${payload.software?.length || 0} softwares)`,
      JSON.stringify({
        os: payload.operating_system?.name,
        ram_bytes: payload.memory?.total_bytes,
        storage_volumes: payload.storage?.volumes?.length || 0,
        security_status: securityStatus,
        agent_version: payload.agent_version
      })
    ]);

    return {
      success: true,
      agentId: finalAgentId,
      assetId,
      status: 'ONLINE',
      message: `Inventário sincronizado com sucesso no PostgreSQL e associado ao Ativo ${assetId}.`
    };
  },

  /**
   * Consulta a lista de aplicativos instalados de um agente
   */
  async getSoftwareList(
    agentId: string,
    search?: string,
    limit = 50,
    offset = 0
  ): Promise<{ data: AgentSoftwareRow[]; total: number }> {
    const conditions: string[] = ['agent_id = $1'];
    const values: any[] = [agentId];
    let idx = 2;

    if (search && search.trim()) {
      conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(COALESCE(publisher, '')) LIKE $${idx})`);
      values.push(`%${search.trim().toLowerCase()}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await query<{ total: string }>(`
      SELECT COUNT(*) as total FROM gihs_core.agent_software ${where};
    `, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    values.push(limit, offset);
    const dataRes = await query<AgentSoftwareRow>(`
      SELECT * FROM gihs_core.agent_software
      ${where}
      ORDER BY name ASC
      LIMIT $${idx} OFFSET $${idx + 1};
    `, values);

    return { data: dataRes.rows, total };
  },

  /**
   * Consulta histórico de eventos do agente
   */
  async getHistory(agentId: string, limit = 20): Promise<any[]> {
    const res = await query(`
      SELECT * FROM gihs_core.agent_inventory_history
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `, [agentId, limit]);
    return res.rows;
  },

  /**
   * Consulta conflitos de identidade pendentes
   */
  async getConflicts(): Promise<AgentConflictRow[]> {
    const res = await query<AgentConflictRow>(`
      SELECT * FROM gihs_core.agent_identity_conflicts
      ORDER BY created_at DESC;
    `);
    return res.rows;
  },

  /**
   * Resolução administrativa de conflito por SUPER_ADMIN
   */
  async resolveConflict(
    conflictId: number,
    resolution: {
      resolvedBy: string;
      notes: string;
      action: 'ACCEPT_NEW_UUID' | 'DISMISS' | 'OVERWRITE';
    }
  ): Promise<boolean> {
    const res = await query(`
      UPDATE gihs_core.agent_identity_conflicts
      SET 
        status = 'RESOLVED',
        resolved_by = $1,
        resolution_notes = $2,
        resolved_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `, [resolution.resolvedBy, resolution.notes, conflictId]);

    return (res.rowCount || 0) > 0;
  },

  /**
   * Solicita forçamento de varredura completa no próximo heartbeat
   */
  async requestForceScan(agentId: string): Promise<boolean> {
    const res = await query(`
      UPDATE gihs_core.inventory_agents
      SET request_full_inventory = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, [agentId]);
    return (res.rowCount || 0) > 0;
  }
};
