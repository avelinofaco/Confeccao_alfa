import { chaveCelula } from '../../utils/grade';
import './producao.css';

const numero = (valor) => Number(valor) || 0;

function CelulaEditavel({ id, rotulo, valor, maximo, onAlterar }) {
  const excede = maximo !== undefined && numero(valor) > maximo;
  return (
    <td>
      <input
        id={id}
        type="number"
        min="0"
        max={maximo}
        inputMode="numeric"
        className={`grade-qtd-campo${excede ? ' excede' : ''}`}
        aria-label={rotulo}
        aria-invalid={excede || undefined}
        value={valor ?? ''}
        disabled={maximo === 0}
        onChange={(e) => onAlterar(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
      />
      {maximo > 0 && <small className="grade-qtd-maximo">de {maximo}</small>}
    </td>
  );
}

function CelulaLeitura({ rotulo, valor, alerta, detalhe, onClick }) {
  const quantidade = numero(valor);
  const reservado = detalhe?.reservado || 0;
  const disponivel = detalhe?.disponivel ?? quantidade;
  const falta = detalhe?.falta_produzir || 0;
  const temReserva = reservado > 0;
  return (
    <td className={`${alerta ? 'grade-qtd-alerta' : ''}${falta > 0 ? ' grade-qtd-falta' : ''}`.trim() || undefined}>
      {onClick ? (
        <button type="button" className="grade-qtd-celula" aria-label={`${rotulo}: ${quantidade} peças`} onClick={onClick}>
          <span>{quantidade}</span>
          {temReserva && (
            <small className="grade-qtd-detalhe">
              <span>Res: {reservado}</span>
              {falta > 0 ? (
                <span className="grade-qtd-detalhe-falta">Falta: {falta}</span>
              ) : (
                <span className="grade-qtd-detalhe-livre">Livre: {disponivel}</span>
              )}
            </small>
          )}
        </button>
      ) : (
        <div>
          <span>{quantidade}</span>
          {temReserva && (
            <small className="grade-qtd-detalhe">
              <span>Res: {reservado}</span>
              {falta > 0 ? (
                <span className="grade-qtd-detalhe-falta">Falta: {falta}</span>
              ) : (
                <span className="grade-qtd-detalhe-livre">Livre: {disponivel}</span>
              )}
            </small>
          )}
        </div>
      )}
    </td>
  );
}

/**
 * Grade de quantidades: linhas (cores) × colunas (tamanhos), com totais por linha e por coluna.
 * Editável quando recebe `onChange`; só leitura caso contrário (células clicáveis com `onCelulaClick`).
 * @param {{
 *   linhas: Array<{id: number|string, rotulo: string, hex?: string}>,
 *   colunas: Array<{id: number, rotulo: string}>,
 *   valores: Record<string, number|string>,
 *   onChange?: (valores: Record<string, number|string>) => void,
 *   maximos?: Record<string, number>,
 *   alertas?: Record<string, boolean>,
 *   onCelulaClick?: (linhaId: number|string, colunaId: number) => void,
 *   legenda: string,
 *   idPrefixo: string,
 * }} props
 */
export function GradeQuantidades({
  linhas,
  colunas,
  valores,
  onChange,
  maximos = {},
  alertas = {},
  detalhes = {},
  onCelulaClick,
  legenda,
  idPrefixo,
}) {
  const valorDe = (linha, coluna) => valores[chaveCelula(linha.id, coluna.id)];
  const totalLinha = (linha) => colunas.reduce((total, coluna) => total + numero(valorDe(linha, coluna)), 0);
  const totalColuna = (coluna) => linhas.reduce((total, linha) => total + numero(valorDe(linha, coluna)), 0);
  const alterar = (linha, coluna, valor) => onChange({ ...valores, [chaveCelula(linha.id, coluna.id)]: valor });

  return (
    <div className="grade-qtd-rolagem">
      <table className="grade-qtd">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Cor</span></th>
            {colunas.map((coluna) => (
              <th key={coluna.id} scope="col">
                <span className="tamanho-grade-badge">{coluna.rotulo}</span>
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.id}>
              <th scope="row">
                {linha.hex && <span className="cadastro-amostra" style={{ background: linha.hex }} aria-hidden="true" />}
                {linha.rotulo}
              </th>
              {colunas.map((coluna) => {
                const chave = chaveCelula(linha.id, coluna.id);
                const rotulo = `${linha.rotulo}, tamanho ${coluna.rotulo}`;
                return onChange ? (
                  <CelulaEditavel key={coluna.id} id={`${idPrefixo}-${chave}`} rotulo={rotulo} valor={valores[chave]}
                    maximo={maximos[chave]} onAlterar={(valor) => alterar(linha, coluna, valor)} />
                ) : (
                  <CelulaLeitura key={coluna.id} rotulo={rotulo} valor={valores[chave]} alerta={alertas[chave]}
                    detalhe={detalhes[chave]}
                    onClick={onCelulaClick ? () => onCelulaClick(linha.id, coluna.id) : undefined} />
                );
              })}
              <td className="grade-qtd-total">{totalLinha(linha)}</td>
            </tr>
          ))}
        </tbody>
        {linhas.length > 1 && (
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {colunas.map((coluna) => <td key={coluna.id}>{totalColuna(coluna)}</td>)}
              <td className="grade-qtd-total">{linhas.reduce((total, linha) => total + totalLinha(linha), 0)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
