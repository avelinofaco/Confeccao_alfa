import { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { chaveCelula, somarValores, valoresParaLista } from '../../utils/grade';
import { GradeQuantidades } from './GradeQuantidades';
import { ModalProducao } from './ModalProducao';

const enviadosDa = (remessa) => Object.fromEntries(remessa.itens.map((i) => [chaveCelula(i.id_cor, i.id_tamanho), i.qtd_enviada]));
const coresDosItens = (itens) => itens.reduce(
  (lista, i) => (lista.some((l) => l.id === i.id_cor) ? lista : [...lista, { id: i.id_cor, rotulo: i.nome_cor, hex: i.hex_cor }]), []);

function descreverPerda(perdas) {
  if (perdas > 0) return ` · perda de ${perdas}`;
  return perdas === 0 ? ' · sem perdas' : '';
}

/** Conferência do retorno da facção por cor e tamanho. Remessa antiga: escolhe as cores e distribui o total. */
export function ModalRetornoFaccao({ remessa, modelo, cores, onFechar, onSalvo }) {
  const toast = useToast();
  const [valores, setValores] = useState(() => enviadosDa(remessa));
  const [coresLivres, setCoresLivres] = useState([]);
  const [corParaIncluir, setCorParaIncluir] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  const tamanhos = (modelo?.grade_tamanhos || []).map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }));
  const linhas = remessa.legada ? coresLivres : coresDosItens(remessa.itens);
  const colunas = remessa.legada ? tamanhos : tamanhos.filter((t) => remessa.itens.some((i) => i.id_tamanho === t.id));
  const enviados = enviadosDa(remessa);
  const maximos = remessa.legada ? {} : Object.fromEntries(
    linhas.flatMap((l) => colunas.map((c) => [chaveCelula(l.id, c.id), enviados[chaveCelula(l.id, c.id)] ?? 0])));
  const retornado = somarValores(valores);
  const perdas = remessa.quantidade_enviada - retornado;

  const incluirCor = () => {
    const cor = cores.find((c) => String(c.id_cor) === corParaIncluir);
    if (!cor || coresLivres.some((l) => l.id === cor.id_cor)) return;
    setCoresLivres((atuais) => [...atuais, { id: cor.id_cor, rotulo: cor.nome, hex: cor.hex }]);
    setCorParaIncluir('');
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (retornado > remessa.quantidade_enviada) {
      toast.aviso(`Voltaram ${retornado} peças, mas foram enviadas ${remessa.quantidade_enviada}.`);
      return;
    }
    if (Object.entries(maximos).some(([chave, maximo]) => (Number(valores[chave]) || 0) > maximo)) {
      toast.aviso('Há cor e tamanho com mais peças do que foram enviadas.');
      return;
    }
    try {
      setSalvando(true);
      await api.put(`/camisetas/costura/${remessa.id_costura}/retornar`, {
        itens: valoresParaLista(valores).map(({ linha, coluna, quantidade }) => ({ id_cor: linha, id_tamanho: coluna, quantidade })),
        observacoes,
      });
      toast.sucesso(`Retorno conferido: ${retornado} peças lançadas em Produtos Prontos${perdas > 0 ? ` (${perdas} perdida(s))` : ''}.`);
      onSalvo();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Erro ao registrar o retorno da facção.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalProducao titulo="Conferir retorno da facção" idTitulo="titulo-retorno-faccao" onFechar={onFechar} largo>
      <p className="producao-resumo">
        {remessa.nome_faccao} · {remessa.codigo_op} · {remessa.nome_modelo} · {remessa.quantidade_enviada} peças enviadas
      </p>
      <form onSubmit={salvar}>
        {remessa.legada && (
          <>
            <p className="producao-aviso">Remessa anterior ao controle por cor e tamanho: informe como as peças voltaram.</p>
            <div className="painel-grade-novo">
              <select aria-label="Cor a incluir" value={corParaIncluir} onChange={(e) => setCorParaIncluir(e.target.value)}>
                <option value="">Incluir cor…</option>
                {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
              </select>
              <button type="button" className="cadastro-btn secundario" onClick={incluirCor} disabled={!corParaIncluir}>
                <Plus size={16} aria-hidden="true" /> Incluir
              </button>
            </div>
          </>
        )}
        {linhas.length > 0 && colunas.length > 0 && (
          <GradeQuantidades idPrefixo="retorno" legenda="Peças que voltaram por cor e tamanho" linhas={linhas} colunas={colunas}
            valores={valores} onChange={setValores} maximos={maximos} />
        )}
        <p className={perdas > 0 ? 'producao-aviso' : 'producao-resumo'} aria-live="polite">
          Voltaram <strong>{retornado}</strong> de {remessa.quantidade_enviada} peças{descreverPerda(perdas)}.
        </p>
        <div className="cadastro-campo">
          <label htmlFor="retorno-observacoes">Observações do controle de qualidade</label>
          <textarea id="retorno-observacoes" rows="2" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>
        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>Confirmar retorno</button>
        </footer>
      </form>
    </ModalProducao>
  );
}
