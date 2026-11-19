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

/** Renderiza o nome do item e o tamanho em badge separada */
function renderizarItemSku(sku) {
  if (!sku) return <span className="text-slate-400">—</span>;
  const partes = sku.split(' · ');
  if (partes.length >= 2) {
    const tamanho = partes[partes.length - 1];
    const produtoECor = partes.slice(0, -1).join(' · ');
    return (
      <div className="historico-item-col">
        <span className="historico-item-nome">{produtoECor}</span>
        <span className="historico-tamanho-badge">{tamanho}</span>
      </div>
    );
  }
  return <span className="historico-item-nome">{sku}</span>;
}

/** Renderiza o badge semântico com cantos arredondados (rounded-full) */
function renderizarBadgeTipo(tipo) {
  const rotulo = ROTULOS_TIPO[tipo] || tipo;
  let classeBadge = 'badge-tipo-padrao';

  if (tipo === 'ENTRADA_PRODUCAO') {
    classeBadge = 'badge-tipo-entrada';
  } else if (tipo === 'SAIDA_ENTREGA') {
    classeBadge = 'badge-tipo-saida';
  } else if (tipo === 'ESTORNO_ENTREGA') {
    classeBadge = 'badge-tipo-estorno';
  } else if (tipo === 'INVENTARIO') {
    classeBadge = 'badge-tipo-inventario';
  } else if (tipo === 'AJUSTE') {
    classeBadge = 'badge-tipo-ajuste';
  }

  return (
    <span className={`historico-badge-tipo ${classeBadge}`}>
      {rotulo}
    </span>
  );
}

/** Destaca código de referência (PED-XXXX-XXXX / OP-XXXX-XXXX) e evita duplicações */
function renderizarMotivoReferencia(motivo, referencia) {
  const mot = (motivo || '').trim();
  const ref = (referencia || '').trim();

  if (!mot && !ref) return <span className="historico-vazio">—</span>;

  // Se são idênticos ou se motivo já contém exatamente a referência
  if (ref && mot) {
    if (mot.toLowerCase() === ref.toLowerCase()) {
      return <span className="historico-codigo-ref">{ref}</span>;
    }

    if (mot.includes(ref)) {
      const partes = mot.split(ref);
      return (
        <span className="historico-motivo-texto">
          {partes[0]}
          <span className="historico-codigo-ref">{ref}</span>
          {partes.slice(1).join(ref)}
        </span>
      );
    }

    return (
      <span className="historico-motivo-texto">
        <span>{mot}</span>
        <span className="historico-separador">·</span>
        <span className="historico-codigo-ref">{ref}</span>
      </span>
    );
  }

  if (ref) {
    return <span className="historico-codigo-ref">{ref}</span>;
  }

  // Apenas motivo: buscar referências conhecidas como PED-XXXX-XXXX ou OP-XXXX-XXXX para destacar
  const padraoCodigo = /(PED-\d{4}-\d+|OP-\d{4}-\d+)/;
  const match = mot.match(padraoCodigo);
  if (match) {
    const codigoEncontrado = match[0];
    const partes = mot.split(codigoEncontrado);
    return (
      <span className="historico-motivo-texto">
        {partes[0]}
        <span className="historico-codigo-ref">{codigoEncontrado}</span>
        {partes.slice(1).join(codigoEncontrado)}
      </span>
    );
  }

  return <span className="historico-motivo-texto">{mot}</span>;
}

/** Histórico do estoque pronto: de um SKU (`idVariacao`) ou de tudo. Mudar `versao` recarrega. */
export function HistoricoMovimentos({ idVariacao, compacto = false, versao = 0, titulo = null }) {
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
      {(titulo || !compacto) && (
        <div className="historico-header-bar">
          <div className="historico-titulo-area">
            {titulo}
          </div>
          {!compacto && (
            <div className="historico-filtro-area">
              <label className="historico-filtro-rotulo" htmlFor="historico-tipo">
                Tipo
              </label>
              <select
                id="historico-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="historico-tipo-select"
                aria-label="Filtrar por tipo de movimentação"
              >
                <option value="">Todos</option>
                {Object.entries(ROTULOS_TIPO).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>{rotulo}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {movimentos.length === 0 ? (
        <p className="painel-cadastro-vazio">Nenhuma movimentação ainda.</p>
      ) : (
        <div className="historico-tabela-wrapper">
          <table className="historico-tabela" aria-label="Histórico de movimentações de estoque">
            <thead>
              <tr>
                <th scope="col" className="th-quando">Quando</th>
                {!idVariacao && <th scope="col" className="th-item">Item</th>}
                <th scope="col" className="th-tipo">Tipo</th>
                <th scope="col" className="th-qtd">Qtd.</th>
                <th scope="col" className="th-saldo">Saldo depois</th>
                <th scope="col" className="th-motivo">Motivo / referência</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id_movimento} className="historico-linha">
                  <td className="td-quando">
                    <span className="data-hora-tabular">{formatarDataHora(m.criado_em)}</span>
                  </td>
                  {!idVariacao && (
                    <td className="td-item">
                      {renderizarItemSku(m.sku)}
                    </td>
                  )}
                  <td className="td-tipo">
                    {renderizarBadgeTipo(m.tipo)}
                  </td>
                  <td className={`td-qtd ${m.quantidade < 0 ? 'qtd-negativa' : 'qtd-positiva'}`}>
                    {comSinal(m.quantidade)}
                  </td>
                  <td className="td-saldo">
                    <span className="saldo-destaque">{m.saldo_apos}</span>
                  </td>
                  <td className="td-motivo">
                    {renderizarMotivoReferencia(m.motivo, m.referencia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
