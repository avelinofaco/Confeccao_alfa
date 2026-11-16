import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pencil, Search, Trash2, Upload, X, ZoomIn } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { useConfirm } from '../feedback/useConfirm';
import { mensagemDeErro } from '../feedback/mensagemErro';
import './cadastros.css';

const LIMITE_BYTES = 2 * 1024 * 1024; // 2 MB
const FORM_VAZIO = {
  id_estampa: null,
  nome: '',
  codigo: '',
  observacoes: '',
  imagem_data_url: '',
  ativo: true,
};

export function PainelEstampas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const inputArquivoRef = useRef(null);

  const [estampas, setEstampas] = useState([]);
  const [busca, setBusca] = useState('');
  const [incluirInativas, setIncluirInativas] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [estampaAmpliada, setEstampaAmpliada] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/camisetas/estampas/', {
        params: {
          busca: busca.trim() || undefined,
          incluir_inativas: incluirInativas,
        },
      });
      setEstampas(data);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar o banco de estampas.'));
    }
  }, [busca, incluirInativas, toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!estampaAmpliada) return undefined;
    const aoTeclar = (e) => {
      if (e.key === 'Escape') setEstampaAmpliada(null);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [estampaAmpliada]);

  const limparFormulario = () => {
    setForm(FORM_VAZIO);
    if (inputArquivoRef.current) inputArquivoRef.current.value = '';
  };

  const aoEscolherArquivo = (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type)) {
      toast.aviso('Formato não suportado. Escolha uma imagem PNG, JPG ou WEBP.');
      e.target.value = '';
      return;
    }
    if (arquivo.size > LIMITE_BYTES) {
      toast.aviso('A imagem excede o limite de 2 MB.');
      e.target.value = '';
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      const resultado = typeof leitor.result === 'string' ? leitor.result : '';
      setForm((atual) => ({
        ...atual,
        imagem_data_url: resultado,
        nome: atual.nome || arquivo.name.replace(/\.[^.]+$/, ''),
      }));
    };
    leitor.readAsDataURL(arquivo);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.aviso('Informe o nome da estampa.');
      return;
    }
    if (!form.id_estampa && !form.imagem_data_url) {
      toast.aviso('Selecione a imagem da estampa (PNG, JPG ou WEBP).');
      return;
    }
    try {
      setSalvando(true);
      const corpo = {
        nome: form.nome.trim(),
        codigo: form.codigo.trim() || null,
        observacoes: form.observacoes.trim() || null,
        ativo: form.ativo,
      };
      if (form.id_estampa) {
        if (form.imagem_data_url) corpo.imagem_data_url = form.imagem_data_url;
        await api.put(`/camisetas/estampas/${form.id_estampa}`, corpo);
        toast.sucesso(`Estampa "${form.nome.trim()}" atualizada.`);
      } else {
        corpo.imagem_data_url = form.imagem_data_url;
        await api.post('/camisetas/estampas/', corpo);
        toast.sucesso(`Estampa "${form.nome.trim()}" cadastrada.`);
      }
      limparFormulario();
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível salvar a estampa.'));
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (estampa) => {
    setForm({
      id_estampa: estampa.id_estampa,
      nome: estampa.nome,
      codigo: estampa.codigo,
      observacoes: estampa.observacoes || '',
      imagem_data_url: estampa.imagem_data_url,
      ativo: estampa.ativo,
    });
    if (inputArquivoRef.current) inputArquivoRef.current.value = '';
  };

  const excluir = async (estampa) => {
    const confirmou = await confirmar({
      titulo: `Excluir a estampa "${estampa.nome}"?`,
      mensagem: `A arte ${estampa.codigo} será removida do catálogo visual.`,
      textoConfirmar: 'Excluir estampa',
      perigo: true,
    });
    if (!confirmou) return;
    try {
      await api.delete(`/camisetas/estampas/${estampa.id_estampa}`);
      toast.sucesso(`Estampa "${estampa.nome}" excluída.`);
      limparFormulario();
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível excluir a estampa.'));
    }
  };

  return (
    <section className="painel-cadastro" aria-labelledby="titulo-painel-estampas">
      <header className="painel-cadastro-cabecalho">
        <h2 id="titulo-painel-estampas">
          <Image size={20} aria-hidden="true" /> Banco de Estampas
          <span className="cadastro-etiqueta">{estampas.length} arte(s)</span>
        </h2>

        <div className="painel-estampas-filtros">
          <div className="painel-estampas-busca">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar estampa por nome ou código"
              placeholder="Buscar por nome ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <label className="cadastro-campo cadastro-campo-check" htmlFor="estampas-mostrar-inativas">
            <input
              id="estampas-mostrar-inativas"
              type="checkbox"
              checked={incluirInativas}
              onChange={(e) => setIncluirInativas(e.target.checked)}
            />
            Mostrar inativas
          </label>
        </div>
      </header>

      <form className="painel-cadastro-form painel-estampas-form" onSubmit={salvar}>
        <div className="painel-estampa-upload">
          <label htmlFor="estampa-arquivo" className="painel-estampa-dropzone">
            {form.imagem_data_url ? (
              <img src={form.imagem_data_url} alt="Prévia da estampa" className="painel-estampa-previa-img" />
            ) : (
              <span className="painel-estampa-placeholder">
                <Upload size={22} aria-hidden="true" />
                <span>Escolher arte (PNG, JPG, WEBP · máx. 2 MB)</span>
              </span>
            )}
          </label>
          <input
            ref={inputArquivoRef}
            id="estampa-arquivo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={aoEscolherArquivo}
            className="painel-estampa-input-oculto"
          />
        </div>

        <div className="cadastro-campo">
          <label htmlFor="estampa-nome">{form.id_estampa ? 'Editando estampa *' : 'Nome da estampa *'}</label>
          <input
            id="estampa-nome"
            value={form.nome}
            maxLength={120}
            placeholder="Ex: Logo Leão Dourado"
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
        </div>

        <div className="cadastro-campo">
          <label htmlFor="estampa-codigo">Código (opcional)</label>
          <input
            id="estampa-codigo"
            value={form.codigo}
            maxLength={30}
            placeholder="Automático (EST-2026-0001)"
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          />
        </div>

        <div className="cadastro-campo">
          <label htmlFor="estampa-observacoes">Observações</label>
          <input
            id="estampa-observacoes"
            value={form.observacoes}
            placeholder="Ex: Silk 2 cores · frente peito"
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </div>

        {form.id_estampa && (
          <label className="cadastro-campo cadastro-campo-check" htmlFor="estampa-ativa">
            <input
              id="estampa-ativa"
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativa
          </label>
        )}

        <div className="painel-cadastro-form-acoes">
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>
            {form.id_estampa ? 'Salvar alterações' : 'Cadastrar estampa'}
          </button>
          {form.id_estampa && (
            <>
              <button type="button" className="cadastro-btn secundario" onClick={limparFormulario}>
                Cancelar
              </button>
              <button type="button" className="cadastro-btn perigo-texto" onClick={() => excluir(form)}>
                <Trash2 size={15} aria-hidden="true" /> Excluir
              </button>
            </>
          )}
        </div>
      </form>

      {estampas.length === 0 ? (
        <p className="painel-cadastro-vazio">
          {busca.trim()
            ? 'Nenhuma estampa encontrada para esta busca.'
            : 'Nenhuma estampa cadastrada ainda. Envie uma imagem PNG, JPG ou WEBP acima para criar o catálogo.'}
        </p>
      ) : (
        <ul className="painel-estampas-grade">
          {estampas.map((est) => (
            <li key={est.id_estampa} className={`painel-estampa-card ${est.ativo ? '' : 'inativa'}`}>
              <button
                type="button"
                className="painel-estampa-miniatura"
                onClick={() => setEstampaAmpliada(est)}
                aria-label={`Ampliar estampa ${est.nome}`}
              >
                <img src={est.imagem_data_url} alt={est.nome} loading="lazy" />
                <span className="painel-estampa-zoom" aria-hidden="true">
                  <ZoomIn size={16} />
                </span>
              </button>
              <div className="painel-estampa-info">
                <div className="painel-estampa-meta">
                  <code className="cadastro-etiqueta">{est.codigo}</code>
                  {!est.ativo && <span className="cadastro-etiqueta inativo">Inativa</span>}
                </div>
                <strong className="painel-estampa-titulo">{est.nome}</strong>
                {est.observacoes && <small className="painel-estampa-obs">{est.observacoes}</small>}
              </div>
              <div className="painel-estampa-acoes">
                <button
                  type="button"
                  className="cadastro-btn secundario"
                  onClick={() => iniciarEdicao(est)}
                  aria-label={`Editar estampa ${est.nome}`}
                >
                  <Pencil size={14} aria-hidden="true" /> Editar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {estampaAmpliada && (
        <div
          className="cadastro-modal-fundo"
          onClick={(e) => e.target === e.currentTarget && setEstampaAmpliada(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-estampa-ampliada"
        >
          <div className="cadastro-modal painel-estampa-modal">
            <header className="cadastro-modal-cabecalho">
              <div>
                <h2 id="titulo-modal-estampa-ampliada">{estampaAmpliada.nome}</h2>
                <code className="cadastro-etiqueta">{estampaAmpliada.codigo}</code>
              </div>
              <button
                type="button"
                className="cadastro-btn-icone"
                onClick={() => setEstampaAmpliada(null)}
                aria-label="Fechar visualização"
              >
                <X size={20} />
              </button>
            </header>
            <div className="painel-estampa-modal-quadro">
              <img src={estampaAmpliada.imagem_data_url} alt={estampaAmpliada.nome} />
            </div>
            {estampaAmpliada.observacoes && (
              <p className="painel-estampa-modal-obs">{estampaAmpliada.observacoes}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
