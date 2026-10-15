import { query } from '../db.ts';

export interface ClientRow {
  id: string;
  name: string;
  acronym?: string;
  plan?: string;
  sla?: string;
  open_tickets?: number;
  monthly_value?: number;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  status?: string;
  cnpj?: string;
  sector_served?: string;
  contract_number?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  description?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export const JOINVILLE_PUBLIC_ORGANS: ClientRow[] = [
  {
    id: 'cli-pmj-semed',
    name: 'Secretaria Municipal de Educação (SEMED)',
    acronym: 'SEMED',
    plan: 'Suporte Full N1/N2 + Infraestrutura & Rede Escolar',
    sla: '99.8%',
    open_tickets: 3,
    monthly_value: 38500.00,
    contact_name: 'Profª. Helena Souza',
    contact_email: 'educacao.suporte@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3000',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Educação & Escolas Municipais',
    contract_number: 'CT-PMJ-2026/014-TI',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Gestão de 92 escolas municipais, 74 Centros de Educação Infantil (CEI), laboratórios de informática, rede de fibra óptica e prontuário educacional SIG-Educação.',
    address: 'Rua Itajaí, 390 - Centro, Joinville - SC'
  },
  {
    id: 'cli-pmj-sms',
    name: 'Secretaria Municipal de Saúde (SMS)',
    acronym: 'SMS',
    plan: 'Cyber Security, DBA Crítico & Suporte 24x7',
    sla: '99.95%',
    open_tickets: 2,
    monthly_value: 54000.00,
    contact_name: 'Dr. Roberto Silveira',
    contact_email: 'saude.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-4100',
    status: 'Ativo',
    cnpj: '83.178.694/0002-25',
    sector_served: 'Saúde Pública & Prontuário e-SUS',
    contract_number: 'CT-PMJ-2026/028-TI',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Suporte ininterrupto 24x7 ao prontuário eletrônico e-SUS, 58 UBSFs, 9 UPAs, PA Leste, PA Sul, regulação de leitos (SISREG) e SAMU municipal.',
    address: 'Rua Araranguá, 397 - América, Joinville - SC'
  },
  {
    id: 'cli-pmj-sefaz',
    name: 'Secretaria da Fazenda (SEFAZ)',
    acronym: 'SEFAZ',
    plan: 'DBA de Alta Performance & Processamento Fiscal Seguro',
    sla: '99.95%',
    open_tickets: 1,
    monthly_value: 42000.00,
    contact_name: 'Dr. Renato Farias',
    contact_email: 'fazenda.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3150',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Fazenda & Tributação Municipal',
    contract_number: 'CT-PMJ-2026/009-TI',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Processamento tributário, emissão de NFS-e, certidões negativas online, arrecadação de IPTU/ISS, conciliação bancária e integração com o Tribunal de Contas (TCE-SC).',
    address: 'Av. Hermann August Lepper, 10 - Saguaçu, Joinville - SC'
  },
  {
    id: 'cli-pmj-sap',
    name: 'Secretaria de Administração e Planejamento (SAP)',
    acronym: 'SAP',
    plan: 'Gestão de Ativos Públicos & Protocolo Eletrônico',
    sla: '99.5%',
    open_tickets: 2,
    monthly_value: 31200.00,
    contact_name: 'Carlos Mendes',
    contact_email: 'administracao.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3080',
    status: 'Ativo',
    cnpj: '83.178.694/0003-06',
    sector_served: 'Patrimônio & Administração Geral',
    contract_number: 'CT-PMJ-2026/033-PAT',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Tombamento e inventário patrimonial de equipamentos de TI, almoxarifado central, termos de cautela digitais, folha de servidores e compras governamentais.',
    address: 'Av. Hermann August Lepper, 10 - Saguaçu, Joinville - SC'
  },
  {
    id: 'cli-pmj-seinfra',
    name: 'Secretaria de Infraestrutura Urbana (SEINFRA)',
    acronym: 'SEINFRA',
    plan: 'Suporte de Campo, Mobilidade & Geoprocessamento GIS',
    sla: '99.2%',
    open_tickets: 2,
    monthly_value: 27500.00,
    contact_name: 'Engº. Marcos Vinicius',
    contact_email: 'seinfra.suporte@joinville.sc.gov.br',
    contact_phone: '(47) 3431-5200',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Obras & Infraestrutura Urbana',
    contract_number: 'CT-PMJ-2026/047-INFRA',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Atendimento às Unidades Regionais de Obras (Sul, Norte, Leste, Pirabeiraba), iluminação pública inteligente e georreferenciamento de pavimentação e drenagem.',
    address: 'Rua Caçador, 112 - Anita Garibaldi, Joinville - SC'
  },
  {
    id: 'cli-pmj-sas',
    name: 'Secretaria de Assistência Social (SAS)',
    acronym: 'SAS',
    plan: 'Suporte Integrado N1/N2 & Conectividade CRAS/CREAS',
    sla: '99.0%',
    open_tickets: 1,
    monthly_value: 22400.00,
    contact_name: 'Mariana Castilho',
    contact_email: 'assistenciasocial.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3300',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Assistência Social & Cidadania',
    contract_number: 'CT-PMJ-2026/051-SAS',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Rede de dados para 12 CRAS, 3 CREAS, Centros Pop, abrigos municipais, sistemas do CadÚnico e programas de acolhimento social.',
    address: 'Av. Procópio Gomes, 749 - Bucarein, Joinville - SC'
  },
  {
    id: 'cli-pmj-secult',
    name: 'Secretaria de Cultura e Turismo (SECULT)',
    acronym: 'SECULT',
    plan: 'Infraestrutura para Eventos, Museus & Acervo Digital',
    sla: '98.9%',
    open_tickets: 0,
    monthly_value: 18500.00,
    contact_name: 'Juliano Prado',
    contact_email: 'cultura.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3433-2190',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Cultura, Turismo & Eventos',
    contract_number: 'CT-PMJ-2026/062-CUL',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Digitalização e acervo do Arquivo Histórico de Joinville, Museu Nacional de Imigração e Colonização, Cidadela Cultural Antarctica e Casa da Cultura.',
    address: 'Av. José Vieira, 315 (Centreventos) - América, Joinville - SC'
  },
  {
    id: 'cli-pmj-sama',
    name: 'Secretaria de Agricultura e Meio Ambiente (SAMA)',
    acronym: 'SAMA',
    plan: 'Licenciamento Ambiental Digital & Fiscalização Móvel',
    sla: '99.1%',
    open_tickets: 1,
    monthly_value: 24800.00,
    contact_name: 'Bióloga Camila Diniz',
    contact_email: 'sama.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-5400',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Meio Ambiente & Agricultura',
    contract_number: 'CT-PMJ-2026/039-AMB',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Sistema de licenciamento ambiental SinFAT Web, fiscalização florestal mobile, Unidade de Bem-Estar Animal (CBEA) e suporte agronômico na zona rural.',
    address: 'Rua Anita Garibaldi, 79 - Anita Garibaldi, Joinville - SC'
  },
  {
    id: 'cli-pmj-sde',
    name: 'Secretaria de Desenvolvimento Econômico e Inovação (SDE)',
    acronym: 'SDE',
    plan: 'Conectividade de Parques Tecnológicos & Portal do Empreendedor',
    sla: '99.4%',
    open_tickets: 1,
    monthly_value: 25000.00,
    contact_name: 'Fernando Becker',
    contact_email: 'sde.inovacao@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3250',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Desenvolvimento Econômico & Inovação',
    contract_number: 'CT-PMJ-2026/077-SDE',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Rede do Ágora Tech Park, sistema Facilita Joinville para emissão de alvarás em minutos, Centro de Atendimento ao Cidadão e atração de investimentos.',
    address: 'Rua Dona Francisca, 8300 - Zona Industrial Norte, Joinville - SC'
  },
  {
    id: 'cli-pmj-sehab',
    name: 'Secretaria de Habitação (SEHAB)',
    acronym: 'SEHAB',
    plan: 'Regularização Fundiária & Cadastro Habitacional',
    sla: '99.0%',
    open_tickets: 0,
    monthly_value: 19600.00,
    contact_name: 'Patrícia Alencar',
    contact_email: 'habitacao.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-5100',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Habitação & Regularização Fundiária',
    contract_number: 'CT-PMJ-2026/044-HAB',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Banco de dados georreferenciado do REURB (Regularização Fundiária), cadastro da fila habitacional do município e titulação de propriedades.',
    address: 'Rua Inácio Bastos, 555 - Bucarein, Joinville - SC'
  },
  {
    id: 'cli-pmj-sesporte',
    name: 'Secretaria de Esportes (SESPORTE)',
    acronym: 'SESPORTE',
    plan: 'Gestão de Praças Esportivas & Eventos Desportivos',
    sla: '98.8%',
    open_tickets: 0,
    monthly_value: 16800.00,
    contact_name: 'Rodrigo Albuquerque',
    contact_email: 'sesporte.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-5300',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Esporte & Lazer',
    contract_number: 'CT-PMJ-2026/088-ESP',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Conectividade e controle de acesso na Arena Joinville, Ginásio Abel Schulz, pista de atletismo e portal de inscrições para modalidades esportivas.',
    address: 'Rua Inácio Bastos, 1084 (Arena) - Bucarein, Joinville - SC'
  },
  {
    id: 'cli-pmj-secon',
    name: 'Secretaria de Proteção Civil e Segurança Pública (SECON)',
    acronym: 'SECON',
    plan: 'Sala de Operações Críticas 24x7 & Radiocomunicação',
    sla: '99.98%',
    open_tickets: 1,
    monthly_value: 46000.00,
    contact_name: 'Comandante Eduardo Silveira',
    contact_email: 'secon.operacoes@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3199',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Defesa Civil & Guarda Municipal',
    contract_number: 'CT-PMJ-2026/012-SEG',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Central Integrada de Monitoramento Urbano (CICC), câmeras de cerco inteligente OCR, rádio digital TETRA, atendimento Defesa Civil 199 e Guarda Municipal 153.',
    address: 'Rua Dr. João Colin, 2719 - Santo Antônio, Joinville - SC'
  },
  {
    id: 'cli-pmj-sgg',
    name: 'Secretaria de Governo (SGG)',
    acronym: 'SGG',
    plan: 'Governança Estratégica & Gestão de Projetos Prioritários',
    sla: '99.6%',
    open_tickets: 0,
    monthly_value: 23000.00,
    contact_name: 'Beatriz Fontoura',
    contact_email: 'governo.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3010',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Articulação Institucional & Gestão',
    contract_number: 'CT-PMJ-2026/003-GOV',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Plataforma de monitoramento do Plano de Governo, integração com secretarias e autarquias, gestão de emendas parlamentares e projetos estruturantes.',
    address: 'Av. Hermann August Lepper, 10 - 2º Andar - Saguaçu, Joinville - SC'
  },
  {
    id: 'cli-pmj-secom',
    name: 'Secretaria de Comunicação (SECOM)',
    acronym: 'SECOM',
    plan: 'Portais Web de Alto Tráfego & Transparência Pública',
    sla: '99.7%',
    open_tickets: 0,
    monthly_value: 21500.00,
    contact_name: 'Lucas Werneck',
    contact_email: 'secom.web@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3030',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Comunicação Social & Portais',
    contract_number: 'CT-PMJ-2026/021-COM',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Portal Oficial joinville.sc.gov.br, CDN, streaming de sessões públicas, comunicação interna institucional e disparo seguro de comunicados à população.',
    address: 'Av. Hermann August Lepper, 10 - Saguaçu, Joinville - SC'
  },
  {
    id: 'cli-pmj-pgm',
    name: 'Procuradoria-Geral do Município (PGM)',
    acronym: 'PGM',
    plan: 'Segurança Jurídica Digital & Processo Eletrônico e-STJ/TJSC',
    sla: '99.85%',
    open_tickets: 1,
    monthly_value: 28500.00,
    contact_name: 'Dra. Renata Meirelles',
    contact_email: 'pgm.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3110',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Jurídico & Contencioso Municipal',
    contract_number: 'CT-PMJ-2026/007-PGM',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Integração direta com e-Proc TJSC, TRF4, STJ e STF, controle automatizado de prazos judiciais, cobrança de dívida ativa tributária e pareceres digitais.',
    address: 'Av. Hermann August Lepper, 10 - Saguaçu, Joinville - SC'
  },
  {
    id: 'cli-pmj-cgm',
    name: 'Controladoria-Geral do Município (CGM)',
    acronym: 'CGM',
    plan: 'Auditoria de Logs, Compliance LGPD & Portal da Transparência',
    sla: '99.8%',
    open_tickets: 0,
    monthly_value: 22000.00,
    contact_name: 'Dr. Thiago Schmidt',
    contact_email: 'cgm.auditoria@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3140',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Controle Interno & Compliance',
    contract_number: 'CT-PMJ-2026/005-CGM',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Auditorias automatizadas em sistemas de compras, conformidade com a LGPD, integridade de transações contábeis e ouvidoria Fala.BR Joinville.',
    address: 'Av. Hermann August Lepper, 10 - Saguaçu, Joinville - SC'
  },
  {
    id: 'cli-pmj-gab',
    name: 'Gabinete do Prefeito e Vice-Prefeito (GAB)',
    acronym: 'GAB',
    plan: 'Atendimento Executivo VIP & Alta Disponibilidade C-Level',
    sla: '99.99%',
    open_tickets: 0,
    monthly_value: 35000.00,
    contact_name: 'Dr. Henrique Vasconcelos',
    contact_email: 'gabinete.prefeito@joinville.sc.gov.br',
    contact_phone: '(47) 3431-3001',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Gabinete Executivo Municipal',
    contract_number: 'CT-PMJ-2026/001-GAB',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Suporte VIP dedicado ao gabinete do chefe do Poder Executivo, equipamentos de alta segurança criptográfica, despachos eletrônicos e salas de videoconferência.',
    address: 'Av. Hermann August Lepper, 10 - 4º Andar - Saguaçu, Joinville - SC'
  },
  {
    id: 'cli-pmj-detrans',
    name: 'Departamento de Trânsito de Joinville (DETRANS)',
    acronym: 'DETRANS',
    plan: 'Mobilidade Urbana, Radares & Frotas Conectadas',
    sla: '99.3%',
    open_tickets: 1,
    monthly_value: 29000.00,
    contact_name: 'Inspetor Vanderlei Santos',
    contact_email: 'detrans.operacoes@joinville.sc.gov.br',
    contact_phone: '(47) 3431-5000',
    status: 'Ativo',
    cnpj: '83.178.694/0004-97',
    sector_served: 'Trânsito, Radares & Fiscalização',
    contract_number: 'CT-PMJ-2026/055-MOB',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Central semafórica em tempo real, telemetria das viaturas dos agentes de trânsito, talonários eletrônicos de fiscalização e pátio de veículos apreendidos.',
    address: 'Rua Blumenau, 2103 - América, Joinville - SC'
  },
  {
    id: 'cli-pmj-caj',
    name: 'Companhia Águas de Joinville (CAJ)',
    acronym: 'CAJ',
    plan: 'Suporte de Missão Crítica SCADA & Telemetria Sanitária',
    sla: '99.95%',
    open_tickets: 2,
    monthly_value: 62000.00,
    contact_name: 'Engª. Larissa Moretto',
    contact_email: 'ti.redes@aguasdejoinville.com.br',
    contact_phone: '(47) 2105-1600',
    status: 'Ativo',
    cnpj: '07.214.502/0001-70',
    sector_served: 'Saneamento Básico & Redes Hidráulicas',
    contract_number: 'CT-CAJ-2026/018-ENG',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Monitoramento industrial SCADA das ETAs Cubatão e Piraí, ETEs, telemetria de macromedidores de água tratada, call center 115 e emissão comercial de faturas.',
    address: 'Rua XV de Novembro, 3950 - Glória, Joinville - SC'
  },
  {
    id: 'cli-pmj-ipreville',
    name: 'Instituto de Previdência dos Servidores de Joinville (IPREVILLE)',
    acronym: 'IPREVILLE',
    plan: 'Gestão Atuarial Segura & Cibersegurança Previdenciária',
    sla: '99.7%',
    open_tickets: 1,
    monthly_value: 26000.00,
    contact_name: 'Marcelo Guimarães',
    contact_email: 'ipreville.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3431-5600',
    status: 'Ativo',
    cnpj: '05.215.178/0001-09',
    sector_served: 'Previdência Social dos Servidores',
    contract_number: 'CT-IPR-2026/004-PREV',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Cálculos atuariais, folha de pagamento de servidores aposentados e pensionistas, censo previdenciário e Prova de Vida com reconhecimento facial.',
    address: 'Praça Nereu Ramos, 372 - Centro, Joinville - SC'
  },
  {
    id: 'cli-pmj-hmsj',
    name: 'Hospital Municipal São José (HMSJ)',
    acronym: 'HMSJ',
    plan: 'Suporte Hospitalar 24x7x365 & PACS / UTI Conectada',
    sla: '99.99%',
    open_tickets: 3,
    monthly_value: 68000.00,
    contact_name: 'Dr. Alexandre Bittencourt',
    contact_email: 'hmsj.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3441-6600',
    status: 'Ativo',
    cnpj: '83.178.694/0005-78',
    sector_served: 'Complexo Hospitalar de Emergência',
    contract_number: 'CT-HMSJ-2026/002-HOSP',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Maior pronto-socorro público e trauma do norte de SC, prontuário Tasy/Philips, sistema PACS de laudos radiológicos digitais, farmácia clínica e leitos de UTI.',
    address: 'Av. Getúlio Vargas, 238 - Anita Garibaldi, Joinville - SC'
  },
  {
    id: 'cli-pmj-procon',
    name: 'PROCON Municipal de Joinville',
    acronym: 'PROCON',
    plan: 'Atendimento ao Consumidor & Integração ProConsumidor Senacon',
    sla: '99.1%',
    open_tickets: 1,
    monthly_value: 15500.00,
    contact_name: 'Fabiana Zimmermann',
    contact_email: 'procon.ti@joinville.sc.gov.br',
    contact_phone: '(47) 3481-5240',
    status: 'Ativo',
    cnpj: '83.178.694/0001-44',
    sector_served: 'Defesa do Consumidor',
    contract_number: 'CT-PMJ-2026/069-PROCON',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Plataforma ProConsumidor conectada à Senacon/Ministério da Justiça, agendamento de audiências conciliatórias online e fiscalização comercial em Joinville.',
    address: 'Rua Amazonas, 49 - Bom Retiro, Joinville - SC'
  },
  {
    id: 'cli-pmj-cvj',
    name: 'Câmara de Vereadores de Joinville (CVJ)',
    acronym: 'CVJ',
    plan: 'Plenário Digital, Votação Eletrônica & Painel de Transmissão',
    sla: '99.8%',
    open_tickets: 1,
    monthly_value: 33000.00,
    contact_name: 'Rodrigo Faria',
    contact_email: 'cvj.informatica@cvj.sc.gov.br',
    contact_phone: '(47) 2101-3200',
    status: 'Ativo',
    cnpj: '83.178.694/0006-59',
    sector_served: 'Poder Legislativo Municipal',
    contract_number: 'CT-CVJ-2026/001-LEG',
    contract_start_date: '01/01/2026',
    contract_end_date: '31/12/2026',
    description: 'Painel do plenário de votação biométrica das sessões ordinárias, tramitação legislativa de projetos de lei, TV Câmara Joinville e portal da transparência legislativa.',
    address: 'Av. Hermann August Lepper, 1100 - Saguaçu, Joinville - SC'
  }
];

function formatClientRow(row: any) {
  const monthlyVal = typeof row.monthly_value === 'number' 
    ? `R$ ${row.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : (row.monthly_value ? `R$ ${parseFloat(row.monthly_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00');

  return {
    id: row.id,
    name: row.name,
    acronym: row.acronym || '',
    plan: row.plan || 'Suporte Municipal Padrão',
    sla: row.sla || '99.5%',
    openTickets: parseInt(row.open_tickets_count || row.open_tickets || '0', 10),
    monthlyValue: monthlyVal,
    monthlyValueNumeric: typeof row.monthly_value === 'number' ? row.monthly_value : (row.monthly_value ? parseFloat(row.monthly_value) : 0),
    contact: row.contact_email || row.contact_name || '',
    contactName: row.contact_name || '',
    contactEmail: row.contact_email || '',
    phone: row.contact_phone || '(47) 3431-3000',
    status: row.status || 'Ativo',
    cnpj: row.cnpj || '83.178.694/0001-44',
    sectorServed: row.sector_served || 'Administração Municipal',
    contractNumber: row.contract_number || `CT-PMJ-2026/${row.id.replace('cli-pmj-', '').toUpperCase()}`,
    contractStartDate: row.contract_start_date || '01/01/2026',
    contractEndDate: row.contract_end_date || '31/12/2026',
    description: row.description || '',
    address: row.address || 'Joinville - SC',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const clientsRepository = {
  async findAll(): Promise<any[]> {
    // Query clients with dynamic count of active tickets from tickets table
    const res = await query<any>(`
      SELECT 
        c.*,
        COUNT(t.id) FILTER (WHERE t.status NOT IN ('RESOLVIDO', 'CANCELADO')) AS open_tickets_count
      FROM gihs_core.clients c
      LEFT JOIN gihs_core.tickets t 
        ON (t.client ILIKE '%' || c.name || '%' OR c.name ILIKE '%' || t.client || '%')
      GROUP BY c.id
      ORDER BY c.name ASC;
    `);

    // If table is completely empty, seed automatically
    if (res.rows.length === 0) {
      await this.seedAll();
      return this.findAll();
    }

    return res.rows.map(formatClientRow);
  },

  async findById(id: string): Promise<any | null> {
    const res = await query<any>(`
      SELECT 
        c.*,
        COUNT(t.id) FILTER (WHERE t.status NOT IN ('RESOLVIDO', 'CANCELADO')) AS open_tickets_count
      FROM gihs_core.clients c
      LEFT JOIN gihs_core.tickets t 
        ON (t.client ILIKE '%' || c.name || '%' OR c.name ILIKE '%' || t.client || '%')
      WHERE c.id = $1
      GROUP BY c.id
      LIMIT 1;
    `, [id]);

    if (!res.rows[0]) return null;
    return formatClientRow(res.rows[0]);
  },

  async create(client: any): Promise<any> {
    const id = client.id || `cli-pmj-${Date.now()}`;
    const monthlyVal = typeof client.monthlyValueNumeric === 'number' 
      ? client.monthlyValueNumeric 
      : (typeof client.monthlyValue === 'string' 
          ? parseFloat(client.monthlyValue.replace(/[^\d,]/g, '').replace(',', '.')) || 20000 
          : 20000);

    const res = await query<any>(`
      INSERT INTO gihs_core.clients (
        id, name, acronym, plan, sla, open_tickets, monthly_value,
        contact_name, contact_email, contact_phone, status,
        cnpj, sector_served, contract_number, contract_start_date, contract_end_date,
        description, address
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18
      )
      RETURNING *;
    `, [
      id,
      client.name,
      client.acronym || client.name.match(/\(([^)]+)\)/)?.[1] || '',
      client.plan || 'Suporte N1/N2 Padrão',
      client.sla || '99.5%',
      client.openTickets || 0,
      monthlyVal,
      client.contactName || client.contact || 'Gestor Municipal',
      client.contactEmail || client.contact || 'contato@joinville.sc.gov.br',
      client.phone || '(47) 3431-3000',
      client.status || 'Ativo',
      client.cnpj || '83.178.694/0001-44',
      client.sectorServed || 'Administração Municipal',
      client.contractNumber || `CT-PMJ-2026/${Math.floor(100 + Math.random() * 900)}-TI`,
      client.contractStartDate || '01/01/2026',
      client.contractEndDate || '31/12/2026',
      client.description || '',
      client.address || 'Joinville - SC'
    ]);

    return formatClientRow(res.rows[0]);
  },

  async update(id: string, client: any): Promise<any | null> {
    const monthlyVal = typeof client.monthlyValueNumeric === 'number' 
      ? client.monthlyValueNumeric 
      : (typeof client.monthlyValue === 'string' 
          ? parseFloat(client.monthlyValue.replace(/[^\d,]/g, '').replace(',', '.')) || null 
          : null);

    const res = await query<any>(`
      UPDATE gihs_core.clients
      SET
        name = COALESCE($2, name),
        acronym = COALESCE($3, acronym),
        plan = COALESCE($4, plan),
        sla = COALESCE($5, sla),
        monthly_value = COALESCE($6, monthly_value),
        contact_name = COALESCE($7, contact_name),
        contact_email = COALESCE($8, contact_email),
        contact_phone = COALESCE($9, contact_phone),
        status = COALESCE($10, status),
        cnpj = COALESCE($11, cnpj),
        sector_served = COALESCE($12, sector_served),
        contract_number = COALESCE($13, contract_number),
        contract_start_date = COALESCE($14, contract_start_date),
        contract_end_date = COALESCE($15, contract_end_date),
        description = COALESCE($16, description),
        address = COALESCE($17, address),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `, [
      id,
      client.name,
      client.acronym,
      client.plan,
      client.sla,
      monthlyVal,
      client.contactName || client.contact,
      client.contactEmail,
      client.phone,
      client.status,
      client.cnpj,
      client.sectorServed,
      client.contractNumber,
      client.contractStartDate,
      client.contractEndDate,
      client.description,
      client.address
    ]);

    if (!res.rows[0]) return null;
    return formatClientRow(res.rows[0]);
  },

  async delete(id: string): Promise<boolean> {
    const res = await query<any>(`
      DELETE FROM gihs_core.clients WHERE id = $1;
    `, [id]);
    return (res.rowCount ?? 0) > 0;
  },

  async seedAll(): Promise<{ seededCount: number }> {
    let count = 0;
    for (const c of JOINVILLE_PUBLIC_ORGANS) {
      await query<any>(`
        INSERT INTO gihs_core.clients (
          id, name, acronym, plan, sla, open_tickets, monthly_value,
          contact_name, contact_email, contact_phone, status,
          cnpj, sector_served, contract_number, contract_start_date, contract_end_date,
          description, address
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          acronym = EXCLUDED.acronym,
          plan = EXCLUDED.plan,
          sla = EXCLUDED.sla,
          monthly_value = EXCLUDED.monthly_value,
          contact_name = EXCLUDED.contact_name,
          contact_email = EXCLUDED.contact_email,
          contact_phone = EXCLUDED.contact_phone,
          status = EXCLUDED.status,
          cnpj = EXCLUDED.cnpj,
          sector_served = EXCLUDED.sector_served,
          contract_number = EXCLUDED.contract_number,
          contract_start_date = EXCLUDED.contract_start_date,
          contract_end_date = EXCLUDED.contract_end_date,
          description = EXCLUDED.description,
          address = EXCLUDED.address,
          updated_at = CURRENT_TIMESTAMP;
      `, [
        c.id,
        c.name,
        c.acronym,
        c.plan,
        c.sla,
        c.open_tickets,
        c.monthly_value,
        c.contact_name,
        c.contact_email,
        c.contact_phone,
        c.status,
        c.cnpj,
        c.sector_served,
        c.contract_number,
        c.contract_start_date,
        c.contract_end_date,
        c.description,
        c.address
      ]);
      count++;
    }
    return { seededCount: count };
  }
};
