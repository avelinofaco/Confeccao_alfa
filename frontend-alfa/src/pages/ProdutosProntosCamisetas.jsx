import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, ClipboardList, History } from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/feedback/useToast';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
import { GradeQuantidades } from '../components/producao/GradeQuantidades';
import { BarraInventario } from '../components/produtos/BarraInventario';
import { HistoricoMovimentos } from '../components/produtos/HistoricoMovimentos';
import { PainelSku } from '../components/produtos/PainelSku';
import {
  acrescentarLinha,
  agruparPorModelo,
  alertasDoGrupo,
  celulaDoGrupo,
  contagensDoInventario,
  detalhesDoGrupo,
  valoresDoGrupo,
  valoresIniciaisInventario,
} from '../utils/produtosProntos';
import '../components/cadastros/cadastros.css';
import './ProdutosProntosCamisetas.css';

const FILTROS_INICIAIS = { id_modelo: '', id_cor: '', abaixo_minimo: false };

const urlDaListagem = (filtros) => {
  const consulta = new URLSearchParams();
  if (filtros.id_modelo) consulta.set('id_modelo', filtros.id_modelo);
  if (filtros.id_cor) consulta.set('id_cor', filtros.id_cor);
  if (filtros.abaixo_minimo) consulta.set('abaixo_minimo', 'true');
  const texto = consulta.toString();
  return `/camisetas/produtos-prontos/${texto ? `?${texto}` : ''}`;
};

