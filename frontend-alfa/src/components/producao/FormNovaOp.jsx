import { useRef, useState } from 'react';
import { Plus, Scale, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { faltasDeMalha, problemasDoEnfesto } from '../../utils/producao';
import { formatarPecas, formatarPeso } from '../../utils/numeros';
import '../cadastros/cadastros.css';
import './producao.css';

const linhaVazia = (chave) => ({ chave, id_cor: '', id_insumo_tecido: '', peso_kg: '' });
const rotuloRolo = (t) => `[${t.codigo}] ${t.tipo_malha_ou_aviamento}${t.nome_cor ? ` · ${t.nome_cor}` : ''} — ${formatarPeso(t.saldo_atual)}`;

/** Abertura de OP: modelo + vínculo opcional a pedido + uma linha por cor do enfesto (cor, rolo de malha e peso). */
export function FormNovaOp({ modelos, tecidos, cores, pedidos = [], onCriada }) {
  const toast = useToast();
  const proximaChave = useRef(1);
  const [idPedido, setIdPedido] = useState('');
  const [idModelo, setIdModelo] = useState('');
  const [linhas, setLinhas] = useState(() => [linhaVazia(0)]);
  const [salvando, setSalvando] = useState(false);

  const modelo = modelos.find((m) => String(m.id_modelo) === String(idModelo));
  const pesoTotal = linhas.reduce((total, l) => total + (parseFloat(l.peso_kg) || 0), 0);
  const consumo = Number(modelo?.consumo_tecido_kg) || 0;
  const pecasPrevistas = consumo > 0 ? Math.floor(pesoTotal / consumo) : 0;
  const faltas = faltasDeMalha(linhas, tecidos);

  // A chave sai do ref aqui, nunca dentro de um updater de estado: em StrictMode o React
  // invoca o updater duas vezes e a numeração das linhas pularia (id da 2ª linha viraria 2).
  const novaLinha = () => {
    const linha = linhaVazia(proximaChave.current);
    proximaChave.current += 1;
    return linha;
  };

  const selecionarPedido = (valorPedido) => {
    setIdPedido(valorPedido);
    if (!valorPedido) return;
    const ped = pedidos.find((p) => String(p.id_pedido) === String(valorPedido));
    if (!ped) return;
    if (ped.id_modelo) {
      setIdModelo(String(ped.id_modelo));
    }
    const coresUnicas = [...new Set((ped.itens || []).map((it) => it.id_cor).filter(Boolean))];
    if (coresUnicas.length > 0) {
      const novasLinhas = coresUnicas.map((idCor) => {
        const roloSugerido = tecidos.find((t) => String(t.id_cor) === String(idCor));
        const chave = proximaChave.current;
        proximaChave.current += 1;
        return {
          chave,
          id_cor: String(idCor),
          id_insumo_tecido: roloSugerido ? String(roloSugerido.id_insumo) : '',
          peso_kg: '',
        };
      });
      setLinhas(novasLinhas);
    }
  };

  const acrescentarCor = () => {
    const linha = novaLinha();
    setLinhas((atuais) => [...atuais, linha]);
  };

  const alterarLinha = (chave, campo, valor) => setLinhas((atuais) => atuais.map((linha) => {
    if (linha.chave !== chave) return linha;
    if (campo === 'id_insumo_tecido') {
      const rolo = tecidos.find((t) => String(t.id_insumo) === valor);
      return { ...linha, id_insumo_tecido: valor, id_cor: rolo?.id_cor ? String(rolo.id_cor) : linha.id_cor };
    }
    if (campo === 'id_cor') {
      const rolo = tecidos.find((t) => String(t.id_insumo) === linha.id_insumo_tecido);
      const roloDeOutraCor = Boolean(rolo?.id_cor) && String(rolo.id_cor) !== valor;
      return { ...linha, id_cor: valor, id_insumo_tecido: roloDeOutraCor ? '' : linha.id_insumo_tecido };
    }
    return { ...linha, [campo]: valor };
  }));

  const rolosDaCor = (idCor) => (idCor ? tecidos.filter((t) => !t.id_cor || String(t.id_cor) === String(idCor)) : tecidos);

  const enviar = async (e) => {
    e.preventDefault();
    const problema = idModelo ? problemasDoEnfesto(linhas) || faltas[0] : 'Escolha o modelo da OP.';
    if (problema) { toast.aviso(problema); return; }
    try {
      setSalvando(true);
      const { data } = await api.post('/camisetas/ordens/', {
        id_modelo: Number(idModelo),
        id_pedido: idPedido ? Number(idPedido) : null,
        cores: linhas.map((l) => ({ id_cor: Number(l.id_cor), id_insumo_tecido: Number(l.id_insumo_tecido), peso_kg: parseFloat(l.peso_kg) })),
      });
      toast.sucesso(`OP ${data.codigo_op} aberta: ${formatarPeso(pesoTotal)} de malha baixados do estoque.`);
      setIdPedido('');
      setLinhas([novaLinha()]);
      onCriada();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível abrir a OP.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <div className="cadastro-grid">
        <div className="cadastro-campo producao-campo-modelo">
          <label htmlFor="op-pedido">Vincular a Pedido em aberto (opcional)</label>
          <select id="op-pedido" value={idPedido} onChange={(e) => selecionarPedido(e.target.value)}>
            <option value="">OP avulsa (para estoque)</option>
            {pedidos.map((p) => (
              <option key={p.id_pedido} value={p.id_pedido}>
                {p.codigo_pedido} — {p.nome_cliente} ({p.quantidade_total} pçs · {p.status_pedido})
              </option>
            ))}
          </select>
        </div>
        <div className="cadastro-campo producao-campo-modelo">
          <label htmlFor="op-modelo">Modelo de camiseta *</label>
          <select id="op-modelo" value={idModelo} onChange={(e) => setIdModelo(e.target.value)}>
            <option value="">Selecione o modelo…</option>
            {modelos.map((m) => <option key={m.id_modelo} value={m.id_modelo}>{m.nome_modelo} ({m.consumo_tecido_kg} kg/peça)</option>)}
          </select>
        </div>
      </div>

      <fieldset className="producao-linhas-cor">
        <legend>Cores do enfesto</legend>
        {linhas.map((linha, indice) => (
          <div key={linha.chave} className="producao-linha-cor">
            <div className="cadastro-campo">
              <label htmlFor={`op-cor-${linha.chave}`}>Cor {indice + 1}</label>
              <select id={`op-cor-${linha.chave}`} value={linha.id_cor} onChange={(e) => alterarLinha(linha.chave, 'id_cor', e.target.value)}>
                <option value="">Selecione…</option>
                {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
              </select>
            </div>
            <div className="cadastro-campo">
              <label htmlFor={`op-rolo-${linha.chave}`}>Rolo de malha</label>
              <select id={`op-rolo-${linha.chave}`} value={linha.id_insumo_tecido}
                onChange={(e) => alterarLinha(linha.chave, 'id_insumo_tecido', e.target.value)}>
                <option value="">Selecione…</option>
                {rolosDaCor(linha.id_cor).map((t) => <option key={t.id_insumo} value={t.id_insumo}>{rotuloRolo(t)}</option>)}
              </select>
            </div>
            <div className="cadastro-campo">
              <label htmlFor={`op-peso-${linha.chave}`}>Peso (kg)</label>
              <input id={`op-peso-${linha.chave}`} type="number" step="0.001" min="0.001" placeholder="Ex.: 12.500"
                value={linha.peso_kg} onChange={(e) => alterarLinha(linha.chave, 'peso_kg', e.target.value)} />
            </div>
            <button type="button" className="cadastro-btn-icone" aria-label={`Remover cor ${indice + 1}`}
              disabled={linhas.length === 1} onClick={() => setLinhas((atuais) => atuais.filter((l) => l.chave !== linha.chave))}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="cadastro-btn secundario" onClick={acrescentarCor}>
            <Plus size={16} aria-hidden="true" /> Adicionar cor
          </button>
        </div>
      </fieldset>

      <p className="producao-resumo" aria-live="polite">
        Total na mesa: <strong>{formatarPeso(pesoTotal)}</strong> · previsão de <strong>{formatarPecas(pecasPrevistas)}</strong>
      </p>
      {faltas.length > 0 && <ul className="producao-aviso" role="alert">{faltas.map((f) => <li key={f}>{f}</li>)}</ul>}
      <button type="submit" className="btn-abrir-op btn-acao-rapida" disabled={salvando || faltas.length > 0}>
        <Scale size={18} aria-hidden="true" />
        <span>Abrir OP e baixar a malha</span>
      </button>
    </form>
  );
}
