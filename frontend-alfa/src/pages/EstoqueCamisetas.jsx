import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Layers, 
  PlusCircle, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  X, 
  ArrowDownLeft, 
  Tag,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './EstoqueCamisetas.css';

// Mapeamento completo de Categorias com prefixos para Código Único e parâmetros de IHC
const MAPA_CATEGORIAS = {
  ROLO_TECIDO: {
    label: 'Rolo de Tecido (Malha)',
    prefixo: 'MALHA-',
    unidadePadrao: 'kg',
    categoriaBackend: 'ROLO_TECIDO',
    placeholder: 'Ex: Meia Malha 30.1 Penteada 100% Algodão'
  },
  LINHA: {
    label: 'Linha',
    prefixo: 'AV-LINHA-',
    unidadePadrao: 'unidades',
    categoriaBackend: 'AVIAMENTO',
    placeholder: 'Ex: Carretel Linha 120 Poliéster Preto'
  },
  ETIQUETA: {
    label: 'Etiqueta',
    prefixo: 'AV-ETIQ-',
    unidadePadrao: 'unidades',
    categoriaBackend: 'AVIAMENTO',
    placeholder: 'Ex: Etiqueta de Composição Cetim P/M/G'
  },
  TAG: {
    label: 'Tag',
    prefixo: 'AV-TAG-',
    unidadePadrao: 'unidades',
    categoriaBackend: 'AVIAMENTO',
    placeholder: 'Ex: Tag Marca Alfa Premium com Cordão'
  },
  OUTRO_AVIAMENTO: {
    label: 'Outro Aviamento',
    prefixo: 'AV-',
    unidadePadrao: 'unidades',
    categoriaBackend: 'AVIAMENTO',
    placeholder: 'Ex: Fita Gorgurão, Elástico, Entretela...'
  }
};

