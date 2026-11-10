import { useCallback, useEffect, useState } from 'react';
import { Palette, Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { useConfirm } from '../feedback/useConfirm';
import { mensagemDeErro } from '../feedback/mensagemErro';
import './cadastros.css';

const CORES_BASICAS = [
  { nome: 'Branco', hex: '#FFFFFF' },
  { nome: 'Preto', hex: '#1F1F1F' },
  { nome: 'Cinza Mescla', hex: '#B8B8B8' },
  { nome: 'Azul Marinho', hex: '#1F2A44' },
];
const FORM_VAZIO = { id_cor: null, nome: '', hex: '#1F1F1F', ativo: true };

export function PainelCores() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [cores, setCores] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/camisetas/cores/', { params: { incluir_inativas: true } });
      setCores(data);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar as cores.'));
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.aviso('Informe o nome da cor.');
      return;
    }
    try {
      setSalvando(true);
      const corpo = { nome: form.nome, hex: form.hex, ativo: form.ativo };
      if (form.id_cor) await api.put(`/camisetas/cores/${form.id_cor}`, corpo);
      else await api.post('/camisetas/cores/', corpo);
      toast.sucesso(`Cor ${form.nome.trim()} salva.`);
      setForm(FORM_VAZIO);
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível salvar a cor.'));
    } finally {
      setSalvando(false);
    }
  };

  const adicionarBasicas = async () => {
    const existentes = new Set(cores.map((c) => c.nome.toLowerCase()));
    const faltantes = CORES_BASICAS.filter((c) => !existentes.has(c.nome.toLowerCase()));
    if (faltantes.length === 0) {
      toast.info('As cores básicas já estão cadastradas.');
      return;
    }
    try {
      for (const cor of faltantes) {
        await api.post('/camisetas/cores/', cor);
      }
      toast.sucesso(`${faltantes.length} cor(es) básica(s) adicionada(s).`);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível adicionar todas as cores básicas.'));
    }
    carregar();
  };

  const excluir = async (cor) => {
    const confirmou = await confirmar({
      titulo: `Excluir a cor ${cor.nome}?`,
      mensagem: 'A cor deixa de existir no cadastro.',
      textoConfirmar: 'Excluir cor',
      perigo: true,
    });
    if (!confirmou) return;
    try {
      await api.delete(`/camisetas/cores/${cor.id_cor}`);
      toast.sucesso(`Cor ${cor.nome} excluída.`);
      setForm(FORM_VAZIO);
      carregar();
    } catch (err) {
      if (err.response?.status !== 409) {
        toast.erro(mensagemDeErro(err, 'Não foi possível excluir a cor.'));
        return;
      }
      const inativar = await confirmar({
        titulo: 'Cor em uso',
        mensagem: `${cor.nome} está ligada a malhas do estoque. Inativar a cor? Ela deixa de aparecer nas escolhas.`,
        textoConfirmar: 'Inativar cor',
      });
      if (!inativar) return;
      try {
        await api.put(`/camisetas/cores/${cor.id_cor}`, { nome: cor.nome, hex: cor.hex, ativo: false });
        toast.sucesso(`Cor ${cor.nome} inativada.`);
        carregar();
      } catch (erroInativar) {
        toast.erro(mensagemDeErro(erroInativar, 'Não foi possível inativar a cor.'));
      }
    }
  };

  return (
    <section className="painel-cadastro" aria-labelledby="titulo-painel-cores">
      <header className="painel-cadastro-cabecalho">
        <h2 id="titulo-painel-cores"><Palette size={20} aria-hidden="true" /> Cores das camisetas</h2>
        <button type="button" className="cadastro-btn secundario" onClick={adicionarBasicas}>
          <Plus size={16} aria-hidden="true" /> Adicionar cores básicas
        </button>
      </header>

      <form className="painel-cadastro-form" onSubmit={salvar}>
        <div className="cadastro-campo">
          <label htmlFor="cor-nome">{form.id_cor ? 'Editando cor' : 'Nova cor'}</label>
          <input
            id="cor-nome"
            value={form.nome}
            maxLength={60}
            placeholder="Ex: Verde Bandeira"
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
        </div>
        <div className="cadastro-campo">
          <label htmlFor="cor-hex">Amostra</label>
          <div className="painel-cor-amostra">
            <input
              id="cor-hex"
              type="color"
              value={form.hex}
              onChange={(e) => setForm({ ...form, hex: e.target.value.toUpperCase() })}
            />
            <code>{form.hex}</code>
          </div>
        </div>
        {form.id_cor && (
          <label className="cadastro-campo cadastro-campo-check" htmlFor="cor-ativa">
            <input id="cor-ativa" type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativa
          </label>
        )}
        <div className="painel-cadastro-form-acoes">
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>
            {form.id_cor ? 'Salvar alterações' : 'Adicionar cor'}
          </button>
          {form.id_cor && (
            <>
              <button type="button" className="cadastro-btn secundario" onClick={() => setForm(FORM_VAZIO)}>Cancelar</button>
              <button type="button" className="cadastro-btn perigo-texto" onClick={() => excluir(form)}>
                <Trash2 size={15} aria-hidden="true" /> Excluir
              </button>
            </>
          )}
        </div>
      </form>

      {cores.length === 0 ? (
        <p className="painel-cadastro-vazio">Nenhuma cor cadastrada. Use "Adicionar cores básicas" para começar.</p>
      ) : (
        <ul className="painel-cores-lista">
          {cores.map((cor) => (
            <li key={cor.id_cor}>
              <button
                type="button"
                className={`painel-cor-item ${cor.ativo ? '' : 'inativa'}`}
                onClick={() => setForm({ id_cor: cor.id_cor, nome: cor.nome, hex: cor.hex, ativo: cor.ativo })}
                aria-label={`Editar a cor ${cor.nome}`}
              >
                <span className="painel-cor-quadro" style={{ background: cor.hex }} aria-hidden="true" />
                <span>{cor.nome}</span>
                {!cor.ativo && <span className="cadastro-etiqueta inativo">Inativa</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
