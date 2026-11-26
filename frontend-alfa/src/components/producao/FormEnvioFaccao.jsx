import { useState } from 'react';
import { Send } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { useConfirm } from '../feedback/useConfirm';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { chaveCelula, somarValores, valoresParaLista } from '../../utils/grade';
import { formatarPecas, formatarPercentual, formatarQuantidade } from '../../utils/numeros';
import { GradeQuantidades } from './GradeQuantidades';

const MARGEM_PADRAO = '3.00';
const descreverFalta = (falta) =>
  `${falta.descricao} (${falta.codigo}): precisa ${formatarQuantidade(falta.necessario, falta.unidade)}, tem ${formatarQuantidade(falta.disponivel, falta.unidade)}`;
const disponiveisDa = (op) => Object.fromEntries(op.cortes.map((c) => [chaveCelula(c.id_cor, c.id_tamanho), c.disponivel]));
const idVariacao = (op, idCor, idTamanho) => op.cortes.find((c) => c.id_cor === idCor && c.id_tamanho === idTamanho)?.id_variacao;

function totalDoEnvio(op, valores, totalLegado) {
  if (!op) return 0;
  return op.legada ? Number(totalLegado) || 0 : somarValores(valores);
}

/** Envio à facção: escolhe a OP e confere a grade cor × tamanho (OP antiga: só o total). */
export function FormEnvioFaccao({ ops, onEnviado }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [idOp, setIdOp] = useState('');
  const [faccao, setFaccao] = useState('');
  const [margem, setMargem] = useState(MARGEM_PADRAO);
  const [observacoes, setObservacoes] = useState('');
  const [valores, setValores] = useState({});
  const [totalLegado, setTotalLegado] = useState('');
  const [salvando, setSalvando] = useState(false);

  const op = ops.find((o) => String(o.id_op) === idOp);
  const total = totalDoEnvio(op, valores, totalLegado);
  const maximos = op && !op.legada ? disponiveisDa(op) : {};
  const excede = Object.entries(maximos).some(([chave, maximo]) => (Number(valores[chave]) || 0) > maximo);

  const escolherOp = (id) => {
    const alvo = ops.find((o) => String(o.id_op) === id);
    setIdOp(id);
    setValores(alvo && !alvo.legada ? disponiveisDa(alvo) : {});
    setTotalLegado(alvo ? String(alvo.saldo_disponivel_envio) : '');
  };

  const corpo = (confirmarSaldoInsuficiente) => ({
    id_op: op.id_op,
    nome_faccao: faccao.trim(),
    margem_seguranca_aviamentos_percentual: parseFloat(margem || MARGEM_PADRAO),
    observacoes,
    confirmar_saldo_insuficiente: confirmarSaldoInsuficiente,
    ...(op.legada
      ? { quantidade_enviada: total }
      : { itens: valoresParaLista(valores).map(({ linha, coluna, quantidade }) => ({ id_variacao: idVariacao(op, linha, coluna), quantidade })) }),
  });

  const enviarComConfirmacao = async () => {
    try {
      return await api.post('/camisetas/costura/enviar', corpo(false));
    } catch (err) {
      const faltas = err.response?.status === 409 ? err.response.data?.detail?.faltas : null;
      if (!faltas) throw err;
      const confirmou = await confirmar({
        titulo: 'Aviamentos insuficientes no estoque',
        mensagem: 'O estoque registrado não cobre este envio. Se o material existe na fábrica, envie mesmo assim: o saldo ficará negativo para você conferir o inventário depois.',
        detalhes: faltas.map(descreverFalta),
        textoConfirmar: 'Enviar mesmo assim',
        textoCancelar: 'Cancelar envio',
        perigo: true, // foco inicial em "Cancelar envio": Enter acidental não deixa estoque negativo
      });
      return confirmou ? api.post('/camisetas/costura/enviar', corpo(true)) : null;
    }
  };

  const limpar = () => {
    setIdOp('');
    setFaccao('');
    setObservacoes('');
    setValores({});
    setTotalLegado('');
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!op || !faccao.trim()) { toast.aviso('Escolha a OP e informe a facção parceira.'); return; }
    if (total <= 0) { toast.aviso('Informe quantas peças vão para a facção.'); return; }
    if (excede || (op.legada && total > op.saldo_disponivel_envio)) {
      toast.aviso('Há quantidades acima do que foi cortado e ainda não enviado.');
      return;
    }
    try {
      setSalvando(true);
      const resposta = await enviarComConfirmacao();
      if (!resposta) return;
      const avisos = resposta.data?.avisos || [];
      toast.sucesso(avisos.length > 0
        ? `Lote de ${formatarPecas(total)} enviado para ${faccao.trim()}.`
        : `Lote de ${formatarPecas(total)} enviado para ${faccao.trim()}. Aviamentos baixados com margem de ${formatarPercentual(margem || MARGEM_PADRAO, 2)}.`);
      avisos.forEach((aviso) => toast.aviso(aviso));
      limpar();
      onEnviado();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Erro ao registrar a remessa de costura.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <div className="producao-envio-grade">
        <div className="form-group">
          <label htmlFor="envio-op">OP cortada *</label>
          <select id="envio-op" value={idOp} onChange={(e) => escolherOp(e.target.value)}>
            <option value="">{ops.length === 0 ? 'Nenhuma OP com peças para enviar' : 'Selecione a OP…'}</option>
            {ops.map((o) => (
              <option key={o.id_op} value={o.id_op}>[{o.codigo_op}] {o.nome_modelo} — {o.saldo_disponivel_envio} peças para enviar</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="envio-faccao">Facção parceira *</label>
          <input id="envio-faccao" type="text" placeholder="Ex.: Facção Estrela" value={faccao} onChange={(e) => setFaccao(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="envio-margem">Margem de aviamentos (%)</label>
          <input id="envio-margem" type="number" step="0.1" min="0" max="100" value={margem} onChange={(e) => setMargem(e.target.value)} />
        </div>
        {op?.legada && (
          <div className="form-group">
            <label htmlFor="envio-total">Peças enviadas (OP antiga)</label>
            <input id="envio-total" type="number" min="1" max={op.saldo_disponivel_envio} value={totalLegado}
              onChange={(e) => setTotalLegado(e.target.value)} />
          </div>
        )}
      </div>
      {op && !op.legada && (
        <GradeQuantidades
          idPrefixo="envio"
          legenda="Peças enviadas por cor e tamanho"
          linhas={op.cores.map((c) => ({ id: c.id_cor, rotulo: c.nome_cor, hex: c.hex_cor }))}
          colunas={op.tamanhos.map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }))}
          valores={valores}
          onChange={setValores}
          maximos={maximos}
        />
      )}
      <div className="form-group">
        <label htmlFor="envio-observacoes">Observações / instruções de costura</label>
        <textarea id="envio-observacoes" rows="2" placeholder="Ex.: gola com ribana 1x1, barra 2 agulhas…" value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)} />
      </div>
      <button type="submit" className="btn-acao-rapida" disabled={salvando}>
        <Send size={18} aria-hidden="true" />
        <span>Registrar remessa de {total} peças</span>
      </button>
    </form>
  );
}