function EstoqueCamisetas() {
  const [abaAtiva, setAbaAtiva] = useState('ROLO_TECIDO'); // 'ROLO_TECIDO' ou 'AVIAMENTO'
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [toast, setToast] = useState(null);

  // Modais e status de salvamento
  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);
  const [modalNovoInsumoAberto, setModalNovoInsumoAberto] = useState(false);
  const [salvandoEntrada, setSalvandoEntrada] = useState(false);
  const [salvandoNovoInsumo, setSalvandoNovoInsumo] = useState(false);
  const [insumoSelecionado, setInsumoSelecionado] = useState(null);

  // Formulário de Entrada Rápida / NF
  const [formEntrada, setFormEntrada] = useState({
    id_insumo: '',
    numero_nota_fiscal: '',
    fornecedor: '',
    quantidade: '',
    valor_total: ''
  });

  // Formulário de Novo Insumo
  const [formNovoInsumo, setFormNovoInsumo] = useState({
    codigo: '',
    categoria: 'ROLO_TECIDO',
    tipo_malha_ou_aviamento: '',
    cor: '',
    unidade_medida: 'kg',
    saldo_atual: '',
    estoque_minimo: '',
    preco_custo_medio: ''
  });

  // Converte unidade cadastrada para a sigla (kg ou Uni)
  const obterSiglaUnidade = (unidade) => {
    return (unidade || '').toLowerCase() === 'kg' ? 'kg' : 'Uni';
  };

  // Formatação limpa de quantidades: 150 kg e 40 kg sem zeros desnecessários (,000)
  const formatarQuantidade = (valor, sigla = '') => {
    if (valor === null || valor === undefined || valor === '') return `0 ${sigla}`.trim();
    const num = Number(valor);
    if (isNaN(num)) return `0 ${sigla}`.trim();

    // Se for inteiro (ex: 150), exibe 150. Se for quebrado (ex: 380.5), exibe 380,5
    const formatado = num.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    });

    return sigla ? `${formatado} ${sigla}` : formatado;
  };

  // Sigla dinâmica da unidade de medida do novo insumo
  const siglaUnidadeNovo = obterSiglaUnidade(formNovoInsumo.unidade_medida);

  // Geração automática e auditável de Código Único por Categoria individual (Linha, Tag, Etiqueta, Malha)
  const gerarCodigoAutomatico = (categoria, listaInsumos = []) => {
    const config = MAPA_CATEGORIAS[categoria] || MAPA_CATEGORIAS.ROLO_TECIDO;
    const prefixo = config.prefixo;

    const codigosNumericos = (listaInsumos || [])
      .filter(item => {
        const cod = (item.codigo || '').toUpperCase();
        if (prefixo === 'AV-ETIQ-') {
          return cod.startsWith('AV-ETIQ-') || cod.startsWith('AV-ETIQUETA-');
        }
        return cod.startsWith(prefixo.toUpperCase());
      })
      .map(item => {
        const match = (item.codigo || '').match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
      });

    const maior = codigosNumericos.length > 0 ? Math.max(...codigosNumericos) : 0;
    const proximo = maior + 1;
    return `${prefixo}${String(proximo).padStart(2, '0')}`;
  };

  const carregarInsumos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/camisetas/insumos/');
      setInsumos(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar insumos de camisetas:", err);
      mostrarToast('erro', 'Não foi possível carregar os insumos do estoque.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarInsumos();
  }, []);

  // Fechar modais ao teclar Escape (IHC - Acessibilidade e Controle do Usuário)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (modalNovoInsumoAberto) setModalNovoInsumoAberto(false);
        if (modalEntradaAberto) setModalEntradaAberto(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalNovoInsumoAberto, modalEntradaAberto]);

  const mostrarToast = (tipo, texto) => {
    setToast({ tipo, texto });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // Filtragem: Rolo de tecido vs Aviamentos (Linha, Etiqueta, Tag e outros)
  const rolosTecido = insumos.filter(i => (i.categoria || '').toUpperCase() === 'ROLO_TECIDO');
  const aviamentos = insumos.filter(i => (i.categoria || '').toUpperCase() !== 'ROLO_TECIDO');

  const itensExibidos = (abaAtiva === 'ROLO_TECIDO' ? rolosTecido : aviamentos).filter(item =>
    (item.tipo_malha_ou_aviamento || '').toLowerCase().includes(busca.toLowerCase()) ||
    (item.codigo || '').toLowerCase().includes(busca.toLowerCase()) ||
    (item.cor || '').toLowerCase().includes(busca.toLowerCase())
  );

  // Abertura do modal de cadastro de novo insumo com categoria e código automático
  const abrirModalNovoInsumo = (catInicial = (abaAtiva === 'ROLO_TECIDO' ? 'ROLO_TECIDO' : 'LINHA')) => {
    const config = MAPA_CATEGORIAS[catInicial] || MAPA_CATEGORIAS.ROLO_TECIDO;
    const codigoSugerido = gerarCodigoAutomatico(catInicial, insumos);
    setFormNovoInsumo({
      codigo: codigoSugerido,
      categoria: catInicial,
      tipo_malha_ou_aviamento: '',
      cor: '',
      unidade_medida: config.unidadePadrao,
      saldo_atual: '',
      estoque_minimo: '',
      preco_custo_medio: ''
    });
    setModalNovoInsumoAberto(true);
  };

  // Ao alterar categoria no modal, atualiza automaticamente o código único e unidade padrão
  const handleCategoriaChange = (novaCat) => {
    const config = MAPA_CATEGORIAS[novaCat] || MAPA_CATEGORIAS.ROLO_TECIDO;
    const novoCodigo = gerarCodigoAutomatico(novaCat, insumos);
    setFormNovoInsumo(prev => ({
      ...prev,
      categoria: novaCat,
      codigo: novoCodigo,
      unidade_medida: config.unidadePadrao
    }));
  };

  // Abertura do modal de entrada rápida
  const abrirModalEntrada = (insumo = null) => {
    if (insumo) {
      setInsumoSelecionado(insumo);
      setFormEntrada({
        id_insumo: insumo.id_insumo,
        numero_nota_fiscal: '',
        fornecedor: '',
        quantidade: '',
        valor_total: ''
      });
    } else {
      setInsumoSelecionado(null);
      setFormEntrada({
        id_insumo: insumos.length > 0 ? insumos[0].id_insumo : '',
        numero_nota_fiscal: '',
        fornecedor: '',
        quantidade: '',
        valor_total: ''
      });
    }
    setModalEntradaAberto(true);
  };

  const handleSalvarEntrada = async (e) => {
    e.preventDefault();
    if (!formEntrada.id_insumo || !formEntrada.quantidade) {
      mostrarToast('erro', 'Selecione o insumo e informe a quantidade.');
      return;
    }

    try {
      setSalvandoEntrada(true);
      await api.post('/camisetas/insumos/entrada/', {
        id_insumo: parseInt(formEntrada.id_insumo),
        numero_nota_fiscal: formEntrada.numero_nota_fiscal,
        fornecedor: formEntrada.fornecedor,
        quantidade: parseFloat(formEntrada.quantidade),
        valor_total: parseFloat(formEntrada.valor_total || 0)
      });

      mostrarToast('sucesso', 'Entrada de material registrada com sucesso! Saldo em estoque atualizado.');
      setModalEntradaAberto(false);
      await carregarInsumos();
    } catch (err) {
      console.error("Erro ao registrar entrada:", err);
      mostrarToast('erro', err.response?.data?.detail || "Erro ao registrar entrada.");
    } finally {
      setSalvandoEntrada(false);
    }
  };

  const handleSalvarNovoInsumo = async (e) => {
    e.preventDefault();
    if (!formNovoInsumo.codigo || !formNovoInsumo.tipo_malha_ou_aviamento || !formNovoInsumo.estoque_minimo) {
      mostrarToast('erro', 'Por favor, preencha os campos obrigatórios marcados com asterisco (*).');
      return;
    }

    try {
      setSalvandoNovoInsumo(true);
      const catBackend = MAPA_CATEGORIAS[formNovoInsumo.categoria]?.categoriaBackend || 
                         (formNovoInsumo.categoria === 'ROLO_TECIDO' ? 'ROLO_TECIDO' : 'AVIAMENTO');

      await api.post('/camisetas/insumos/', {
        codigo: formNovoInsumo.codigo,
        categoria: catBackend,
        tipo_malha_ou_aviamento: formNovoInsumo.tipo_malha_ou_aviamento,
        cor: formNovoInsumo.cor,
        unidade_medida: formNovoInsumo.unidade_medida,
        saldo_atual: parseFloat(formNovoInsumo.saldo_atual || 0),
        estoque_minimo: parseFloat(formNovoInsumo.estoque_minimo || 0),
        preco_custo_medio: parseFloat(formNovoInsumo.preco_custo_medio || 0)
      });

      mostrarToast('sucesso', `Insumo ${formNovoInsumo.codigo} cadastrado com sucesso!`);
      setModalNovoInsumoAberto(false);
      await carregarInsumos();
    } catch (err) {
      console.error("Erro ao cadastrar insumo:", err);
      mostrarToast('erro', err.response?.data?.detail || "Erro ao cadastrar novo insumo.");
    } finally {
      setSalvandoNovoInsumo(false);
    }
  };

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Totais financeiros consolidados de matérias-primas cadastradas no estoque
  const totalValorMalhas = rolosTecido.reduce((acc, item) => acc + (parseFloat(item.saldo_atual || 0) * parseFloat(item.preco_custo_medio || 0)), 0);
  const totalPesoMalhas = rolosTecido.reduce((acc, item) => acc + parseFloat(item.saldo_atual || 0), 0);
  const totalValorAviamentos = aviamentos.reduce((acc, item) => acc + (parseFloat(item.saldo_atual || 0) * parseFloat(item.preco_custo_medio || 0)), 0);
  const totalValorEstoque = totalValorMalhas + totalValorAviamentos;

  return (
    <div className="estoque-camisetas-container">
      <Sidebar />

      <main className="estoque-camisetas-main">
        {/* Toast Notificação de Feedback (IHC - Visibilidade do Status) */}
        {toast && (
          <div className={`toast-alerta-flutuante ${toast.tipo}`} role="alert" aria-live="assertive">
            <span>{toast.texto}</span>
            <button 
              type="button" 
              onClick={() => setToast(null)} 
              className="toast-btn-fechar"
              aria-label="Fechar notificação"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <header className="estoque-header">
          <div className="estoque-header-title">
            <h1>
              <Package size={28} color="#2563eb" aria-hidden="true" />
              3. Gestão de Estoque de Insumos
            </h1>
            <p>
              Controle físico de rolos de tecido (malhas em kg) e aviamentos (linhas, etiquetas e tags) 
              com lançamentos rápidos de compras e notas fiscais.
            </p>
          </div>

          {/* Botões padronizados no mesmo estilo (IHC - Consistência e Padrões) */}
          <div className="estoque-actions-top">
            <button 
              className="btn-acao-rapida secundario"
              onClick={() => abrirModalNovoInsumo(abaAtiva === 'ROLO_TECIDO' ? 'ROLO_TECIDO' : 'LINHA')}
              title="Cadastrar um novo insumo com código gerado automaticamente"
            >
              <PlusCircle size={18} />
              <span>Cadastrar Novo Insumo</span>
            </button>

            <button 
              className="btn-acao-rapida secundario"
              onClick={() => abrirModalEntrada()}
              title="Lançamento rápido de notas fiscais e compras"
            >
              <ArrowDownLeft size={18} />
              <span>Lançamento Rápido / Entrada NF</span>
            </button>
          </div>
        </header>

        {/* CARDS RESUMO DO VALOR DE MATÉRIAS-PRIMAS EM ESTOQUE */}
        <section className="resumo-estoque-grid" aria-label="Indicadores do valor de matérias-primas em estoque">
          <div className="card-estoque-kpi">
            <span>Valor Total de Matérias-Primas</span>
            <h3>{formatarMoeda(totalValorEstoque)}</h3>
            <small style={{ color: '#64748b', fontSize: '0.8rem' }}>Patrimônio em estoque cadastrado</small>
          </div>
          <div className="card-estoque-kpi">
            <span>Investido em Malhas ({totalPesoMalhas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg)</span>
            <h3 style={{ color: '#2563eb' }}>{formatarMoeda(totalValorMalhas)}</h3>
            <small style={{ color: '#64748b', fontSize: '0.8rem' }}>{rolosTecido.length} tipo(s) de malha cadastrados</small>
          </div>
          <div className="card-estoque-kpi">
            <span>Investido em Aviamentos</span>
            <h3 style={{ color: '#059669' }}>{formatarMoeda(totalValorAviamentos)}</h3>
            <small style={{ color: '#64748b', fontSize: '0.8rem' }}>{aviamentos.length} tipo(s) de aviamentos (linhas, etiquetas, tags)</small>
          </div>
        </section>

        {/* NAVEGAÇÃO ENTRE AS DUAS ABAS (IHC - Metáfora de Abas e Comunicabilidade) */}
        <div className="tabs-navigation" role="tablist" aria-label="Categorias de insumos">
          <button 
            role="tab"
            aria-selected={abaAtiva === 'ROLO_TECIDO'}
            className={`tab-btn ${abaAtiva === 'ROLO_TECIDO' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('ROLO_TECIDO')}
          >
            <Layers size={18} aria-hidden="true" />
            <span>Rolos de Tecido (Malhas em kg)</span>
            <span className="tab-badge-count">{rolosTecido.length}</span>
          </button>

          <button 
            role="tab"
            aria-selected={abaAtiva === 'AVIAMENTO'}
            className={`tab-btn ${abaAtiva === 'AVIAMENTO' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('AVIAMENTO')}
          >
            <Tag size={18} aria-hidden="true" />
            <span>Aviamentos (Linhas, Etiquetas, Tags)</span>
            <span className="tab-badge-count">{aviamentos.length}</span>
          </button>
        </div>

        {/* CARD DA TABELA */}
        <div className="card-estoque-tabela">
          <div className="filtros-estoque-bar">
            <div className="search-input-box">
              <Search size={16} aria-hidden="true" />
              <input 
                type="text" 
                placeholder={abaAtiva === 'ROLO_TECIDO' ? "Buscar malha por tipo ou cor..." : "Buscar aviamento..."}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Campo de busca de insumos"
              />
            </div>
            {busca && (
              <span className="badge-resultados-busca">
                Filtrando: {itensExibidos.length} resultado(s)
              </span>
            )}
          </div>

          <div className="table-responsive">
            <table className="estoque-table">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">{abaAtiva === 'ROLO_TECIDO' ? 'Tipo de Malha' : 'Descrição do Aviamento'}</th>
                  <th scope="col">Cor</th>
                  <th scope="col">Saldo Atual</th>
                  <th scope="col">Estoque Mínimo</th>
                  <th scope="col">{abaAtiva === 'ROLO_TECIDO' ? 'Custo Médio / kg' : 'Custo Médio / Uni'}</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      Carregando insumos do estoque...
                    </td>
                  </tr>
                ) : itensExibidos.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      {busca ? 'Nenhum insumo corresponde aos termos pesquisados.' : 'Nenhum item cadastrado nesta categoria.'}
                    </td>
                  </tr>
                ) : (
                  itensExibidos.map((item) => {
                    const saldoNum = parseFloat(item.saldo_atual || 0);
                    const minNum = parseFloat(item.estoque_minimo || 0);
                    const isCritico = saldoNum <= minNum;
                    const siglaItem = obterSiglaUnidade(item.unidade_medida);

                    return (
                      <tr key={item.id_insumo}>
                        <td><strong className="codigo-insumo-destaque">{item.codigo}</strong></td>
                        <td>{item.tipo_malha_ou_aviamento}</td>
                        <td>{item.cor || '—'}</td>
                        {/* Exibição limpa: a sigla da unidade (kg ou Uni) já acompanha diretamente o valor */}
                        <td style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                          {formatarQuantidade(item.saldo_atual, siglaItem)}
                        </td>
                        <td>{formatarQuantidade(item.estoque_minimo, siglaItem)}</td>
                        <td>
                          <strong>{formatarMoeda(item.preco_custo_medio)}</strong>
                        </td>
                        <td>
                          {isCritico ? (
                            <span className="status-estoque-badge critico" title="Saldo abaixo ou igual ao estoque mínimo">
                              <AlertTriangle size={12} />
                              Estoque Crítico
                            </span>
                          ) : (
                            <span className="status-estoque-badge normal" title="Nível de estoque seguro">
                              <CheckCircle size={12} />
                              Normal
                            </span>
                          )}
                        </td>
                        <td>
                          <button 
                            className="btn-acao-rapida secundario"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            onClick={() => abrirModalEntrada(item)}
                            title={`Lançar entrada rápida para ${item.tipo_malha_ou_aviamento}`}
                          >
                            + Entrada
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DE ENTRADA RÁPIDA / NF */}
        {modalEntradaAberto && (
          <div 
            className="modal-overlay" 
            onClick={(e) => e.target.classList.contains('modal-overlay') && setModalEntradaAberto(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-entrada"
          >
            <div className="modal-content modal-entrada-content">
              <div className="modal-header">
                <div>
                  <h3 id="titulo-modal-entrada">Lançamento Rápido de Entrada / NF</h3>
                  <p className="modal-subtitulo">Adicione compras de insumos para atualizar o saldo físico imediatamente.</p>
                </div>
                <button 
                  className="modal-close-btn" 
                  onClick={() => setModalEntradaAberto(false)}
                  aria-label="Fechar modal"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSalvarEntrada}>
                <div className="form-group">
                  <label htmlFor="entrada-insumo-select">Insumo *</label>
                  <select 
                    id="entrada-insumo-select"
                    value={formEntrada.id_insumo}
                    onChange={(e) => setFormEntrada({ ...formEntrada, id_insumo: e.target.value })}
                    required
                    className="select-padronizado"
                  >
                    <option value="">Selecione o insumo...</option>
                    {insumos.map(i => (
                      <option key={i.id_insumo} value={i.id_insumo}>
                        [{i.codigo}] {i.tipo_malha_ou_aviamento} ({i.cor || 'Sem cor'}) — Saldo Atual: {formatarQuantidade(i.saldo_atual, obterSiglaUnidade(i.unidade_medida))}
                      </option>
                    ))}
                  </select>
                  <span className="form-help-hint">Material que receberá a reposição física</span>
                </div>

                <div className="modal-form-grid-2">
                  <div className="form-group">
                    <label htmlFor="entrada-quantidade">Quantidade Recebida *</label>
                    <input 
                      id="entrada-quantidade"
                      type="number" 
                      step="any"
                      min="0.001"
                      placeholder="Ex: 50"
                      value={formEntrada.quantidade}
                      onChange={(e) => setFormEntrada({ ...formEntrada, quantidade: e.target.value })}
                      required
                    />
                    <span className="form-help-hint">Volume faturado na NF</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="entrada-valor-total">Valor Total da Compra (R$)</label>
                    <input 
                      id="entrada-valor-total"
                      type="number" 
                      step="0.01"
                      min="0"
                      placeholder="Ex: 2100.00"
                      value={formEntrada.valor_total}
                      onChange={(e) => setFormEntrada({ ...formEntrada, valor_total: e.target.value })}
                    />
                    <span className="form-help-hint">Valor financeiro da entrada</span>
                  </div>
                </div>

                <div className="modal-form-grid-2">
                  <div className="form-group">
                    <label htmlFor="entrada-nf">Número Nota Fiscal</label>
                    <input 
                      id="entrada-nf"
                      type="text" 
                      placeholder="Ex: NF-4491"
                      value={formEntrada.numero_nota_fiscal}
                      onChange={(e) => setFormEntrada({ ...formEntrada, numero_nota_fiscal: e.target.value })}
                    />
                    <span className="form-help-hint">Rastreabilidade fiscal</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="entrada-fornecedor">Fornecedor</label>
                    <input 
                      id="entrada-fornecedor"
                      type="text" 
                      placeholder="Ex: Malharia Alpha Tecidos"
                      value={formEntrada.fornecedor}
                      onChange={(e) => setFormEntrada({ ...formEntrada, fornecedor: e.target.value })}
                    />
                    <span className="form-help-hint">Origem do material</span>
                  </div>
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn-cancelar" 
                    onClick={() => setModalEntradaAberto(false)}
                    disabled={salvandoEntrada}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-acao-rapida"
                    disabled={salvandoEntrada}
                  >
                    <CheckCircle size={18} />
                    <span>{salvandoEntrada ? 'Injetando Saldo...' : 'Confirmar e Injetar Saldo'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE CADASTRO DE NOVO INSUMO (IHC: USABILIDADE, COMUNICABILIDADE E ACESSIBILIDADE) */}
        {modalNovoInsumoAberto && (
          <div 
            className="modal-overlay" 
            onClick={(e) => e.target.classList.contains('modal-overlay') && setModalNovoInsumoAberto(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-novo-insumo"
          >
            <div className="modal-content modal-novo-insumo-content">
              <div className="modal-header">
                <div>
                  <h3 id="titulo-modal-novo-insumo">Cadastrar Novo Insumo de Camiseta</h3>
                  <p className="modal-subtitulo">
                    Cadastre o material com especificação técnica, saldo inicial e estoque mínimo de segurança.
                  </p>
                </div>
                <button 
                  className="modal-close-btn" 
                  onClick={() => setModalNovoInsumoAberto(false)}
                  aria-label="Fechar janela de cadastro"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSalvarNovoInsumo}>
                {/* Linha 1: Categoria Individual e Código Único */}
                <div className="modal-form-grid-2">
                  <div className="form-group">
                    <label htmlFor="novo-insumo-categoria">Categoria *</label>
                    <select 
                      id="novo-insumo-categoria"
                      value={formNovoInsumo.categoria}
                      onChange={(e) => handleCategoriaChange(e.target.value)}
                      required
                      className="select-padronizado"
                    >
                      <option value="ROLO_TECIDO">Rolo de Tecido (Malha)</option>
                      <option value="LINHA">Linha</option>
                      <option value="ETIQUETA">Etiqueta</option>
                      <option value="TAG">Tag</option>
                      <option value="OUTRO_AVIAMENTO">Outro Aviamento</option>
                    </select>
                    <span className="form-help-hint">Define o prefixo e grupo do insumo</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="novo-insumo-codigo">
                      Código Único *
                    </label>
                    <div className="input-group-codigo">
                      <input 
                        id="novo-insumo-codigo"
                        type="text" 
                        value={formNovoInsumo.codigo}
                        onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, codigo: e.target.value })}
                        placeholder="Ex: AV-LINHA-02 ou AV-TAG-02"
                        className="input-codigo-destaque"
                        required
                      />
                      <button 
                        type="button" 
                        className="btn-regerar-codigo" 
                        title="Recalcular código sequencial"
                        onClick={() => {
                          const recod = gerarCodigoAutomatico(formNovoInsumo.categoria, insumos);
                          setFormNovoInsumo(prev => ({ ...prev, codigo: recod }));
                        }}
                        aria-label="Recalcular código único sequencial"
                      >
                        <RefreshCw size={15} />
                      </button>
                    </div>
                    <span className="form-help-hint">Código identificador do material</span>
                  </div>
                </div>

                {/* Linha 2: Tipo de Malha / Nome do Aviamento */}
                <div className="form-group">
                  <label htmlFor="novo-insumo-tipo">
                    {formNovoInsumo.categoria === 'ROLO_TECIDO' ? 'Tipo de Malha *' : 'Descrição / Nome do Item *'}
                  </label>
                  <input 
                    id="novo-insumo-tipo"
                    type="text" 
                    placeholder={MAPA_CATEGORIAS[formNovoInsumo.categoria]?.placeholder || "Ex: Meia Malha 30.1 ou Linha 120"}
                    value={formNovoInsumo.tipo_malha_ou_aviamento}
                    onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, tipo_malha_ou_aviamento: e.target.value })}
                    required
                  />
                  <span className="form-help-hint">Especificação técnica detalhada do material</span>
                </div>

                {/* Linha 3: Cor e Unidade de Medida */}
                <div className="modal-form-grid-2">
                  <div className="form-group">
                    <label htmlFor="novo-insumo-cor">Cor / Tingimento</label>
                    <input 
                      id="novo-insumo-cor"
                      type="text" 
                      placeholder="Ex: Preto, Branco Alvejado, Azul Marinho..."
                      value={formNovoInsumo.cor}
                      onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, cor: e.target.value })}
                    />
                    <span className="form-help-hint">Cor padrão ou sem tingimento</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="novo-insumo-unidade">Unidade de Medida *</label>
                    <select 
                      id="novo-insumo-unidade"
                      value={formNovoInsumo.unidade_medida}
                      onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, unidade_medida: e.target.value })}
                      required
                      className="select-padronizado"
                    >
                      <option value="kg">kg (Quilogramas - Malhas)</option>
                      <option value="unidades">Uni (Unidades - Aviamentos)</option>
                    </select>
                    <span className="form-help-hint">kg para malhas e Uni para aviamentos</span>
                  </div>
                </div>

                {/* Linha 4: Saldo Inicial, Estoque Mínimo e Preço de Custo (Inputs Alinhados e Limpos) */}
                <div className="modal-form-grid-3">
                  <div className="form-group">
                    <label htmlFor="novo-insumo-saldo">
                      Saldo Inicial ({siglaUnidadeNovo})
                    </label>
                    <input 
                      id="novo-insumo-saldo"
                      type="number" 
                      step="any"
                      min="0"
                      placeholder="0"
                      value={formNovoInsumo.saldo_atual}
                      onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, saldo_atual: e.target.value })}
                    />
                    <span className="form-help-hint">Quantidade inicial em {siglaUnidadeNovo}</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="novo-insumo-minimo">
                      Estoque Mínimo ({siglaUnidadeNovo}) *
                    </label>
                    <input 
                      id="novo-insumo-minimo"
                      type="number" 
                      step="any"
                      min="0"
                      placeholder="Ex: 40"
                      value={formNovoInsumo.estoque_minimo}
                      onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, estoque_minimo: e.target.value })}
                      required
                    />
                    <span className="form-help-hint">Alerta de reposição</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="novo-insumo-custo">
                      Preço de Custo (R$)
                    </label>
                    <input 
                      id="novo-insumo-custo"
                      type="number" 
                      step="0.01" 
                      min="0"
                      placeholder="0.00"
                      value={formNovoInsumo.preco_custo_medio}
                      onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, preco_custo_medio: e.target.value })}
                    />
                    <span className="form-help-hint">Valor por {siglaUnidadeNovo}</span>
                  </div>
                </div>

                <div className="info-box-ihc">
                  <Info size={16} color="#2563eb" aria-hidden="true" />
                  <span>
                    Categoria: <strong>{MAPA_CATEGORIAS[formNovoInsumo.categoria]?.label}</strong> | Código sugerido: <strong>{formNovoInsumo.codigo}</strong> | Unidade: <strong>{siglaUnidadeNovo}</strong>
                  </span>
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn-cancelar" 
                    onClick={() => setModalNovoInsumoAberto(false)}
                    disabled={salvandoNovoInsumo}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-acao-rapida"
                    disabled={salvandoNovoInsumo}
                  >
                    <CheckCircle size={18} />
                    <span>{salvandoNovoInsumo ? 'Salvando...' : 'Salvar Insumo'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default EstoqueCamisetas;
