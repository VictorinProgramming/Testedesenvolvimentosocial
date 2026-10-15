import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Clock,
  ShieldCheck,
  MapPin,
  Camera,
  Calendar,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Building,
  Globe,
  SlidersHorizontal,
  Info,
  Lock,
  Sparkles,
  Zap,
  HelpCircle
} from 'lucide-react';
import {
  pontoConfigService,
  PontoConfiguration,
  AuthorizedLocation,
  DEFAULT_PONTO_CONFIG
} from '../../../services/pontoConfigService';
import { Collaborator } from '../../../types';

interface PontoConfigPanelProps {
  currentUser?: Collaborator;
  onSaved?: () => void;
}

export const PontoConfigPanel: React.FC<PontoConfigPanelProps> = ({
  currentUser,
  onSaved
}) => {
  const [config, setConfig] = useState<PontoConfiguration>(pontoConfigService.getConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'all' | 'jornada' | 'tolerancias' | 'biometria' | 'cerca' | 'banco' | 'ajustes'>('all');

  // Estado para adicionar novo local autorizado
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newLocation, setNewLocation] = useState<Partial<AuthorizedLocation>>({
    name: '',
    address: '',
    latitude: -23.55052,
    longitude: -46.633308,
    radiusMeters: 150,
    isHeadquarters: false
  });

  // Estado para novo IP corporativo
  const [newIpInput, setNewIpInput] = useState('');

  useEffect(() => {
    // Carrega configuração atualizada do backend
    pontoConfigService.fetchFromBackend().then((loaded) => {
      setConfig(loaded);
    });

    const unsubscribe = pontoConfigService.subscribe((updated) => {
      setConfig(updated);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMessage(null);

    try {
      const result = await pontoConfigService.saveConfig(config, currentUser?.email || currentUser?.name);
      setSaveSuccessMessage(result.message || 'Configurações de ponto salvas com sucesso no PostgreSQL!');
      if (onSaved) onSaved();
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar configurações de ponto:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Deseja restaurar as configurações oficiais padrão da Portaria 671 MTE / CLT?')) {
      return;
    }
    setIsSaving(true);
    const restored = await pontoConfigService.resetToDefaults();
    setConfig(restored);
    setIsSaving(false);
    setSaveSuccessMessage('Parâmetros legais da Portaria 671 MTE restaurados com sucesso!');
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  const handleAddLocation = () => {
    if (!newLocation.name || !newLocation.address) return;
    const location: AuthorizedLocation = {
      id: `loc-${Date.now()}`,
      name: newLocation.name,
      address: newLocation.address,
      latitude: Number(newLocation.latitude) || -23.55052,
      longitude: Number(newLocation.longitude) || -46.633308,
      radiusMeters: Number(newLocation.radiusMeters) || 150,
      isHeadquarters: Boolean(newLocation.isHeadquarters)
    };

    const updatedLocations = [...config.geofencing.authorizedLocations, location];
    setConfig({
      ...config,
      geofencing: {
        ...config.geofencing,
        authorizedLocations: updatedLocations
      }
    });

    setNewLocation({
      name: '',
      address: '',
      latitude: -23.55052,
      longitude: -46.633308,
      radiusMeters: 150,
      isHeadquarters: false
    });
    setShowAddLocationModal(false);
  };

  const handleRemoveLocation = (id: string) => {
    const updated = config.geofencing.authorizedLocations.filter(l => l.id !== id);
    setConfig({
      ...config,
      geofencing: {
        ...config.geofencing,
        authorizedLocations: updated
      }
    });
  };

  const handleAddIp = () => {
    const ip = newIpInput.trim();
    if (!ip) return;
    if (config.geofencing.corporateIpWhitelist.includes(ip)) {
      setNewIpInput('');
      return;
    }
    setConfig({
      ...config,
      geofencing: {
        ...config.geofencing,
        corporateIpWhitelist: [...config.geofencing.corporateIpWhitelist, ip]
      }
    });
    setNewIpInput('');
  };

  const handleRemoveIp = (ipToRemove: string) => {
    setConfig({
      ...config,
      geofencing: {
        ...config.geofencing,
        corporateIpWhitelist: config.geofencing.corporateIpWhitelist.filter(ip => ip !== ipToRemove)
      }
    });
  };

  const toggleWorkDay = (day: string) => {
    const current = config.workSchedule.workDays || [];
    const nextDays = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    setConfig({
      ...config,
      workSchedule: {
        ...config.workSchedule,
        workDays: nextDays
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400 shadow-md">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Configuração & Parâmetros da Gestão de Ponto
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Portaria 671 MTE / CLT
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  REP-P Homologado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Regras de jornada, tolerâncias legais, biometria facial, geofencing e banco de horas integrados ao PostgreSQL.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Restaurar valores padrão previstos na Portaria 671 MTE"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Padrões CLT 671</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-lg shadow-cyan-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Salvando...' : 'Salvar Parâmetros'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-600/50 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold">{saveSuccessMessage}</span>
              <div className="text-[11px] text-emerald-300/80">
                Os novos parâmetros já estão em vigor para todas as marcações e validações do sistema.
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-900/50 px-2 py-1 rounded">
            PostgreSQL: gihs_core.system_settings
          </span>
        </div>
      )}

      {/* Filter Tabs for Sub-sections */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-800">
        {[
          { id: 'all', label: 'Todas as Seções', icon: SlidersHorizontal },
          { id: 'jornada', label: '1. Jornada & Horários', icon: Clock },
          { id: 'tolerancias', label: '2. Tolerâncias CLT 671', icon: ShieldCheck },
          { id: 'biometria', label: '3. Biometria & Antifraude', icon: Camera },
          { id: 'cerca', label: '4. Cerca Virtual & GPS', icon: MapPin },
          { id: 'banco', label: '5. Banco de Horas & Fechamento', icon: Calendar },
          { id: 'ajustes', label: '6. Regras de Ajustes & Atestados', icon: FileSpreadsheet }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeSection === tab.id
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* SEÇÃO 1: JORNADA DE TRABALHO & HORÁRIOS */}
      {(activeSection === 'all' || activeSection === 'jornada') && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-white">1. Jornada de Trabalho & Horários Padrão</h3>
                <p className="text-[11px] text-slate-400">Defina os horários contratuais de referência e escala padrão da empresa</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Escala: {config.workSchedule.scheduleType}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Horário Entrada Padrão</label>
              <input
                type="time"
                value={config.workSchedule.standardEntry}
                onChange={(e) => setConfig({
                  ...config,
                  workSchedule: { ...config.workSchedule, standardEntry: e.target.value }
                })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500 block">Início da jornada diária</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Início Intervalo (Almoço)</label>
              <input
                type="time"
                value={config.workSchedule.standardBreakStart}
                onChange={(e) => setConfig({
                  ...config,
                  workSchedule: { ...config.workSchedule, standardBreakStart: e.target.value }
                })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500 block">Saída para refeição</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Fim Intervalo (Retorno)</label>
              <input
                type="time"
                value={config.workSchedule.standardBreakEnd}
                onChange={(e) => setConfig({
                  ...config,
                  workSchedule: { ...config.workSchedule, standardBreakEnd: e.target.value }
                })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500 block">Retorno intrajornada</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Horário Saída Padrão</label>
              <input
                type="time"
                value={config.workSchedule.standardExit}
                onChange={(e) => setConfig({
                  ...config,
                  workSchedule: { ...config.workSchedule, standardExit: e.target.value }
                })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500 block">Encerramento da jornada</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Modelo de Escala Contratual</label>
              <select
                value={config.workSchedule.scheduleType}
                onChange={(e) => setConfig({
                  ...config,
                  workSchedule: { ...config.workSchedule, scheduleType: e.target.value as any }
                })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="CLT_PADRAO">CLT Padrão 5x2 (44h Semanais - 8h48/dia)</option>
                <option value="CLT_40H">CLT 5x2 (40h Semanais - 8h/dia)</option>
                <option value="ESCALA_12X36">Escala 12x36 (12h Trabalho / 36h Descanso)</option>
                <option value="FLEXIVEL">Jornada Flexível / Banco de Horas Livre</option>
              </select>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Intervalo Mínimo Obrigatório</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="30"
                  max="120"
                  value={config.workSchedule.minimumBreakMinutes}
                  onChange={(e) => setConfig({
                    ...config,
                    workSchedule: { ...config.workSchedule, minimumBreakMinutes: Number(e.target.value) }
                  })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
                <span className="text-slate-400 shrink-0">minutos (CLT)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Dias Úteis de Trabalho</label>
              <div className="flex items-center gap-1">
                {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'].map(day => {
                  const isChecked = config.workSchedule.workDays?.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWorkDay(day)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-900 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 2: TOLERÂNCIAS LEGAIS CLT & PORTARIA 671 MTE */}
      {(activeSection === 'all' || activeSection === 'tolerancias') && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">2. Tolerâncias Legais & Limites CLT (Portaria 671 MTE)</h3>
                <p className="text-[11px] text-slate-400">
                  Parâmetros previstos no Artigo 58, § 1º da CLT para desconsideração de minutos residuais
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              Art. 58 CLT § 1º
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-semibold">Tolerância por Batida</span>
                <span className="font-mono text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {config.tolerances.entryToleranceMinutes} minutos
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                value={config.tolerances.entryToleranceMinutes}
                onChange={(e) => setConfig({
                  ...config,
                  tolerances: {
                    ...config.tolerances,
                    entryToleranceMinutes: Number(e.target.value),
                    exitToleranceMinutes: Number(e.target.value)
                  }
                })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Limite padrão CLT: até <strong>5 minutos</strong> de variação na entrada ou na saída não são computados como atraso ou extra.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-semibold">Tolerância Diária Acumulada</span>
                <span className="font-mono text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {config.tolerances.dailyToleranceMinutes} minutos
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={config.tolerances.dailyToleranceMinutes}
                onChange={(e) => setConfig({
                  ...config,
                  tolerances: { ...config.tolerances, dailyToleranceMinutes: Number(e.target.value) }
                })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Limite legal: até <strong>10 minutos diários</strong> somando todas as variações da jornada (CLT Art. 58).
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-semibold">Anti-Duplicidade de Batida</span>
                <span className="font-mono text-cyan-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {config.tolerances.antiDuplicateMinutes} minutos
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={config.tolerances.antiDuplicateMinutes}
                onChange={(e) => setConfig({
                  ...config,
                  tolerances: { ...config.tolerances, antiDuplicateMinutes: Number(e.target.value) }
                })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Bloqueia batida dupla acidental no mesmo minuto caso o colaborador clique duas vezes seguidas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Permitir Registro Antecipado</span>
                <p className="text-[11px] text-slate-400">Permite registrar ponto até 15 minutos antes do início do expediente</p>
              </div>
              <input
                type="checkbox"
                checked={config.tolerances.allowEarlyPunch}
                onChange={(e) => setConfig({
                  ...config,
                  tolerances: { ...config.tolerances, allowEarlyPunch: e.target.checked }
                })}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Alerta de Fim de Intervalo</span>
                <p className="text-[11px] text-slate-400">Exibe notificação visual na tela quando o intervalo estiver a 5min de encerrar</p>
              </div>
              <input
                type="checkbox"
                checked={config.tolerances.notifyApproachingBreakEnd}
                onChange={(e) => setConfig({
                  ...config,
                  tolerances: { ...config.tolerances, notifyApproachingBreakEnd: e.target.checked }
                })}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 3: BIOMETRIA FACIAL & ANTIFRAUDE */}
      {(activeSection === 'all' || activeSection === 'biometria') && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-sm font-bold text-white">3. Segurança Biométrica Facial & Antifraude (REP-P)</h3>
                <p className="text-[11px] text-slate-400">
                  Validação algorítmica de traços anatômicos faciais e detecção de vivacidade
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
              Biometria 68 Pontos
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Slider de Tolerância Biométrica */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-semibold">Margem de Similaridade Facial Mínima</span>
                <span className="font-mono text-purple-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {config.biometry.minConfidenceScore}%
                </span>
              </div>
              <input
                type="range"
                min="70"
                max="98"
                value={config.biometry.minConfidenceScore}
                onChange={(e) => setConfig({
                  ...config,
                  biometry: { ...config.biometry, minConfidenceScore: Number(e.target.value) }
                })}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Pontuações iguais ou superiores a <strong>{config.biometry.minConfidenceScore}%</strong> aprovam a identidade do colaborador automaticamente em menos de 1 segundo.
              </p>
            </div>

            {/* Anti-spoofing */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-bold text-white block">Detecção de Vivacidade (Anti-Spoofing Facial)</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Impede o uso de fotos impressas ou vídeos de tela para burlar a batida de ponto.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.biometry.requireAntiSpoofing}
                  onChange={(e) => setConfig({
                    ...config,
                    biometry: { ...config.biometry, requireAntiSpoofing: e.target.checked }
                  })}
                  className="w-5 h-5 accent-purple-500 rounded cursor-pointer shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Análise de profundidade, reflexo de tela e micro-movimentos oculares.</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Modo Estrito (Bloquear se score &lt; mínimo)</span>
                <p className="text-[11px] text-slate-400">
                  Se desativado, o ponto é registrado e gera alerta visual para auditoria imediata do gestor.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.biometry.strictMode}
                onChange={(e) => setConfig({
                  ...config,
                  biometry: { ...config.biometry, strictMode: e.target.checked }
                })}
                className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Permitir Justificativa Manual se Falhar</span>
                <p className="text-[11px] text-slate-400">
                  Permite justificar caso o colaborador esteja sem câmera homologada ou em manutenção.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.biometry.allowFallbackManual}
                onChange={(e) => setConfig({
                  ...config,
                  biometry: { ...config.biometry, allowFallbackManual: e.target.checked }
                })}
                className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 4: CERCA VIRTUAL & GEOFENCING GPS */}
      {(activeSection === 'all' || activeSection === 'cerca') && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="text-sm font-bold text-white">4. Cerca Virtual & Geolocalização (Geofencing)</h3>
                <p className="text-[11px] text-slate-400">
                  Validação de perímetro geográfico via satélite GPS e IP corporativo da rede
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddLocationModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Posto Autorizado</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Exigir GPS nas Batidas</span>
                <p className="text-[11px] text-slate-400">Captura coordenadas de latitude e longitude reais</p>
              </div>
              <input
                type="checkbox"
                checked={config.geofencing.requireGps}
                onChange={(e) => setConfig({
                  ...config,
                  geofencing: { ...config.geofencing, requireGps: e.target.checked }
                })}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Permitir Batida Externa / Campo</span>
                <p className="text-[11px] text-slate-400">Para colaboradores de mobilidade ou home office</p>
              </div>
              <input
                type="checkbox"
                checked={config.geofencing.allowExternalPunch}
                onChange={(e) => setConfig({
                  ...config,
                  geofencing: { ...config.geofencing, allowExternalPunch: e.target.checked }
                })}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-semibold">Raio Máximo GPS Padrão</span>
                <span className="font-mono text-rose-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {config.geofencing.maxAccuracyMeters}m
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="500"
                value={config.geofencing.maxAccuracyMeters}
                onChange={(e) => setConfig({
                  ...config,
                  geofencing: { ...config.geofencing, maxAccuracyMeters: Number(e.target.value) }
                })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Lista de Sedes & Postos de Trabalho Cadastrados */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-rose-400" />
              <span>Sedes & Postos de Trabalho Autorizados ({config.geofencing.authorizedLocations.length})</span>
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {config.geofencing.authorizedLocations.map((loc) => (
                <div
                  key={loc.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white truncate">{loc.name}</span>
                      {loc.isHeadquarters && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                          Matriz
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{loc.address}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span>Lat: {loc.latitude.toFixed(4)}</span>
                      <span>Lng: {loc.longitude.toFixed(4)}</span>
                      <span className="text-rose-400">Raio: {loc.radiusMeters}m</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveLocation(loc.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Remover local"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Whitelist de IPs Corporativos */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Whitelist de IPs Autorizados da Rede Corporativa</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {config.geofencing.corporateIpWhitelist.map((ip) => (
                <span
                  key={ip}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300"
                >
                  <span>{ip}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveIp(ip)}
                    className="text-slate-500 hover:text-rose-400 cursor-pointer ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}

              <div className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Ex: 189.40.12.99"
                  value={newIpInput}
                  onChange={(e) => setNewIpInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddIp(); } }}
                  className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500 w-36"
                />
                <button
                  type="button"
                  onClick={handleAddIp}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  + Adicionar IP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 5: BANCO DE HORAS & HORAS EXTRAS */}
      {(activeSection === 'all' || activeSection === 'banco') && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">5. Banco de Horas & Regras de Fechamento de Folha</h3>
                <p className="text-[11px] text-slate-400">
                  Regime de compensação, acréscimos legais e período de corte do espelho mensal
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
              Fechamento: Dia {config.overtimeAndBank.closingDayOfMonth}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Regime de Horas Extras</label>
              <select
                value={config.overtimeAndBank.regime}
                onChange={(e) => setConfig({
                  ...config,
                  overtimeAndBank: { ...config.overtimeAndBank, regime: e.target.value as any }
                })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="BANCO_DE_HORAS">Banco de Horas (Compensação)</option>
                <option value="HORAS_EXTRAS">Pagamento em Folha (Horas Extras)</option>
                <option value="MISTO">Misto (Banco em dias úteis, HE em feriados)</option>
              </select>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Limite Máximo Diário de HE</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="30"
                  max="240"
                  value={config.overtimeAndBank.maxDailyOvertimeMinutes}
                  onChange={(e) => setConfig({
                    ...config,
                    overtimeAndBank: { ...config.overtimeAndBank, maxDailyOvertimeMinutes: Number(e.target.value) }
                  })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-400 shrink-0">minutos (2h CLT)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Adicional HE Dias Úteis</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={config.overtimeAndBank.weekdayOvertimePercentage}
                  onChange={(e) => setConfig({
                    ...config,
                    overtimeAndBank: { ...config.overtimeAndBank, weekdayOvertimePercentage: Number(e.target.value) }
                  })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-400 shrink-0">% (CLT padrão 50%)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Dia do Corte Mensal da Folha</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={config.overtimeAndBank.closingDayOfMonth}
                  onChange={(e) => setConfig({
                    ...config,
                    overtimeAndBank: { ...config.overtimeAndBank, closingDayOfMonth: Number(e.target.value) }
                  })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-400 shrink-0">de cada mês</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 6: REGRAS DE AJUSTES & ATESTADOS */}
      {(activeSection === 'all' || activeSection === 'ajustes') && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-white">6. Políticas de Ajustes, Justificativas & Atestados</h3>
                <p className="text-[11px] text-slate-400">
                  Fluxos de aprovação, prazos de envio de atestado médico e abonos de faltas
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Prazo para Solicitar Ajuste</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={config.adjustmentPolicies.maxDaysToRequestAdjustment}
                  onChange={(e) => setConfig({
                    ...config,
                    adjustmentPolicies: { ...config.adjustmentPolicies, maxDaysToRequestAdjustment: Number(e.target.value) }
                  })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
                <span className="text-slate-400 shrink-0">dias úteis (48h)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">Nível de Aprovação Exigido</label>
              <select
                value={config.adjustmentPolicies.approverRole}
                onChange={(e) => setConfig({
                  ...config,
                  adjustmentPolicies: { ...config.adjustmentPolicies, approverRole: e.target.value as any }
                })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="GESTOR_OU_ADMIN">Gestor Imediato ou Administrador</option>
                <option value="RH_ADMIN">Equipe de RH / DP</option>
                <option value="APENAS_SUPER_ADMIN">Apenas Super Administrador</option>
              </select>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Exigir Anexo para Atestado</span>
                <p className="text-[11px] text-slate-400">Obrigatório anexar PDF ou foto com CRM legível</p>
              </div>
              <input
                type="checkbox"
                checked={config.adjustmentPolicies.requireAttachmentForMedicalLeave}
                onChange={(e) => setConfig({
                  ...config,
                  adjustmentPolicies: { ...config.adjustmentPolicies, requireAttachmentForMedicalLeave: e.target.checked }
                })}
                className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA ADICIONAR NOVO POSTO / LOCAL AUTORIZADO */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Cadastrar Posto de Trabalho Autorizado</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddLocationModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome do Local</label>
                <input
                  type="text"
                  placeholder="Ex: Polo Regional - Centro Operacional"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Endereço Completo</label>
                <input
                  type="text"
                  placeholder="Ex: Av. das Nações Unidas, 12000 - São Paulo, SP"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={newLocation.latitude}
                    onChange={(e) => setNewLocation({ ...newLocation, latitude: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={newLocation.longitude}
                    onChange={(e) => setNewLocation({ ...newLocation, longitude: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Raio de Tolerância em Metros</label>
                <input
                  type="number"
                  min="50"
                  max="2000"
                  value={newLocation.radiusMeters}
                  onChange={(e) => setNewLocation({ ...newLocation, radiusMeters: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-rose-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Colaboradores dentro deste raio terão a batida aprovada automaticamente.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddLocationModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddLocation}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md"
              >
                Salvar Posto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
