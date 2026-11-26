import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, ShoppingCart } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { formatarMoeda, formatarPecas, formatarQuantidade } from '../../utils/numeros';
import './painelSugestaoCompra.css';

const MARGEM_PADRAO = '5';

const formatarData = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '—');

function TabelaLinhas({ titulo, linhas, mostrarCor }) {
  if (linhas.length === 0) {
    return (
      <div className="sugestao-bloco">
        <h4>{titulo}</h4>
        <p className="sugestao-vazio">Nada a comprar: o saldo cobre os pedidos da fila.</p>
      </div>
    );
  }
  return (
    <div className="sugestao-bloco">
      <h4>{titulo}</h4>
      <div className="table-responsive">
        <table className="sugestao-tabela">
          <thead>
            <tr>
              <th>Insumo</th>
              {mostrarCor && <th>Cor</th>}
              <th>Peças</th>
              <th>Necessário</th>
              <th>Em estoque</th>
              <th>Comprar</th>
              <th>Preço ref.</th>
              <th>Custo estimado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={`${linha.id_insumo}-${linha.nome_cor || ''}`} className={Number(linha.comprar) > 0 ? '' : 'sugestao-coberto'}>
                <td>
                  <strong>{linha.codigo}</strong>
                  <small>{linha.descricao}</small>
                </td>
                {mostrarCor && <td>{linha.nome_cor || '—'}</td>}
                <td>{formatarPecas(linha.pecas)}</td>
                <td>{formatarQuantidade(linha.necessario, linha.unidade)}</td>
                <td>
                  {formatarQuantidade(linha.saldo_atual, linha.unidade)}
                  {Number(linha.estoque_minimo) > 0 && (
                    <small>mínimo {formatarQuantidade(linha.estoque_minimo, linha.unidade)}</small>
                  )}
                </td>
                <td className="sugestao-comprar">
                  {formatarQuantidade(linha.comprar, linha.unidade)}
                  {linha.embalagens > 0 && (
                    <small>
                      {linha.embalagens === 1 ? '1 embalagem fechada' : `${linha.embalagens} embalagens fechadas`}
                      {Number(linha.sobra) > 0 && ` · sobram ${formatarQuantidade(linha.sobra, linha.unidade)}`}
                    </small>
                  )}
                </td>
                <td>
                  {formatarMoeda(linha.preco_referencia)}
                  <small>{linha.origem_preco}</small>
                </td>
                <td className="sugestao-custo">{formatarMoeda(linha.custo_estimado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PainelSugestaoCompra() {
  const toast = useToast();
  const [margem, setMargem] = useState(MARGEM_PADRAO);
  const [sugestao, setSugestao] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [pedidosAbertos, setPedidosAbertos] = useState(false);

  const carregar = useCallback(async (margemPercentual) => {
    try {
      setCarregando(true);
      const { data } = await api.get('/camisetas/insumos/sugestao-compra/', {
        params: { margem_percentual: margemPercentual || 0 },
      });
      setSugestao(data);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível calcular a sugestão de compra.'));
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    carregar(MARGEM_PADRAO);
  }, [carregar]);

  const pedidos = sugestao?.pedidos_considerados || [];
  const alertas = sugestao?.alertas || [];

  return (
    <section className="sugestao-compra-card" aria-label="Sugestão de compra de insumos">
      <div className="sugestao-topo">
        <div>
          <h3>
            <ShoppingCart size={20} aria-hidden="true" />
            O que comprar para os pedidos na fila
          </h3>
          <p className="sugestao-explicacao">
            Tecido conta só pedidos que ainda não têm ordem de produção — a OP já baixa a malha do rolo.
            Aviamento conta as peças que ainda não foram enviadas à facção. Insumo contado em peças
            é arredondado para cima; malha em kg e viés em metros mantêm as casas decimais.
          </p>
        </div>
        <div className="sugestao-acoes">
          <label htmlFor="sugestao-margem">
            Margem de segurança (%)
            <input
              id="sugestao-margem"
              type="number"
              min="0"
              max="100"
              step="1"
              value={margem}
              onChange={(e) => setMargem(e.target.value)}
            />
          </label>
          <button type="button" onClick={() => carregar(margem)} disabled={carregando}>
            <RefreshCw size={16} aria-hidden="true" />
            <span>{carregando ? 'Calculando…' : 'Recalcular'}</span>
          </button>
        </div>
      </div>

      {sugestao && (
        <>
          <div className="sugestao-total">
            <span>Investimento estimado na compra</span>
            <strong>{formatarMoeda(sugestao.total_estimado)}</strong>
            <small>
              {pedidos.length === 0
                ? 'Nenhum pedido aguardando produção no momento.'
                : `${pedidos.length} pedido(s) na fila`}
            </small>
          </div>

          {alertas.length > 0 && (
            <ul className="sugestao-alertas" aria-label="Avisos da sugestão">
              {alertas.map((alerta) => (
                <li key={alerta}>
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>{alerta}</span>
                </li>
              ))}
            </ul>
          )}

          <TabelaLinhas titulo="Tecido (malha)" linhas={sugestao.tecidos} mostrarCor />
          <TabelaLinhas titulo="Aviamentos" linhas={sugestao.aviamentos} mostrarCor={false} />

          {pedidos.length > 0 && (
            <div className="sugestao-bloco">
              <button
                type="button"
                className="sugestao-toggle"
                onClick={() => setPedidosAbertos((aberto) => !aberto)}
                aria-expanded={pedidosAbertos}
              >
                {pedidosAbertos ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                <span>De onde veio esta conta ({pedidos.length} pedido(s))</span>
              </button>
              {pedidosAbertos && (
                <div className="table-responsive">
                  <table className="sugestao-tabela">
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Status</th>
                        <th>Prazo</th>
                        <th>Peças</th>
                        <th>Conta tecido?</th>
                        <th>Peças sem aviamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidos.map((pedido) => (
                        <tr key={pedido.codigo_pedido}>
                          <td><strong>{pedido.codigo_pedido}</strong></td>
                          <td>{pedido.nome_cliente}</td>
                          <td>{pedido.status_pedido}</td>
                          <td>{formatarData(pedido.prazo_entrega)}</td>
                          <td>{formatarPecas(pedido.pecas)}</td>
                          <td>{pedido.conta_tecido ? 'Sim' : 'Não — já tem OP'}</td>
                          <td>{formatarPecas(pedido.pecas_pendentes_aviamento)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
