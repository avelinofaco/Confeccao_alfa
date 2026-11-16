import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { chaveCelula, valoresParaLista } from '../../utils/grade';
import { formatarRendimento } from '../../utils/producao';
import { GradeQuantidades } from './GradeQuantidades';
import { ModalProducao } from './ModalProducao';

const valoresDoCorte = (op) => Object.fromEntries(op.cortes.map((c) => [chaveCelula(c.id_cor, c.id_tamanho), c.cortado]));

/** Registro do corte: grade cor × tamanho (OP antiga: só o total), com rendimento total e por cor. */
export function ModalCorteOp({ op, onFechar, onSalvo }) {
  const toast = useToast();
  const [valores, setValores] = useState(() => valoresDoCorte(op));
  const [totalLegado, setTotalLegado] = useState(String(op.pecas_reais_cortadas || op.pecas_planejadas || ''));
  const [salvando, setSalvando] = useState(false);
  const linhas = op.cores.map((c) => ({ id: c.id_cor, rotulo: c.nome_cor, hex: c.hex_cor }));
  const colunas = op.tamanhos.map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }));
  const totalDaCor = (idCor) => colunas.reduce((total, c) => total + (Number(valores[chaveCelula(idCor, c.id)]) || 0), 0);
  const total = op.legada ? Number(totalLegado) || 0 : op.cores.reduce((soma, c) => soma + totalDaCor(c.id_cor), 0);

  const salvar = async (e) => {
    e.preventDefault();
    if (total <= 0) { toast.aviso('Informe as peças cortadas.'); return; }
    const corpo = op.legada
      ? { pecas_reais_cortadas: total }
      : { cortes: valoresParaLista(valores, { soPositivos: false }).map(({ linha, coluna, quantidade }) => ({ id_cor: linha, id_tamanho: coluna, quantidade })) };
    try {
      setSalvando(true);
      await api.put(`/camisetas/ordens/${op.id_op}/finalizar-corte`, corpo);
      toast.sucesso(`Corte da ${op.codigo_op} registrado: ${total} peças (${formatarRendimento(total, op.peso_malha_enviado_kg)}).`);
      onSalvo();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível registrar o corte.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalProducao titulo={`Registrar corte · ${op.codigo_op}`} idTitulo="titulo-corte-op" onFechar={onFechar} largo={!op.legada}>
      <p className="producao-resumo">
        {op.nome_modelo} · {Number(op.peso_malha_enviado_kg).toFixed(3)} kg na mesa · previsão de {op.pecas_planejadas || 0} peças
      </p>
      <form onSubmit={salvar}>
        {op.legada ? (
          <div className="cadastro-campo">
            <label htmlFor="corte-total-legado">Peças cortadas (OP antiga, sem cor e tamanho)</label>
            <input id="corte-total-legado" type="number" min="1" value={totalLegado} onChange={(e) => setTotalLegado(e.target.value)} />
          </div>
        ) : (
          <GradeQuantidades idPrefixo="corte" legenda="Peças cortadas por cor e tamanho" linhas={linhas} colunas={colunas}
            valores={valores} onChange={setValores} />
        )}
        <ul className="producao-lista" aria-live="polite">
          <li>Total: <strong>{total} peças</strong> · {formatarRendimento(total, op.peso_malha_enviado_kg)}</li>
          {!op.legada && op.cores.map((c) => (
            <li key={c.id_cor}>
              <span className="cadastro-amostra" style={{ background: c.hex_cor }} aria-hidden="true" /> {c.nome_cor}:{' '}
              {totalDaCor(c.id_cor)} peças em {Number(c.peso_kg).toFixed(3)} kg · {formatarRendimento(totalDaCor(c.id_cor), c.peso_kg)}
            </li>
          ))}
        </ul>
        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>Salvar corte</button>
        </footer>
      </form>
    </ModalProducao>
  );
}
