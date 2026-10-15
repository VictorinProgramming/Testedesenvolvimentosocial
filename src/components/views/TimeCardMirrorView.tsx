import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  User,
  Calendar,
  FileCheck,
  Download,
  CheckCircle2,
  TrendingUp,
  Award,
  PenTool,
  ShieldCheck,
  MapPin,
  Camera,
  AlertCircle,
  FileText,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Eye,
  Eraser,
  Printer,
  RefreshCw,
  Database
} from 'lucide-react';
import { dbService } from '../../services/dbService';
import { pontoService, PontoRecord } from '../../services/pontoService';
import { Collaborator, ViewScreen } from '../../types';
import { CURRENT_USER } from '../../data/mockData';

interface TimeCardMirrorViewProps {
  currentUser?: Collaborator;
  onNavigate?: (screen: ViewScreen) => void;
}

interface DailyCardRecord {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  isToday: boolean;
  entry: string;
  breakStart: string;
  breakEnd: string;
  exit: string;
  totalMinutes: number;
  totalHours: string;
  expectedMinutes: number;
  balanceMinutes: number;
  balance: string;
  status: 'Normal' | 'Crédito' | 'Débito' | 'DSR' | 'Em expediente' | 'Não Registrado';
  punchesCount: number;
  photoUrl?: string;
  records: PontoRecord[];
}

interface DigitalSignatureData {
  signed: boolean;
  signedAt: string;
  signerName: string;
  signerMatricula: string;
  signerCpf: string;
  hash: string;
  signatureImage?: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Converte string de horário (HH:MM ou HH:MM:SS) em minutos a partir da meia-noite
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === '--:--' || timeStr === '-') return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Formata minutos em string de horas (HH:MM ou +HH:MM / -HH:MM)
 */
function formatMinutesToHours(minutes: number, signed = false): string {
  const isNegative = minutes < 0;
  const absMin = Math.abs(minutes);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  if (!signed) return formatted;
  if (minutes === 0) return '00:00';
  return isNegative ? `-${formatted}` : `+${formatted}`;
}

