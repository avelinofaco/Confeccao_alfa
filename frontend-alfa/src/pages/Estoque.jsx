import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Plus,
  Search,
  AlertTriangle,
  Boxes,
  Layers,
  Trash2,
  X,
  PlusCircle,
  Menu
} from "lucide-react";
import api from "../services/api";
import "./Estoque.css";

function Estoque() {
  const navigate = useNavigate();
  const userName = "Gestor Alfa";

  const [materiais, setMateriais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("Todos");
  
  // Controle do menu mobile
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  // Controle dos Modais
  const [showModalCadastro, setShowModalCadastro] = useState(false);
  const [showModalEntrada, setShowModalEntrada] = useState(false);

  const [novoInsumo, setNovoInsumo] = useState({
    codigo: "",
    categoria: "Tecidos",
    tipo: "",
    unidade_medida: "kg",
    estoque_minimo_seguranca: "",
  });

  const [dadosEntrada, setDadosEntrada] = useState({
    id_insumo: null,
    nome_exibicao: "",
    quantidade_recebida: "",
  });

  // BUSCA REAL NO BANCO DE DADOS
  const carregarEstoque = async () => {
    try {
      setLoading(true);
      const response = await api.get("/estoque/insumos/");
      setMateriais(response.data);
    } catch (error) {
      console.error("Erro ao carregar do banco:", error);
      setMateriais([]); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token_confeccao");
    if (!token) navigate("/");
    else carregarEstoque();
  }, [navigate]);

  // CADASTRAR NO BANCO DE DADOS
  const handleCadastrarInsumo = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        codigo: novoInsumo.codigo,
        categoria: novoInsumo.categoria,
        tipo: novoInsumo.tipo,
        unidade_medida: novoInsumo.unidade_medida,
        estoque_minimo_seguranca: parseFloat(novoInsumo.estoque_minimo_seguranca),
      };

      await api.post("/estoque/insumos/", payload);
      alert("Insumo cadastrado no catálogo com sucesso!");

      setShowModalCadastro(false);
      setNovoInsumo({
        codigo: "",
        categoria: "Tecidos",
        tipo: "",
        unidade_medida: "kg",
        estoque_minimo_seguranca: "",
      });
      carregarEstoque(); 
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      alert("Erro ao salvar no banco. Verifique os dados ou o terminal do FastAPI.");
    }
  };

  // REGISTRAR ENTRADA NO BANCO DE DADOS
  const abrirModalEntrada = (insumo) => {
    setDadosEntrada({
      id_insumo: insumo.id_insumo,
      nome_exibicao: `${insumo.codigo} - ${insumo.tipo}`,
      quantidade_recebida: "",
    });
    setShowModalEntrada(true);
  };

  const handleRegistrarEntrada = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        id_insumo: dadosEntrada.id_insumo,
        quantidade_recebida: parseFloat(dadosEntrada.quantidade_recebida),
      };

      await api.post("/estoque/entradas/", payload);
      alert("Entrada de material registrada com sucesso!");
      setShowModalEntrada(false);
      carregarEstoque();
    } catch (error) {
      console.error("Erro ao registrar entrada:", error);
      alert("Erro ao registrar entrada.");
    }
  };

  // Excluir item protegido
  const handleExcluirInsumo = async (id) => {
    if (window.confirm("Deseja realmente remover este item do catálogo?")) {
      try {
        await api.delete(`/estoque/${id}`);
        carregarEstoque();
      } catch (error) {
        alert("Não foi possível excluir o item. Ele pode ter movimentações atreladas.");
      }
    }
  };

  // Filtros
  const materiaisFiltrados = materiais.filter((item) => {
    const termo = searchTerm.toLowerCase();
    const bateBusca =
      (item.tipo || "").toLowerCase().includes(termo) ||
      (item.codigo || "").toLowerCase().includes(termo);
    const bateCategoria = filterCategoria === "Todos" || item.categoria === filterCategoria;
    return bateBusca && bateCategoria;
  });

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
          <div className="logo-box-sm">
            <Scissors size={22} color="#00c875" strokeWidth={2} />
          </div>
          <h2>Confecção Alfa</h2>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item" onClick={() => { navigate('/dashboard'); setMenuMobileAberto(false); }}>
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>
          <button className="nav-item active" onClick={() => { navigate('/estoque'); setMenuMobileAberto(false); }}>
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
          <button className="nav-item logout" onClick={() => { localStorage.removeItem("token_confeccao"); navigate("/"); }}>
            <LogOut size={19} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>Controle de Estoque</h1>
            <p className="subtitle">Gestão de catálogo de materiais e registro de entradas</p>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">Administração</span>
            </div>
            <div className="avatar">A</div>
          </div>
        </header>

        {/* Indicadores KPIs */}
        <section className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon green">
              <Boxes size={22} />
            </div>
            <div className="kpi-data">
              <span className="kpi-label">Itens no Catálogo</span>
              <div className="kpi-value-group">
                <span className="kpi-value">{materiais.length}</span>
              </div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon amber">
              <AlertTriangle size={22} />
            </div>
            <div className="kpi-data">
              <span className="kpi-label">Itens em Estoque Crítico</span>
              <div className="kpi-value-group">
                <span className="kpi-value text-amber">
                  {materiais.filter(i => (parseFloat(i.quantidade_atual) || 0) <= (parseFloat(i.estoque_minimo_seguranca) || 0)).length}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Barra de Ações */}
        <section className="action-bar-card">
          <div className="search-filter-group">
            <div className="search-box">
              <Search size={18} color="#9ca3af" />
              <input
                type="text"
                placeholder="Buscar por código ou tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="select-filter"
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
            >
              <option value="Todos">Todas as Categorias</option>
              <option value="Tecidos">Tecidos / Malhas</option>
              <option value="Aviamentos">Aviamentos e Elásticos</option>
              <option value="Linhas/Fios">Linhas e Fios</option>
            </select>
          </div>
          <button className="primary-btn" onClick={() => setShowModalCadastro(true)}>
            <Plus size={18} />
            <span>Cadastrar Insumo</span>
          </button>
        </section>

        {/* Tabela de Insumos - Adicionada DIV table-responsive para scroll lateral */}
        <section className="table-card">
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Qtd. Atual</th>
                  <th>Mínimo</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>Carregando dados...</td></tr>
                ) : materiaisFiltrados.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>Nenhum insumo encontrado.</td></tr>
                ) : (
                  materiaisFiltrados.map((item) => {
                    const qtdAtual = parseFloat(item.quantidade_atual) || 0;
                    const minSeguranca = parseFloat(item.estoque_minimo_seguranca) || 0;
                    const eCritico = qtdAtual <= minSeguranca;
                    return (
                      <tr key={item.id_insumo}>
                        <td className="font-semibold text-gray-500">{item.codigo}</td>
                        <td className="font-semibold text-gray-800">
                          {item.tipo} <br />
                          <span style={{ fontSize: "11px", color: "#6b7280" }}>{item.categoria}</span>
                        </td>
                        <td className="font-bold text-gray-900">
                          {item.quantidade_atual || 0} <span className="unit-label">{item.unidade_medida}</span>
                        </td>
                        <td className="text-gray-500">
                          {item.estoque_minimo_seguranca} {item.unidade_medida}
                        </td>
                        <td>
                          {eCritico ? (
                            <span className="status-badge red"><AlertTriangle size={13} /> Repor</span>
                          ) : (
                            <span className="status-badge green">OK</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                          <button
                            className="icon-action-btn primary"
                            title="Registrar Entrada"
                            onClick={() => abrirModalEntrada(item)}
                            style={{ backgroundColor: "#e8f5e9", color: "#00c875" }}
                          >
                            <PlusCircle size={16} /> Entrada
                          </button>
                          <button className="icon-action-btn delete" title="Excluir" onClick={() => handleExcluirInsumo(item.id_insumo)}>
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

      {/* MODAIS (CADASTRAR E ENTRADA) - Mantidos inalterados visualmente */}
      {showModalCadastro && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Catálogo: Novo Insumo</h2>
              <button className="close-btn" onClick={() => setShowModalCadastro(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCadastrarInsumo} className="modal-form">
              <div className="form-row">
                <div className="input-group">
                  <label>Código (Referência)</label>
                  <input type="text" placeholder="Ex: TEC-001" value={novoInsumo.codigo} onChange={(e) => setNovoInsumo({ ...novoInsumo, codigo: e.target.value })} required />
                </div>
                <div className="input-group">
                  <label>Categoria</label>
                  <select value={novoInsumo.categoria} onChange={(e) => setNovoInsumo({ ...novoInsumo, categoria: e.target.value })}>
                    <option value="Tecidos">Tecidos / Malhas</option>
                    <option value="Aviamentos">Aviamentos e Elásticos</option>
                    <option value="Linhas/Fios">Linhas e Fios</option>
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label>Tipo / Nome</label>
                <input type="text" placeholder="Ex: Microfibra Poliamida" value={novoInsumo.tipo} onChange={(e) => setNovoInsumo({ ...novoInsumo, tipo: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Unidade</label>
                  <select value={novoInsumo.unidade_medida} onChange={(e) => setNovoInsumo({ ...novoInsumo, unidade_medida: e.target.value })}>
                    <option value="kg">Quilogramas (kg)</option>
                    <option value="m">Metros (m)</option>
                    <option value="un">Unidades (un)</option>
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label>Estoque Mínimo (Segurança)</label>
                <input type="number" step="0.01" placeholder="Ex: 150" value={novoInsumo.estoque_minimo_seguranca} onChange={(e) => setNovoInsumo({ ...novoInsumo, estoque_minimo_seguranca: e.target.value })} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalCadastro(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Cadastrar Catálogo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModalEntrada && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "400px" }}>
            <div className="modal-header">
              <h2>Registrar Entrada</h2>
              <button className="close-btn" onClick={() => setShowModalEntrada(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRegistrarEntrada} className="modal-form">
              <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "10px" }}>
                Insumo selecionado:<br />
                <strong style={{ color: "#1f2937" }}>{dadosEntrada.nome_exibicao}</strong>
              </p>
              <div className="input-group">
                <label>Quantidade Recebida</label>
                <input type="number" step="0.01" placeholder="0.00" value={dadosEntrada.quantidade_recebida} onChange={(e) => setDadosEntrada({ ...dadosEntrada, quantidade_recebida: e.target.value })} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModalEntrada(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Confirmar Entrada</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Estoque;