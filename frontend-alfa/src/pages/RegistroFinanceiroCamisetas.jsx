import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, DollarSign, FileSpreadsheet, PlusCircle, Printer, Trash2, Menu, X, Scissors } from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/feedback/useToast';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import './RegistroFinanceiroCamisetas.css';

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CATEGORIAS_DESPESA = [
  { codigo: 'FACCAO', rotulo: 'Facção / Costura Externa' },
  { codigo: 'ESTAMPARIA', rotulo: 'Estamparia / Silk / DTF' },
  { codigo: 'ALUGUEL', rotulo: 'Aluguel / Condomínio' },
  { codigo: 'ENERGIA_AGUA', rotulo: 'Energia / Água / Internet' },
  { codigo: 'FOLHA', rotulo: 'Folha / Pró-labore / Encargos' },
  { codigo: 'IMPOSTOS', rotulo: 'Impostos / Taxas' },
  { codigo: 'FRETE', rotulo: 'Frete / Logística' },
  { codigo: 'OUTROS', rotulo: 'Outras Despesas' },
];

const rotuloCategoria = (codigo) =>
  CATEGORIAS_DESPESA.find((c) => c.codigo === codigo)?.rotulo || codigo;

const mesAtual = () => new Date().toLocaleDateString('sv-SE').slice(0, 7);

const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);

const formatarMesAno = (mesAno) => {
  const [ano, mes] = String(mesAno || '').split('-');
  const indice = parseInt(mes, 10) - 1;
  return NOMES_MESES[indice] ? `${NOMES_MESES[indice]} / ${ano}` : mesAno || '—';
};

const margemPercentual = (reg) => {
  const faturamento = Number(reg.faturamento_receita) || 0;
  return faturamento > 0 ? ((Number(reg.lucro_liquido) / faturamento) * 100).toFixed(1) : '0.0';
};

const descreverOrigem = (reg) => {
  const partes = [];
  if (reg.qtd_pedidos_entregues > 0) partes.push(`${reg.qtd_pedidos_entregues} entrega(s)`);
  if (reg.qtd_entradas > 0) partes.push(`${reg.qtd_entradas} nota(s) fiscal(is)`);
  if (reg.qtd_despesas > 0) partes.push(`${reg.qtd_despesas} despesa(s)`);
  return partes.length > 0 ? partes.join(' · ') : 'Sem movimento';
};

const escaparHtml = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const somar = (registros, campo) => registros.reduce((acc, r) => acc + (Number(r[campo]) || 0), 0);

