import { useEffect, useId, useState } from 'react';
import { CheckCircle, UserPlus } from 'lucide-react';
import api from '../../services/api';
import { FormCliente } from './FormCliente';
import { formatarDocumento } from '../../utils/documentos';
import './cadastros.css';

const MINIMO_LETRAS = 2;
const ESPERA_MS = 250;
const MAX_SUGESTOES = 8;

/**
 * Campo de cliente com busca ao digitar (ARIA combobox) e cadastro rápido.
 * @param {{ id: string, cliente: {id_cliente:number, nome:string}|null, onChange: (cliente: object|null) => void }} props
 */
export function SeletorCliente({ id, cliente, onChange }) {
  const listaId = useId();
  const [texto, setTexto] = useState(cliente?.nome ?? '');
  // Resultado ligado ao termo buscado: evita mostrar sugestões de um termo antigo
  // e só oferece "Cadastrar…" depois que a busca do termo atual terminou.
  const [resultado, setResultado] = useState({ termo: '', clientes: [] });
  const [erroBusca, setErroBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [cadastrando, setCadastrando] = useState(false);

  useEffect(() => {
    setTexto(cliente?.nome ?? '');
  }, [cliente]);

  const termo = texto.trim();
  const buscando = aberto && termo.length >= MINIMO_LETRAS && termo !== cliente?.nome;

  useEffect(() => {
    if (!buscando) return undefined;
    let cancelado = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/camisetas/clientes/', { params: { busca: termo, limite: MAX_SUGESTOES } });
        if (!cancelado) {
          setResultado({ termo, clientes: data });
          setErroBusca('');
        }
      } catch {
        if (!cancelado) {
          setResultado({ termo, clientes: [] });
          setErroBusca('Não foi possível buscar clientes agora.');
        }
      }
    }, ESPERA_MS);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [buscando, termo]);

  const carregando = buscando && resultado.termo !== termo;
  const opcoes = buscando && !carregando ? [...resultado.clientes, { novo: true }] : [];

  const escolher = (opcao) => {
    setAberto(false);
    setAtivo(-1);
    if (opcao.novo) {
      setCadastrando(true);
      return;
    }
    setTexto(opcao.nome);
    onChange(opcao);
  };

  const aoDigitar = (e) => {
    setTexto(e.target.value);
    setAberto(true);
    setAtivo(-1);
    if (cliente) onChange(null);
  };

  const aoTeclar = (e) => {
    if (!opcoes.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((atual) => (atual + 1) % opcoes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((atual) => (atual <= 0 ? opcoes.length - 1 : atual - 1));
    } else if (e.key === 'Enter' && ativo >= 0) {
      e.preventDefault();
      escolher(opcoes[ativo]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  };

  return (
    <div className="seletor-cliente">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={buscando}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={ativo >= 0 ? `${listaId}-${ativo}` : undefined}
        autoComplete="off"
        placeholder="Digite o nome, CPF/CNPJ ou telefone do cliente"
        value={texto}
        onChange={aoDigitar}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={aoTeclar}
      />
      {cliente && (
        <span className="seletor-cliente-ok">
          <CheckCircle size={14} aria-hidden="true" /> Cliente cadastrado
        </span>
      )}
      {buscando && (
        <ul id={listaId} role="listbox" className="seletor-cliente-lista" onMouseDown={(e) => e.preventDefault()}>
          {carregando && <li className="seletor-cliente-carregando" role="presentation">Buscando clientes…</li>}
          {erroBusca && !carregando && <li className="seletor-cliente-erro" role="presentation">{erroBusca}</li>}
          {opcoes.map((opcao, indice) => (
            <li
              key={opcao.novo ? 'novo' : opcao.id_cliente}
              id={`${listaId}-${indice}`}
              role="option"
              aria-selected={indice === ativo}
              className={`seletor-cliente-opcao ${indice === ativo ? 'ativa' : ''} ${opcao.novo ? 'nova' : ''}`}
              onClick={() => escolher(opcao)}
            >
              {opcao.novo ? (
                <><UserPlus size={15} aria-hidden="true" /> Cadastrar “{termo}”</>
              ) : (
                <>
                  <strong>{opcao.nome}</strong>
                  <small>{[formatarDocumento(opcao.documento), opcao.cidade].filter(Boolean).join(' · ')}</small>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {cadastrando && (
        <FormCliente
          modoRapido
          nomeInicial={termo}
          onSalvo={(novo) => {
            setCadastrando(false);
            escolher(novo);
          }}
          onFechar={() => setCadastrando(false)}
        />
      )}
    </div>
  );
}
