import { Plus, Trash2 } from 'lucide-react';
import { GradeQuantidades } from '../producao/GradeQuantidades';
import { LINHA_QTD, POSICOES_ESTAMPA, colunasDoModelo, itemVazio, totalDoItem } from '../../utils/pedidoItens';
import '../cadastros/cadastros.css';
import './pedidos.css';

/** Lista de itens do pedido: modelo, cor, estampa/posição opcional e quantidades por tamanho da grade do modelo. */
export function ItensPedidoEditor({ itens, onChange, modelos, cores, estampas = [], idPrefixo }) {
  const alterar = (chave, mudancas) => onChange(itens.map((item) => (item.chave === chave ? { ...item, ...mudancas } : item)));
  const adicionar = () => {
    const proxima = Math.max(0, ...itens.map((item) => item.chave)) + 1;
    onChange([...itens, itemVazio(proxima, itens.at(-1)?.id_modelo ?? '')]);
  };
  const totalGeral = itens.reduce((total, item) => total + totalDoItem(item), 0);

  return (
    <fieldset className="itens-pedido">
      <legend>Itens do pedido <span className="total-grade-badge">Total: {totalGeral} peças</span></legend>
      {itens.map((item, indice) => {
        const modelo = modelos.find((m) => String(m.id_modelo) === String(item.id_modelo));
        const cor = cores.find((c) => String(c.id_cor) === String(item.id_cor));
        const estampa = estampas.find((est) => String(est.id_estampa) === String(item.id_estampa));
        const id = `${idPrefixo}-${item.chave}`;
        return (
          <div key={item.chave} className="item-pedido">
            <div className="item-pedido-cabecalho">
              <strong>Item {indice + 1}</strong>
              {itens.length > 1 && (
                <button type="button" className="cadastro-btn-icone" aria-label={`Remover item ${indice + 1}`}
                  onClick={() => onChange(itens.filter((i) => i.chave !== item.chave))}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="item-pedido-campos">
              <div className="cadastro-campo">
                <label htmlFor={`${id}-modelo`}>Modelo *</label>
                <select id={`${id}-modelo`} value={item.id_modelo} onChange={(e) => alterar(item.chave, { id_modelo: e.target.value, valores: {} })}>
                  <option value="">Selecione…</option>
                  {modelos.map((m) => <option key={m.id_modelo} value={m.id_modelo}>{m.nome_modelo}</option>)}
                </select>
              </div>
              <div className="cadastro-campo">
                <label htmlFor={`${id}-cor`}>Cor *</label>
                <select id={`${id}-cor`} value={item.id_cor} onChange={(e) => alterar(item.chave, { id_cor: e.target.value })}>
                  <option value="">Selecione…</option>
                  {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
                </select>
              </div>
              <div className="cadastro-campo">
                <label htmlFor={`${id}-estampa`}>Estampa (opcional)</label>
                <div className="item-pedido-estampa-linha">
                  <select
                    id={`${id}-estampa`}
                    value={item.id_estampa || ''}
                    onChange={(e) => alterar(item.chave, {
                      id_estampa: e.target.value,
                      posicao_estampa: e.target.value ? (item.posicao_estampa || 'Frente') : 'Frente',
                    })}
                  >
                    <option value="">Lisa (sem estampa)</option>
                    {estampas.map((est) => (
                      <option key={est.id_estampa} value={est.id_estampa}>
                        [{est.codigo}] {est.nome}
                      </option>
                    ))}
                  </select>
                  {estampa?.imagem_data_url && (
                    <img
                      src={estampa.imagem_data_url}
                      alt={estampa.nome}
                      className="item-pedido-estampa-thumb"
                      title={`${estampa.codigo} — ${estampa.nome}`}
                    />
                  )}
                </div>
              </div>
              {item.id_estampa && (
                <div className="cadastro-campo">
                  <label htmlFor={`${id}-posicao`}>Posição da estampa</label>
                  <select
                    id={`${id}-posicao`}
                    value={item.posicao_estampa || 'Frente'}
                    onChange={(e) => alterar(item.chave, { posicao_estampa: e.target.value })}
                  >
                    {POSICOES_ESTAMPA.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {modelo ? (
              <GradeQuantidades
                idPrefixo={id}
                legenda={`Quantidades do item ${indice + 1} por tamanho`}
                linhas={[{ id: LINHA_QTD, rotulo: cor?.nome || `Item ${indice + 1}`, hex: cor?.hex }]}
                colunas={colunasDoModelo(modelo)}
                valores={item.valores}
                onChange={(valores) => alterar(item.chave, { valores })}
              />
            ) : (
              <p className="painel-cadastro-vazio">Escolha o modelo para ver a grade de tamanhos.</p>
            )}
          </div>
        );
      })}
      <button type="button" className="cadastro-btn secundario" onClick={adicionar}>
        <Plus size={16} aria-hidden="true" /> Adicionar item
      </button>
    </fieldset>
  );
}
