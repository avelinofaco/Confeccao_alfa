import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, DollarSign, PlusCircle, Printer } from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/feedback/useToast';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import './RegistroFinanceiroCamisetas.css';

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

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
  return partes.length > 0 ? partes.join(' · ') : 'Sem movimento';
};

const escaparHtml = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const somar = (registros, campo) => registros.reduce((acc, r) => acc + (Number(r[campo]) || 0), 0);

function RegistroFinanceiroCamisetas() {
  const toast = useToast();
  const anoCorrente = Number(mesAtual().slice(0, 4));
  const [ano, setAno] = useState(anoCorrente);
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formFin, setFormFin] = useState({ mes_ano: mesAtual(), outros_custos_operacionais: '', observacoes: '' });

  const carregarRegistros = useCallback(async (anoReferencia) => {
    try {
      setCarregando(true);
      const res = await api.get(`/camisetas/financeiro/?ano=${anoReferencia}`);
      setRegistros(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar financeiro:', err);
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar o financeiro.'));
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    carregarRegistros(ano);
  }, [ano, carregarRegistros]);

  const registroDoMes = registros.find((r) => r.mes_ano === formFin.mes_ano);

  const handleMesAnoChange = (e) => {
    const novoMes = e.target.value;
    const existente = registros.find((r) => r.mes_ano === novoMes);
    setFormFin({
      mes_ano: novoMes,
      outros_custos_operacionais: existente && Number(existente.outros_custos_operacionais) > 0
        ? String(existente.outros_custos_operacionais)
        : '',
      observacoes: existente?.observacoes || '',
    });
    const anoDoMes = Number(novoMes.slice(0, 4));
    if (anoDoMes && anoDoMes !== ano) setAno(anoDoMes);
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
      toast.sucesso(`Outros custos de ${formatarMesAno(formFin.mes_ano)} salvos. O lucro do mês foi recalculado.`);
      await carregarRegistros(ano);
    } catch (err) {
      console.error('Erro ao salvar outros custos:', err);
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
        <th>Mês</th><th>Origem</th><th>Matéria-prima</th><th>Faturamento</th><th>Outros custos</th>
        <th>Lucro</th><th>Margem</th><th>Observações</th>
      </tr></thead><tbody>${linhas}</tbody></table>
      <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
      </body></html>`);
    janela.document.close();
  };

  return (
    <div className="financeiro-camisetas-container">
      <Sidebar />

      <main className="financeiro-camisetas-main">
        <header className="financeiro-header">
          <h1>
            <DollarSign size={28} color="#204B72" aria-hidden="true" />
            9. Tela de Registro Financeiro (Custos e Lucratividade)
          </h1>
          <p>
            O faturamento (pedidos entregues) e as compras de matéria-prima (notas fiscais) são calculados
            automaticamente. Aqui você lança só os <strong>outros custos do mês</strong>: facções, energia, aluguel…
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

        <div className="form-financeiro-card">
          <h2>
            <PlusCircle size={20} color="#2563eb" aria-hidden="true" />
            Outros custos do mês
          </h2>

          {registroDoMes && (
            <div className="banner-mes-apurado" role="status">
              <strong>{formatarMesAno(formFin.mes_ano)}:</strong>{' '}
              {formatarMoeda(registroDoMes.faturamento_receita)} em entregas ({registroDoMes.qtd_pedidos_entregues}) ·{' '}
              {formatarMoeda(registroDoMes.valor_gasto_materiais)} em notas fiscais ({registroDoMes.qtd_entradas}) ·{' '}
              lucro {formatarMoeda(registroDoMes.lucro_liquido)}
            </div>
          )}

          <form onSubmit={handleSalvar}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1.2rem' }}>
              <div className="form-group">
                <label htmlFor="fin-mes">Mês de referência *</label>
                <input id="fin-mes" type="month" value={formFin.mes_ano} onChange={handleMesAnoChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="fin-outros">Outros custos (facções, energia, aluguel…) R$</label>
                <input
                  id="fin-outros"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 3500.00"
                  value={formFin.outros_custos_operacionais}
                  onChange={(e) => setFormFin({ ...formFin, outros_custos_operacionais: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.4rem' }}>
              <label htmlFor="fin-obs">Observações</label>
              <textarea
                id="fin-obs"
                rows="2"
                placeholder="Ex: Facção Maria R$ 2.000 + energia R$ 1.500"
                value={formFin.observacoes}
                onChange={(e) => setFormFin({ ...formFin, observacoes: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-acao-rapida" disabled={salvando}>
              <CheckCircle size={18} aria-hidden="true" />
              <span>{salvando ? 'Salvando…' : 'Salvar outros custos'}</span>
            </button>
          </form>
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
                  <th>Outros Custos</th>
                  <th>Lucro Líquido</th>
                  <th>Margem</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {carregando && registros.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Carregando…</td></tr>
                ) : registros.map((reg) => (
                  <tr key={reg.mes_ano}>
                    <td><strong>{formatarMesAno(reg.mes_ano)}</strong></td>
                    <td>
                      <span className={`origem-tag ${reg.qtd_pedidos_entregues + reg.qtd_entradas > 0 ? '' : 'vazio'}`}>
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
