import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  ShoppingCart, 
  Crop, 
  Scissors, 
  PackageCheck, 
  Users, 
  LogOut,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Award,
  Menu, X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import api from '../services/api';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('Gestor Alfa');
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  
  // Estados dinâmicos para o estoque e rendimento vindo diretamente do banco
  const [dadosNivelEstoque, setDadosNivelEstoque] = useState([]);
  const [qtdEstoqueCritico, setQtdEstoqueCritico] = useState(0);
  const [loadingEstoque, setLoadingEstoque] = useState(true);
  const [totalPecasProntas, setTotalPecasProntas] = useState(0);
  
  // Novos estados para o Rendimento e Produção Mensal
  const [dadosRendimentoMalha, setDadosRendimentoMalha] = useState([]);
  const [loadingRendimento, setLoadingRendimento] = useState(true);
  const [dadosProducaoMensal, setDadosProducaoMensal] = useState([]); // 🔥 NOVO ESTADO AQUI

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) {
      navigate('/');
    } else {
      carregarEstoqueDashboard();
      carregarRendimentoDashboard();
      carregarTotalEProducao(); // 🔥 FUNÇÃO UNIFICADA AQUI
    }
  }, [navigate]);

  // 1. Busca insumos no banco de dados e formata para o gráfico de Estoque
  const carregarEstoqueDashboard = async () => {
    try {
      setLoadingEstoque(true);
      const response = await api.get('/estoque/insumos/');
      const insumos = response.data || [];

      const estoqueFormatado = insumos.map(item => ({
        item: item.tipo ? `${item.tipo} (${item.cor || ''})`.trim() : item.codigo,
        quantidade: item.quantidade_atual || 0,
        min: item.estoque_minimo_seguranca || 0
      }));

      setDadosNivelEstoque(estoqueFormatado);

      // Calculando com parseFloat para garantir que a matemática seja exata
      const criticos = insumos.filter(
        i => (parseFloat(i.quantidade_atual) || 0) <= (parseFloat(i.estoque_minimo_seguranca) || 0)
      ).length;
      setQtdEstoqueCritico(criticos);
    } catch (error) {
      console.error("Erro ao carregar insumos para o Dashboard:", error);
      setDadosNivelEstoque([]);
      setQtdEstoqueCritico(0);
    } finally {
      setLoadingEstoque(false);
    }
  };

  // 2. Busca OPs de corte e cruza com a Ficha Técnica para agrupar por TECIDO (Malha)
  const carregarRendimentoDashboard = async () => {
    try {
      setLoadingRendimento(true);
      
      const resOrdens = await api.get('/producao/ordens').catch(() => ({ data: [] }));
      const resInsumos = await api.get('/estoque/insumos/').catch(() => ({ data: [] }));

      const insumos = resInsumos.data || [];
      const opsCortadas = resOrdens.data.filter(op => op.rendimento_real && parseFloat(op.rendimento_real) > 0);

      if (opsCortadas.length === 0) {
        setDadosRendimentoMalha([]);
        return;
      }

      const idsProdutos = [...new Set(opsCortadas.map(op => op.id_produto))];
      const mapaTecidosPorProduto = {};

      for (const idProduto of idsProdutos) {
        try {
          const resFicha = await api.get(`/produtos/${idProduto}`);
          const ficha = resFicha.data;
          
          const composicao = ficha.composicao || ficha.materiais || ficha.insumos || [];
          let tecidoEncontrado = 'Outros/Misto';

          if (composicao.length > 0) {
            for (const item of composicao) {
              const insumoDetalhe = insumos.find(i => (i.id_insumo || i.id) === (item.id_insumo || item.id));
              
              if (insumoDetalhe) {
                const categoriaStr = (insumoDetalhe.categoria || '').toLowerCase();
                
                if (categoriaStr.includes('tecido') || categoriaStr.includes('malha')) {
                  tecidoEncontrado = insumoDetalhe.tipo || insumoDetalhe.nome_insumo || insumoDetalhe.codigo;
                  break; 
                }
                
                if (tecidoEncontrado === 'Outros/Misto') {
                  tecidoEncontrado = insumoDetalhe.tipo || insumoDetalhe.nome_insumo || insumoDetalhe.codigo;
                }
              }
            }
          }
          
          mapaTecidosPorProduto[idProduto] = tecidoEncontrado;
        } catch (err) {
          console.error(`Erro ao buscar ficha do produto ${idProduto}:`, err);
          mapaTecidosPorProduto[idProduto] = 'Desconhecido';
        }
      }

      const mapaRendimento = {};
      opsCortadas.forEach(op => {
        const tecido = mapaTecidosPorProduto[op.id_produto] || 'Desconhecido';
        
        if (!mapaRendimento[tecido]) {
            mapaRendimento[tecido] = { total: 0, count: 0 };
        }
        mapaRendimento[tecido].total += parseFloat(op.rendimento_real);
        mapaRendimento[tecido].count += 1;
      });

      const graficoFormatado = Object.keys(mapaRendimento)
        .map(tecido => ({
          malha: tecido,
          rendimento: parseFloat((mapaRendimento[tecido].total / mapaRendimento[tecido].count).toFixed(2))
        }))
        .filter(item => item.malha !== 'Outros/Misto' && item.malha !== 'Desconhecido'); 

      setDadosRendimentoMalha(graficoFormatado);
    } catch (error) {
      console.error("Erro ao carregar rendimento para o Dashboard:", error);
    } finally {
      setLoadingRendimento(false);
    }
  };

  // 🔥 3. FUNÇÃO ATUALIZADA: Calcula o Total e o Gráfico de Evolução (Últimos 5 meses)
  const carregarTotalEProducao = async () => {
    try {
      // 1. Cria a base dos últimos 5 meses dinamicamente
      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const ultimos5Meses = [];
      const hoje = new Date();

      for (let i = 4; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        ultimos5Meses.push({
          mesNum: d.getMonth(),
          ano: d.getFullYear(),
          mes: mesesNomes[d.getMonth()],
          quantidade: 0
        });
      }

      // 2. Busca os dados no Back-end
      const res = await api.get('/costura/movimentacoes').catch(() => ({ data: [] }));
      const movimentacoes = res.data || [];
      
      let totalPecas = 0;

      // 3. Percorre os retornos da costura
      movimentacoes.forEach(mov => {
        // Verifica se a movimentação retornou peças
        if (mov.status_movimentacao === 'Retornado' || mov.quantidade_recebida > 0) {
          const qtd = parseInt(mov.quantidade_recebida || 0);
          totalPecas += qtd; 

          // 🔥 CORREÇÃO AQUI: Procura a data em todas as possibilidades do banco
          const dataString = mov.data_retorno || mov.atualizado_em || mov.criado_em || mov.data_envio;
          
          if (dataString) {
            const dataRetorno = new Date(dataString);
            const mesIndex = ultimos5Meses.findIndex(
              m => m.mesNum === dataRetorno.getMonth() && m.ano === dataRetorno.getFullYear()
            );

            // Se o mês da devolução estiver dentro dos últimos 5 meses, soma na barra do gráfico!
            if (mesIndex !== -1) {
              ultimos5Meses[mesIndex].quantidade += qtd;
            }
          }
        }
      });

      setTotalPecasProntas(totalPecas);
      setDadosProducaoMensal(ultimos5Meses);

    } catch (error) {
      console.error("Erro ao buscar histórico de produção:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token_confeccao');
    navigate('/');
  };

  const malhaCampeao = dadosRendimentoMalha.length > 0 
    ? dadosRendimentoMalha.reduce((prev, current) => (prev.rendimento > current.rendimento) ? prev : current) 
    : { malha: 'Aguardando cortes...', rendimento: 0 };

  return (
    <div className="dashboard-container">

      {/* CABEÇALHO MOBILE (Só aparece no celular) */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-box-sm">
            <Scissors size={20} color="#00c875" strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>Confecção Alfa</h2>
        </div>
        <button className="btn-menu-mobile" onClick={() => setMenuMobileAberto(!menuMobileAberto)}>
          {menuMobileAberto ? <X size={24} color="#1f2937" /> : <Menu size={24} color="#1f2937" />}
        </button>
      </div>

      {/* SIDEBAR UNIFICADA (Dinâmica para Desktop e Mobile) */}
      <aside className={`sidebar ${menuMobileAberto ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-box-sm">
            <Scissors size={22} color="#00c875" strokeWidth={2} />
          </div>
          <h2>Confecção Alfa</h2>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active" onClick={() => { navigate('/dashboard'); setMenuMobileAberto(false); }}>
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>
          <button className="nav-item" onClick={() => { navigate('/estoque'); setMenuMobileAberto(false); }}>
            <Package size={19} />
            <span>Estoque</span>
          </button>
          <button className="nav-item" onClick={() => { navigate('/ficha-tecnica'); setMenuMobileAberto(false); }}>
            <FileText size={19} />
            <span>Ficha Técnica</span>
          </button>
          <button className="nav-item" onClick={() => { navigate('/comercial'); setMenuMobileAberto(false); }}>
            <ShoppingCart size={19} />
            <span>Comercial</span>
          </button>
          <button className="nav-item" onClick={() => { navigate('/corte-rendimento'); setMenuMobileAberto(false); }}>
            <Crop size={19} />
            <span>Corte/Rendimento</span>
          </button>
          <button className="nav-item" onClick={() => { navigate('/costura'); setMenuMobileAberto(false); }}>
            <Scissors size={19} />
            <span>Costura</span>
          </button>
          <button className="nav-item" onClick={() => { navigate('/equipe'); setMenuMobileAberto(false); }}>
            <Users size={19} />
            <span>Equipe</span>
          </button>
          <button className="nav-item" onClick={() => { navigate('/configuracoes'); setMenuMobileAberto(false); }}>
            <Users size={19} />
            <span>Configurações</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout" onClick={handleLogout}>
            <LogOut size={19} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>Painel de Controle</h1>
            <p className="subtitle">Acompanhamento em tempo real do estoque, produção e rendimento de calcinhas</p>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">Administração</span>
            </div>
            <div className="avatar">A</div>
          </div>
        </header>

        {/* Indicadores (KPIs)*/}
        <section className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon green">
              <Boxes size={22} />
            </div>
            <div className="kpi-data">
              <span className="kpi-label">Total de Peças em Estoque</span>
              <div className="kpi-value-group">
                <span className="kpi-value">{totalPecasProntas}</span>
                <span className="kpi-unit">peças</span>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon blue">
              <Award size={22} />
            </div>
            <div className="kpi-data">
              <span className="kpi-label">Tecido com Maior Rendimento</span>
              <div className="kpi-value-group">
                <span className="kpi-value text-blue">{malhaCampeao.malha}</span>
                {malhaCampeao.rendimento > 0 && (
                  <span className="kpi-badge positive">{malhaCampeao.rendimento} pçs/kg</span>
                )}
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon amber">
              <AlertTriangle size={22} />
            </div>
            <div className="kpi-data">
              <span className="kpi-label">Insumos em Estoque Crítico</span>
              <div className="kpi-value-group">
                <span className="kpi-value text-amber">{qtdEstoqueCritico}</span>
                <span className="kpi-unit">itens</span>
              </div>
            </div>
          </div>
        </section>

        {/* Gráficos */}
        <section className="charts-grid">
          
          <div className="chart-card">
            <div className="chart-header">
              <h3>Rendimento Médio de Malhas (peças/kg)</h3>
              <span className="chart-tag">Retorno médio por kg de tecido</span>
            </div>
            <div className="chart-wrapper">
              {loadingRendimento ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#6b7280' }}>
                  Carregando dados de rendimento...
                </div>
              ) : dadosRendimentoMalha.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af' }}>
                  Nenhum corte registrado ainda.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dadosRendimentoMalha} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="malha" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 13 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 13 }} unit=" p/kg" />
                    <Tooltip 
                      cursor={{fill: '#f9fafb'}}
                      formatter={(value) => [`${value} peças/kg`, 'Rendimento']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                    />
                    <Bar dataKey="rendimento" name="Rendimento (peças/kg)" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3>Evolução da Produção Mensal</h3>
              <span className="chart-tag">Últimos 5 Meses</span>
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dadosProducaoMensal} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProducao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00c875" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00c875" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <Tooltip 
                    formatter={(value) => [`${value} peças`, 'Produção']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="quantidade" 
                    name="Peças Produzidas" 
                    stroke="#00c875" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorProducao)" 
                    dot={{ r: 5, fill: '#00c875', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card full-width">
            <div className="chart-header">
              <h3>Nível do Estoque de Principais Materiais (kg / unidades)</h3>
              <span className="chart-tag">Atualizado em tempo real</span>
            </div>
            <div className="chart-wrapper">
              {loadingEstoque ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#6b7280' }}>
                  Carregando dados de estoque do banco...
                </div>
              ) : dadosNivelEstoque.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af' }}>
                  Nenhum insumo cadastrado no estoque ainda.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dadosNivelEstoque} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 13 }} />
                    <YAxis dataKey="item" type="category" axisLine={false} tickLine={false} tick={{ fill: '#374151', fontSize: 13 }} width={140} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="quantidade" name="Quantidade Atual" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={20} />
                    <Bar dataKey="min" name="Estoque Mínimo" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </section>
      </main>

    </div>
  );
}

export default Dashboard;