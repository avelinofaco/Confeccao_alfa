import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ShoppingCart, Crop, Scissors, PackageCheck, Users, LogOut,
  Plus, Search, PlusCircle, X, ChevronRight, Menu
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './FichaTecnica.css';

function FichaTecnica() {
  const navigate = useNavigate();
  const userName = 'Gestor Alfa';

  const [produtos, setProdutos] = useState([]);
  const [insumosDisponiveis, setInsumosDisponiveis] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [detalhesProduto, setDetalhesProduto] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Controle do menu mobile
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  // Modais
  const [showModalModelo, setShowModalModelo] = useState(false);
  const [showModalInsumo, setShowModalInsumo] = useState(false);

  // Estados dos formulários
  const [nomeModelo, setNomeModelo] = useState('');
  const [novoConsumo, setNovoConsumo] = useState({
    id_insumo: '',
    gasto_por_unidade: ''
  });

  // Carregar lista de modelos e insumos do banco
  const carregarDadosIniciais = async () => {
    try {
      setLoading(true);
      
      const resProdutos = await api.get('/produtos/'); 
      setProdutos(resProdutos.data || []);

      const resInsumos = await api.get('/estoque/insumos/').catch(() => api.get('/insumos/'));
      setInsumosDisponiveis(resInsumos.data || []);

    } catch (error) {
      console.error("Erro ao carregar dados iniciais:", error);
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  };

  // Buscar detalhes do produto + materiais consumidos
  const carregarDetalhesProduto = async (idProduto) => {
    if (!idProduto || idProduto === '{id}' || idProduto.toString().includes('id')) {
      return; 
    }

    try {
      setLoadingDetalhes(true);
      setProdutoSelecionado(idProduto);
      
      const response = await api.get(`/produtos/${idProduto}`);
      setDetalhesProduto(response.data);

    } catch (error) {
      console.error("Erro ao buscar detalhes da ficha:", error);
      alert("Não foi possível carregar os detalhes deste modelo.");
    } finally {
      setLoadingDetalhes(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) navigate('/');
    else carregarDadosIniciais();
  }, [navigate]);

  // Cadastrar Novo Modelo
  const handleCadastrarModelo = async (e) => {
    e.preventDefault();
    try {
      const payload = { nome_modelo: nomeModelo };
      
      const response = await api.post('/produtos/', payload);
      alert('Modelo/Ficha Técnica criado com sucesso!');
      
      setShowModalModelo(false);
      setNomeModelo('');
      
      await carregarDadosIniciais();

      const recemCriado = response.data;
      const novoId = recemCriado?.id_produto || recemCriado?.id;

      if (novoId) {
        carregarDetalhesProduto(novoId);
      }

    } catch (error) {
      console.error("Erro ao cadastrar modelo:", error);
      alert('Erro ao criar modelo. Verifique os dados.');
    }
  };

  // Adicionar Insumo à Ficha
  const handleAdicionarInsumoFicha = async (e) => {
    e.preventDefault();
    if (!produtoSelecionado) return;

    try {
      const payload = {
        id_insumo: parseInt(novoConsumo.id_insumo),
        gasto_por_unidade: parseFloat(novoConsumo.gasto_por_unidade)
      };

      // Rota correta apontando para "insumos"
      await api.post(`/produtos/${produtoSelecionado}/insumos`, payload);
      alert('Insumo vinculado à ficha técnica com sucesso!');

      setShowModalInsumo(false);
      setNovoConsumo({ id_insumo: '', gasto_por_unidade: '' });
      carregarDetalhesProduto(produtoSelecionado);

    } catch (error) {
      console.error("Erro ao vincular insumo:", error);
      alert('Erro ao vincular insumo à ficha.');
    }
  };

  const formatarConsumoExplicativo = (consumoValor, unidadeMedida, nomeInsumo) => {
    const consumo = parseFloat(consumoValor || 0);
    const un = (unidadeMedida || '').toLowerCase().trim();
    const nome = (nomeInsumo || '').toLowerCase();

    // Se for linha de costura
    if (nome.includes('linha') || nome.includes('fio') || nome.includes('carretel')) {
      const metros = Math.round(consumo * 4000);
      const pecasPorCone = consumo > 0 ? Math.round(1 / consumo) : 50;
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, color: '#00c875' }}>
            {consumo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} carretel
          </span>
          <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
            (~{metros}m de costura | 1 cone rende ~{pecasPorCone} peças)
          </small>
        </div>
      );
    }

    // Se for tecido ou malha em kg
    if (un === 'kg' || nome.includes('tecido') || nome.includes('malha') || nome.includes('microfibra') || nome.includes('algodão')) {
      const gramas = Math.round(consumo * 1000);
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, color: '#00c875' }}>
            {consumo.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 })} kg
          </span>
          <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
            ({gramas} g de malha por peça)
          </small>
        </div>
      );
    }

    // Se for medido em metros (elásticos, rendas em tira, viés)
    if (un === 'm' || un === 'metro' || un === 'metros' || nome.includes('elástico') || nome.includes('elastico') || nome.includes('viés') || nome.includes('vies')) {
      const cm = Math.round(consumo * 100);
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, color: '#00c875' }}>
            {consumo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} m
          </span>
          <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
            ({cm} cm de elástico/renda por peça)
          </small>
        </div>
      );
    }

    // Padrão: aviamentos unitários (etiquetas, lacinhos, tags, argolas)
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 700, color: '#00c875' }}>
          {consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un
        </span>
        <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
          ({consumo === 1 ? '1 unidade' : `${consumo} unidades`} por peça)
        </small>
      </div>
    );
  };

  const produtosFiltrados = produtos.filter(p => 
    (p.nome_modelo || p.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
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

      {/* Sidebar - Menu Lateral Responsivo com Troca de Segmento */}
      <Sidebar menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto} />

      {/* Conteúdo Principal */}
      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>Ficha Técnica de Produtos</h1>
            <p className="subtitle">Mapeamento de consumo de insumos por modelo de calcinha</p>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">Administração</span>
            </div>
            <div className="avatar">A</div>
          </div>
        </header>

        {/* SEÇÃO SUPERIOR HORIZONTAL: MODELOS DE PRODUTOS */}
        <section className="modelos-horizontal-container">
          <div className="modelos-horizontal-header">
            <div className="search-box modelos-search">
              <Search size={18} color="#9ca3af" />
              <input 
                type="text" 
                placeholder="Buscar modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="primary-btn" onClick={() => setShowModalModelo(true)}>
              <Plus size={18} />
              <span>Novo Modelo</span>
            </button>
          </div>

          <div className="modelos-horizontal-strip">
            {loading ? (
              <div className="loading-card">Carregando modelos...</div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="empty-card">Nenhum modelo cadastrado.</div>
            ) : (
              produtosFiltrados.map((item) => {
                const produtoId = item.id_produto || item.id;
                const isSelected = produtoSelecionado === produtoId;
                return (
                  <button 
                    key={produtoId}
                    type="button"
                    className={`modelo-chip ${isSelected ? 'active' : ''}`}
                    onClick={() => carregarDetalhesProduto(produtoId)}
                  >
                    <span className="modelo-chip-tag">Calcinha</span>
                    <span className="modelo-chip-title">{item.nome_modelo || item.nome}</span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* DETALHES DA FICHA TÉCNICA (LARGURA TOTAL) */}
        <section className="detalhes-full-container">
          {!produtoSelecionado ? (
            <div className="empty-details-card">
              <FileText size={48} color="#9ca3af" strokeWidth={1} />
              <h3>Selecione um modelo acima</h3>
              <p>Clique em um dos modelos na barra horizontal acima para visualizar e gerenciar o consumo de insumos.</p>
            </div>
          ) : loadingDetalhes ? (
            <div className="loading-card">Carregando ficha técnica do produto...</div>
          ) : (
            <div className="ficha-detalhes-card">
              <div className="ficha-header">
                <div>
                  <span className="category-badge">Ficha Técnica #{detalhesProduto?.id_produto || detalhesProduto?.id}</span>
                  <h2>{detalhesProduto?.nome_modelo || detalhesProduto?.nome}</h2>
                </div>
                <button className="primary-btn-outline" onClick={() => setShowModalInsumo(true)}>
                  <PlusCircle size={18} />
                  <span>Adicionar Insumo</span>
                </button>
              </div>

              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Código Insumo</th>
                      <th>Material / Tipo</th>
                      <th>Consumo por Peça</th>
                      <th>Unidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const listaInsumos = detalhesProduto?.composicao || 
                                           detalhesProduto?.materiais || 
                                           detalhesProduto?.insumos || 
                                           detalhesProduto?.ficha_tecnica_insumos || 
                                           [];

                      if (listaInsumos.length === 0) {
                        return (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>
                              Nenhum insumo vinculado a esta ficha técnica ainda.
                            </td>
                          </tr>
                        );
                      }

                      return listaInsumos.map((comp, index) => {
                        const info = insumosDisponiveis.find(i => (i.id_insumo || i.id) === (comp.id_insumo || comp.id)) || {};
                        const unidadeReal = info.unidade_medida || comp.unidade_medida || 'kg';
                        const nomeReal = info.tipo || info.nome_insumo || 'Material';

                        return (
                          <tr key={comp.id_ficha_tecnica || index}>
                            <td className="font-semibold text-gray-500">{info.codigo || `-`}</td>
                            <td className="font-semibold text-gray-800">{nomeReal}</td>
                            <td>
                              {formatarConsumoExplicativo(comp.gasto_por_unidade, unidadeReal, nomeReal)}
                            </td>
                            <td className="text-gray-500">{unidadeReal}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* MODAL 1: CADASTRAR NOVO MODELO */}
      {showModalModelo && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Cadastrar Novo Modelo de Roupa</h2>
              <button className="close-btn" onClick={() => setShowModalModelo(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCadastrarModelo} className="modal-form">
              <div className="input-group">
                <label>Nome do Modelo / Produto</label>
                <input 
                  type="text" 
                  placeholder="Ex: Calcinha Rendada Fio Dental M" 
                  value={nomeModelo}
                  onChange={(e) => setNomeModelo(e.target.value)}
                  required 
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalModelo(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar Modelo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VINCULAR INSUMO E GASTO POR UNIDADE */}
      {showModalInsumo && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Adicionar Insumo à Ficha Técnica</h2>
              <button className="close-btn" onClick={() => setShowModalInsumo(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdicionarInsumoFicha} className="modal-form">
              <div className="input-group">
                <label>Selecione a Matéria-Prima / Insumo</label>
                <select 
                  value={novoConsumo.id_insumo}
                  onChange={(e) => setNovoConsumo({...novoConsumo, id_insumo: e.target.value})}
                  required
                >
                  <option value="">Selecione um insumo do estoque...</option>
                  {insumosDisponiveis.map(i => (
                    <option key={i.id_insumo || i.id} value={i.id_insumo || i.id}>
                      {i.codigo} - {i.tipo} [{i.unidade_medida}]
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const insumoSel = insumosDisponiveis.find(i => (i.id_insumo || i.id)?.toString() === novoConsumo.id_insumo?.toString());
                return (
                  <div className="input-group">
                    <label>
                      Gasto/Consumo por Unidade Produzida
                      {insumoSel?.unidade_medida && (
                        <span style={{ marginLeft: '8px', color: '#00c875', fontWeight: 600 }}>
                          ({insumoSel.unidade_medida})
                        </span>
                      )}
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="number" 
                        step="0.0001" 
                        placeholder={insumoSel?.unidade_medida ? `Ex: 0.0450 (${insumoSel.unidade_medida} por peça)` : "Ex: 0.0450"} 
                        value={novoConsumo.gasto_por_unidade}
                        onChange={(e) => setNovoConsumo({...novoConsumo, gasto_por_unidade: e.target.value})}
                        required 
                        style={{ paddingRight: insumoSel?.unidade_medida ? '55px' : '12px' }}
                      />
                      {insumoSel?.unidade_medida && (
                        <span style={{ 
                          position: 'absolute', 
                          right: '12px', 
                          color: '#6b7280', 
                          fontSize: '13px', 
                          fontWeight: '600',
                          backgroundColor: '#f3f4f6',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {insumoSel.unidade_medida}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalInsumo(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Adicionar à Ficha</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default FichaTecnica;