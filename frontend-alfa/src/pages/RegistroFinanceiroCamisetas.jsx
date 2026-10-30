import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PlusCircle, 
  Calendar, 
  FileSpreadsheet, 
  CheckCircle,
  HelpCircle,
  Percent,
  RefreshCw,
  Sparkles,
  ShoppingBag,
  PackageCheck,
  Printer
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import './RegistroFinanceiroCamisetas.css';

function RegistroFinanceiroCamisetas() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [dadosApurados, setDadosApurados] = useState(null);
  const [buscandoApuracao, setBuscandoApuracao] = useState(false);

  // Form de lançamento mensal
  const [formFin, setFormFin] = useState({
    mes_ano: new Date().toISOString().slice(0, 7), // AAAA-MM
    valor_gasto_materiais: '',
    faturamento_receita: '',
    outros_custos_operacionais: '',
    observacoes: ''
  });

  const carregarRegistros = async () => {
    try {
      setLoading(true);
      const res = await api.get('/camisetas/financeiro/');
      setRegistros(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar registros financeiros:", err);
    } finally {
      setLoading(false);
    }
  };

  // Consulta no backend os gastos de compras de materiais e vendas a clientes para o mês selecionado
  const buscarApuracaoMes = async (mesAno) => {
    if (!mesAno) return;
    try {
      setBuscandoApuracao(true);
      const res = await api.get(`/camisetas/financeiro/apuracao-mensal/?mes_ano=${mesAno}`);
      const dados = res.data;
      setDadosApurados(dados);

      // Se tiver dados reais no mês (compras no estoque ou pedidos de clientes), já sugere no form
      if (dados && dados.tem_dados_reais) {
        setFormFin(prev => ({
          ...prev,
          mes_ano: mesAno,
          valor_gasto_materiais: parseFloat(dados.gasto_materiais_real || 0).toFixed(2),
          faturamento_receita: parseFloat(dados.faturamento_vendas_real || 0).toFixed(2),
          outros_custos_operacionais: prev.outros_custos_operacionais || (parseFloat(dados.outros_custos || 0) > 0 ? parseFloat(dados.outros_custos).toFixed(2) : ''),
          observacoes: prev.observacoes || `Apuração automática: ${dados.qtd_pedidos_vendas} pedido(s) de clientes e ${dados.qtd_entradas_estoque} compra(s) de estoque.`
        }));
      }
    } catch (err) {
      console.warn("Não foi possível apurar dados automáticos do mês:", err);
    } finally {
      setBuscandoApuracao(false);
    }
  };

  useEffect(() => {
    carregarRegistros();
    buscarApuracaoMes(formFin.mes_ano);
  }, []);

  const handleMesAnoChange = (e) => {
    const novoMes = e.target.value;
    setFormFin(prev => ({ ...prev, mes_ano: novoMes }));
    buscarApuracaoMes(novoMes);
  };

  // Botão para sincronizar todo o histórico com dados reais do estoque e vendas
  const handleSincronizarAutomatico = async () => {
    try {
      setSincronizando(true);
      const res = await api.post('/camisetas/financeiro/sincronizar-automatico/');
      setRegistros(res.data || []);
      await buscarApuracaoMes(formFin.mes_ano);
      alert("Sincronização concluída com sucesso! Os gastos com compras de estoque e os pedidos de clientes foram consolidados automaticamente mês a mês.");
    } catch (err) {
      console.error("Erro ao sincronizar financeiro:", err);
      alert("Não foi possível sincronizar automaticamente.");
    } finally {
      setSincronizando(false);
    }
  };

  const aplicarDadosApuradosManual = () => {
    if (!dadosApurados) return;
    setFormFin(prev => ({
      ...prev,
      valor_gasto_materiais: parseFloat(dadosApurados.gasto_materiais_real || 0).toFixed(2),
      faturamento_receita: parseFloat(dadosApurados.faturamento_vendas_real || 0).toFixed(2),
      outros_custos_operacionais: parseFloat(dadosApurados.outros_custos || 0) > 0 ? parseFloat(dadosApurados.outros_custos).toFixed(2) : '',
      observacoes: `Apuração automática do sistema: ${dadosApurados.qtd_pedidos_vendas} pedido(s) e ${dadosApurados.qtd_entradas_estoque} compra(s) de insumos.`
    }));
  };

  const handleSalvarFinanceiro = async (e) => {
    e.preventDefault();
    if (!formFin.mes_ano || !formFin.valor_gasto_materiais || !formFin.faturamento_receita) {
      alert("Preencha o mês/ano, compras de materiais e faturamento.");
      return;
    }

    try {
      const gast = parseFloat(formFin.valor_gasto_materiais || 0);
      const fat = parseFloat(formFin.faturamento_receita || 0);
      const outros = parseFloat(formFin.outros_custos_operacionais || 0);
      // Lucro líquido calculado automaticamente
      const lucro = fat - gast - outros;

      await api.post('/camisetas/financeiro/', {
        mes_ano: formFin.mes_ano,
        valor_gasto_materiais: gast,
        faturamento_receita: fat,
        outros_custos_operacionais: outros,
        lucro_liquido: lucro,
        observacoes: formFin.observacoes
      });

      alert("Lançamento financeiro registrado com sucesso! O gráfico de barras anual do Dashboard foi atualizado.");
      carregarRegistros();
    } catch (err) {
      console.error("Erro ao registrar financeiro:", err);
      alert(err.response?.data?.detail || "Erro ao registrar financeiro.");
    }
  };

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatarMesAnoTexto = (mesAnoStr) => {
    if (!mesAnoStr) return '—';
    const partes = String(mesAnoStr).split('-');
    if (partes.length === 2) {
      const ano = partes[0];
      const mesNum = parseInt(partes[1], 10);
      const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      if (mesNum >= 1 && mesNum <= 12) {
        return `${meses[mesNum - 1]} / ${ano}`;
      }
    }
    return mesAnoStr;
  };

  // Totais do período
  const totalGastoMateriais = registros.reduce((acc, r) => acc + parseFloat(r.valor_gasto_materiais || 0), 0);
  const totalFaturamento = registros.reduce((acc, r) => acc + parseFloat(r.faturamento_receita || 0), 0);
  const totalLucro = registros.reduce((acc, r) => acc + parseFloat(r.lucro_liquido || 0), 0);
  const margemMedia = totalFaturamento > 0 ? ((totalLucro / totalFaturamento) * 100).toFixed(1) : '0';

  // Exportação elegante em PDF do Histórico Mensal de 12 meses
  const handleExportarPDF = () => {
    const win = window.open('', '_blank');
    if (!win) {
      alert("Por favor, permita popups neste navegador para exportar o relatório em PDF.");
      return;
    }

    const dataHoje = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const linhasHtml = registros.map(reg => {
      const gast = parseFloat(reg.valor_gasto_materiais || 0);
      const fat = parseFloat(reg.faturamento_receita || 0);
      const outros = parseFloat(reg.outros_custos_operacionais || 0);
      const luc = parseFloat(reg.lucro_liquido || 0);
      const margem = fat > 0 ? ((luc / fat) * 100).toFixed(1) : '0.0';
      const isReal = (reg.observacoes || '').toLowerCase().includes('sincroniz') || 
                     (reg.observacoes || '').toLowerCase().includes('apuração') ||
                     (reg.observacoes || '').toLowerCase().includes('automátic');

      return `
        <tr>
          <td><strong>${formatarMesAnoTexto(reg.mes_ano)}</strong></td>
          <td style="text-align: center;"><span class="badge ${isReal ? 'real' : 'proj'}">${isReal ? '✓ Real' : 'Projeção'}</span></td>
          <td style="text-align: right; color: #b91c1c; font-weight: 700;">${formatarMoeda(gast)}</td>
          <td style="text-align: right; color: #1d4ed8; font-weight: 700;">${formatarMoeda(fat)}</td>
          <td style="text-align: right; color: #4b5563;">${formatarMoeda(outros)}</td>
          <td style="text-align: right; color: #047857; font-weight: 800;">${formatarMoeda(luc)}</td>
          <td style="text-align: center; font-weight: 700;">${margem}%</td>
          <td style="font-size: 10px; color: #6b7280;">${reg.observacoes || '-'}</td>
        </tr>
      `;
    }).join('');

    const htmlCompleto = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório Financeiro Anual - Confecção Alfa</title>
        <style>
          @page { size: A4 landscape; margin: 12mm 15mm; }
          body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2C2523; margin: 0; padding: 24px; font-size: 12px; }
          .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2C2523; padding-bottom: 12px; margin-bottom: 18px; }
          .logo-title h1 { margin: 0; font-size: 22px; font-weight: 800; color: #1E3A8A; font-family: 'Lora', Georgia, serif; }
          .logo-title p { margin: 3px 0 0; font-size: 13px; color: #5C524D; }
          .meta-info { text-align: right; font-size: 11px; color: #6B7280; line-height: 1.4; }
          .resumo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
          .card-kpi { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 14px; background: #FAF9F6; }
          .card-kpi span { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6B7280; display: block; margin-bottom: 4px; }
          .card-kpi strong { font-size: 16px; font-weight: 800; }
          .tabela { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          .tabela th { background: #F4EFEA; color: #2C2523; text-transform: uppercase; font-size: 10px; font-weight: 700; padding: 8px 10px; border-bottom: 2px solid #D5CCC0; text-align: left; }
          .tabela td { padding: 8px 10px; border-bottom: 1px solid #EAE4DD; }
          .tabela tr:nth-child(even) { background-color: #FAF8F5; }
          .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; display: inline-block; }
          .badge.real { background: #DCFCE7; color: #15803D; }
          .badge.proj { background: #F3F4F6; color: #4B5563; }
          .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 8px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-title">
            <h1>CONFECÇÃO ALFA</h1>
            <p>Relatório Anual de Fechamento Financeiro & Lucratividade (${registros.length} Meses)</p>
          </div>
          <div class="meta-info">
            Emissão: <strong>${dataHoje}</strong><br>
            Segmento: <strong>Camisetas & Malharia</strong>
          </div>
        </div>

        <div class="resumo-grid">
          <div class="card-kpi" style="border-left: 4px solid #1D4ED8;">
            <span>Faturamento Bruto</span>
            <strong style="color: #1D4ED8;">${formatarMoeda(totalFaturamento)}</strong>
          </div>
          <div class="card-kpi" style="border-left: 4px solid #B91C1C;">
            <span>Compras de Matéria-Prima</span>
            <strong style="color: #B91C1C;">${formatarMoeda(totalGastoMateriais)}</strong>
          </div>
          <div class="card-kpi" style="border-left: 4px solid #047857;">
            <span>Lucro Líquido Acumulado</span>
            <strong style="color: #047857;">${formatarMoeda(totalLucro)}</strong>
          </div>
          <div class="card-kpi" style="border-left: 4px solid #D97706;">
            <span>Margem Média Real</span>
            <strong style="color: #D97706;">${margemMedia}%</strong>
          </div>
        </div>

        <table class="tabela">
          <thead>
            <tr>
              <th>Mês/Ano</th>
              <th style="text-align: center;">Origem</th>
              <th style="text-align: right;">Gasto em Matéria-Prima</th>
              <th style="text-align: right;">Faturamento Bruto</th>
              <th style="text-align: right;">Outros Custos</th>
              <th style="text-align: right;">Lucro Líquido</th>
              <th style="text-align: center;">Margem (%)</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            ${linhasHtml}
          </tbody>
        </table>

        <div class="footer">
          <span>Confecção Alfa - Relatório Gerencial de Custos e Lucratividade</span>
          <span>Página 1 de 1</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    win.document.write(htmlCompleto);
    win.document.close();
  };

  return (
    <div className="financeiro-camisetas-container">
      <Sidebar />

      <main className="financeiro-camisetas-main">
        <header className="financeiro-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1>
                <DollarSign size={28} color="#204B72" />
                6. Tela de Registro Financeiro (Custos e Lucratividade)
              </h1>
              <p>
                Os gastos com compras de matérias-primas no estoque e o faturamento das vendas aos clientes 
                são apurados automaticamente mês a mês pelo sistema. Esses dados alimentam em tempo real o motor do Dashboard.
              </p>
            </div>

            <button 
              type="button" 
              className="btn-acao-rapida" 
              onClick={handleSincronizarAutomatico}
              disabled={sincronizando}
              style={{ background: '#3D7098', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.2rem', borderRadius: '8px', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(44, 37, 35, 0.08)' }}
              title="Consolida todas as notas fiscais de estoque e pedidos de clientes mês a mês"
            >
              <RefreshCw size={17} className={sincronizando ? 'anim-girar' : ''} />
              <span>{sincronizando ? 'Sincronizando Sistema...' : 'Sincronizar com Estoque e Vendas'}</span>
            </button>
          </div>
        </header>

        {/* CARDS RESUMO DO MOTOR FINANCEIRO (ORDEM: 1. Faturamento Bruto, 2. Compras de Matéria-Prima, 3. Lucro Líquido Apurado, 4. Margem Média de Lucro) */}
        <section className="resumo-financeiro-grid">
          <div className="card-financeiro-kpi faturamento">
            <span>Faturamento Bruto</span>
            <h3>{formatarMoeda(totalFaturamento)}</h3>
          </div>

          <div className="card-financeiro-kpi saidas">
            <span>Compras de Matéria-Prima</span>
            <h3>{formatarMoeda(totalGastoMateriais)}</h3>
          </div>

          <div className="card-financeiro-kpi lucro">
            <span>Lucro Líquido Apurado</span>
            <h3>{formatarMoeda(totalLucro)}</h3>
          </div>

          <div className="card-financeiro-kpi">
            <span>Margem Média de Lucro</span>
            <h3 style={{ color: '#047857' }}>{margemMedia}%</h3>
          </div>
        </section>

        {/* FORMULÁRIO DE LANÇAMENTO */}
        <div className="form-financeiro-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
            <h2 style={{ margin: 0 }}>
              <PlusCircle size={20} color="#2563eb" />
              Lançamento / Ajuste de Fechamento Mensal
            </h2>

            {dadosApurados?.tem_dados_reais && (
              <span style={{ background: '#ecfdf5', color: '#047857', fontSize: '0.82rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={14} /> Dados reais do sistema disponíveis para este mês
              </span>
            )}
          </div>

          {/* BANNER INFORMATIVO DE DADOS APURADOS AUTOMATICAMENTE */}
          {dadosApurados?.tem_dados_reais ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1rem 1.2rem', marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <strong style={{ color: '#166534', display: 'block', marginBottom: '0.2rem' }}>
                  ⚡ Movimentações cadastradas no sistema encontradas para {formatarMesAnoTexto(formFin.mes_ano)}:
                </strong>
                <span style={{ color: '#15803d', fontSize: '0.88rem' }}>
                  • <strong>{formatarMoeda(dadosApurados.gasto_materiais_real)}</strong> em compras de insumos ({dadosApurados.qtd_entradas_estoque} entradas no estoque) | 
                  • <strong>{formatarMoeda(dadosApurados.faturamento_vendas_real)}</strong> em vendas aos clientes ({dadosApurados.qtd_pedidos_vendas} pedidos) | 
                  • Lucro apurado: <strong>{formatarMoeda(dadosApurados.lucro_apurado)}</strong>
                </span>
              </div>
              <button 
                type="button" 
                onClick={aplicarDadosApuradosManual}
                style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 0.9rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <CheckCircle size={15} />
                <span>Aplicar no Formulário</span>
              </button>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '0.7rem 1rem', marginBottom: '1.2rem', fontSize: '0.85rem', color: '#64748b' }}>
              💡 Selecione o mês/ano abaixo. Ao cadastrar entradas no estoque ou novos pedidos de clientes, o sistema preencherá os gastos e o faturamento automaticamente!
            </div>
          )}

          <form onSubmit={handleSalvarFinanceiro}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1.2rem' }}>
              <div className="form-group">
                <label>Mês / Ano de Referência *</label>
                <input 
                  type="month" 
                  value={formFin.mes_ano}
                  onChange={handleMesAnoChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Gasto com Matérias-Primas (Estoque R$) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="Ex: 22000.00"
                  value={formFin.valor_gasto_materiais}
                  onChange={(e) => setFormFin({ ...formFin, valor_gasto_materiais: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Faturamento com Vendas aos Clientes (R$) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="Ex: 42000.00"
                  value={formFin.faturamento_receita}
                  onChange={(e) => setFormFin({ ...formFin, faturamento_receita: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Outros Gastos / Facções de Costura (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="Ex: 3500.00"
                  value={formFin.outros_custos_operacionais}
                  onChange={(e) => setFormFin({ ...formFin, outros_custos_operacionais: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.4rem' }}>
              <label>Observações / Fornecedores Envolvidos</label>
              <textarea 
                rows="2"
                placeholder="Ex: Fechamento automático consolidado com compras no estoque e pedidos aos clientes..."
                value={formFin.observacoes}
                onChange={(e) => setFormFin({ ...formFin, observacoes: e.target.value })}
              ></textarea>
            </div>

            <button type="submit" className="btn-acao-rapida">
              <CheckCircle size={18} />
              <span>Salvar Registro & Atualizar Gráfico do Dashboard</span>
            </button>
          </form>
        </div>

        {/* TABELA DE REGISTROS MENSAIS */}
        <div className="tabela-financeiro-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Histórico Mensal de Custos & Lucratividade ({registros.length} meses)</h2>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                * Os meses com pedidos ou compras de estoque cadastrados sincronizam automaticamente
              </span>
            </div>

            <button 
              type="button" 
              className="btn-exportar-pdf"
              onClick={handleExportarPDF}
              title="Exportar Histórico Mensal de 12 meses em arquivo PDF timbrado"
            >
              <Printer size={16} />
              <span>Exportar em PDF</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="tabela-fin">
              <thead>
                <tr>
                  <th>Mês/Ano</th>
                  <th>Origem</th>
                  <th>Gasto em Matéria-Prima (Saídas)</th>
                  <th>Faturamento Bruto</th>
                  <th>Outros Custos</th>
                  <th>Lucro Líquido (Entradas)</th>
                  <th>Margem de Lucro (%)</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Nenhum registro financeiro cadastrado ainda.
                    </td>
                  </tr>
                ) : (
                  registros.map((reg) => {
                    const gast = parseFloat(reg.valor_gasto_materiais || 0);
                    const fat = parseFloat(reg.faturamento_receita || 0);
                    const luc = parseFloat(reg.lucro_liquido || 0);
                    const margem = fat > 0 ? ((luc / fat) * 100).toFixed(1) : '0';
                    const isReal = (reg.observacoes || '').toLowerCase().includes('sincroniz') || 
                                   (reg.observacoes || '').toLowerCase().includes('apuração') ||
                                   (reg.observacoes || '').toLowerCase().includes('automátic');

                    return (
                      <tr key={reg.id_registro}>
                        <td><strong>{formatarMesAnoTexto(reg.mes_ano)}</strong></td>
                        <td>
                          {isReal ? (
                            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              ✓ Real (Sistema)
                            </span>
                          ) : (
                            <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                              Projeção
                            </span>
                          )}
                        </td>
                        <td style={{ color: '#dc2626', fontWeight: 700 }}>{formatarMoeda(gast)}</td>
                        <td style={{ color: '#2563eb', fontWeight: 700 }}>{formatarMoeda(fat)}</td>
                        <td>{formatarMoeda(reg.outros_custos_operacionais)}</td>
                        <td style={{ color: '#059669', fontWeight: 800 }}>{formatarMoeda(luc)}</td>
                        <td>
                          <span className="margem-lucro-tag">{margem}%</span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {reg.observacoes || 'Fechamento normal'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default RegistroFinanceiroCamisetas;
