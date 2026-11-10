import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Ruler, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { useConfirm } from '../feedback/useConfirm';
import { mensagemDeErro } from '../feedback/mensagemErro';
import './cadastros.css';

const MODELOS_PRONTOS = [
  { nome: 'Adulto (PP–XGG)', tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'] },
  { nome: 'Infantil (2–16)', tamanhos: ['2', '4', '6', '8', '10', '12', '14', '16'] },
  { nome: 'Babylook (PP–GG)', tamanhos: ['PP', 'P', 'M', 'G', 'GG'] },
];
const FORM_VAZIO = { id_grade: null, nome: '', tamanhos: [], ativo: true };

const mover = (lista, indice, passo) => {
  const destino = indice + passo;
  if (destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
};

export function PainelGrades() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [grades, setGrades] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [novoTamanho, setNovoTamanho] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/camisetas/grades/', { params: { incluir_inativas: true } });
      setGrades(data);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar as grades.'));
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionarTamanho = () => {
    const rotulo = novoTamanho.trim().toUpperCase();
    if (!rotulo) return;
    if (form.tamanhos.some((t) => t.toUpperCase() === rotulo)) {
      toast.aviso(`O tamanho ${rotulo} já está na grade.`);
      return;
    }
    setForm({ ...form, tamanhos: [...form.tamanhos, rotulo] });
    setNovoTamanho('');
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim() || form.tamanhos.length === 0) {
      toast.aviso('Dê um nome à grade e adicione pelo menos um tamanho.');
      return;
    }
    try {
      setSalvando(true);
      const corpo = { nome: form.nome, tamanhos: form.tamanhos, ativo: form.ativo };
      if (form.id_grade) await api.put(`/camisetas/grades/${form.id_grade}`, corpo);
      else await api.post('/camisetas/grades/', corpo);
      toast.sucesso(`Grade ${form.nome.trim()} salva.`);
      setForm(FORM_VAZIO);
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível salvar a grade.'));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (grade) => {
    const confirmou = await confirmar({
      titulo: `Excluir a grade ${grade.nome}?`,
      mensagem: grade.qtd_modelos > 0
        ? `Ela é usada por ${grade.qtd_modelos} modelo(s); troque a grade desses modelos antes, ou inative-a.`
        : 'A grade deixa de existir no cadastro.',
      textoConfirmar: 'Excluir grade',
      perigo: true,
    });
    if (!confirmou) return;
    try {
      await api.delete(`/camisetas/grades/${grade.id_grade}`);
      toast.sucesso(`Grade ${grade.nome} excluída.`);
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível excluir a grade.'));
    }
  };

  return (
    <section className="painel-cadastro" aria-labelledby="titulo-painel-grades">
      <header className="painel-cadastro-cabecalho">
        <h2 id="titulo-painel-grades"><Ruler size={20} aria-hidden="true" /> Grades de tamanhos</h2>
        <div className="painel-modelos-prontos">
          <span>Começar de um modelo pronto:</span>
          {MODELOS_PRONTOS.map((modelo) => (
            <button
              key={modelo.nome}
              type="button"
              className="cadastro-btn secundario"
              onClick={() => setForm({ ...FORM_VAZIO, nome: modelo.nome, tamanhos: modelo.tamanhos })}
            >
              {modelo.nome}
            </button>
          ))}
        </div>
      </header>

      <form className="painel-cadastro-form" onSubmit={salvar}>
        <div className="cadastro-campo">
          <label htmlFor="grade-nome">{form.id_grade ? 'Editando grade' : 'Nova grade'}</label>
          <input
            id="grade-nome"
            value={form.nome}
            maxLength={80}
            placeholder="Ex: Adulto (PP–XGG)"
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
        </div>
        <div className="cadastro-campo">
          <label htmlFor="grade-novo-tamanho">Adicionar tamanho</label>
          <div className="painel-grade-novo">
            <input
              id="grade-novo-tamanho"
              value={novoTamanho}
              maxLength={10}
              placeholder="Ex: XG"
              onChange={(e) => setNovoTamanho(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarTamanho(); } }}
            />
            <button type="button" className="cadastro-btn secundario" onClick={adicionarTamanho}>Adicionar</button>
          </div>
        </div>
        <ol className="painel-grade-tamanhos" aria-label="Tamanhos da grade, na ordem">
          {form.tamanhos.length === 0 && <li className="painel-cadastro-vazio">Nenhum tamanho ainda.</li>}
          {form.tamanhos.map((rotulo, indice) => (
            <li key={rotulo} className="painel-grade-tamanho">
              <strong>{rotulo}</strong>
              <button type="button" className="cadastro-btn-icone" aria-label={`Mover ${rotulo} para a esquerda`}
                onClick={() => setForm({ ...form, tamanhos: mover(form.tamanhos, indice, -1) })}>
                <ArrowUp size={14} />
              </button>
              <button type="button" className="cadastro-btn-icone" aria-label={`Mover ${rotulo} para a direita`}
                onClick={() => setForm({ ...form, tamanhos: mover(form.tamanhos, indice, 1) })}>
                <ArrowDown size={14} />
              </button>
              <button type="button" className="cadastro-btn-icone" aria-label={`Remover ${rotulo}`}
                onClick={() => setForm({ ...form, tamanhos: form.tamanhos.filter((t) => t !== rotulo) })}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ol>
        {form.id_grade && (
          <label className="cadastro-campo cadastro-campo-check" htmlFor="grade-ativa">
            <input id="grade-ativa" type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativa
          </label>
        )}
        <div className="painel-cadastro-form-acoes">
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>
            {form.id_grade ? 'Salvar alterações' : 'Salvar grade'}
          </button>
          {(form.id_grade || form.nome || form.tamanhos.length > 0) && (
            <button type="button" className="cadastro-btn secundario" onClick={() => setForm(FORM_VAZIO)}>Cancelar</button>
          )}
        </div>
      </form>

      <ul className="painel-grades-lista">
        {grades.map((grade) => (
          <li key={grade.id_grade} className="painel-grade-item">
            <div>
              <strong>{grade.nome}</strong>
              {!grade.ativo && <span className="cadastro-etiqueta inativo">Inativa</span>}
              <div className="painel-grade-etiquetas">
                {grade.tamanhos.map((t) => <span key={t} className="cadastro-etiqueta">{t}</span>)}
              </div>
              <small>{grade.qtd_modelos} modelo(s) usam esta grade</small>
            </div>
            <div className="painel-grade-acoes">
              <button type="button" className="cadastro-btn-icone" aria-label={`Editar ${grade.nome}`}
                onClick={() => setForm({ id_grade: grade.id_grade, nome: grade.nome, tamanhos: grade.tamanhos, ativo: grade.ativo })}>
                <Pencil size={16} />
              </button>
              <button type="button" className="cadastro-btn-icone" aria-label={`Excluir ${grade.nome}`} onClick={() => excluir(grade)}>
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
