import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  PlusCircle, 
  Shirt, 
  Layers, 
  CheckCircle, 
  X,
  Info,
  Trash2,
  Sparkles,
  Tag
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './FichaTecnicaCamisetas.css';

function FichaTecnicaCamisetas() {
  const [modelos, setModelos] = useState([]);
  const [modeloAtivo, setModeloAtivo] = useState(null);
  const [fichas, setFichas] = useState([]);
  const [insumosEstoque, setInsumosEstoque] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Modais
  const [modalNovoModelo, setModalNovoModelo] = useState(false);
  const [modalNovoItemFicha, setModalNovoItemFicha] = useState(false);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [salvandoItemFicha, setSalvandoItemFicha] = useState(false);

  // Form Novo Modelo
  const [formModelo, setFormModelo] = useState({
    nome_modelo: '',
    grade_disponivel: 'P, M, G, GG',
    consumo_tecido_kg: '0.180',
    descricao: ''
  });

  // Form Novo Item Ficha - Simples e Direto
  const [formItemFicha, setFormItemFicha] = useState({
    id_insumo: '',
    tipo_insumo: 'Aviamento',
    descricao_insumo: '',
    consumo_unitario: '1',
    unidade_medida: 'unidades',
    custo_unitario_estimado: ''
  });

  const mostrarToast = (tipo, texto) => {
    setToast({ tipo, texto });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resModelos, resInsumos] = await Promise.all([
        api.get('/camisetas/modelos/').catch(() => ({ data: [] })),
        api.get('/camisetas/insumos/').catch(() => ({ data: [] }))
      ]);

      const listaMods = resModelos.data || [];
      setModelos(listaMods);
      setInsumosEstoque(resInsumos.data || []);

      if (listaMods.length > 0) {
        if (!modeloAtivo) {
          setModeloAtivo(listaMods[0]);
          carregarFichasDoModelo(listaMods[0].id_modelo);
        } else {
          // Atualiza dados do modelo ativo
          const modAtualizado = listaMods.find(m => m.id_modelo === modeloAtivo.id_modelo) || listaMods[0];
          setModeloAtivo(modAtualizado);
          carregarFichasDoModelo(modAtualizado.id_modelo);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados de fichas técnicas:", err);
      mostrarToast('erro', 'Não foi possível carregar os modelos e insumos.');
    } finally {
      setLoading(false);
    }
  };

  const carregarFichasDoModelo = async (idModelo) => {
    try {
      const res = await api.get(`/camisetas/fichas/?id_modelo=${idModelo}`);
      setFichas(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar ficha do modelo:", err);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Suporte à tecla Escape para fechar modais (IHC - Controle do Usuário)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (modalNovoModelo) setModalNovoModelo(false);
        if (modalNovoItemFicha) setModalNovoItemFicha(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalNovoModelo, modalNovoItemFicha]);

  const selecionarModelo = (mod) => {
    setModeloAtivo(mod);
    carregarFichasDoModelo(mod.id_modelo);
  };

  // Ao selecionar um insumo do estoque, auto-preenche tipo, descrição, custo e unidade
  const handleInsumoEstoqueChange = (idInsumo) => {
    if (!idInsumo) {
      setFormItemFicha({
        id_insumo: '',
        tipo_insumo: 'Aviamento',
        descricao_insumo: '',
        consumo_unitario: '1',
        unidade_medida: 'unidades',
        custo_unitario_estimado: ''
      });
      return;
    }

    const insumo = insumosEstoque.find(i => String(i.id_insumo) === String(idInsumo));
    if (!insumo) return;

    // Detecção inteligente do tipo a partir do código ou categoria
    const cod = (insumo.codigo || '').toUpperCase();
    let tipoDetectado = 'Aviamento';
    let consumoSugerido = '1';
    let unidadeSugerida = 'unidades';

    if (cod.startsWith('AV-LINHA')) {
      tipoDetectado = 'Linha de Costura';
      consumoSugerido = '0.02'; // ~0.02 carretel por peça
      unidadeSugerida = 'unidades';
    } else if (cod.startsWith('AV-ETIQ')) {
      tipoDetectado = 'Etiqueta';
      consumoSugerido = '1'; // 1 unidade por peça
      unidadeSugerida = 'unidades';
    } else if (cod.startsWith('AV-TAG')) {
      tipoDetectado = 'Tag';
      consumoSugerido = '1'; // 1 unidade por peça
      unidadeSugerida = 'unidades';
    } else if (cod.startsWith('MALHA') || insumo.categoria === 'ROLO_TECIDO') {
      tipoDetectado = 'Tecido / Ribana';
      consumoSugerido = '0.030';
      unidadeSugerida = 'kg';
    }

    const custoMedio = parseFloat(insumo.preco_custo_medio || 0);

    setFormItemFicha({
      id_insumo: String(idInsumo),
      tipo_insumo: tipoDetectado,
      descricao_insumo: `[${insumo.codigo}] ${insumo.tipo_malha_ou_aviamento}${insumo.cor ? ` (${insumo.cor})` : ''}`,
      consumo_unitario: consumoSugerido,
      unidade_medida: unidadeSugerida,
      custo_unitario_estimado: custoMedio ? custoMedio.toFixed(2) : '0.00'
    });
  };

  const handleSalvarModelo = async (e) => {
    e.preventDefault();
    if (!formModelo.nome_modelo || !formModelo.consumo_tecido_kg) {
      mostrarToast('erro', 'Por favor, informe o nome do modelo e o consumo de tecido.');
      return;
    }

    try {
      setSalvandoModelo(true);
      const res = await api.post('/camisetas/modelos/', {
        nome_modelo: formModelo.nome_modelo,
        grade_disponivel: formModelo.grade_disponivel || 'P, M, G, GG',
        consumo_tecido_kg: parseFloat(formModelo.consumo_tecido_kg),
        descricao: formModelo.descricao
      });

      mostrarToast('sucesso', `Modelo "${formModelo.nome_modelo}" cadastrado com sucesso!`);
      setModalNovoModelo(false);
      setFormModelo({
        nome_modelo: '',
        grade_disponivel: 'P, M, G, GG',
        consumo_tecido_kg: '0.180',
        descricao: ''
      });
      await carregarDados();
      if (res.data) {
        selecionarModelo(res.data);
      }
    } catch (err) {
      console.error("Erro ao salvar modelo:", err);
      mostrarToast('erro', err.response?.data?.detail || "Erro ao salvar modelo.");
    } finally {
      setSalvandoModelo(false);
    }
  };

  const handleSalvarItemFicha = async (e) => {
    e.preventDefault();
    if (!modeloAtivo) return;

    if (!formItemFicha.descricao_insumo || !formItemFicha.consumo_unitario) {
      mostrarToast('erro', 'Informe a descrição e o consumo unitário por camiseta.');
      return;
    }

    try {
      setSalvandoItemFicha(true);
      const consumoNum = parseFloat(formItemFicha.consumo_unitario);
      const custoUnit = parseFloat(formItemFicha.custo_unitario_estimado || 0);

      await api.post('/camisetas/fichas/', {
        id_modelo: modeloAtivo.id_modelo,
        id_insumo: formItemFicha.id_insumo ? parseInt(formItemFicha.id_insumo) : null,
        tipo_insumo: formItemFicha.tipo_insumo,
        descricao_insumo: formItemFicha.descricao_insumo,
        consumo_unitario: consumoNum,
        unidade_medida: formItemFicha.unidade_medida === 'kg' ? 'kg' : 'unidades',
        custo_unitario_estimado: custoUnit
      });

      mostrarToast('sucesso', `Item "${formItemFicha.descricao_insumo}" adicionado à ficha técnica!`);
      setModalNovoItemFicha(false);
      setFormItemFicha({
        id_insumo: '',
        tipo_insumo: 'Aviamento',
        descricao_insumo: '',
        consumo_unitario: '1',
        unidade_medida: 'unidades',
        custo_unitario_estimado: ''
      });
      await carregarFichasDoModelo(modeloAtivo.id_modelo);
    } catch (err) {
      console.error("Erro ao adicionar item na ficha:", err);
      mostrarToast('erro', err.response?.data?.detail || "Erro ao adicionar item à ficha técnica.");
    } finally {
      setSalvandoItemFicha(false);
    }
  };

  // Remoção de item da ficha técnica (IHC - Controle e Liberdade do Usuário)
  const handleRemoverItemFicha = async (idFicha, nomeItem) => {
    const confirma = window.confirm(`Deseja remover "${nomeItem}" da ficha técnica deste modelo?`);
    if (!confirma) return;

    try {
      await api.delete(`/camisetas/fichas/${idFicha}`);
      mostrarToast('sucesso', `Item removido da ficha técnica.`);
      await carregarFichasDoModelo(modeloAtivo.id_modelo);
    } catch (err) {
      console.error("Erro ao remover item:", err);
      mostrarToast('erro', "Não foi possível remover o item.");
    }
  };

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatarNumeroLimpo = (valor, sufixo = '') => {
    const num = parseFloat(valor || 0);
    const formatado = num.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    });
    return sufixo ? `${formatado} ${sufixo}` : formatado;
  };

  // Formatação amigável e explicativa do consumo unitário por peça (facilita o entendimento do operador)
  const formatarConsumoUnitarioAmigavel = (item) => {
    const tipo = (item.tipo_insumo || '').toLowerCase();
    const desc = (item.descricao_insumo || '').toLowerCase();
    const consumo = parseFloat(item.consumo_unitario || 0);

    // Se for linha de costura ou carretel
    if (tipo.includes('linha') || desc.includes('linha') || desc.includes('carretel') || desc.includes('fração')) {
      const pecasPorCone = consumo > 0 ? Math.round(1 / consumo) : 50;
      const metrosEstimados = Math.round(consumo * 4000);
      return (
        <div className="consumo-amigavel-box">
          <span className="consumo-valor-destaque">{consumo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} carretel</span>
          <small className="consumo-explicacao">
            (~{metrosEstimados}m de costura | 1 cone rende ~{pecasPorCone} peças)
          </small>
        </div>
      );
    }

    // Se for tecido ou malha (kg)
    if (item.unidade_medida === 'kg' || tipo.includes('tecido') || tipo.includes('malha') || tipo.includes('ribana')) {
      const gramas = Math.round(consumo * 1000);
      return (
        <div className="consumo-amigavel-box">
          <span className="consumo-valor-destaque">{consumo.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg</span>
          <small className="consumo-explicacao">({gramas}g de malha por peça)</small>
        </div>
      );
    }

    // Aviamentos unitários (etiquetas, tags, botões)
    return (
      <div className="consumo-amigavel-box">
        <span className="consumo-valor-destaque">{consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un</span>
        <small className="consumo-explicacao">(1 unidade por peça)</small>
      </div>
    );
  };

  // Custo estimado: se houver tecido na ficha, soma os insumos reais; se não houver, considera o tecido base do modelo
  const temTecidoNaFicha = fichas.some(f => (f.tipo_insumo || '').toLowerCase().includes('tecido') || f.unidade_medida === 'kg');
  const custoItensFicha = fichas.reduce((acc, item) => acc + parseFloat(item.custo_unitario_estimado || 0), 0);
  const custoTecidoBase = (!temTecidoNaFicha && modeloAtivo) ? parseFloat(modeloAtivo.consumo_tecido_kg || 0) * 42.50 : 0;
  const custoTotalEstimado = custoItensFicha + custoTecidoBase;

  return (
    <div className="ficha-camisetas-container">
      <Sidebar />

      <main className="ficha-camisetas-main">
        {/* Toast Notificação Flutuante */}
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

        {/* Cabeçalho da Tela: "4. Tela de Ficha Técnica Digital" (Sem "Engenharia do Produto") */}
        <header className="ficha-header">
          <h1>
            <FileText size={28} color="#2563eb" aria-hidden="true" />
            4. Tela de Ficha Técnica Digital
          </h1>
          <p>
            Defina o padrão de consumo para cada modelo de camiseta cadastrado: 
            vínculo do modelo, especificação da grade (P, M, G, GG), consumo unitário de tecido (kg/peça) 
            e aviamentos associados (etiquetas e linhas).
          </p>
        </header>

        {/* SEÇÃO HORIZONTAL DE MODELOS DE CAMISETAS (IHC - Visibilidade e Ergonomia de Tela) */}
        <section className="secao-modelos-horizontal" aria-label="Seleção de modelo de camiseta">
          <div className="modelos-horizontal-header">
            <div className="titulo-modelos-box">
              <Shirt size={20} color="#2563eb" aria-hidden="true" />
              <h2>Modelos de Camisetas</h2>
              <span className="badge-total-modelos">{modelos.length} modelo(s)</span>
            </div>

            <button 
              className="btn-acao-rapida secundario"
              onClick={() => setModalNovoModelo(true)}
              title="Cadastrar um novo modelo de camiseta"
            >
              <PlusCircle size={17} />
              <span>Cadastrar Novo Modelo</span>
            </button>
          </div>

          <div className="lista-modelos-horizontal">
            {modelos.length === 0 ? (
              <div className="aviso-sem-modelos">
                <p>Nenhum modelo cadastrado. Clique no botão acima para adicionar o primeiro modelo de camiseta.</p>
              </div>
            ) : (
              modelos.map((mod) => {
                const isAtivo = modeloAtivo?.id_modelo === mod.id_modelo;
                return (
                  <button 
                    key={mod.id_modelo}
                    type="button"
                    className={`modelo-card-horizontal ${isAtivo ? 'ativo' : ''}`}
                    onClick={() => selecionarModelo(mod)}
                    aria-pressed={isAtivo}
                  >
                    <div className="modelo-card-icone">
                      <Shirt size={24} color={isAtivo ? '#2563eb' : '#64748b'} />
                    </div>
                    <div className="modelo-card-info">
                      <h4>{mod.nome_modelo}</h4>
                      <div className="modelo-card-metas">
                        <span className="pill-consumo">
                          {formatarNumeroLimpo(mod.consumo_tecido_kg, 'kg/peça')}
                        </span>
                        <span className="pill-grade">{mod.grade_disponivel || 'P, M, G, GG'}</span>
                      </div>
                    </div>
                    {isAtivo && (
                      <div className="badge-modelo-selecionado" title="Modelo ativo na ficha técnica">
                        <CheckCircle size={16} color="#2563eb" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* DETALHE DA FICHA TÉCNICA (LARGURA TOTAL DESIMPEDIDA) */}
        {modeloAtivo ? (
          <div className="detalhe-ficha-card">
            <div className="detalhe-ficha-header">
              <div>
                <h2>{modeloAtivo.nome_modelo}</h2>
                <p className="subtitulo-modelo-ativo">
                  {modeloAtivo.descricao || 'Camiseta padrão confeccionada em linha de produção'}
                </p>
              </div>
              <button 
                className="btn-acao-rapida"
                onClick={() => {
                  setFormItemFicha({
                    id_insumo: '',
                    tipo_insumo: 'Aviamento',
                    descricao_insumo: '',
                    consumo_unitario: '1',
                    unidade_medida: 'unidades',
                    custo_unitario_estimado: ''
                  });
                  setModalNovoItemFicha(true);
                }}
                title="Vincular insumo ou aviamento a este modelo de camiseta"
              >
                <PlusCircle size={18} />
                <span>Adicionar Insumo na Ficha</span>
              </button>
            </div>

            {/* ESPECIFICAÇÕES PRINCIPAIS EM CARDS HORIZONTAIS */}
            <div className="especificacoes-box">
              <div className="espec-item">
                <span className="espec-rotulo">Grade de Tamanhos</span>
                <strong className="espec-valor">{modeloAtivo.grade_disponivel || 'P, M, G, GG'}</strong>
              </div>

              <div className="espec-item">
                <span className="espec-rotulo">Consumo de Tecido</span>
                <strong className="espec-valor destaque-azul">
                  {formatarNumeroLimpo(modeloAtivo.consumo_tecido_kg, 'kg / peça')}
                  <small className="espec-detalhe">
                    ({(parseFloat(modeloAtivo.consumo_tecido_kg) * 1000).toFixed(0)}g)
                  </small>
                </strong>
              </div>

              <div className="espec-item">
                <span className="espec-rotulo">Rendimento Esperado</span>
                <strong className="espec-valor">
                  {parseFloat(modeloAtivo.consumo_tecido_kg) > 0 
                    ? (1 / parseFloat(modeloAtivo.consumo_tecido_kg)).toFixed(2) 
                    : '0'} peças / kg
                </strong>
              </div>

              <div className="espec-item">
                <span className="espec-rotulo">Custo Total de Insumos</span>
                <strong className="espec-valor destaque-verde">
                  {formatarMoeda(custoTotalEstimado)} / peça
                </strong>
              </div>
            </div>

            {/* TABELA DE COMPOSIÇÃO DOS INSUMOS */}
            <div className="tabela-ficha-secao">
              <div className="tabela-ficha-header-bar">
                <h3>Composição de Insumos & Aviamentos</h3>
                <span className="badge-qtd-itens">{fichas.length} material(is) na receita</span>
              </div>

              <div className="table-responsive">
                <table className="tabela-itens-ficha">
                  <thead>
                    <tr>
                      <th scope="col">Tipo</th>
                      <th scope="col">Descrição do Material</th>
                      <th scope="col">Consumo Unitário por Camiseta</th>
                      <th scope="col">Custo Estimado</th>
                      <th scope="col" style={{ textAlign: 'center', width: '90px' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Itens da receita cadastrados no modelo */}
                    {fichas.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                          Nenhum material (tecido, etiqueta, linha, tag) adicionado à receita ainda. 
                          Clique em <strong>"Adicionar Insumo na Ficha"</strong> acima para montar a composição.
                        </td>
                      </tr>
                    ) : (
                      fichas.map((f) => (
                        <tr key={f.id_ficha}>
                          <td>
                            <span className={`badge-tipo-insumo ${(f.tipo_insumo || '').toLowerCase().includes('tecido') ? 'tecido' : 'aviamento'}`}>
                              {f.tipo_insumo}
                            </span>
                          </td>
                          <td>
                            <strong>{f.descricao_insumo}</strong>
                          </td>
                          <td>
                            {formatarConsumoUnitarioAmigavel(f)}
                          </td>
                          <td>
                            <strong style={{ color: '#047857' }}>{formatarMoeda(f.custo_unitario_estimado)}</strong>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button"
                              className="btn-remover-item-ficha"
                              onClick={() => handleRemoverItemFicha(f.id_ficha, f.descricao_insumo)}
                              title="Remover material da ficha deste modelo"
                              aria-label={`Remover ${f.descricao_insumo}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="detalhe-ficha-card vazio">
            <p>Selecione ou cadastre um modelo de camiseta para visualizar sua ficha técnica digital.</p>
          </div>
        )}

        {/* MODAL CADASTRAR NOVO MODELO (MAIS ESTREITO E COMPACTO) */}
        {modalNovoModelo && (
          <div 
            className="modal-overlay" 
            onClick={(e) => e.target.classList.contains('modal-overlay') && setModalNovoModelo(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-modelo"
          >
            <div className="modal-content modal-modelo-content">
              <div className="modal-header">
                <div>
                  <h3 id="titulo-modal-modelo">Cadastrar Novo Modelo</h3>
                  <p className="modal-subtitulo">Defina o nome e o consumo de malha por camiseta.</p>
                </div>
                <button 
                  className="modal-close-btn" 
                  onClick={() => setModalNovoModelo(false)}
                  aria-label="Fechar janela"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSalvarModelo}>
                <div className="form-group">
                  <label htmlFor="modelo-nome">Nome do Modelo *</label>
                  <input 
                    id="modelo-nome"
                    type="text" 
                    placeholder="Ex: Camiseta Básica Gola Redonda"
                    value={formModelo.nome_modelo}
                    onChange={(e) => setFormModelo({ ...formModelo, nome_modelo: e.target.value })}
                    required
                  />
                  <span className="form-help-hint">Nome comercial exibido nos pedidos e ordens</span>
                </div>

                <div className="form-group">
                  <label htmlFor="modelo-grade">Grade Disponível</label>
                  <input 
                    id="modelo-grade"
                    type="text" 
                    placeholder="P, M, G, GG"
                    value={formModelo.grade_disponivel}
                    onChange={(e) => setFormModelo({ ...formModelo, grade_disponivel: e.target.value })}
                  />
                  <span className="form-help-hint">Tamanhos padrão produzidos</span>
                </div>

                <div className="form-group">
                  <label htmlFor="modelo-consumo">Consumo de Malha por Peça (kg) *</label>
                  <div className="input-group-addon">
                    <span className="addon-prefix" aria-hidden="true">kg</span>
                    <input 
                      id="modelo-consumo"
                      type="number" 
                      step="0.001"
                      min="0.01"
                      placeholder="0.180"
                      value={formModelo.consumo_tecido_kg}
                      onChange={(e) => setFormModelo({ ...formModelo, consumo_tecido_kg: e.target.value })}
                      className="input-with-addon"
                      required
                    />
                  </div>
                  <span className="form-help-hint">Ex: 0.180 kg = 180 gramas por camiseta</span>
                </div>

                <div className="form-group">
                  <label htmlFor="modelo-desc">Descrição / Observações (Opcional)</label>
                  <textarea 
                    id="modelo-desc"
                    rows="2"
                    placeholder="Ex: Modelagem regular fit, ribana 2x1 na gola, costura reforçada ombro a ombro..."
                    value={formModelo.descricao}
                    onChange={(e) => setFormModelo({ ...formModelo, descricao: e.target.value })}
                  ></textarea>
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn-cancelar" 
                    onClick={() => setModalNovoModelo(false)}
                    disabled={salvandoModelo}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-acao-rapida"
                    disabled={salvandoModelo}
                  >
                    <CheckCircle size={18} />
                    <span>{salvandoModelo ? 'Salvando...' : 'Salvar Modelo'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL ADICIONAR INSUMO NA FICHA (SIMPLES, PRÁTICO E DIDÁTICO) */}
        {modalNovoItemFicha && (
          <div 
            className="modal-overlay" 
            onClick={(e) => e.target.classList.contains('modal-overlay') && setModalNovoItemFicha(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-item-ficha"
          >
            <div className="modal-content modal-item-ficha-content">
              <div className="modal-header">
                <div>
                  <h3 id="titulo-modal-item-ficha">Adicionar Insumo na Ficha Técnica</h3>
                  <p className="modal-subtitulo">
                    Modelo selecionado: <strong>{modeloAtivo?.nome_modelo}</strong>
                  </p>
                </div>
                <button 
                  className="modal-close-btn" 
                  onClick={() => setModalNovoItemFicha(false)}
                  aria-label="Fechar janela"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSalvarItemFicha}>
                {/* PASSO 1: SELECIONAR INSUMO DO ESTOQUE */}
                <div className="form-group">
                  <label htmlFor="select-insumo-estoque">
                    <span>1. Selecionar Insumo do Estoque</span>
                    <span className="badge-dica-preenche">Preenche dados automaticamente</span>
                  </label>
                  <select 
                    id="select-insumo-estoque"
                    value={formItemFicha.id_insumo}
                    onChange={(e) => handleInsumoEstoqueChange(e.target.value)}
                    className="select-padronizado"
                  >
                    <option value="">+ Outro material (Digitar manualmente)</option>
                    {insumosEstoque.map(i => (
                      <option key={i.id_insumo} value={i.id_insumo}>
                        [{i.codigo}] {i.tipo_malha_ou_aviamento} {i.cor ? `(${i.cor})` : ''} — Custo: {formatarMoeda(i.preco_custo_medio)}/{i.unidade_medida === 'kg' ? 'kg' : 'Uni'}
                      </option>
                    ))}
                  </select>
                  <span className="form-help-hint">Escolha um item já cadastrado para vincular custos e estoque</span>
                </div>

                {/* PASSO 2: DESCRIÇÃO E TIPO */}
                <div className="modal-form-grid-2">
                  <div className="form-group">
                    <label htmlFor="item-tipo">Tipo do Insumo *</label>
                    <select 
                      id="item-tipo"
                      value={formItemFicha.tipo_insumo}
                      onChange={(e) => setFormItemFicha({ ...formItemFicha, tipo_insumo: e.target.value })}
                      className="select-padronizado"
                      required
                    >
                      <option value="Linha de Costura">Linha de Costura</option>
                      <option value="Etiqueta">Etiqueta</option>
                      <option value="Tag">Tag</option>
                      <option value="Aviamento">Aviamento Geral</option>
                      <option value="Ribana / Gola">Ribana / Gola</option>
                      <option value="Tecido Secundário">Tecido Secundário</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="item-unidade">Unidade de Medida *</label>
                    <select 
                      id="item-unidade"
                      value={formItemFicha.unidade_medida}
                      onChange={(e) => setFormItemFicha({ ...formItemFicha, unidade_medida: e.target.value })}
                      className="select-padronizado"
                      required
                    >
                      <option value="unidades">Uni (Unidades - Aviamentos)</option>
                      <option value="kg">kg (Quilogramas - Tecidos)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="item-descricao">Descrição do Insumo / Material *</label>
                  <input 
                    id="item-descricao"
                    type="text" 
                    placeholder="Ex: Etiqueta de Cetim P/M/G ou Carretel Linha 120"
                    value={formItemFicha.descricao_insumo}
                    onChange={(e) => setFormItemFicha({ ...formItemFicha, descricao_insumo: e.target.value })}
                    required
                  />
                </div>

                {/* PASSO 3: CONSUMO POR CAMISETA E CUSTO */}
                <div className="modal-form-grid-2">
                  <div className="form-group">
                    <label htmlFor="item-consumo">
                      Quanto gasta por 1 camiseta? *
                    </label>
                    <div className="input-group-addon">
                      <span className="addon-prefix" aria-hidden="true">
                        {formItemFicha.unidade_medida === 'kg' ? 'kg' : 'Uni'}
                      </span>
                      <input 
                        id="item-consumo"
                        type="number" 
                        step="any"
                        min="0.0001"
                        placeholder={formItemFicha.unidade_medida === 'kg' ? "Ex: 0.030" : "Ex: 1"}
                        value={formItemFicha.consumo_unitario}
                        onChange={(e) => setFormItemFicha({ ...formItemFicha, consumo_unitario: e.target.value })}
                        className="input-with-addon"
                        required
                      />
                    </div>
                    <span className="form-help-hint">
                      {formItemFicha.unidade_medida === 'kg' ? 'Ex: 0.030 kg para gola' : 'Ex: 1 para tag ou etiqueta'}
                    </span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="item-custo">Custo Estimado por Peça (R$)</label>
                    <div className="input-group-addon">
                      <span className="addon-prefix" aria-hidden="true">R$</span>
                      <input 
                        id="item-custo"
                        type="number" 
                        step="0.01"
                        min="0"
                        placeholder="0.15"
                        value={formItemFicha.custo_unitario_estimado}
                        onChange={(e) => setFormItemFicha({ ...formItemFicha, custo_unitario_estimado: e.target.value })}
                        className="input-with-addon"
                      />
                    </div>
                    <span className="form-help-hint">Impacto financeiro por camiseta</span>
                  </div>
                </div>

                {/* CARD DE PRÉVIA EM TEMPO REAL (IHC - TRANSPARÊNCIA E COMUNICABILIDADE) */}
                {formItemFicha.descricao_insumo && (
                  <div className="preview-item-ficha-box">
                    <Info size={18} color="#2563eb" aria-hidden="true" />
                    <div>
                      <strong>Resumo da Receita:</strong>
                      <p>
                        Para cada 1 camiseta deste modelo, serão consumidos <strong>{formItemFicha.consumo_unitario || '1'} {formItemFicha.unidade_medida === 'kg' ? 'kg' : 'Uni'}</strong> de <strong>{formItemFicha.descricao_insumo}</strong> com impacto de <strong>{formatarMoeda(formItemFicha.custo_unitario_estimado)}</strong> no custo do produto.
                      </p>
                    </div>
                  </div>
                )}

                {/* DICA EXPLICATIVA DE LINHA DE COSTURA */}
                {(formItemFicha.tipo_insumo === 'Linha de Costura' || (formItemFicha.descricao_insumo || '').toLowerCase().includes('linha') || (formItemFicha.descricao_insumo || '').toLowerCase().includes('carretel')) && (
                  <div className="dica-linha-box">
                    <strong>💡 Como funciona a Linha de Costura na confecção:</strong>
                    <div>
                      Um carretel/cone padrão de Linha 120 (4.000m) atende cerca de 50 camisetas (~80 metros de costura somando overloque, galoneira e reta). 
                      Por isso, a fração é <strong>0,020 carretel por peça</strong> (1 ÷ 50). 
                      Ao produzir uma ordem de 100 camisetas, o sistema baixará exatamente 2 carretéis inteiros do estoque.
                    </div>
                  </div>
                )}

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn-cancelar" 
                    onClick={() => setModalNovoItemFicha(false)}
                    disabled={salvandoItemFicha}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-acao-rapida"
                    disabled={salvandoItemFicha}
                  >
                    <CheckCircle size={18} />
                    <span>{salvandoItemFicha ? 'Adicionando...' : 'Adicionar à Ficha Técnica'}</span>
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

export default FichaTecnicaCamisetas;
