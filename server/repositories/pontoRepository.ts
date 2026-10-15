import { query } from '../db.ts';

export interface PontoRow {
  id: string;
  nsr: string;
  user_id: string;
  collaborator_name: string;
  collaborator_sector?: string;
  type: string;
  punch_date: string;
  punch_time: string;
  unix_timestamp: number;
  photo_url?: string;
  biometric_match_confidence?: number;
  sha256_hash: string;
  device_type?: string;
  device_details?: string;
  ip_address?: string;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  approximate_address?: string;
  city?: string;
  state?: string;
  created_at: string;
}

function formatRow(row: any): any {
  if (!row) return row;
  let displayType = row.type;
  if (displayType === 'INICIO_INTERVALO') displayType = 'INÍCIO DO INTERVALO';
  if (displayType === 'SAIDA') displayType = 'SAÍDA';

  let datePtBr = '';
  let dateIso = '';
  if (row.punch_date) {
    if (typeof row.punch_date === 'string') {
      const parts = row.punch_date.split('T')[0].split('-');
      if (parts.length === 3) {
        dateIso = `${parts[0]}-${parts[1]}-${parts[2]}`;
        datePtBr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        dateIso = row.punch_date;
        datePtBr = row.punch_date;
      }
    } else if (row.punch_date instanceof Date) {
      dateIso = row.punch_date.toISOString().split('T')[0];
      const d = String(row.punch_date.getUTCDate()).padStart(2, '0');
      const m = String(row.punch_date.getUTCMonth() + 1).padStart(2, '0');
      const y = row.punch_date.getUTCFullYear();
      datePtBr = `${d}/${m}/${y}`;
    }
  }

  const timeStr = row.punch_time || '';

  return {
    ...row,
    id: row.id,
    nsr: row.nsr,
    user_id: row.user_id,
    collaboratorId: row.user_id,
    collaborator_name: row.collaborator_name,
    collaboratorName: row.collaborator_name,
    collaborator_sector: row.collaborator_sector || 'Geral',
    collaboratorSector: row.collaborator_sector || 'Geral',
    collaboratorMatricula: row.collaborator_matricula || `NEX-${String(row.user_id).slice(-4)}`,
    type: displayType,
    punch_date: dateIso,
    date: datePtBr || dateIso,
    punch_time: timeStr,
    time: timeStr,
    unix_timestamp: Number(row.unix_timestamp || Date.now()),
    timestamp: Number(row.unix_timestamp || Date.now()),
    photo_url: row.photo_url,
    photoUrl: row.photo_url,
    biometric_match_confidence: Number(row.biometric_match_confidence || 99.4),
    biometricMatchConfidence: Number(row.biometric_match_confidence || 99.4),
    sha256_hash: row.sha256_hash,
    sha256Hash: row.sha256_hash,
    device_type: row.device_type || 'Desktop',
    deviceType: row.device_type || 'Desktop',
    device_details: row.device_details,
    deviceDetails: row.device_details,
    ip_address: row.ip_address || '127.0.0.1',
    ipAddress: row.ip_address || '127.0.0.1',
    location: {
      latitude: Number(row.latitude || -23.561684),
      longitude: Number(row.longitude || -46.655981),
      accuracyMeters: Number(row.accuracy_meters || 15),
      approximateAddress: row.approximate_address || 'São Paulo, SP (Aprox. 15m)',
      city: row.city || 'São Paulo',
      state: row.state || 'SP',
      country: row.country || 'Brasil',
      ipAddress: row.ip_address || '127.0.0.1',
      source: 'GPS_SATELLITE',
      isApproximate: false
    }
  };
}

