import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';

const ROTULOS_TIPO = {
  INVENTARIO: 'Inventário',
  AJUSTE: 'Ajuste',
  ENTRADA_PRODUCAO: 'Entrada da produção',
  SAIDA_ENTREGA: 'Saída (entrega)',
  ESTORNO_ENTREGA: 'Estorno de entrega',
};
const LIMITE_COMPACTO = 10;
const LIMITE_COMPLETO = 100;
const formatarDataHora = (valor) => (valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const comSinal = (n) => (n > 0 ? `+${n}` : String(n));

/** Histórico do estoque pronto: de um SKU (`idVariacao`) ou de tudo. Mudar `versao` recarrega. */
export function HistoricoMovimentos({ idVariacao, compacto = false, versao = 0 }) {
  const toast = useToast();
  const [tipo, setTipo] = useState('');
  const [movimentos, setMovimentos] = useState([]);

  useEffect(() => {
    let ativo = true;
    api.get('/camisetas/produtos-prontos/movimentos/', {
      params: { id_variacao: idVariacao, tipo: tipo || undefined, limite: compacto ? LIMITE_COMPACTO : LIMITE_COMPLETO },
    })
      .then(({ data }) => { if (ativo) setMovimentos(data); })
      .catch((err) => { if (ativo) toast.erro(mensagemDeErro(err, 'Não foi possível carregar o histórico.')); });
    return () => { ativo = false; };
  }, [idVariacao, tipo, compacto, versao, toast]);

  return (
    <div className="historico-movimentos">
      {!compacto && (
        <label className="historico-filtro" htmlFor="historico-tipo">
          Tipo
          <select id="historico-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ROTULOS_TIPO).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </label>
      )}
      {movimentos.length === 0 ? (
        <p className="painel-cadastro-vazio">Nenhuma movimentação ainda.</p>
      ) : (
        <div className="grade-qtd-rolagem">
          <table className="historico-tabela">
            <thead>
              <tr>
                <th scope="col">Quando</th>
                {!idVariacao && <th scope="col">Item</th>}
                <th scope="col">Tipo</th>
                <th scope="col">Qtd.</th>
                <th scope="col">Saldo depois</th>
                <th scope="col">Motivo / referência</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id_movimento}>
                  <td>{formatarDataHora(m.criado_em)}</td>
                  {!idVariacao && <td>{m.sku}</td>}
                  <td>{ROTULOS_TIPO[m.tipo] || m.tipo}</td>
                  <td className={m.quantidade < 0 ? 'historico-saida' : 'historico-entrada'}>{comSinal(m.quantidade)}</td>
                  <td>{m.saldo_apos}</td>
                  <td>{[m.motivo, m.referencia].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
