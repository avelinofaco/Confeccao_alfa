import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { ModalProducao } from '../producao/ModalProducao';
import { HistoricoMovimentos } from './HistoricoMovimentos';

const MOTIVO_MINIMO = 3;

/** Ajuste, estoque mínimo e histórico de um SKU. `sku`: { id_variacao, nome, saldo, estoque_minimo }. */
export function PainelSku({ sku, onFechar, onAlterado }) {
  const toast = useToast();
  const [ajuste, setAjuste] = useState({ quantidade: '', motivo: '' });
  const [minimo, setMinimo] = useState(String(sku.estoque_minimo));
  const [salvando, setSalvando] = useState(false);

  const executar = async (acao, sucesso, falha) => {
    try {
      setSalvando(true);
      await acao();
      toast.sucesso(sucesso);
      onAlterado();
    } catch (err) {
      toast.erro(mensagemDeErro(err, falha));
    } finally {
      setSalvando(false);
    }
  };

  const salvarAjuste = (e) => {
    e.preventDefault();
    const quantidade = parseInt(ajuste.quantidade, 10);
    if (!quantidade) { toast.aviso('Informe quanto entra (ex.: 5) ou sai (ex.: -2).'); return; }
    if (ajuste.motivo.trim().length < MOTIVO_MINIMO) { toast.aviso('Explique o motivo do ajuste (pelo menos 3 letras).'); return; }
    executar(
      () => api.post('/camisetas/produtos-prontos/ajustes', { id_variacao: sku.id_variacao, quantidade, motivo: ajuste.motivo.trim() }),
      `Estoque de ${sku.nome} ajustado.`,
      'Não foi possível ajustar o estoque.',
    );
  };

  const salvarMinimo = (e) => {
    e.preventDefault();
    const valor = parseInt(minimo, 10);
    if (Number.isNaN(valor) || valor < 0) { toast.aviso('O estoque mínimo precisa ser zero ou mais.'); return; }
    executar(
      () => api.put(`/camisetas/produtos-prontos/variacoes/${sku.id_variacao}/minimo`, { estoque_minimo: valor }),
      `Estoque mínimo de ${sku.nome}: ${valor} peças.`,
      'Não foi possível salvar o estoque mínimo.',
    );
  };

  return (
    <ModalProducao titulo={sku.nome} idTitulo="titulo-painel-sku" onFechar={onFechar}>
      <p className="producao-resumo">
        Saldo atual: <strong>{sku.saldo} peças</strong>
        {sku.estoque_minimo > 0 && ` · mínimo ${sku.estoque_minimo}`}
        {` · reservado em pedidos: ${sku.reservado || 0} · livre: ${sku.disponivel ?? sku.saldo}`}
        {sku.falta_produzir > 0 && ` · falta produzir: ${sku.falta_produzir}`}
      </p>
      <form className="painel-sku-bloco" onSubmit={salvarAjuste}>
        <h3>Ajustar estoque</h3>
        <div className="cadastro-grid">
          <div className="cadastro-campo">
            <label htmlFor="sku-ajuste-qtd">Quantidade (+ entra, − sai)</label>
            <input id="sku-ajuste-qtd" type="number" placeholder="Ex.: -2" value={ajuste.quantidade}
              onChange={(e) => setAjuste({ ...ajuste, quantidade: e.target.value })} />
          </div>
          <div className="cadastro-campo">
            <label htmlFor="sku-ajuste-motivo">Motivo do ajuste</label>
            <input id="sku-ajuste-motivo" maxLength={255} placeholder="Ex.: peça manchada" value={ajuste.motivo}
              onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })} />
          </div>
        </div>
        <div className="painel-cadastro-form-acoes">
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>Salvar ajuste</button>
        </div>
      </form>
      <form className="painel-sku-bloco" onSubmit={salvarMinimo}>
        <h3>Estoque mínimo</h3>
        <div className="painel-grade-novo">
          <input id="sku-minimo" type="number" min="0" aria-label="Estoque mínimo em peças" value={minimo}
            onChange={(e) => setMinimo(e.target.value)} />
          <button type="submit" className="cadastro-btn secundario" disabled={salvando}>Salvar mínimo</button>
        </div>
      </form>
      <section className="painel-sku-bloco" aria-labelledby="titulo-historico-sku">
        <h3 id="titulo-historico-sku">Últimas movimentações</h3>
        <HistoricoMovimentos idVariacao={sku.id_variacao} compacto />
      </section>
    </ModalProducao>
  );
}
