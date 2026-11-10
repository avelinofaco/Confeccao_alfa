import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { formatarDocumento, formatarTelefone } from '../../utils/documentos';
import './cadastros.css';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE',
  'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const VAZIO = {
  tipo: 'PJ', nome: '', documento: '', telefone_whatsapp: '', email: '',
  cidade: '', uf: '', endereco: '', observacoes: '', ativo: true,
};

const paraFormulario = (cliente, nomeInicial) => {
  if (!cliente) return { ...VAZIO, nome: nomeInicial };
  const base = Object.fromEntries(Object.keys(VAZIO).map((chave) => [chave, cliente[chave] ?? VAZIO[chave]]));
  return {
    ...base,
    documento: formatarDocumento(cliente.documento),
    telefone_whatsapp: formatarTelefone(cliente.telefone_whatsapp),
  };
};

/**
 * Formulário de cliente em janela. `modoRapido` pede só nome e WhatsApp.
 * @param {{ cliente?: object|null, nomeInicial?: string, modoRapido?: boolean,
 *           onSalvo: (cliente: object) => void, onFechar: () => void }} props
 */
export function FormCliente({ cliente = null, nomeInicial = '', modoRapido = false, onSalvo, onFechar }) {
  const toast = useToast();
  const [dados, setDados] = useState(() => paraFormulario(cliente, nomeInicial));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const editando = Boolean(cliente?.id_cliente);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const alterar = (campo, valor) => setDados((atual) => ({ ...atual, [campo]: valor }));
  const propsCampo = (campo) => ({
    id: `cliente-${campo}`,
    value: dados[campo],
    onChange: (e) => alterar(campo, e.target.value),
  });

  const salvar = async (e) => {
    e.preventDefault();
    // Usado dentro do formulário do pedido: o envio não pode subir até ele.
    e.stopPropagation();
    if (dados.nome.trim().length < 2) {
      setErro('Informe o nome do cliente (pelo menos 2 letras).');
      return;
    }
    try {
      setSalvando(true);
      setErro('');
      const corpo = { ...dados, uf: dados.uf || null, tipo: dados.tipo || null };
      const { data } = editando
        ? await api.put(`/camisetas/clientes/${cliente.id_cliente}`, corpo)
        : await api.post('/camisetas/clientes/', corpo);
      toast.sucesso(editando ? `Cliente ${data.nome} atualizado.` : `Cliente ${data.nome} cadastrado.`);
      onSalvo(data);
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível salvar o cliente.'));
    } finally {
      setSalvando(false);
    }
  };

  // Portal no <body>: evita <form> dentro de <form> quando aberto a partir do pedido.
  return createPortal(
    <div className="cadastro-modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <form
        className={`cadastro-modal ${modoRapido ? 'compacto' : ''}`}
        onSubmit={salvar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-form-cliente"
        noValidate
      >
        <header className="cadastro-modal-cabecalho">
          <h2 id="titulo-form-cliente">{editando ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button type="button" className="cadastro-btn-icone" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {erro && <p className="cadastro-erro" role="alert">{erro}</p>}

        <div className="cadastro-grid">
          {!modoRapido && (
            <div className="cadastro-campo">
              <label htmlFor="cliente-tipo">Tipo</label>
              <select {...propsCampo('tipo')}>
                <option value="PJ">Empresa (CNPJ)</option>
                <option value="PF">Pessoa (CPF)</option>
              </select>
            </div>
          )}
          <div className="cadastro-campo cadastro-campo-largo">
            <label htmlFor="cliente-nome">{dados.tipo === 'PF' ? 'Nome *' : 'Nome / Razão social *'}</label>
            <input {...propsCampo('nome')} maxLength={150} autoFocus required />
          </div>
          {!modoRapido && (
            <div className="cadastro-campo">
              <label htmlFor="cliente-documento">{dados.tipo === 'PF' ? 'CPF' : 'CNPJ'}</label>
              <input
                {...propsCampo('documento')}
                inputMode="numeric"
                onBlur={() => alterar('documento', formatarDocumento(dados.documento))}
              />
            </div>
          )}
          <div className="cadastro-campo">
            <label htmlFor="cliente-telefone_whatsapp">WhatsApp</label>
            <input
              {...propsCampo('telefone_whatsapp')}
              inputMode="tel"
              placeholder="(85) 9 9999-9999"
              onBlur={() => alterar('telefone_whatsapp', formatarTelefone(dados.telefone_whatsapp))}
            />
          </div>
          {!modoRapido && (
            <>
              <div className="cadastro-campo">
                <label htmlFor="cliente-email">E-mail</label>
                <input {...propsCampo('email')} type="email" maxLength={150} />
              </div>
              <div className="cadastro-campo">
                <label htmlFor="cliente-cidade">Cidade</label>
                <input {...propsCampo('cidade')} maxLength={100} />
              </div>
              <div className="cadastro-campo">
                <label htmlFor="cliente-uf">UF</label>
                <select {...propsCampo('uf')}>
                  <option value="">—</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="cadastro-campo cadastro-campo-largo">
                <label htmlFor="cliente-endereco">Endereço</label>
                <input {...propsCampo('endereco')} maxLength={255} />
              </div>
              <div className="cadastro-campo cadastro-campo-largo">
                <label htmlFor="cliente-observacoes">Observações</label>
                <textarea {...propsCampo('observacoes')} rows={2} />
              </div>
              {editando && (
                <label className="cadastro-campo cadastro-campo-check" htmlFor="cliente-ativo">
                  <input
                    id="cliente-ativo"
                    type="checkbox"
                    checked={dados.ativo}
                    onChange={(e) => alterar('ativo', e.target.checked)}
                  />
                  Cliente ativo
                </label>
              )}
            </>
          )}
        </div>

        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar cliente'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
