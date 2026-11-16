import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { ModalProducao } from '../producao/ModalProducao';
import { itemDaApi, itemParaApi, problemaDosItens } from '../../utils/pedidoItens';
import { ItensPedidoEditor } from './ItensPedidoEditor';

/** Edição dos itens de um pedido ainda não entregue (é aqui que o pedido antigo recebe a cor). */
export function ModalItensPedido({ pedido, modelos, cores, estampas = [], onFechar, onSalvo }) {
  const toast = useToast();
  const [itens, setItens] = useState(() => pedido.itens.map((item, indice) => itemDaApi(item, indice + 1)));
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    const problema = problemaDosItens(itens);
    if (problema) { toast.aviso(problema); return; }
    try {
      setSalvando(true);
      await api.put(`/camisetas/pedidos/${pedido.id_pedido}/itens`, { itens: itens.map(itemParaApi) });
      toast.sucesso(`Itens do pedido ${pedido.codigo_pedido} atualizados.`);
      onSalvo();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível salvar os itens do pedido.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalProducao titulo={`Itens do pedido ${pedido.codigo_pedido}`} idTitulo="titulo-itens-pedido" onFechar={onFechar} largo>
      <form onSubmit={salvar}>
        {pedido.itens.some((item) => !item.id_cor) && (
          <p className="producao-aviso">Este pedido veio do sistema antigo, sem cor. Escolha a cor de cada item para poder entregar.</p>
        )}
        <ItensPedidoEditor itens={itens} onChange={setItens} modelos={modelos} cores={cores} estampas={estampas} idPrefixo="editar-item" />
        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>Salvar itens</button>
        </footer>
      </form>
    </ModalProducao>
  );
}
