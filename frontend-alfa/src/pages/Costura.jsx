import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ShoppingCart, Crop, Scissors, PackageCheck, Users, LogOut,
  Plus, Search, CheckCircle, Activity, X, ArrowRight, Menu
} from 'lucide-react';
import api from '../services/api';
import './Costura.css';

function Costura() {
  const navigate = useNavigate();
  const userName = 'Gestor Alfa';

  const [movimentacoes, setMovimentacoes] = useState([]);
  const [opsDisponiveis, setOpsDisponiveis] = useState([]);
  const [todasOps, setTodasOps] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Controle do menu mobile
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  // Modais
  const [showModalEnvio, setShowModalEnvio] = useState(false);
  const [showModalRetorno, setShowModalRetorno] = useState(false);

  // Estados dos formulários
  const [novoEnvio, setNovoEnvio] = useState({
    id_op: '',
    destino_costura: '',
    margem_seguranca_insumos: ''
  });

  const [dadosRetorno, setDadosRetorno] = useState({
    id_movimentacao: null,
    nome_costureira: '',
    quantidade_recebida: ''
  });

  // Estado para a caixinha azul da prévia
  const [previaInsumos, setPreviaInsumos] = useState([]);
  const [loadingPrevia, setLoadingPrevia] = useState(false);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const resMovimentacoes = await api.get('/costura/movimentacoes').catch(() => ({ data: [] }));
      setMovimentacoes(resMovimentacoes.data || []);

      const resOps = await api.get('/producao/ordens').catch(() => ({ data: [] }));
      const listaOps = resOps.data || [];
      
      setTodasOps(listaOps);
      setOpsDisponiveis(listaOps.filter(op => op.status_op === 'Corte Finalizado'));
    } catch (error) {
      console.error("Erro ao carregar dados da costura:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) navigate('/');
    else carregarDados();
  }, [navigate]);

  // Efeito que calcula a prévia de elásticos/linhas (ignorando tecidos)
  useEffect(() => {
    const buscarPreviaConsumo = async () => {
      if (!novoEnvio.id_op) {
        setPreviaInsumos([]);
        return;
      }

      const opSelecionada = opsDisponiveis.find(op => op.id_op === parseInt(novoEnvio.id_op));
      if (!opSelecionada) return;

      try {
        setLoadingPrevia(true);
        const resProduto = await api.get(`/produtos/${opSelecionada.id_produto}`);
        const resInsumos = await api.get('/estoque/insumos/').catch(() => api.get('/insumos/')); 
        
        const composicao = resProduto.data.composicao || [];
        const insumos = resInsumos.data || [];

        // Filtra e calcula apenas os aviamentos (Ignora os tecidos/kg que já foram baixados no Corte)
        const calculoPrevia = composicao.map(comp => {
          const insumoDetalhe = insumos.find(i => (i.id_insumo || i.id) === comp.id_insumo);
          
          if (insumoDetalhe) {
            const categoria = (insumoDetalhe.categoria || '').toLowerCase();
            const unidade = (insumoDetalhe.unidade_medida || '').toLowerCase();

            // Filtro rigoroso: Aceita apenas 'aviamentos', 'linhas', 'm' ou 'un'
            if (categoria.includes('aviamento') || categoria.includes('linha') || unidade === 'm' || unidade === 'un') {
              const gastoTotal = parseFloat(comp.gasto_por_unidade) * opSelecionada.quantidade_pecas_cortadas;
              
              return {
                nome: insumoDetalhe.tipo || insumoDetalhe.nome_insumo || 'Aviamento',
                quantidade: gastoTotal.toFixed(2),
                unidade: unidade === 'metros' ? 'm' : (insumoDetalhe.unidade_medida || 'un')
              };
            }
          }
          return null;
        }).filter(item => item !== null);

        setPreviaInsumos(calculoPrevia);
      } catch (error) {
        console.error("Erro ao buscar prévia:", error);
        setPreviaInsumos([]);
      } finally {
        setLoadingPrevia(false);
      }
    };

    buscarPreviaConsumo();
  }, [novoEnvio.id_op, opsDisponiveis]);

  const handleEnviarParaCostura = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        id_op: parseInt(novoEnvio.id_op),
        destino_costura: novoEnvio.destino_costura,
        margem_seguranca_insumos: parseFloat(novoEnvio.margem_seguranca_insumos || 0)
      };

      await api.post('/costura/envios', payload);
      alert('Peças enviadas para a costureira! Insumos baixados do estoque.');
      
      setShowModalEnvio(false);
      setNovoEnvio({ id_op: '', destino_costura: '', margem_seguranca_insumos: '' });
      carregarDados();
    } catch (error) {
      console.error("Erro ao enviar para costura:", error);
      alert(error.response?.data?.detail || 'Erro ao enviar para costura. Verifique o estoque.');
    }
  };

  const abrirModalRetorno = (mov) => {
    setDadosRetorno({
      id_movimentacao: mov.id_movimentacao,
      nome_costureira: mov.destino_costura,
      quantidade_recebida: ''
    });
    setShowModalRetorno(true);
  };

  const handleRegistrarRetorno = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        quantidade_recebida: parseInt(dadosRetorno.quantidade_recebida)
      };

      await api.put(`/costura/retorno/${dadosRetorno.id_movimentacao}`, payload);
      alert('Retorno registrado! Perdas calculadas e estoque pronto atualizado.');
      
      setShowModalRetorno(false);
      carregarDados();
    } catch (error) {
      console.error("Erro ao registrar retorno:", error);
      alert('Erro ao registrar o retorno da costura.');
    }
  };

  const movimentacoesFiltradas = movimentacoes.filter(mov => 
    (mov.destino_costura || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      
      {/* CABEÇALHO MOBILE */}
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

      {/* Sidebar Responsiva */}
      <aside className={`sidebar ${menuMobileAberto ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-box-sm"><Scissors size={22} color="#00c875" strokeWidth={2} /></div>
          <h2>Confecção Alfa</h2>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item" onClick={() => { navigate('/dashboard'); setMenuMobileAberto(false); }}><LayoutDashboard size={19} /><span>Dashboard</span></button>
          <button className="nav-item" onClick={() => { navigate('/estoque'); setMenuMobileAberto(false); }}><Package size={19} /><span>Estoque</span></button>
          <button className="nav-item" onClick={() => { navigate('/ficha-tecnica'); setMenuMobileAberto(false); }}><FileText size={19} /><span>Ficha Técnica</span></button>
          <button className="nav-item" onClick={() => { navigate('/comercial'); setMenuMobileAberto(false); }}><ShoppingCart size={19} /><span>Comercial</span></button>
          <button className="nav-item" onClick={() => { navigate('/corte-rendimento'); setMenuMobileAberto(false); }}><Crop size={19} /><span>Corte/Rendimento</span></button>
          <button className="nav-item active" onClick={() => { navigate('/costura'); setMenuMobileAberto(false); }}><Scissors size={19} /><span>Costura</span></button>
          <button className="nav-item" onClick={() => { navigate('/equipe'); setMenuMobileAberto(false); }}><Users size={19} /><span>Equipe</span></button>
          <button className="nav-item" onClick={() => { navigate('/configuracoes'); setMenuMobileAberto(false); }}><Users size={19} /><span>Configurações</span></button>
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item logout" onClick={() => { localStorage.removeItem('token_confeccao'); navigate('/'); }}><LogOut size={19} /><span>Sair</span></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>Controle de Costura</h1>
            <p className="subtitle">Gestão de envios para oficinas, retorno de peças e baixa de aviamentos</p>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">Administração</span>
            </div>
            <div className="avatar">A</div>
          </div>
        </header>

        <section className="action-bar-card">
          <div className="search-filter-group">
            <div className="search-box">
              <Search size={18} color="#9ca3af" />
              <input 
                type="text" 
                placeholder="Buscar por nome da costureira..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <button className="primary-btn" onClick={() => setShowModalEnvio(true)}>
            <Plus size={18} />
            <span>Novo Envio</span>
          </button>
        </section>

        <section className="table-card">
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>OP Vinculada</th>
                  <th>Destino (Costureira)</th>
                  <th>Qtd Enviada</th>
                  <th>Peças Boas</th>
                  <th>Perdas</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>Carregando...</td></tr>
                ) : movimentacoesFiltradas.length === 0 ? (
                  <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px', color: '#6b7280'}}>Nenhum registro de costura encontrado.</td></tr>
                ) : (
                  movimentacoesFiltradas.map((mov) => {
                    const isRetornado = mov.status_movimentacao === 'Retornado';
                    const opEncontrada = todasOps.find(op => op.id_op === mov.id_op);
                    const codigoOpAmigavel = opEncontrada ? opEncontrada.codigo_op : `OP #${mov.id_op}`;
                    
                    return (
                      <tr key={mov.id_movimentacao}>
                        <td className="font-semibold text-gray-800">{codigoOpAmigavel}</td>
                        <td className="font-bold text-gray-700">{mov.destino_costura}</td>
                        <td className="font-bold text-blue-600">{mov.quantidade_enviada} un</td>
                        <td className={isRetornado ? "font-bold text-green-600" : "text-gray-400"}>
                          {isRetornado ? `${mov.quantidade_recebida} un` : 'Aguardando'}
                        </td>
                        <td className={mov.perda_pecas > 0 ? "font-bold text-red-500" : "text-gray-400"}>
                          {isRetornado ? (mov.perda_pecas > 0 ? `${mov.perda_pecas} un` : '0 un') : '-'}
                        </td>
                        <td>
                          {isRetornado ? (
                            <span className="status-badge green"><CheckCircle size={13} /> Finalizado</span>
                          ) : (
                            <span className="status-badge amber"><Activity size={13} /> Em Costura</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {!isRetornado && (
                            <button 
                              className="icon-action-btn primary"
                              title="Registrar Retorno"
                              onClick={() => abrirModalRetorno(mov)}
                              style={{ backgroundColor: '#eff6ff', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                            >
                              Retorno <ArrowRight size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODAL 1: ENVIAR PARA COSTURA */}
      {showModalEnvio && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Enviar para Costura</h2>
              <button className="close-btn" onClick={() => setShowModalEnvio(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEnviarParaCostura} className="modal-form">
              <div className="input-group">
                <label>Selecione a OP (Corte Finalizado)</label>
                <select 
                  value={novoEnvio.id_op}
                  onChange={(e) => setNovoEnvio({...novoEnvio, id_op: e.target.value})}
                  required
                >
                  <option value="">Escolha a Ordem de Produção...</option>
                  {opsDisponiveis.map(op => (
                    <option key={op.id_op} value={op.id_op}>
                      {op.codigo_op} - ({op.quantidade_pecas_cortadas} peças cortadas)
                    </option>
                  ))}
                </select>
              </div>

              {/* Caixinha azul dinâmica para prévia do consumo de aviamentos */}
              {loadingPrevia && <div style={{fontSize: '12px', color: '#6b7280'}}>Calculando prévia de aviamentos...</div>}
              {previaInsumos.length > 0 && (
                <div style={{backgroundColor: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe', marginTop: '4px', marginBottom: '8px'}}>
                  <p style={{fontSize: '13px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '6px'}}>Prévia de Aviamentos Necessários:</p>
                  <ul style={{ margin: 0, paddingLeft: '16px', color: '#3b82f6', fontSize: '13px' }}>
                      {previaInsumos.map((item, index) => (
                        <li key={index}><strong>{item.quantidade} {item.unidade}</strong> de {item.nome}</li>
                      ))}
                    </ul>
                </div>
              )}

              <div className="input-group">
                <label>Destino (Nome da Costureira/Oficina)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Confecção da Maria" 
                  value={novoEnvio.destino_costura}
                  onChange={(e) => setNovoEnvio({...novoEnvio, destino_costura: e.target.value})}
                  required 
                />
              </div>

              <div className="input-group">
                <label>Margem de Segurança Aviamentos (metros)</label>
                <input 
                  type="number" 
                  step="0.001" 
                  placeholder="Ex: 50.000" 
                  value={novoEnvio.margem_seguranca_insumos}
                  onChange={(e) => setNovoEnvio({...novoEnvio, margem_seguranca_insumos: e.target.value})}
                />
                <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px'}}>*Valor extra enviado para repor defeitos.</small>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalEnvio(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Confirmar Envio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR RETORNO */}
      {showModalRetorno && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Registrar Retorno</h2>
              <button className="close-btn" onClick={() => setShowModalRetorno(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRegistrarRetorno} className="modal-form">
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '15px' }}>
                Costureira: <strong style={{ color: '#1f2937' }}>{dadosRetorno.nome_costureira}</strong>
              </p>
              
              <div className="input-group">
                <label>Quantidade de Peças Recebidas (Prontas)</label>
                <input 
                  type="number" 
                  placeholder="Ex: 790" 
                  value={dadosRetorno.quantidade_recebida}
                  onChange={(e) => setDadosRetorno({...dadosRetorno, quantidade_recebida: e.target.value})}
                  required 
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalRetorno(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar Fechamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Costura;