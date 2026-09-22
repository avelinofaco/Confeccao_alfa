import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ShoppingCart, Crop, Scissors, PackageCheck, Users, LogOut,
  Plus, Search, X, Calendar, Check, Trash2, Menu
} from 'lucide-react';
import api from '../services/api';
import './Comercial.css';

function Comercial() {
  const navigate = useNavigate();
  const userName = 'Gestor Alfa';

  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Controle do menu mobile
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  const [novoPedido, setNovoPedido] = useState({
    codigo_pedido: '',
    nome_cliente: '',
    id_produto: '',
    quantidade_pecas: 1,
    data_entrega_desejada: '',
    valor_total: 0,
    observacoes: ''
  });

  const carregarDados = async () => {
    try {
      setLoading(true);
      const resPedidos = await api.get('/comercial/pedidos').catch(() => ({ data: [] }));
      setPedidos(resPedidos.data || []);

      const resProdutos = await api.get('/produtos/').catch(() => ({ data: [] }));
      setProdutos(resProdutos.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados do comercial:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token_confeccao');
    if (!token) navigate('/');
    else carregarDados();
  }, [navigate]);

  const handleCriarPedido = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        codigo_pedido: novoPedido.codigo_pedido,
        nome_cliente: novoPedido.nome_cliente,
        id_produto: parseInt(novoPedido.id_produto),
        quantidade_pecas: parseInt(novoPedido.quantidade_pecas),
        data_entrega_desejada: novoPedido.data_entrega_desejada,
        valor_total: parseFloat(novoPedido.valor_total),
        observacoes: novoPedido.observacoes
      };

      await api.post('/comercial/pedidos', payload);
      alert('Pedido criado com sucesso!');
      
      setShowModal(false);
      setNovoPedido({
        codigo_pedido: '', nome_cliente: '', id_produto: '', quantidade_pecas: 1, 
        data_entrega_desejada: '', valor_total: 0, observacoes: ''
      });
      carregarDados();

    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      alert('Erro ao registrar pedido. Verifique os dados preenchidos.');
    }
  };

  // AÇÃO: Confirmar Entrega
  const handleConfirmarEntrega = async (id) => {
    if (window.confirm("Deseja confirmar a entrega deste pedido ao cliente?")) {
      try {
        await api.put(`/comercial/pedidos/${id}/status`, { status_pedido: 'Entregue' });
        carregarDados();
      } catch (error) {
        console.error("Erro ao confirmar entrega:", error);
        alert("Não foi possível atualizar o status do pedido.");
      }
    }
  };

  // AÇÃO: Deletar Pedido
  const handleDeletarPedido = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este pedido?")) {
      try {
        await api.delete(`/comercial/pedidos/${id}`);
        carregarDados();
      } catch (error) {
        console.error("Erro ao deletar pedido:", error);
        alert("Não foi possível excluir o pedido.");
      }
    }
  };

  const pedidosFiltrados = pedidos.filter(ped => 
    (ped.nome_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ped.codigo_pedido || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {/* Sidebar - Menu Lateral Responsivo */}
      <aside className={`sidebar ${menuMobileAberto ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-box-sm"><Scissors size={22} color="#00c875" strokeWidth={2} /></div>
          <h2>Confecção Alfa</h2>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item" onClick={() => { navigate('/dashboard'); setMenuMobileAberto(false); }}><LayoutDashboard size={19} /><span>Dashboard</span></button>
          <button className="nav-item" onClick={() => { navigate('/estoque'); setMenuMobileAberto(false); }}><Package size={19} /><span>Estoque</span></button>
          <button className="nav-item" onClick={() => { navigate('/ficha-tecnica'); setMenuMobileAberto(false); }}><FileText size={19} /><span>Ficha Técnica</span></button>
          <button className="nav-item active" onClick={() => { navigate('/comercial'); setMenuMobileAberto(false); }}><ShoppingCart size={19} /><span>Comercial</span></button>
          <button className="nav-item" onClick={() => { navigate('/corte-rendimento'); setMenuMobileAberto(false); }}><Crop size={19} /><span>Corte/Rendimento</span></button>
          <button className="nav-item" onClick={() => { navigate('/costura'); setMenuMobileAberto(false); }}><Scissors size={19} /><span>Costura</span></button>
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
            <h1>Gestão Comercial</h1>
            <p className="subtitle">Controle de pedidos de clientes e acompanhamento de vendas</p>
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
                placeholder="Buscar por cliente ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <button className="primary-btn" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            <span>Novo Pedido</span>
          </button>
        </section>

        <section className="table-card">
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Produto</th>
                  <th>Qtd.</th>
                  <th>Data de Entrega</th>
                  <th>Valor Total</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>Carregando pedidos...</td></tr>
                ) : pedidosFiltrados.length === 0 ? (
                  <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>Nenhum pedido encontrado.</td></tr>
                ) : (
                  pedidosFiltrados.map((ped) => {
                    const infoProduto = produtos.find(p => (p.id_produto || p.id) === ped.id_produto) || {};
                    const isEntregue = ped.status_pedido === 'Entregue';
                    const idPedido = ped.id_pedido || ped.id;

                    return (
                      <tr key={idPedido}>
                        <td className="font-semibold text-gray-800">{ped.codigo_pedido}</td>
                        <td className="font-bold text-gray-700">{ped.nome_cliente}</td>
                        <td className="text-gray-600">{infoProduto.nome_modelo || infoProduto.nome || 'Desconhecido'}</td>
                        <td className="font-bold text-blue-600">{ped.quantidade_pecas} un</td>
                        <td>
                          <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563'}}>
                            <Calendar size={14} /> 
                            {ped.data_entrega_desejada}
                          </div>
                        </td>
                        <td className="font-bold text-green-600">
                          R$ {Number(ped.valor_total).toFixed(2).replace('.', ',')}
                        </td>
                        <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button 
                            title={isEntregue ? "Pedido Entregue" : "Confirmar Entrega"}
                            onClick={() => !isEntregue && handleConfirmarEntrega(idPedido)}
                            style={{ 
                              backgroundColor: isEntregue ? '#00c875' : '#e8f5e9', 
                              color: isEntregue ? '#ffffff' : '#00c875',
                              border: 'none',
                              padding: '6px',
                              borderRadius: '6px',
                              cursor: isEntregue ? 'default' : 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Check size={16} />
                          </button>

                          <button 
                            title="Excluir Pedido" 
                            onClick={() => handleDeletarPedido(idPedido)}
                            style={{
                              backgroundColor: '#fee2e2',
                              color: '#ef4444',
                              border: 'none',
                              padding: '6px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
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

      {/* MODAL NOVO PEDIDO */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Novo Pedido</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCriarPedido} className="modal-form">
              <div className="form-row">
                <div className="input-group">
                  <label>Código do Pedido</label>
                  <input type="text" value={novoPedido.codigo_pedido} onChange={(e) => setNovoPedido({...novoPedido, codigo_pedido: e.target.value})} required />
                </div>
                <div className="input-group">
                  <label>Nome do Cliente</label>
                  <input type="text" value={novoPedido.nome_cliente} onChange={(e) => setNovoPedido({...novoPedido, nome_cliente: e.target.value})} required />
                </div>
              </div>

              <div className="input-group">
                <label>Produto</label>
                <select value={novoPedido.id_produto} onChange={(e) => setNovoPedido({...novoPedido, id_produto: e.target.value})} required>
                  <option value="">Selecione o produto...</option>
                  {produtos.map(p => (
                    <option key={p.id_produto || p.id} value={p.id_produto || p.id}>
                      {p.nome_modelo || p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row-three">
                <div className="input-group">
                  <label>Quantidade</label>
                  <input type="number" min="1" value={novoPedido.quantidade_pecas} onChange={(e) => setNovoPedido({...novoPedido, quantidade_pecas: e.target.value})} required />
                </div>
                <div className="input-group">
                  <label>Data Desejada</label>
                  <input type="date" value={novoPedido.data_entrega_desejada} onChange={(e) => setNovoPedido({...novoPedido, data_entrega_desejada: e.target.value})} required />
                </div>
                <div className="input-group">
                  <label>Valor Total (R$)</label>
                  <input type="number" step="0.01" value={novoPedido.valor_total} onChange={(e) => setNovoPedido({...novoPedido, valor_total: e.target.value})} required />
                </div>
              </div>

              <div className="input-group">
                <label>Observações</label>
                <textarea rows="3" value={novoPedido.observacoes} onChange={(e) => setNovoPedido({...novoPedido, observacoes: e.target.value})} className="textarea-field"></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar Pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Comercial;