export const pontoRepository = {
  async findAll(limit: number = 1000, options: { userId?: string; name?: string; month?: string; date?: string } = {}): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.userId) {
      params.push(options.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (options.name) {
      params.push(options.name);
      conditions.push(`LOWER(collaborator_name) = LOWER($${params.length})`);
    }
    if (options.date) {
      params.push(options.date);
      conditions.push(`punch_date = $${params.length}`);
    }
    if (options.month) {
      const parts = options.month.split('/');
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        params.push(y);
        conditions.push(`EXTRACT(YEAR FROM punch_date) = $${params.length}`);
        params.push(m);
        conditions.push(`EXTRACT(MONTH FROM punch_date) = $${params.length}`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);
    const limitClause = `LIMIT $${params.length}`;

    const res = await query(`
      SELECT * FROM ponto_records
      ${whereClause}
      ORDER BY unix_timestamp DESC
      ${limitClause};
    `, params);
    return res.rows.map(formatRow);
  },

  async findByUserId(userId: string, limit: number = 500): Promise<any[]> {
    const res = await query(`
      SELECT * FROM ponto_records
      WHERE user_id = $1
      ORDER BY unix_timestamp DESC
      LIMIT $2;
    `, [userId, limit]);
    return res.rows.map(formatRow);
  },

  async findByCollaboratorName(name: string, limit: number = 500): Promise<any[]> {
    const res = await query(`
      SELECT * FROM ponto_records
      WHERE LOWER(collaborator_name) = LOWER($1)
      ORDER BY unix_timestamp DESC
      LIMIT $2;
    `, [name, limit]);
    return res.rows.map(formatRow);
  },

  async findByDateRange(startDate: string, endDate: string): Promise<any[]> {
    const res = await query(`
      SELECT * FROM ponto_records
      WHERE punch_date >= $1 AND punch_date <= $2
      ORDER BY unix_timestamp ASC;
    `, [startDate, endDate]);
    return res.rows.map(formatRow);
  },

  async seedMonthPunches(targetUserId?: string, targetMonth?: string): Promise<{ inserted: number }> {
    let usersQuery = 'SELECT id, name, sector_name FROM users';
    const params: any[] = [];
    if (targetUserId) {
      usersQuery += ' WHERE id = $1';
      params.push(targetUserId);
    }
    const uRes = await query(usersQuery, params);
    const users = uRes.rows;
    if (users.length === 0) return { inserted: 0 };

    let monthNum = 10;
    let yearNum = 2026;
    if (targetMonth) {
      const parts = targetMonth.split('/');
      if (parts.length === 2) {
        monthNum = parseInt(parts[0], 10);
        yearNum = parseInt(parts[1], 10);
      }
    }

    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    let insertedCount = 0;

    for (const u of users) {
      const existRes = await query('SELECT punch_date, count(*) FROM ponto_records WHERE user_id = $1 GROUP BY punch_date', [u.id]);
      const existingFullDays = new Set(
        existRes.rows.filter((r: any) => parseInt(r.count || '0', 10) >= 4).map((r: any) => {
          if (r.punch_date instanceof Date) return r.punch_date.toISOString().split('T')[0];
          return String(r.punch_date).split('T')[0];
        })
      );

      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(yearNum, monthNum - 1, day);
        const dow = dateObj.getDay();
        if (dow === 0 || dow === 6) continue;

        const dateIso = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (existingFullDays.has(dateIso)) continue;

        const randMin = (baseH: number, baseM: number, spread: number) => {
          const delta = Math.floor(Math.random() * (spread * 2 + 1)) - spread;
          const totalM = baseH * 60 + baseM + delta;
          const h = Math.floor(totalM / 60);
          const m = totalM % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        };

        const tEntrada = randMin(8, 0, 4);
        const tIntervalo = randMin(12, 0, 3);
        const tRetorno = randMin(13, 0, 3);
        const tSaida = randMin(18, 0, 5);

        const punches = [
          { type: 'ENTRADA', time: tEntrada },
          { type: 'INICIO_INTERVALO', time: tIntervalo },
          { type: 'RETORNO', time: tRetorno },
          { type: 'SAIDA', time: tSaida }
        ];

        for (let i = 0; i < punches.length; i++) {
          const p = punches[i];
          const timeParts = p.time.split(':');
          const punchTimestamp = new Date(yearNum, monthNum - 1, day, parseInt(timeParts[0], 10), parseInt(timeParts[1], 10)).getTime();
          const nsr = `NSR-${yearNum}-${String(day).padStart(2, '0')}${String(monthNum).padStart(2, '0')}-${u.id.slice(-4)}-${i + 1}-${Math.floor(Math.random() * 90000 + 10000)}`;
          const id = `pnt-${punchTimestamp}-${Math.random().toString(36).slice(2, 7)}`;
          const hash = `SHA256_PG_${nsr}_${punchTimestamp}`;

          await query(`
            INSERT INTO ponto_records (
              id, nsr, user_id, collaborator_name, collaborator_sector,
              type, punch_date, punch_time, unix_timestamp,
              biometric_match_confidence, sha256_hash, device_type, ip_address,
              latitude, longitude, city, state, approximate_address
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              99.4, $10, 'Terminal Biométrico Facial', '189.40.12.98',
              -23.561684, -46.655981, 'São Paulo', 'SP', 'Sede Matriz GIHS - São Paulo'
            )
            ON CONFLICT (nsr) DO NOTHING;
          `, [
            id, nsr, u.id, u.name, u.sector_name || 'Geral',
            p.type, dateIso, p.time, punchTimestamp, hash
          ]);
          insertedCount++;
        }
      }
    }

    return { inserted: insertedCount };
  },

  async create(record: any): Promise<any> {
    let normalizedType = record.type || 'ENTRADA';
    if (normalizedType === 'INÍCIO DO INTERVALO' || normalizedType === 'INICIO DO INTERVALO') {
      normalizedType = 'INICIO_INTERVALO';
    } else if (normalizedType === 'SAÍDA') {
      normalizedType = 'SAIDA';
    }

    // 1. Garantir integridade de usuário no PostgreSQL
    let userId = record.user_id || record.collaboratorId;
    const colabName = record.collaborator_name || record.collaboratorName || 'Colaborador';
    const sectorName = record.collaborator_sector || record.collaboratorSector || 'Geral';

    if (userId) {
      const uRes = await query('SELECT id FROM users WHERE id = $1', [userId]);
      if (uRes.rows.length === 0) {
        const byName = await query('SELECT id FROM users WHERE LOWER(name) = LOWER($1)', [colabName]);
        if (byName.rows.length > 0) {
          userId = byName.rows[0].id;
        } else {
          const email = `${colabName.toLowerCase().replace(/\s+/g, '.')}@bycomp.com.br`;
          await query(`
            INSERT INTO users (id, name, email, role, user_role, sector_name)
            VALUES ($1, $2, $3, $4, 'COLABORADOR', $5)
            ON CONFLICT (id) DO NOTHING;
          `, [userId, colabName, email, 'Colaborador', sectorName]);
        }
      }
    } else {
      const firstUser = await query('SELECT id FROM users LIMIT 1');
      userId = firstUser.rows[0]?.id || 'colab-1';
    }

    // 2. Normalizar data para ISO YYYY-MM-DD
    let normalizedDate = record.punch_date || record.date;
    if (!normalizedDate) {
      normalizedDate = new Date().toISOString().split('T')[0];
    } else if (normalizedDate.includes('/')) {
      const parts = normalizedDate.split('/');
      if (parts.length === 3) {
        normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    // 3. Normalizar hora
    let normalizedTime = record.punch_time || record.time;
    if (!normalizedTime) {
      normalizedTime = new Date().toTimeString().split(' ')[0];
    }

    const loc = record.location || {};

    const res = await query(`
      INSERT INTO ponto_records (
        id, nsr, user_id, collaborator_name, collaborator_sector,
        type, punch_date, punch_time, unix_timestamp,
        photo_url, biometric_match_confidence, sha256_hash,
        device_type, device_details, ip_address,
        latitude, longitude, accuracy_meters, approximate_address, city, state
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19, $20, $21
      )
      RETURNING *;
    `, [
      record.id || `ponto-${Date.now()}`,
      record.nsr || `NSR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      userId,
      colabName,
      sectorName,
      normalizedType,
      normalizedDate,
      normalizedTime,
      record.unix_timestamp || record.timestamp || Date.now(),
      record.photo_url || record.photoUrl || null,
      record.biometric_match_confidence || record.biometricMatchConfidence || 99.4,
      record.sha256_hash || record.sha256Hash || 'SHA256_POSTGRES_VERIFIED',
      record.device_type || record.deviceType || 'Desktop',
      record.device_details || record.deviceDetails || null,
      record.ip_address || record.ipAddress || loc.ipAddress || '127.0.0.1',
      loc.latitude || record.latitude || null,
      loc.longitude || record.longitude || null,
      loc.accuracyMeters || record.accuracy_meters || null,
      loc.approximateAddress || record.approximate_address || null,
      loc.city || record.city || 'São Paulo',
      loc.state || record.state || 'SP'
    ]);

    return formatRow(res.rows[0]);
  }
};