function RegistroFinanceiroCamisetas() {
  const toast = useToast();
  const anoCorrente = Number(mesAtual().slice(0, 4));
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [ano, setAno] = useState(anoCorrente);
  const [registros, setRegistros] = useState([]);
  const [dreMes, setDreMes] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  const [formFin, setFormFin] = useState({ mes_ano: mesAtual(), outros_custos_operacionais: '', observacoes: '' });
  const [formDespesa, setFormDespesa] = useState({
    categoria: 'FACCAO',
    descricao: '',
    valor: '',
    data_vencimento: '',
    status_pagamento: 'Pago',
  });

  const carregarDados = useCallback(async (anoReferencia, mesReferencia) => {
    try {
      setCarregando(true);
      const [resAno, resDre] = await Promise.all([
        api.get(`/camisetas/financeiro/?ano=${anoReferencia}`),
        api.get(`/camisetas/financeiro/dre/?mes_ano=${mesReferencia}`),
      ]);
      setRegistros(resAno.data || []);
      setDreMes(resDre.data || null);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar o financeiro.'));
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    carregarDados(ano, formFin.mes_ano);
  }, [ano, formFin.mes_ano, carregarDados]);

  const registroDoMes = registros.find((r) => r.mes_ano === formFin.mes_ano);

  const handleMesAnoChange = (e) => {
    const novoMes = e.target.value;
    const existente = registros.find((r) => r.mes_ano === novoMes);
    setFormFin({
      mes_ano: novoMes,
      outros_custos_operacionais: '',
      observacoes: existente?.observacoes || '',
    });
    const anoDoMes = Number(novoMes.slice(0, 4));
    if (anoDoMes && anoDoMes !== ano) setAno(anoDoMes);
  };

  const handleLancarDespesa = async (e) => {
    e.preventDefault();
    const valorNum = Number(formDespesa.valor || 0);
    if (!formDespesa.descricao.trim()) {
      toast.aviso('Informe a descrição da despesa.');
      return;
    }
    if (valorNum <= 0) {
      toast.aviso('Informe um valor maior que zero para a despesa.');
      return;
    }
    try {
      setSalvandoDespesa(true);
      await api.post('/camisetas/financeiro/despesas/', {
        mes_ano: formFin.mes_ano,
        categoria: formDespesa.categoria,
        descricao: formDespesa.descricao.trim(),
        valor: valorNum,
        data_vencimento: formDespesa.data_vencimento || null,
        status_pagamento: formDespesa.status_pagamento,
      });
      toast.sucesso('Despesa registrada com sucesso.');
      setFormDespesa((atual) => ({ ...atual, descricao: '', valor: '', data_vencimento: '' }));
      await carregarDados(ano, formFin.mes_ano);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível lançar a despesa.'));
    } finally {
      setSalvandoDespesa(false);
    }
  };

  const handleQuitarDespesa = async (idDespesa) => {
    try {
      await api.put(`/camisetas/financeiro/despesas/${idDespesa}/pagar`, {});
      toast.sucesso('Despesa marcada como paga.');
      await carregarDados(ano, formFin.mes_ano);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível quitar a despesa.'));
    }
  };

  const handleExcluirDespesa = async (idDespesa) => {
    try {
      await api.delete(`/camisetas/financeiro/despesas/${idDespesa}`);
      toast.sucesso('Despesa removida.');
      await carregarDados(ano, formFin.mes_ano);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível remover a despesa.'));
    }
  };

  const handleAlternarPagamentoPedido = async (pedido) => {
    const novoStatus = pedido.status_pagamento === 'Pago' ? 'Pendente' : 'Pago';
    try {
      await api.put(`/camisetas/financeiro/pedidos/${pedido.id_pedido}/pagamento`, {
        status_pagamento: novoStatus,
      });
      toast.sucesso(`Pedido ${pedido.codigo_pedido} marcado como ${novoStatus}.`);
      await carregarDados(ano, formFin.mes_ano);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível atualizar o recebimento do pedido.'));
    }
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    const outros = Number(formFin.outros_custos_operacionais || 0);
    if (!formFin.mes_ano) {
      toast.aviso('Escolha o mês de referência.');
      return;
    }
    if (outros < 0) {
      toast.aviso('Outros custos não pode ser negativo.');
      return;
    }
    try {
      setSalvando(true);
      await api.post('/camisetas/financeiro/', {
        mes_ano: formFin.mes_ano,
        outros_custos_operacionais: outros,
        observacoes: formFin.observacoes,
      });
      toast.sucesso(`Observações e ajuste avulso de ${formatarMesAno(formFin.mes_ano)} salvos.`);
      await carregarDados(ano, formFin.mes_ano);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Erro ao salvar os outros custos.'));
    } finally {
      setSalvando(false);
    }
  };

  const totalFaturamento = somar(registros, 'faturamento_receita');
  const totalGasto = somar(registros, 'valor_gasto_materiais');
  const totalLucro = somar(registros, 'lucro_liquido');
  const margemMedia = totalFaturamento > 0 ? ((totalLucro / totalFaturamento) * 100).toFixed(1) : '0.0';

  const handleExportarPDF = () => {
    const janela = window.open('', '_blank');
    if (!janela) {
      toast.aviso('Permita janelas pop-up neste navegador para exportar o relatório em PDF.');
      return;
    }
    const emissao = new Date().toLocaleString('pt-BR');
    const linhas = registros.map((reg) => `
      <tr>
        <td><strong>${escaparHtml(formatarMesAno(reg.mes_ano))}</strong></td>
        <td>${escaparHtml(descreverOrigem(reg))}</td>
        <td style="text-align:right;color:#b91c1c;font-weight:700;">${formatarMoeda(reg.valor_gasto_materiais)}</td>
        <td style="text-align:right;color:#1d4ed8;font-weight:700;">${formatarMoeda(reg.faturamento_receita)}</td>
        <td style="text-align:right;">${formatarMoeda(reg.outros_custos_operacionais)}</td>
        <td style="text-align:right;color:#047857;font-weight:800;">${formatarMoeda(reg.lucro_liquido)}</td>
        <td style="text-align:center;font-weight:700;">${margemPercentual(reg)}%</td>
        <td style="font-size:10px;color:#6b7280;">${escaparHtml(reg.observacoes || '-')}</td>
      </tr>`).join('');

    janela.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>Relatório Financeiro ${ano} - Confecção Alfa</title>
      <style>
        @page { size: A4 landscape; margin: 12mm 15mm; }
        body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2C2523; padding: 24px; font-size: 12px; }
        h1 { margin: 0; font-size: 22px; color: #1E3A8A; font-family: 'Lora', Georgia, serif; }
        .meta { color: #6B7280; font-size: 11px; margin: 4px 0 16px; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
        .kpi { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 14px; background: #FAF9F6; }
        .kpi span { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6B7280; }
        .kpi strong { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #F4EFEA; text-transform: uppercase; font-size: 10px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #D5CCC0; }
        td { padding: 8px 10px; border-bottom: 1px solid #EAE4DD; }
      </style></head><body>
      <h1>CONFECÇÃO ALFA — Financeiro ${ano}</h1>
      <p class="meta">Emissão: ${escaparHtml(emissao)} · Faturamento = pedidos entregues · Gasto = notas fiscais de insumos</p>
      <div class="kpis">
        <div class="kpi"><span>Faturamento</span><strong>${formatarMoeda(totalFaturamento)}</strong></div>
        <div class="kpi"><span>Compras de matéria-prima</span><strong>${formatarMoeda(totalGasto)}</strong></div>
        <div class="kpi"><span>Lucro líquido</span><strong>${formatarMoeda(totalLucro)}</strong></div>
        <div class="kpi"><span>Margem média</span><strong>${margemMedia}%</strong></div>
      </div>
      <table><thead><tr>
        <th>Mês</th><th>Origem</th><th>Matéria-prima</th><th>Faturamento</th><th>Despesas operacionais</th>
        <th>Lucro</th><th>Margem</th><th>Observações</th>
      </tr></thead><tbody>${linhas}</tbody></table>
      <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
      </body></html>`);
    janela.document.close();
  };

  return (
    <div className="financeiro-camisetas-container">
      {/* CABEÇALHO MOBILE (Só aparece no celular) */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-box-sm">
            <Scissors size={20} color="#2563eb" strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>Confecção Alfa</h2>
        </div>
        <button
          type="button"
          className="btn-menu-mobile"
          onClick={() => setMenuMobileAberto(!menuMobileAberto)}
          aria-label="Abrir menu de navegação"
        >
          {menuMobileAberto ? <X size={24} color="#1f2937" /> : <Menu size={24} color="#1f2937" />}
        </button>
      </div>

      {menuMobileAberto && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMenuMobileAberto(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto} />

      <main className="financeiro-camisetas-main">
        <header className="financeiro-header">
          <h1>
            <DollarSign size={28} color="#204B72" aria-hidden="true" />
            9. Financeiro Real (DRE Mensal, Despesas e Contas a Pagar/Receber)
          </h1>
          <p>
            Faturamento e compras de matéria-prima vêm automaticamente das entregas e notas fiscais.
            Lance aqui as <strong>despesas operacionais por categoria</strong> (facção, estamparia, energia, aluguel)
            e acompanhe o que já foi <strong>recebido ou pago</strong> no mês.
          </p>
        </header>

        <section className="resumo-financeiro-grid" aria-label={`Resumo do ano ${ano}`}>
          <div className="card-financeiro-kpi faturamento">
            <span>Faturamento {ano}</span>
            <h3>{formatarMoeda(totalFaturamento)}</h3>
          </div>
          <div className="card-financeiro-kpi saidas">
            <span>Compras de Matéria-Prima</span>
            <h3>{formatarMoeda(totalGasto)}</h3>
          </div>
          <div className="card-financeiro-kpi lucro">
            <span>Lucro Líquido</span>
            <h3>{formatarMoeda(totalLucro)}</h3>
          </div>
          <div className="card-financeiro-kpi">
            <span>Margem Média</span>
            <h3>{margemMedia}%</h3>
          </div>
        </section>

        {/* SELETOR DE MÊS E DRE MENSAL DETALHADO */}
        <div className="form-financeiro-card">
          <div className="dre-topo-barra">
            <h2>
              <FileSpreadsheet size={20} color="#2563eb" aria-hidden="true" />
              DRE e Fluxo do Mês — {formatarMesAno(formFin.mes_ano)}
            </h2>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="fin-mes">Mês de referência *</label>
              <input id="fin-mes" type="month" value={formFin.mes_ano} onChange={handleMesAnoChange} required />
            </div>
          </div>

          {dreMes && (
            <div className="dre-resumo-grid" role="region" aria-label="Demonstrativo de resultado do mês">
              <div className="dre-item">
                <span>(+) Receita de Entregas</span>
                <strong className="dre-valor-azul">{formatarMoeda(dreMes.faturamento_entregas)}</strong>
                <small>
                  Recebido: {formatarMoeda(dreMes.receita_recebida)} · A receber: {formatarMoeda(dreMes.receita_a_receber)}
                </small>
              </div>
              <div className="dre-item">
                <span>(−) Compras Matéria-Prima</span>
                <strong className="dre-valor-vermelho">{formatarMoeda(dreMes.gasto_materiais)}</strong>
                <small>Margem bruta: {formatarMoeda(dreMes.margem_bruta)}</small>
              </div>
              <div className="dre-item">
                <span>(−) Despesas Operacionais</span>
                <strong className="dre-valor-vermelho">{formatarMoeda(dreMes.total_despesas_operacionais)}</strong>
                <small>
                  Pagas: {formatarMoeda(dreMes.despesas_pagas)} · Pendentes: {formatarMoeda(dreMes.despesas_pendentes)}
                </small>
              </div>
              <div className="dre-item dre-item-destaque">
                <span>(=) Resultado Líquido</span>
                <strong className={Number(dreMes.lucro_liquido) >= 0 ? 'dre-valor-verde' : 'dre-valor-vermelho'}>
                  {formatarMoeda(dreMes.lucro_liquido)}
                </strong>
                <small>Margem líquida: {Number(dreMes.margem_liquida_percentual || 0).toFixed(1)}%</small>
              </div>
            </div>
          )}

          {/* LANÇAMENTO DE DESPESA CATEGORIZADA */}
          <form onSubmit={handleLancarDespesa} className="despesa-form-bloco">
            <h3>
              <PlusCircle size={18} color="#2563eb" aria-hidden="true" /> Lançar despesa operacional / conta a pagar
            </h3>
            <div className="despesa-form-grid">
              <div className="form-group">
                <label htmlFor="desp-categoria">Categoria *</label>
                <select
                  id="desp-categoria"
                  value={formDespesa.categoria}
                  onChange={(e) => setFormDespesa({ ...formDespesa, categoria: e.target.value })}
                >
                  {CATEGORIAS_DESPESA.map((cat) => (
                    <option key={cat.codigo} value={cat.codigo}>{cat.rotulo}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="desp-descricao">Descrição *</label>
                <input
                  id="desp-descricao"
                  type="text"
                  placeholder="Ex.: Facção Dona Maria - Lote 12"
                  value={formDespesa.descricao}
                  onChange={(e) => setFormDespesa({ ...formDespesa, descricao: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="desp-valor">Valor (R$) *</label>
                <input
                  id="desp-valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ex.: 850.00"
                  value={formDespesa.valor}
                  onChange={(e) => setFormDespesa({ ...formDespesa, valor: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="desp-vencimento">Vencimento</label>
                <input
                  id="desp-vencimento"
                  type="date"
                  value={formDespesa.data_vencimento}
                  onChange={(e) => setFormDespesa({ ...formDespesa, data_vencimento: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="desp-status">Situação *</label>
                <select
                  id="desp-status"
                  value={formDespesa.status_pagamento}
                  onChange={(e) => setFormDespesa({ ...formDespesa, status_pagamento: e.target.value })}
                >
                  <option value="Pago">Pago</option>
                  <option value="Pendente">Pendente (a pagar)</option>
                </select>
              </div>
              <div className="form-group despesa-form-acao">
                <button type="submit" className="btn-acao-rapida" disabled={salvandoDespesa}>
                  <PlusCircle size={16} aria-hidden="true" />
                  <span>{salvandoDespesa ? 'Lançando…' : 'Adicionar despesa'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* LISTAS LADO A LADO: DESPESAS DO MÊS + RECEBIMENTOS DE PEDIDOS DO MÊS */}
          {dreMes && (
            <div className="dre-listas-grid">
              <div className="dre-lista-card">
                <h3>Despesas lançadas em {formatarMesAno(formFin.mes_ano)} ({dreMes.despesas.length})</h3>
                {dreMes.despesas.length === 0 ? (
                  <p className="dre-vazio">Nenhuma despesa detalhada neste mês.</p>
                ) : (
                  <table className="tabela-fin tabela-fin-compacta">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Descrição</th>
                        <th>Data</th>
                        <th>Valor</th>
                        <th>Situação</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dreMes.despesas.map((d) => (
                        <tr key={d.id_despesa}>
                          <td><strong>{rotuloCategoria(d.categoria)}</strong></td>
                          <td>{d.descricao}</td>
                          <td>{d.data_vencimento ? new Date(d.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                          <td style={{ color: '#dc2626', fontWeight: 700 }}>{formatarMoeda(d.valor)}</td>
                          <td>
                            <span className={`fin-status-badge ${d.status_pagamento === 'Pago' ? 'pago' : 'pendente'}`}>
                              {d.status_pagamento}
                            </span>
                          </td>
                          <td className="fin-acoes-celula">
                            <div className="fin-acoes-wrapper">
                              {d.status_pagamento === 'Pendente' && (
                                <button
                                  type="button"
                                  className="fin-btn-quitar"
                                  onClick={() => handleQuitarDespesa(d.id_despesa)}
                                >
                                  Quitar
                                </button>
                              )}
                              <button
                                type="button"
                                className="fin-btn-excluir"
                                aria-label={`Excluir despesa ${d.descricao}`}
                                onClick={() => handleExcluirDespesa(d.id_despesa)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="dre-lista-card">
                <h3>Contas a Receber — Entregas do Mês ({dreMes.pedidos_do_mes.length})</h3>
                {dreMes.pedidos_do_mes.length === 0 ? (
                  <p className="dre-vazio">Nenhum pedido entregue neste mês.</p>
                ) : (
                  <table className="tabela-fin tabela-fin-compacta">
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Valor</th>
                        <th>Recebimento</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dreMes.pedidos_do_mes.map((ped) => (
                        <tr key={ped.id_pedido}>
                          <td><strong>{ped.codigo_pedido}</strong></td>
                          <td>{ped.nome_cliente}</td>
                          <td style={{ color: '#2563eb', fontWeight: 700 }}>{formatarMoeda(ped.valor_total)}</td>
                          <td>
                            <span className={`fin-status-badge ${ped.status_pagamento === 'Pago' ? 'pago' : 'pendente'}`}>
                              {ped.status_pagamento}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="fin-btn-quitar"
                              onClick={() => handleAlternarPagamentoPedido(ped)}
                            >
                              {ped.status_pagamento === 'Pago' ? 'Marcar Pendente' : 'Marcar Pago'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* AJUSTE AVULSO / OBSERVAÇÕES DO MÊS (COMPATIBILIDADE FASE 0) */}
          <details className="fin-avulso-details">
            <summary>Observações do mês e outros custos avulsos (sem categoria)</summary>
            {registroDoMes && (
              <div className="banner-mes-apurado" role="status" style={{ marginTop: '0.8rem' }}>
                <strong>{formatarMesAno(formFin.mes_ano)}:</strong>{' '}
                {formatarMoeda(registroDoMes.faturamento_receita)} em entregas ({registroDoMes.qtd_pedidos_entregues}) ·{' '}
                {formatarMoeda(registroDoMes.valor_gasto_materiais)} em notas fiscais ({registroDoMes.qtd_entradas}) ·{' '}
                lucro {formatarMoeda(registroDoMes.lucro_liquido)}
              </div>
            )}
            <form onSubmit={handleSalvar} style={{ marginTop: '0.8rem' }}>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="fin-outros">Outros custos avulsos (R$)</label>
                  <input
                    id="fin-outros"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="Ex: 150.00"
                    value={formFin.outros_custos_operacionais}
                    onChange={(e) => setFormFin({ ...formFin, outros_custos_operacionais: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="fin-obs">Observações do fechamento</label>
                  <input
                    id="fin-obs"
                    type="text"
                    placeholder="Ex: Fechamento conferido com contabilidade"
                    value={formFin.observacoes}
                    onChange={(e) => setFormFin({ ...formFin, observacoes: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn-acao-rapida" disabled={salvando}>
                <CheckCircle size={18} aria-hidden="true" />
                <span>{salvando ? 'Salvando…' : 'Salvar observações / ajuste avulso'}</span>
              </button>
            </form>
          </details>
        </div>

        <div className="tabela-financeiro-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Mês a mês — {ano}</h2>
              <label htmlFor="fin-ano" className="seletor-ano-label">
                Ano:{' '}
                <select id="fin-ano" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
                  {[anoCorrente - 2, anoCorrente - 1, anoCorrente].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="btn-exportar-pdf" onClick={handleExportarPDF} title={`Exportar o financeiro de ${ano} em PDF`}>
              <Printer size={16} aria-hidden="true" />
              <span>Exportar em PDF</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="tabela-fin">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Origem</th>
                  <th>Matéria-Prima (Notas)</th>
                  <th>Faturamento (Entregas)</th>
                  <th>Despesas Operacionais</th>
                  <th>Lucro Líquido</th>
                  <th>Margem</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {carregando && registros.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Carregando…</td></tr>
                ) : registros.map((reg) => (
                  <tr
                    key={reg.mes_ano}
                    onClick={() => setFormFin((atual) => ({ ...atual, mes_ano: reg.mes_ano, observacoes: reg.observacoes || '' }))}
                    style={{ cursor: 'pointer' }}
                    title="Clique para abrir o DRE deste mês"
                  >
                    <td><strong>{formatarMesAno(reg.mes_ano)}</strong></td>
                    <td>
                      <span className={`origem-tag ${reg.qtd_pedidos_entregues + reg.qtd_entradas + (reg.qtd_despesas || 0) > 0 ? '' : 'vazio'}`}>
                        {descreverOrigem(reg)}
                      </span>
                    </td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>{formatarMoeda(reg.valor_gasto_materiais)}</td>
                    <td style={{ color: '#2563eb', fontWeight: 700 }}>{formatarMoeda(reg.faturamento_receita)}</td>
                    <td>{formatarMoeda(reg.outros_custos_operacionais)}</td>
                    <td style={{ color: '#059669', fontWeight: 800 }}>{formatarMoeda(reg.lucro_liquido)}</td>
                    <td><span className="margem-lucro-tag">{margemPercentual(reg)}%</span></td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{reg.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default RegistroFinanceiroCamisetas;
