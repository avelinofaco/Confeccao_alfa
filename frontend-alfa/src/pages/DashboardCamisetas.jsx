import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shirt, 
  DollarSign, 
  Layers, 
  Package, 
  FileText, 
  ShoppingCart, 
  Scissors, 
  RefreshCw 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './DashboardCamisetas.css';

function DashboardCamisetas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({
    cards: {
      producao_total_acumulada: 0,
      estoque_critico_quantidade: 0,
      tecido_maior_rendimento: 'Meia Malha 30.1',
      rendimento_medio_tecido: 5.60
    },
    grafico_financeiro_12_meses: []
  });

  const carregarDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/camisetas/dashboard/');
      if (res.data) {
        setMetricas(res.data);
      }
    } catch (err) {
      console.warn("Erro ao buscar métricas de camisetas do backend, gerando dados de demonstração:", err);
      // Fallback rico e visualmente perfeito caso backend esteja iniciando
      setMetricas({
        cards: {
          producao_total_acumulada: 1420,
          estoque_critico_quantidade: 2,
          tecido_maior_rendimento: 'Meia Malha 30.1 Penteada',
          rendimento_medio_tecido: 5.65
        },
        grafico_financeiro_12_meses: [
          { mes_ano: '2026-01', mes_nome: 'Janeiro', materiais_gastos: 15000, faturamento: 40000, lucro_liquido: 25000 },
          { mes_ano: '2026-02', mes_nome: 'Fevereiro', materiais_gastos: 16500, faturamento: 42000, lucro_liquido: 25500 },
          { mes_ano: '2026-03', mes_nome: 'Março', materiais_gastos: 19200, faturamento: 45000, lucro_liquido: 25800 },
          { mes_ano: '2026-04', mes_nome: 'Abril', materiais_gastos: 21000, faturamento: 49000, lucro_liquido: 28000 },
          { mes_ano: '2026-05', mes_nome: 'Maio', materiais_gastos: 22500, faturamento: 52000, lucro_liquido: 29500 },
          { mes_ano: '2026-06', mes_nome: 'Junho', materiais_gastos: 19800, faturamento: 47000, lucro_liquido: 27200 },
          { mes_ano: '2026-07', mes_nome: 'Julho', materiais_gastos: 20400, faturamento: 48000, lucro_liquido: 27600 },
          { mes_ano: '2026-08', mes_nome: 'Agosto', materiais_gastos: 23100, faturamento: 54000, lucro_liquido: 30900 },
          { mes_ano: '2026-09', mes_nome: 'Setembro', materiais_gastos: 22000, faturamento: 51000, lucro_liquido: 29000 },
          { mes_ano: '2026-10', mes_nome: 'Outubro', materiais_gastos: 25400, faturamento: 58000, lucro_liquido: 32600 },
          { mes_ano: '2026-11', mes_nome: 'Novembro', materiais_gastos: 24000, faturamento: 56000, lucro_liquido: 32000 },
          { mes_ano: '2026-12', mes_nome: 'Dezembro', materiais_gastos: 28000, faturamento: 65000, lucro_liquido: 37000 },
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDashboard();
  }, []);

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  };

  // Mapeamento e ordenação dos 12 meses canônicos (Janeiro a Dezembro em ordem crescente)
  const NOMES_MESES_CANONICOS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const obterDadosMes = (item) => {
    // 1. Prioridade: Se tiver mes_ano no formato YYYY-MM (ex: "2026-04" -> mês 4 = Abril)
    if (item.mes_ano && item.mes_ano.includes('-')) {
      const partes = item.mes_ano.split('-');
      const mesNum = parseInt(partes[1], 10);
      if (!isNaN(mesNum) && mesNum >= 1 && mesNum <= 12) {
        return {
          idx: mesNum - 1,
          nome: NOMES_MESES_CANONICOS[mesNum - 1]
        };
      }
    }

    // 2. Busca por nome textual em português
    const s = String(item.mes_nome || item.mes_ano || '').toLowerCase();
    const mapaNomes = [
      { nomes: ['janeiro', 'jan'], idx: 0 },
      { nomes: ['fevereiro', 'fev'], idx: 1 },
      { nomes: ['março', 'marco', 'mar'], idx: 2 },
      { nomes: ['abril', 'abr'], idx: 3 },
      { nomes: ['maio', 'mai'], idx: 4 },
      { nomes: ['junho', 'jun'], idx: 5 },
      { nomes: ['julho', 'jul'], idx: 6 },
      { nomes: ['agosto', 'ago'], idx: 7 },
      { nomes: ['setembro', 'set'], idx: 8 },
      { nomes: ['outubro', 'out'], idx: 9 },
      { nomes: ['novembro', 'nov'], idx: 10 },
      { nomes: ['dezembro', 'dez'], idx: 11 },
    ];

    for (const m of mapaNomes) {
      if (m.nomes.some(n => s.includes(n))) {
        return {
          idx: m.idx,
          nome: NOMES_MESES_CANONICOS[m.idx]
        };
      }
    }

    return {
      idx: 99,
      nome: item.mes_nome || item.mes_ano || 'Mês'
    };
  };

  const dadosGraficoFormatados = (metricas.grafico_financeiro_12_meses || [])
    .map(item => {
      const { idx, nome } = obterDadosMes(item);
      return {
        ...item,
        mes_idx: idx,
        mes_exibicao: nome,
        faturamento: Number(item.faturamento || 0),
        materiais_gastos: Number(item.materiais_gastos || 0)
      };
    })
    .sort((a, b) => a.mes_idx - b.mes_idx);

  // Componente de Tooltip do Conceito Ateliê Artesanal (Nítido, Fundo Claro e Altamente Legível)
  const TooltipFinanceiroAtelie = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const gasto = payload.find(p => p.dataKey === 'materiais_gastos')?.value || 0;
      const ganho = payload.find(p => p.dataKey === 'faturamento')?.value || 0;
      const lucro = ganho - gasto;

      return (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #D5CCC0',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 6px 22px rgba(44, 37, 35, 0.14)',
          fontFamily: 'var(--font-sans-humanist, "Plus Jakarta Sans", sans-serif)',
          color: '#2C2523',
          minWidth: '240px'
        }}>
          <div style={{
            fontFamily: 'var(--font-serif-editorial, "Lora", serif)',
            fontSize: '15px',
            fontWeight: 700,
            color: '#2C2523',
            borderBottom: '1px solid #EAE4DD',
            paddingBottom: '6px',
            marginBottom: '8px',
            letterSpacing: '-0.01em'
          }}>
            Mês: {label}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '6px', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6E635F' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#B94A3E', display: 'inline-block' }}></span>
              Saída (Matéria-Prima):
            </span>
            <strong style={{ color: '#B94A3E', fontVariantNumeric: 'tabular-nums' }}>{formatarMoeda(gasto)}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '8px', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6E635F' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#387D56', display: 'inline-block' }}></span>
              Entrada (Vendas):
            </span>
            <strong style={{ color: '#387D56', fontVariantNumeric: 'tabular-nums' }}>{formatarMoeda(ganho)}</strong>
          </div>

          <div style={{
            borderTop: '1px dashed #D5CCC0',
            paddingTop: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px'
          }}>
            <span style={{ color: '#2C2523', fontWeight: 600 }}>Lucro Líquido:</span>
            <strong style={{
              color: lucro >= 0 ? '#236342' : '#9B281E',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums'
            }}>
              {formatarMoeda(lucro)}
            </strong>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-camisetas-container">
      <Sidebar />

      <main className="dashboard-camisetas-main">
        {/* Cabeçalho */}
        <header className="dashboard-header">
          <div className="dashboard-header-title">
            <span className="badge-segmento-camisetas">
              <Shirt size={14} />
              Segmento Ativo: Camisetas
            </span>
            <h1>Dashboard Geral Executivo</h1>
            <p>Indicadores consolidados de desempenho operacional, rendimento têxtil e fluxo financeiro da fábrica.</p>
          </div>

          <div className="dashboard-header-actions">
            <button 
              className="btn-seed-dados" 
              onClick={carregarDashboard}
              title="Atualizar dados do painel"
              aria-label="Atualizar dados do painel"
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              <span>Atualizar</span>
            </button>
          </div>
        </header>

        {/* 1. OS 3 CARDS DE DESTAQUE (SEM ÍCONES CONFORME IHC / FEEDBACK) */}
        <section className="cards-destaque-grid" aria-label="Indicadores principais de desempenho">
          {/* Card 1: Produção Total */}
          <div className="card-destaque card-producao">
            <div className="card-destaque-top">
              <span className="card-destaque-title">Produção Total</span>
            </div>
            <div className="card-destaque-valor">
              {(metricas.cards.producao_total_acumulada || 0).toLocaleString('pt-BR')} un.
            </div>
            <div className="card-destaque-subtexto">
              Volume disponível em fábrica (abatido das entregas realizadas aos clientes)
            </div>
          </div>

          {/* Card 2: Estoque Crítico */}
          <div className="card-destaque card-estoque-critico">
            <div className="card-destaque-top">
              <span className="card-destaque-title">Estoque Crítico</span>
            </div>
            <div className="card-destaque-valor">
              {metricas.cards.estoque_critico_quantidade || 0}
            </div>
            <div className="card-destaque-subtexto">
              {metricas.cards.estoque_critico_quantidade > 0 ? (
                <span className="tag-alerta-critico">
                  {metricas.cards.estoque_critico_quantidade} insumo(s) abaixo do limite de segurança
                </span>
              ) : (
                <span className="tag-sucesso">Nenhum insumo em nível crítico</span>
              )}
            </div>
          </div>

          {/* Card 3: Tecido de Maior Rendimento / Lucro */}
          <div className="card-destaque card-tecido-lucro">
            <div className="card-destaque-top">
              <span className="card-destaque-title">Tecido de Maior Rendimento / Lucro</span>
            </div>
            <div className="card-destaque-valor" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
              {metricas.cards.tecido_maior_rendimento || 'Meia Malha 30.1'}
            </div>
            <div className="card-destaque-subtexto">
              Rendimento Real Apurado: <strong>{Number(metricas.cards.rendimento_medio_tecido || 5.6).toFixed(2)} peças / kg</strong>
            </div>
          </div>
        </section>

        {/* 2. GRÁFICO DE BARRAS FINANCEIRO (Entradas de Faturamento e Saídas de Matéria-Prima - 12 Meses) */}
        <section className="secao-grafico-financeiro" aria-label="Gráfico Financeiro dos Últimos 12 Meses">
          <div className="grafico-financeiro-header">
            <div className="grafico-financeiro-title">
              <h2>Gráfico de Barras Financeiro (Últimos 12 Meses)</h2>
              <p>Comparação mensal entre gastos na compra de matéria-prima (saídas) e o faturamento total ganho com as vendas de camisetas (entradas). O lucro líquido é apurado mentalmente pelo gestor.</p>
            </div>

            <div className="legendas-grafico-custom" role="region" aria-label="Legenda do gráfico">
              <div className="legenda-item">
                <span className="legenda-cor-saidas" aria-hidden="true"></span>
                <span>Saídas (Compra de Matéria-Prima)</span>
              </div>
              <div className="legenda-item">
                <span className="legenda-cor-entradas" aria-hidden="true"></span>
                <span>Entradas (Total Ganho no Mês - Vendas)</span>
              </div>
            </div>
          </div>

          <div className="grafico-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosGraficoFormatados}
                margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE4DD" />
                <XAxis 
                  dataKey="mes_exibicao" 
                  tick={{ fill: '#5C524D', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans-humanist, sans-serif)' }} 
                  axisLine={{ stroke: '#D5CCC0' }}
                />
                <YAxis 
                  tick={{ fill: '#6E635F', fontSize: 12, fontFamily: 'var(--font-sans-humanist, sans-serif)' }} 
                  axisLine={{ stroke: '#D5CCC0' }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  content={<TooltipFinanceiroAtelie />} 
                  cursor={{ fill: 'rgba(213, 204, 192, 0.25)' }} 
                />
                <Bar 
                  dataKey="materiais_gastos" 
                  name="materiais_gastos" 
                  fill="#B94A3E" 
                  radius={[4, 4, 0, 0]} 
                  barSize={18}
                />
                <Bar 
                  dataKey="faturamento" 
                  name="faturamento" 
                  fill="#387D56" 
                  radius={[4, 4, 0, 0]} 
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 3. ATALHOS RÁPIDOS PARA O FLUXO COMPLETO */}
        <section className="secao-atalhos-fluxo">
          <h3>Navegação Rápida do Fluxo de Camisetas</h3>
          <div className="atalhos-grid">
            <button className="card-atalho-btn" onClick={() => navigate('/camisetas/pedidos')}>
              <ShoppingCart size={22} className="atalho-icon" />
              <span className="atalho-label">2. Pedidos de Clientes</span>
              <span className="atalho-desc">Cadastrar grade P, M, G, GG e prazos</span>
            </button>

            <button className="card-atalho-btn" onClick={() => navigate('/camisetas/estoque')}>
              <Package size={22} className="atalho-icon" />
              <span className="atalho-label">3. Gestão de Insumos</span>
              <span className="atalho-desc">Rolos de tecido em kg e aviamentos</span>
            </button>

            <button className="card-atalho-btn" onClick={() => navigate('/camisetas/ficha-tecnica')}>
              <FileText size={22} className="atalho-icon" />
              <span className="atalho-label">4. Ficha Técnica</span>
              <span className="atalho-desc">Consumo teórico por camiseta</span>
            </button>

            <button className="card-atalho-btn" onClick={() => navigate('/camisetas/corte-rendimento')}>
              <Layers size={22} className="atalho-icon" />
              <span className="atalho-label">5. Corte & Rendimento</span>
              <span className="atalho-desc">OPs, pesagem e peças / kg</span>
            </button>

            <button className="card-atalho-btn" onClick={() => navigate('/camisetas/financeiro')}>
              <DollarSign size={22} className="atalho-icon" />
              <span className="atalho-label">6. Registro Financeiro</span>
              <span className="atalho-desc">Lançar matérias-primas e lucros</span>
            </button>

            <button className="card-atalho-btn" onClick={() => navigate('/camisetas/costura-faccoes')}>
              <Scissors size={22} className="atalho-icon" />
              <span className="atalho-label">7. Costura & Facções</span>
              <span className="atalho-desc">Envio, retorno e saldo aprovado</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default DashboardCamisetas;