function FiltrosProdutos({ filtros, onChange, modelos, cores, desativado }) {
  const alterar = (campo, valor) => onChange({ ...filtros, [campo]: valor });
  return (
    <div className="produtos-filtros">
      <label htmlFor="filtro-modelo">
        Modelo
        <select id="filtro-modelo" value={filtros.id_modelo} disabled={desativado} onChange={(e) => alterar('id_modelo', e.target.value)}>
          <option value="">Todos</option>
          {modelos.map((m) => <option key={m.id_modelo} value={m.id_modelo}>{m.nome_modelo}</option>)}
        </select>
      </label>
      <label htmlFor="filtro-cor">
        Cor
        <select id="filtro-cor" value={filtros.id_cor} disabled={desativado} onChange={(e) => alterar('id_cor', e.target.value)}>
          <option value="">Todas</option>
          {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
        </select>
      </label>
      <label className="produtos-filtro-check" htmlFor="filtro-minimo">
        <input id="filtro-minimo" type="checkbox" checked={filtros.abaixo_minimo} disabled={desativado}
          onChange={(e) => alterar('abaixo_minimo', e.target.checked)} />
        Só abaixo do mínimo
      </label>
    </div>
  );
}

function ProdutosProntosCamisetas() {
  const toast = useToast();
  const [linhas, setLinhas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [cores, setCores] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [inventario, setInventario] = useState(null); // null = fora do modo inventário · { grupos, valores, motivo }
  const [salvando, setSalvando] = useState(false);
  const [skuAberto, setSkuAberto] = useState(null);
  const [versaoHistorico, setVersaoHistorico] = useState(0);

  const carregar = useCallback(async () => {
    const { dados, houveFalha } = await buscarEmParalelo([urlDaListagem(filtros), '/camisetas/modelos/', '/camisetas/cores/']);
    const [listaLinhas, listaModelos, listaCores] = dados;
    setLinhas(listaLinhas);
    setModelos(listaModelos);
    setCores(listaCores);
    if (houveFalha) toast.erro('Não foi possível carregar todo o estoque pronto. Recarregue a página.');
  }, [filtros, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const grupos = useMemo(() => agruparPorModelo(linhas), [linhas]);
  const totalPecas = linhas.reduce((total, linha) => total + linha.total, 0);
  const totalReservado = linhas.reduce((total, linha) => total + (linha.total_reservado || 0), 0);
  const totalDisponivel = linhas.reduce((total, linha) => total + (linha.total_disponivel ?? linha.total), 0);
  const totalFaltaProduzir = linhas.reduce((total, linha) => total + (linha.total_falta_produzir || 0), 0);
  const gruposExibidos = inventario ? inventario.grupos : grupos;

  const recarregarTudo = () => {
    setVersaoHistorico((versao) => versao + 1);
    carregar();
  };

  const abrirSku = (grupo, idCor, idTamanho) => {
    const celula = celulaDoGrupo(grupo, idCor, idTamanho);
    if (!celula?.id_variacao) {
      toast.info('Ainda não há estoque desta cor e tamanho. Use “Fazer inventário” para lançar a contagem.');
      return;
    }
    const cor = grupo.linhas.find((linha) => linha.id === idCor);
    setSkuAberto({ ...celula, nome: `${grupo.nome_modelo} · ${cor?.rotulo} · ${celula.rotulo}` });
  };

  const salvarInventario = async () => {
    const contagens = contagensDoInventario(inventario.grupos, inventario.valores);
    if (contagens.length === 0) { toast.aviso('Nenhuma quantidade foi contada.'); return; }
    try {
      setSalvando(true);
      const { data } = await api.post('/camisetas/produtos-prontos/inventario', { motivo: inventario.motivo || undefined, contagens });
      toast.sucesso(data.skus_alterados === 0
        ? 'Contagem conferida: o estoque já estava certo.'
        : `Inventário salvo: ${data.skus_alterados} item(ns) ajustado(s) (+${data.pecas_entrada} / −${data.pecas_saida} peças).`);
      setInventario(null);
      recarregarTudo();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível salvar o inventário.'));
    } finally {
      setSalvando(false);
    }
  };

  const alterarInventario = (mudanca) => setInventario((atual) => ({ ...atual, ...mudanca(atual) }));

  return (
    <div className="produtos-container">
      <Sidebar />
      <main className="produtos-main">
        <header className="page-header">
          <h1><Boxes size={28} color="#2563eb" aria-hidden="true" /> 8. Produtos Prontos</h1>
          <p>Peças acabadas por modelo, cor e tamanho. Clique numa quantidade para ajustar, definir o mínimo ou ver o histórico.</p>
        </header>

        <div className="produtos-barra">
          <FiltrosProdutos filtros={filtros} onChange={setFiltros} modelos={modelos} cores={cores} desativado={Boolean(inventario)} />
          <div className="produtos-kpis" aria-live="polite">
            <span className="produtos-total"><strong>{totalPecas}</strong> peças prontas</span>
            <span className="produtos-kpi"><strong>{totalReservado}</strong> reservadas em pedidos</span>
            <span className="produtos-kpi"><strong>{totalDisponivel}</strong> livres</span>
            {totalFaltaProduzir > 0 && (
              <span className="produtos-kpi produtos-kpi-falta"><strong>{totalFaltaProduzir}</strong> faltam produzir</span>
            )}
          </div>
          {!inventario && (
            <button type="button" className="cadastro-btn primario"
              onClick={() => setInventario({ grupos, valores: valoresIniciaisInventario(grupos), motivo: '' })}>
              <ClipboardList size={16} aria-hidden="true" /> Fazer inventário
            </button>
          )}
        </div>

        {inventario && (
          <BarraInventario
            modelos={modelos}
            cores={cores}
            motivo={inventario.motivo}
            salvando={salvando}
            onMotivo={(motivo) => alterarInventario(() => ({ motivo }))}
            onIncluir={(modelo, cor) => alterarInventario((atual) => ({ grupos: acrescentarLinha(atual.grupos, modelo, cor) }))}
            onSalvar={salvarInventario}
            onCancelar={() => setInventario(null)}
          />
        )}

        {gruposExibidos.length === 0 && (
          <p className="produtos-vazio">
            {inventario
              ? 'Inclua um modelo e uma cor para começar a contagem.'
              : 'Nenhuma peça pronta ainda. Use “Fazer inventário” para lançar o estoque de abertura.'}
          </p>
        )}

        {gruposExibidos.map((grupo) => (
          <section key={grupo.id_modelo} className="produtos-card" aria-labelledby={`titulo-modelo-${grupo.id_modelo}`}>
            <h2 id={`titulo-modelo-${grupo.id_modelo}`}>{grupo.nome_modelo}</h2>
            {inventario ? (
              <GradeQuantidades
                idPrefixo={`inventario-${grupo.id_modelo}`}
                legenda={`Contagem de ${grupo.nome_modelo}`}
                linhas={grupo.linhas}
                colunas={grupo.colunas}
                valores={inventario.valores[grupo.id_modelo] || {}}
                onChange={(valores) => alterarInventario((atual) => ({ valores: { ...atual.valores, [grupo.id_modelo]: valores } }))}
              />
            ) : (
              <GradeQuantidades
                idPrefixo={`saldo-${grupo.id_modelo}`}
                legenda={`Saldo de ${grupo.nome_modelo} por cor e tamanho`}
                linhas={grupo.linhas}
                colunas={grupo.colunas}
                valores={valoresDoGrupo(grupo)}
                alertas={alertasDoGrupo(grupo)}
                detalhes={detalhesDoGrupo(grupo)}
                onCelulaClick={(idCor, idTamanho) => abrirSku(grupo, idCor, idTamanho)}
              />
            )}
          </section>
        ))}

        <section className="produtos-card produtos-card-historico" aria-labelledby="titulo-historico">
          <HistoricoMovimentos
            versao={versaoHistorico}
            titulo={
              <h2 id="titulo-historico" className="historico-titulo">
                <History size={18} aria-hidden="true" />
                <span>Histórico de movimentações</span>
              </h2>
            }
          />
        </section>

        {skuAberto && (
          <PainelSku
            sku={skuAberto}
            onFechar={() => setSkuAberto(null)}
            onAlterado={() => { setSkuAberto(null); recarregarTudo(); }}
          />
        )}
      </main>
    </div>
  );
}

export default ProdutosProntosCamisetas;
