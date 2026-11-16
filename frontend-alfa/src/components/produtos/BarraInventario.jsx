import { useState } from 'react';
import { Plus } from 'lucide-react';

/** Controles do modo inventário: motivo, incluir modelo + cor sem estoque, salvar ou cancelar. */
export function BarraInventario({ modelos, cores, motivo, onMotivo, onIncluir, onSalvar, onCancelar, salvando }) {
  const [idModelo, setIdModelo] = useState('');
  const [idCor, setIdCor] = useState('');

  const incluir = () => {
    const modelo = modelos.find((m) => String(m.id_modelo) === idModelo);
    const cor = cores.find((c) => String(c.id_cor) === idCor);
    if (!modelo || !cor) return;
    onIncluir(modelo, cor);
    setIdCor('');
  };

  return (
    <section className="inventario-barra" aria-labelledby="titulo-inventario">
      <h2 id="titulo-inventario">Modo inventário</h2>
      <p>Digite a quantidade contada em cada célula. Deixe em branco o que não foi contado: o sistema lança só as diferenças.</p>
      <div className="inventario-campos">
        <div className="cadastro-campo">
          <label htmlFor="inventario-motivo">Motivo da contagem</label>
          <input id="inventario-motivo" maxLength={255} placeholder="Inventário de abertura" value={motivo}
            onChange={(e) => onMotivo(e.target.value)} />
        </div>
        <div className="cadastro-campo">
          <label htmlFor="inventario-modelo">Incluir modelo</label>
          <select id="inventario-modelo" value={idModelo} onChange={(e) => setIdModelo(e.target.value)}>
            <option value="">Selecione…</option>
            {modelos.map((m) => <option key={m.id_modelo} value={m.id_modelo}>{m.nome_modelo}</option>)}
          </select>
        </div>
        <div className="cadastro-campo">
          <label htmlFor="inventario-cor">na cor</label>
          <select id="inventario-cor" value={idCor} onChange={(e) => setIdCor(e.target.value)}>
            <option value="">Selecione…</option>
            {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
          </select>
        </div>
        <button type="button" className="cadastro-btn secundario" onClick={incluir} disabled={!idModelo || !idCor}>
          <Plus size={16} aria-hidden="true" /> Incluir
        </button>
      </div>
      <div className="inventario-acoes">
        <button type="button" className="cadastro-btn secundario" onClick={onCancelar} disabled={salvando}>Cancelar</button>
        <button type="button" className="cadastro-btn primario" onClick={onSalvar} disabled={salvando}>Salvar contagem</button>
      </div>
    </section>
  );
}