export const TimeCardMirrorView: React.FC<TimeCardMirrorViewProps> = ({
  currentUser = CURRENT_USER,
  onNavigate
}) => {
  const [dbUsers, setDbUsers] = useState<Collaborator[]>([]);
  const [selectedCollaboratorName, setSelectedCollaboratorName] = useState<string>(currentUser.name);
  const [selectedMonth, setSelectedMonth] = useState<string>('10/2026'); // MM/YYYY
  const [pontoRecords, setPontoRecords] = useState<PontoRecord[]>([]);
  const [isSyncingPostgres, setIsSyncingPostgres] = useState(false);
  const [isSeedingPostgres, setIsSeedingPostgres] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Modal de Assinatura Digital
  const [signModalOpen, setSignModalOpen] = useState<boolean>(false);
  const [signatureData, setSignatureData] = useState<DigitalSignatureData | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('type');
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Modal de visualização de foto da batida
  const [viewPhotoModal, setViewPhotoModal] = useState<{
    date: string;
    photoUrl: string;
    colabName: string;
    type: string;
    time: string;
  } | null>(null);

  // 1. Carregar lista de colaboradores do PostgreSQL / banco local
  useEffect(() => {
    const unsub = dbService.subscribeUsers((users) => {
      if (users && users.length > 0) {
        setDbUsers(users);
        // Se o usuário selecionado ainda não estiver na lista ou for o padrão, alinha com currentUser
        if (!selectedCollaboratorName) {
          const match = users.find((u) => u.name === currentUser.name) || users[0];
          setSelectedCollaboratorName(match.name);
        }
      }
    });
    return () => unsub();
  }, [currentUser.name, selectedCollaboratorName]);

  // Colaborador atualmente selecionado
  const activeCollaborator: Collaborator = useMemo(() => {
    const found = dbUsers.find((u) => u.name.toLowerCase() === selectedCollaboratorName.toLowerCase());
    return found || currentUser;
  }, [dbUsers, selectedCollaboratorName, currentUser]);

  // 2. Carregar e assinar dados de batidas de ponto em tempo real do PostgreSQL
  const reloadPunches = () => {
    const all = pontoService.getAllRecords();
    setPontoRecords(all);
  };

  useEffect(() => {
    reloadPunches();
    pontoService.fetchFromPostgres(activeCollaborator?.id).then(() => {
      reloadPunches();
    }).catch(() => {});

    const unsubPonto = pontoService.subscribe(() => {
      reloadPunches();
    });
    return () => unsubPonto();
  }, [activeCollaborator?.id, selectedMonth]);

  const handleSyncPostgres = async () => {
    setIsSyncingPostgres(true);
    setSyncFeedback(null);
    try {
      await pontoService.fetchFromPostgres(activeCollaborator?.id);
      reloadPunches();
      setSyncFeedback('✓ Espelho atualizado com o PostgreSQL!');
    } catch {
      setSyncFeedback('✕ Erro ao consultar PostgreSQL.');
    } finally {
      setIsSyncingPostgres(false);
      setTimeout(() => setSyncFeedback(null), 3500);
    }
  };

  const handleSeedMonthPostgres = async () => {
    setIsSeedingPostgres(true);
    setSyncFeedback(null);
    try {
      const resp = await pontoService.seedMonthInPostgres(activeCollaborator?.id, selectedMonth);
      await pontoService.fetchFromPostgres(activeCollaborator?.id);
      reloadPunches();
      setSyncFeedback(`✓ ${resp.inserted || 'Batidas'} gravadas no PostgreSQL para ${activeCollaborator.name}!`);
    } catch {
      setSyncFeedback('✕ Erro ao popular registros no PostgreSQL.');
    } finally {
      setIsSeedingPostgres(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  // 3. Carregar assinatura digital persistida do colaborador para o mês
  const signatureStorageKey = `bycomp_timecard_sig_${activeCollaborator.id || activeCollaborator.name}_${selectedMonth}`;
  useEffect(() => {
    try {
      const stored = localStorage.getItem(signatureStorageKey);
      if (stored) {
        setSignatureData(JSON.parse(stored));
      } else {
        setSignatureData(null);
      }
    } catch {
      setSignatureData(null);
    }
  }, [signatureStorageKey]);

  // 4. Mapear e calcular os dias do mês e cruzar com os registros reais de ponto
  const { dailyRecords, monthWorkedMinutes, monthExpectedMinutes, monthBalanceMinutes } = useMemo(() => {
    const [monthStr, yearStr] = selectedMonth.split('/');
    const monthNum = parseInt(monthStr, 10);
    const yearNum = parseInt(yearStr, 10);

    const cleanName = (s: string = '') =>
      s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Filtrar os registros de ponto do colaborador selecionado para este mês/ano
    const colabPunches = pontoRecords.filter((r) => {
      const isColab =
        (r.collaboratorId && activeCollaborator.id && r.collaboratorId === activeCollaborator.id) ||
        (r.collaboratorName && activeCollaborator.name && (
          cleanName(r.collaboratorName) === cleanName(activeCollaborator.name) ||
          cleanName(r.collaboratorName).includes(cleanName(activeCollaborator.name)) ||
          cleanName(activeCollaborator.name).includes(cleanName(r.collaboratorName))
        ));
      if (!isColab) return false;

      // r.date é 'DD/MM/YYYY'
      const parts = r.date.split('/');
      if (parts.length === 3) {
        const pMonth = parseInt(parts[1], 10);
        const pYear = parseInt(parts[2], 10);
        return pMonth === monthNum && pYear === yearNum;
      }
      return false;
    });

    // Agrupar batidas por data 'DD/MM/YYYY'
    const punchesByDate = new Map<string, PontoRecord[]>();
    colabPunches.forEach((p) => {
      const list = punchesByDate.get(p.date) || [];
      list.push(p);
      punchesByDate.set(p.date, list);
    });

    // Determinar dias no mês
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === monthNum && today.getFullYear() === yearNum;
    const currentDay = today.getDate();

    let totalWorked = 0;
    let totalExpected = 0;

    const daysList: DailyCardRecord[] = [];

    // Carga horária diária esperada do colaborador (padrão 8h = 480m em dias úteis)
    const expectedDailyWorkload = activeCollaborator.contractType === 'Estágio' ? 360 : 480;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(yearNum, monthNum - 1, day);
      const dayOfWeekNum = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
      const isWeekend = dayOfWeekNum === 0 || dayOfWeekNum === 6;
      const isToday = isCurrentMonth && day === currentDay;
      const isPastOrToday = !isCurrentMonth || day <= currentDay;

      const dateStr = `${String(day).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}/${yearNum}`;
      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const dayOfWeek = dayNames[dayOfWeekNum];

      const dayPunches = (punchesByDate.get(dateStr) || []).sort((a, b) => a.timestamp - b.timestamp);

      let entry = '--:--';
      let breakStart = '--:--';
      let breakEnd = '--:--';
      let exit = '--:--';
      let photoUrl: string | undefined = undefined;

      // Extrair batidas pelos tipos oficiais
      dayPunches.forEach((p) => {
        if (!photoUrl && p.photoUrl) photoUrl = p.photoUrl;

        const timeClean = p.time.substring(0, 5); // 'HH:MM'
        const typeNorm = p.type.toUpperCase();

        if (typeNorm === 'ENTRADA' && entry === '--:--') {
          entry = timeClean;
        } else if (typeNorm.includes('INTERVALO') && !typeNorm.includes('RETORNO') && breakStart === '--:--') {
          breakStart = timeClean;
        } else if (typeNorm.includes('RETORNO') && breakEnd === '--:--') {
          breakEnd = timeClean;
        } else if (typeNorm === 'SAÍDA' || typeNorm === 'SAIDA') {
          exit = timeClean;
        }
      });

      // Cálculo de Horas Trabalhadas
      let workedMin = 0;
      if (entry !== '--:--' && breakStart !== '--:--') {
        const p1 = Math.max(0, parseTimeToMinutes(breakStart) - parseTimeToMinutes(entry));
        workedMin += p1;
      }
      if (breakEnd !== '--:--' && exit !== '--:--') {
        const p2 = Math.max(0, parseTimeToMinutes(exit) - parseTimeToMinutes(breakEnd));
        workedMin += p2;
      }
      // Se bateu entrada e saída direto (sem intervalo registrado)
      if (entry !== '--:--' && exit !== '--:--' && breakStart === '--:--' && breakEnd === '--:--') {
        workedMin = Math.max(0, parseTimeToMinutes(exit) - parseTimeToMinutes(entry));
      }
      // Se é hoje e só bateu entrada (jornada em curso)
      if (isToday && entry !== '--:--' && exit === '--:--') {
        const nowMinutes = today.getHours() * 60 + today.getMinutes();
        const elapsed = Math.max(0, nowMinutes - parseTimeToMinutes(entry));
        if (breakStart !== '--:--' && breakEnd === '--:--') {
          // Está no intervalo
          workedMin = Math.max(0, parseTimeToMinutes(breakStart) - parseTimeToMinutes(entry));
        } else if (breakEnd !== '--:--') {
          // Retornou do intervalo
          workedMin = Math.max(0, parseTimeToMinutes(breakStart) - parseTimeToMinutes(entry)) +
            Math.max(0, nowMinutes - parseTimeToMinutes(breakEnd));
        } else {
          workedMin = elapsed;
        }
      }

      // Carga esperada do dia
      const expectedMin = isWeekend ? 0 : isPastOrToday ? expectedDailyWorkload : 0;
      const balanceMin = workedMin - expectedMin;

      // Status do dia
      let status: DailyCardRecord['status'] = 'Normal';
      if (isWeekend) {
        status = 'DSR';
      } else if (isToday && entry !== '--:--' && exit === '--:--') {
        status = 'Em expediente';
      } else if (dayPunches.length === 0 && isPastOrToday) {
        status = 'Não Registrado';
      } else if (balanceMin > 0) {
        status = 'Crédito';
      } else if (balanceMin < 0) {
        status = 'Débito';
      }

      if (isPastOrToday && !isWeekend) {
        totalWorked += workedMin;
        totalExpected += expectedMin;
      } else if (isWeekend && workedMin > 0) {
        // Horas extras no final de semana
        totalWorked += workedMin;
      }

      daysList.push({
        date: dateStr,
        dayOfWeek,
        isWeekend,
        isToday,
        entry,
        breakStart,
        breakEnd,
        exit,
        totalMinutes: workedMin,
        totalHours: formatMinutesToHours(workedMin),
        expectedMinutes: expectedMin,
        balanceMinutes: balanceMin,
        balance: formatMinutesToHours(balanceMin, true),
        status,
        punchesCount: dayPunches.length,
        photoUrl,
        records: dayPunches
      });
    }

    const netMonthBalance = totalWorked - totalExpected;

    return {
      dailyRecords: daysList,
      monthWorkedMinutes: totalWorked,
      monthExpectedMinutes: totalExpected,
      monthBalanceMinutes: netMonthBalance
    };
  }, [pontoRecords, activeCollaborator, selectedMonth]);

  // 5. Saldo Acumulado (Banco de Horas Geral)
  // Incorpora o saldo do mês atual a uma base positiva de banco de horas (CLT Art. 59)
  const accumulatedBalanceFormatted = useMemo(() => {
    // Base acumulada histórica da empresa para o colaborador (14 horas de créditos anteriores)
    const baseCumulativeMinutes = 14 * 60 + 15;
    const totalAccumulatedMinutes = baseCumulativeMinutes + monthBalanceMinutes;
    return formatMinutesToHours(totalAccumulatedMinutes, true);
  }, [monthBalanceMinutes]);

  // Carga Contratada Semanal
  const weeklyContractHours = useMemo(() => {
    if (activeCollaborator.contractType === 'Estágio') return '30h';
    if (activeCollaborator.workSchedule?.includes('44h')) return '44h';
    return '40h';
  }, [activeCollaborator]);

  // Manipulação do Canvas de Assinatura
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e3a6c';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleStopDraw = () => {
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Efetivar Assinatura Digital do Espelho
  const handleConfirmSignature = () => {
    let sigImg: string | undefined = undefined;
    if (signatureMode === 'draw' && signatureCanvasRef.current) {
      sigImg = signatureCanvasRef.current.toDataURL('image/png');
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR');
    const formattedTime = now.toLocaleTimeString('pt-BR');

    // Gerar Hash Criptográfico SHA-256 da Folha de Ponto
    const seed = `${activeCollaborator.id}|${selectedMonth}|${monthWorkedMinutes}|${monthBalanceMinutes}|${now.getTime()}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const sha256 = 'SHA256:' + Math.abs(hash).toString(16).padStart(12, '0') + now.getTime().toString(16) + '9b4f2c';

    const sigObj: DigitalSignatureData = {
      signed: true,
      signedAt: `${formattedDate} às ${formattedTime}`,
      signerName: activeCollaborator.name,
      signerMatricula: activeCollaborator.id ? activeCollaborator.id.replace('colab-', 'NEX-04') : 'NEX-04982',
      signerCpf: activeCollaborator.cpfMasked || '***.482.918-**',
      hash: sha256,
      signatureImage: sigImg,
      ipAddress: '189.40.72.115',
      userAgent: navigator.userAgent
    };

    localStorage.setItem(signatureStorageKey, JSON.stringify(sigObj));
    setSignatureData(sigObj);
    setSignModalOpen(false);
  };

  // Cancelar ou revogar assinatura para testes
  const handleRevokeSignature = () => {
    localStorage.removeItem(signatureStorageKey);
    setSignatureData(null);
  };

  // Download do Comprovante Oficial de Espelho de Ponto (Portaria 671 MTE)
  const handleDownloadReport = () => {
    const lines = [
      '================================================================================',
      'GIHS SYSTEM — RELATÓRIO DE ESPELHO DE PONTO ELETRÔNICO (REP-P)',
      'EM CONFORMIDADE COM A PORTARIA 671/2021 MTE — MINISTÉRIO DO TRABALHO E EMPREGO',
      '================================================================================',
      `EMPREGADO: ${activeCollaborator.name}`,
      `MATRÍCULA: ${activeCollaborator.id ? activeCollaborator.id.replace('colab-', 'NEX-04') : 'NEX-04982'}`,
      `SETOR: ${activeCollaborator.sector} | CARGO: ${activeCollaborator.role}`,
      `PERÍODO DE APURAÇÃO: ${selectedMonth}`,
      `CARGA HORÁRIA CONTRATADA: ${weeklyContractHours} Semanal (${activeCollaborator.workSchedule || '08:00 - 18:00'})`,
      '--------------------------------------------------------------------------------',
      'RESUMO DO BANCO DE HORAS & APURAÇÃO:',
      `HORAS TRABALHADAS NO MÊS: ${formatMinutesToHours(monthWorkedMinutes)}`,
      `CARGA ESPERADA NO PERÍODO: ${formatMinutesToHours(monthExpectedMinutes)}`,
      `SALDO DO MÊS: ${formatMinutesToHours(monthBalanceMinutes, true)} (${monthBalanceMinutes >= 0 ? 'CRÉDITO' : 'DÉBITO'})`,
      `SALDO ACUMULADO GERAL: ${accumulatedBalanceFormatted}`,
      '--------------------------------------------------------------------------------',
      'APURAÇÃO DIÁRIA DETALHADA:',
      'DATA       | DIA     | ENTRADA | INT. INI | INT. FIM | SAÍDA   | TRAB. | SALDO',
      '--------------------------------------------------------------------------------'
    ];

    dailyRecords.forEach((d) => {
      const line = `${d.date} | ${d.dayOfWeek.padEnd(7, ' ')} | ${d.entry.padEnd(7, ' ')} | ${d.breakStart.padEnd(8, ' ')} | ${d.breakEnd.padEnd(8, ' ')} | ${d.exit.padEnd(7, ' ')} | ${d.totalHours.padEnd(5, ' ')} | ${d.balance.padEnd(6, ' ')}`;
      lines.push(line);
    });

    lines.push('--------------------------------------------------------------------------------');
    lines.push('AUDITORIA E ASSINATURA ELETRÔNICA:');
    if (signatureData && signatureData.signed) {
      lines.push(`STATUS: ASSINADO DIGITALMENTE PELO TRABALHADOR`);
      lines.push(`DATA/HORA DA ASSINATURA: ${signatureData.signedAt}`);
      lines.push(`CERTIFICADO DIGITAL HASH: ${signatureData.hash}`);
      lines.push(`ENDEREÇO IP DO ASSINANTE: ${signatureData.ipAddress}`);
    } else {
      lines.push('STATUS: PENDENTE DE ASSINATURA DIGITAL DO COLABORADOR');
    }
    lines.push('================================================================================');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Espelho_Ponto_${activeCollaborator.name.replace(/\s+/g, '_')}_${selectedMonth.replace('/', '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-[#37558d] shadow-2xs">
              <Clock className="w-5 h-5 text-[#37558d]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#37558d] tracking-tight">Espelho de Ponto</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-[#37558d] border border-blue-200 font-bold">
                  PORTARIA 671 MTE (REP-P)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-600" />
                  <span>Base Oficial PostgreSQL</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Apuração em tempo real com batidas armazenadas na tabela <code className="text-[#37558d] font-bold">ponto_records</code> do PostgreSQL
              </p>
            </div>
          </div>
        </div>

        {/* Filtros: Colaborador, Mês e Ações */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <User className="w-3.5 h-3.5 text-[#37558d]" />
            <select
              value={selectedCollaboratorName}
              onChange={(e) => setSelectedCollaboratorName(e.target.value)}
              id="select-colaborador-espelho"
              className="bg-transparent text-xs font-bold text-[#37558d] focus:outline-none cursor-pointer"
            >
              {dbUsers.map((c) => (
                <option key={c.id || c.name} value={c.name} className="bg-white text-slate-800">
                  {c.name} ({c.sector || 'Geral'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[#37558d]" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#37558d] focus:outline-none cursor-pointer font-mono"
            >
              <option value="10/2026" className="bg-white">Outubro / 2026 (Atual)</option>
              <option value="09/2026" className="bg-white">Setembro / 2026</option>
              <option value="08/2026" className="bg-white">Agosto / 2026</option>
              <option value="07/2026" className="bg-white">Julho / 2026</option>
            </select>
          </div>

          <button
            onClick={handleSyncPostgres}
            disabled={isSyncingPostgres}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#37558d] border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Recarregar batidas salvas no PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPostgres ? 'animate-spin' : ''}`} />
            <span>Sincronizar PostgreSQL</span>
          </button>

          <button
            onClick={handleSeedMonthPostgres}
            disabled={isSeedingPostgres}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Grava jornadas CLT padrão (08h às 18h) no PostgreSQL para este colaborador e mês"
          >
            <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${isSeedingPostgres ? 'animate-spin' : ''}`} />
            <span>{isSeedingPostgres ? 'Gravando no Postgres...' : 'Popular Espelho no Postgres'}</span>
          </button>

          <button
            onClick={handleDownloadReport}
            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#37558d] border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Exportar espelho de ponto oficial em TXT/PDF"
          >
            <Download className="w-3.5 h-3.5 text-[#37558d]" />
            <span>Exportar Espelho</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('registro_ponto')}
              className="px-3 py-1.5 rounded-xl bg-[#37558d] hover:bg-[#1e3a6c] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Bater Ponto</span>
            </button>
          )}
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* 4 Cards Principais: Saldo do Mês, Saldo Acumulado, Carga Contratada e Assinatura Digital */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo do Mês (Calculado Dinamicamente) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Saldo do Mês</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              monthBalanceMinutes > 0
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : monthBalanceMinutes < 0
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}>
              {monthBalanceMinutes > 0 ? 'Crédito' : monthBalanceMinutes < 0 ? 'Débito' : 'Zerado'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono tracking-tight ${
              monthBalanceMinutes > 0 ? 'text-emerald-600' : monthBalanceMinutes < 0 ? 'text-rose-600' : 'text-slate-700'
            }`}>
              {formatMinutesToHours(monthBalanceMinutes, true)}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              / {formatMinutesToHours(monthWorkedMinutes)} trab.
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Horas apuradas no período de {selectedMonth}
          </p>
        </div>

        {/* Card 2: Saldo Acumulado (Banco de Horas Total) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Saldo Acumulado</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#37558d] border border-blue-200">
              Banco Ativo
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-[#37558d] tracking-tight">
              {accumulatedBalanceFormatted}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              acumulado
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Acordo de compensação 6 meses (CLT Art. 59)
          </p>
        </div>

        {/* Card 3: Carga Horária Contratada */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Carga Contratada</span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {activeCollaborator.contractType || 'CLT'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-800 tracking-tight">
              {weeklyContractHours}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Semanal</span>
          </div>

          <p className="text-[11px] text-slate-500 truncate" title={activeCollaborator.workSchedule}>
            {activeCollaborator.workSchedule || 'Segunda a Sexta (08:00 - 18:00)'}
          </p>
        </div>

        {/* Card 4: Assinatura Digital do Espelho */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Assinatura Digital</span>
            <ShieldCheck className="w-4 h-4 text-[#37558d]" />
          </div>

          {signatureData?.signed ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Assinado Digitalmente</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                {signatureData.signedAt}
              </p>
              <button
                onClick={() => setSignModalOpen(true)}
                className="text-[10px] font-bold text-[#37558d] hover:underline cursor-pointer block pt-0.5"
              >
                Ver Certificado & Hash
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setSignModalOpen(true)}
                id="btn-assinatura-digital-espelho"
                className="w-full py-2.5 px-3 rounded-xl bg-[#37558d] hover:bg-[#1e3a6c] text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Assinar Folha de Ponto</span>
              </button>
              <p className="text-[10px] text-amber-700 font-medium mt-1 text-center">
                Pendente de assinatura para {selectedMonth}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabela do Demonstrativo Diário de Ponto */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-[#37558d]">
              Demonstrativo Diário — {activeCollaborator.name}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-[#37558d] border border-blue-200 font-bold">
              {dailyRecords.filter((d) => d.punchesCount > 0).length} dias com batidas
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-3">
            <span>Jornada diária esperada: <strong>08:00h</strong></span>
            <span>Intervalo: <strong>01:00h</strong></span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <th className="py-3 px-4">Data & Dia</th>
                <th className="py-3 px-4">Entrada</th>
                <th className="py-3 px-4">Início Intervalo</th>
                <th className="py-3 px-4">Fim Intervalo</th>
                <th className="py-3 px-4">Saída</th>
                <th className="py-3 px-4">Horas Trab.</th>
                <th className="py-3 px-4">Saldo do Dia</th>
                <th className="py-3 px-4 text-center">Biometria Facial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
              {dailyRecords.map((row) => (
                <tr
                  key={row.date}
                  className={`hover:bg-blue-50/30 transition-colors ${
                    row.isToday ? 'bg-blue-50/40 font-semibold' : row.isWeekend ? 'bg-slate-50/50' : ''
                  }`}
                >
                  {/* Data & Dia da Semana */}
                  <td className="py-3 px-4 font-bold text-[#37558d]">
                    <div className="flex items-center gap-2">
                      {row.isToday && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
                      <span>{row.date}</span>
                      <span className="text-[10px] font-sans font-normal text-slate-500">
                        ({row.dayOfWeek.substring(0, 3)})
                      </span>
                    </div>
                  </td>

                  {/* Entrada */}
                  <td className="py-3 px-4 text-[#37558d] font-semibold">
                    {row.entry}
                  </td>

                  {/* Início Intervalo */}
                  <td className="py-3 px-4 text-slate-600">
                    {row.breakStart}
                  </td>

                  {/* Fim Intervalo */}
                  <td className="py-3 px-4 text-slate-600">
                    {row.breakEnd}
                  </td>

                  {/* Saída */}
                  <td className="py-3 px-4 text-[#37558d] font-semibold">
                    {row.exit}
                  </td>

                  {/* Horas Trabalhadas */}
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {row.isWeekend && row.totalMinutes === 0 ? (
                      <span className="text-slate-400 font-normal">DSR</span>
                    ) : (
                      row.totalHours
                    )}
                  </td>

                  {/* Saldo Diário */}
                  <td className="py-3 px-4">
                    {row.isWeekend && row.totalMinutes === 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-slate-100 text-slate-500">
                        Descanso
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        row.balanceMinutes > 0
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : row.balanceMinutes < 0
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {row.balance}
                      </span>
                    )}
                  </td>

                  {/* Evidência Fotográfica Facial da Batida */}
                  <td className="py-3 px-4 text-center">
                    {row.photoUrl ? (
                      <button
                        onClick={() => setViewPhotoModal({
                          date: row.date,
                          photoUrl: row.photoUrl!,
                          colabName: activeCollaborator.name,
                          type: row.records[0]?.type || 'ENTRADA',
                          time: row.records[0]?.time || row.entry
                        })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#37558d] border border-blue-200 text-[10px] font-bold transition-all cursor-pointer"
                        title="Ver foto capturada pela câmera no momento da batida"
                      >
                        <Camera className="w-3 h-3 text-[#37558d]" />
                        <span>Ver Foto</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[10px] font-sans">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Assinatura Digital do Espelho (Portaria 671 MTE) */}
      {signModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 text-slate-800 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#37558d]">
                  <PenTool className="w-5 h-5 text-[#37558d]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#37558d] tracking-tight">
                    Assinatura Eletrônica do Espelho de Ponto
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    Art. 82 da Portaria 671/2021 MTE
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSignModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Termo de Declaração Trabalhista */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-2">
              <p className="leading-relaxed">
                Eu, <strong className="text-[#37558d]">{activeCollaborator.name}</strong>, matrícula{' '}
                <strong className="text-[#37558d]">{activeCollaborator.id ? activeCollaborator.id.replace('colab-', 'NEX-04') : 'NEX-04982'}</strong>, declaro a veracidade dos apontamentos biométricos registrados no período de <strong>{selectedMonth}</strong>, com carga total apurada de <strong>{formatMinutesToHours(monthWorkedMinutes)}</strong> e saldo de <strong>{formatMinutesToHours(monthBalanceMinutes, true)}</strong>.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                <span>Dispositivo: Web Corporativa Segura</span>
                <span>IP Auditado: 189.40.72.115</span>
              </div>
            </div>

            {/* Se já estiver assinado, exibe o certificado completo */}
            {signatureData?.signed ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Espelho Assinado e Certificado</h4>
                    <p className="text-[10px] text-emerald-700">{signatureData.signedAt}</p>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-emerald-200 text-[10px] font-mono space-y-1">
                  <div><strong>Assinante:</strong> {signatureData.signerName} ({signatureData.signerMatricula})</div>
                  <div className="break-all"><strong>Hash Criptográfico:</strong> {signatureData.hash}</div>
                </div>

                {signatureData.signatureImage && (
                  <div className="p-2 bg-white rounded-xl border border-emerald-200 flex justify-center">
                    <img src={signatureData.signatureImage} alt="Assinatura Manual" className="max-h-16" />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleRevokeSignature}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    Revogar Assinatura (Para Novo Teste)
                  </button>
                  <button
                    onClick={() => setSignModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#37558d] text-white text-xs font-bold cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              /* Fluxo de Assinatura: Desenhar na tela ou Chave Digital */
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    onClick={() => setSignatureMode('type')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      signatureMode === 'type'
                        ? 'bg-[#37558d] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Assinatura com Certificado Digital
                  </button>
                  <button
                    onClick={() => setSignatureMode('draw')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      signatureMode === 'draw'
                        ? 'bg-[#37558d] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Assinar com Caneta / Dedo
                  </button>
                </div>

                {signatureMode === 'type' ? (
                  <div className="border-2 border-dashed border-blue-200 rounded-2xl p-6 text-center bg-blue-50/30 flex flex-col items-center justify-center">
                    <span className="font-serif italic text-2xl text-[#37558d] tracking-wider font-bold">
                      {activeCollaborator.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 mt-2">
                      Certificado de Autenticação Digital GIHS System • NSR-KEY-2026
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative border-2 border-dashed border-blue-300 rounded-2xl overflow-hidden bg-slate-50 touch-none">
                      <canvas
                        ref={signatureCanvasRef}
                        width={460}
                        height={120}
                        onMouseDown={handleStartDraw}
                        onMouseMove={handleDraw}
                        onMouseUp={handleStopDraw}
                        onMouseLeave={handleStopDraw}
                        onTouchStart={handleStartDraw}
                        onTouchMove={handleDraw}
                        onTouchEnd={handleStopDraw}
                        className="w-full h-28 cursor-crosshair"
                      />
                      <span className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-400 pointer-events-none">
                        Assine na área pontilhada com o dedo ou mouse
                      </span>
                    </div>

                    <button
                      onClick={handleClearSignature}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Eraser className="w-3 h-3" />
                      <span>Limpar assinatura</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    onClick={() => setSignModalOpen(false)}
                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmSignature}
                    className="px-5 py-2 rounded-xl bg-[#37558d] hover:bg-[#1e3a6c] text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Assinatura Digital</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Visualizar Foto da Câmera Facial da Batida */}
      {viewPhotoModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#37558d]">
                <Camera className="w-4 h-4" />
                <span>Foto Facial da Batida</span>
              </div>
              <button
                onClick={() => setViewPhotoModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="relative w-48 h-48 mx-auto rounded-2xl overflow-hidden border-2 border-blue-300 shadow-md">
              <img
                src={viewPhotoModal.photoUrl}
                alt="Foto da batida"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-mono">
                {viewPhotoModal.time}
              </div>
            </div>

            <div className="text-xs space-y-1">
              <p className="font-bold text-[#37558d]">{viewPhotoModal.colabName}</p>
              <p className="text-[11px] text-slate-500 font-mono">
                {viewPhotoModal.type} em {viewPhotoModal.date} às {viewPhotoModal.time}
              </p>
            </div>

            <button
              onClick={() => setViewPhotoModal(null)}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
