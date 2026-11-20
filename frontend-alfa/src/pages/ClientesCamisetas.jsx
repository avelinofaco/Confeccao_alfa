import React, { useCallback, useEffect, useState } from 'react';
import { Link2, MessageCircle, Pencil, Plus, Search, Trash2, Users, Menu, X, Scissors } from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/feedback/useToast';
import { useConfirm } from '../components/feedback/useConfirm';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { FormCliente } from '../components/cadastros/FormCliente';
import { formatarDocumento, formatarTelefone } from '../utils/documentos';
import './ClientesCamisetas.css';

const ESPERA_BUSCA_MS = 250;
const CAMPOS_EDITAVEIS = ['tipo', 'nome', 'documento', 'telefone_whatsapp', 'email', 'cidade', 'uf', 'endereco', 'observacoes'];

const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
const formatarData = (valor) => (valor ? new Date(valor).toLocaleDateString('pt-BR') : '—');
const dadosEditaveis = (cliente) => Object.fromEntries(CAMPOS_EDITAVEIS.map((c) => [c, cliente[c] ?? null]));

function ClientesCamisetas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [emEdicao, setEmEdicao] = useState(null); // null = fechado · {} = novo · cliente = editar
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const { data } = await api.get('/camisetas/clientes/', {
        params: { busca: busca.trim() || undefined, incluir_inativos: incluirInativos, limite: 200 },
      });
      setClientes(data);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar os clientes.'));
    } finally {
      setCarregando(false);
    }
  }, [busca, incluirInativos, toast]);

  useEffect(() => {
    const timer = setTimeout(carregar, ESPERA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [carregar]);

  const alterarAtivo = async (cliente, ativo) => {
    try {
      await api.put(`/camisetas/clientes/${cliente.id_cliente}`, { ...dadosEditaveis(cliente), ativo });
      toast.sucesso(ativo ? `${cliente.nome} reativado.` : `${cliente.nome} inativado.`);
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível alterar o cliente.'));
    }
  };

  const excluir = async (cliente) => {
    const confirmou = await confirmar({
      titulo: `Excluir ${cliente.nome}?`,
      mensagem: 'O cadastro será apagado definitivamente.',
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!confirmou) return;
    try {
      await api.delete(`/camisetas/clientes/${cliente.id_cliente}`);
      toast.sucesso(`${cliente.nome} excluído.`);
      carregar();
    } catch (err) {
      if (err.response?.status !== 409) {
        toast.erro(mensagemDeErro(err, 'Não foi possível excluir o cliente.'));
        return;
      }
      const inativar = await confirmar({
        titulo: 'Cliente com pedidos',
        mensagem: `${cliente.nome} tem pedidos e não pode ser excluído. Inativar o cadastro? Ele deixa de aparecer na busca de novos pedidos.`,
        textoConfirmar: 'Inativar cliente',
      });
      if (inativar) alterarAtivo(cliente, false);
    }
  };

  const aoSalvar = () => {
    setEmEdicao(null);
    carregar();
  };

  const copiarLinkPortal = async (cliente) => {
    if (!cliente.token_portal) return;
    const url = `${window.location.origin}/portal/cliente/${cliente.token_portal}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.sucesso(`Link do Portal copiado para ${cliente.nome}! Envie no WhatsApp.`);
    } catch {
      toast.info(`Link do Portal: ${url}`);
    }
  };

  return (
    <div className="clientes-container">
      {/* CABEÇALHO MOBILE (Só aparece no celular) */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-box-sm">
            <Scissors size={20} color="#2563eb" strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>Confecção Alfa</h2>
        </div>
        <button 
          type="button"
          className="btn-menu-mobile" 
          onClick={() => setMenuMobileAberto(!menuMobileAberto)}
          aria-label="Abrir menu de navegação"
        >
          {menuMobileAberto ? <X size={24} color="#1f2937" /> : <Menu size={24} color="#1f2937" />}
        </button>
      </div>

      {/* Backdrop escuro para fechar ao tocar fora no mobile */}
      {menuMobileAberto && (
        <div className="sidebar-backdrop" onClick={() => setMenuMobileAberto(false)} aria-hidden="true" />
      )}

      <Sidebar menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto} />
      <main className="clientes-main">
        <header className="page-header">
          <h1><Users size={28} color="#2563eb" aria-hidden="true" /> 3. Clientes</h1>
          <p>Cadastre lojas, empresas e pessoas que compram da confecção. Nos pedidos, basta buscar pelo nome.</p>
        </header>

        <div className="clientes-barra">
          <label className="clientes-busca" htmlFor="busca-clientes">
            <Search size={16} aria-hidden="true" />
            <input
              id="busca-clientes"
              type="search"
              placeholder="Buscar por nome, CPF/CNPJ ou telefone"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <label className="clientes-filtro" htmlFor="mostrar-inativos">
            <input
              id="mostrar-inativos"
              type="checkbox"
              checked={incluirInativos}
              onChange={(e) => setIncluirInativos(e.target.checked)}
            />
            Mostrar inativos
          </label>
          <button type="button" className="cadastro-btn primario" onClick={() => setEmEdicao({})}>
            <Plus size={16} aria-hidden="true" /> Novo cliente
          </button>
        </div>

        <div className="clientes-tabela-card">
          <table className="clientes-tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CPF / CNPJ</th>
                <th>WhatsApp</th>
                <th>Cidade</th>
                <th>Pedidos</th>
                <th>Último pedido</th>
                <th>Total em pedidos</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="clientes-vazio">
                    {carregando ? 'Carregando…' : 'Nenhum cliente encontrado. Use "Novo cliente" para cadastrar.'}
                  </td>
                </tr>
              ) : clientes.map((cliente) => (
                <tr key={cliente.id_cliente}>
                  <td>
                    <strong>{cliente.nome}</strong>
                    {!cliente.ativo && <span className="cadastro-etiqueta inativo">Inativo</span>}
                  </td>
                  <td>{formatarDocumento(cliente.documento) || '—'}</td>
                  <td>
                    {cliente.telefone_whatsapp ? (
                      <a
                        className="clientes-whatsapp"
                        href={`https://wa.me/55${cliente.telefone_whatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir conversa no WhatsApp"
                      >
                        <MessageCircle size={14} aria-hidden="true" /> {formatarTelefone(cliente.telefone_whatsapp)}
                      </a>
                    ) : '—'}
                  </td>
                  <td>{[cliente.cidade, cliente.uf].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{cliente.qtd_pedidos}</td>
                  <td>{formatarData(cliente.ultimo_pedido_em)}</td>
                  <td>{formatarMoeda(cliente.valor_total_pedidos)}</td>
                  <td className="clientes-acoes">
                    {cliente.ativo && cliente.token_portal && (
                      <button
                        type="button"
                        className="cadastro-btn-icone"
                        onClick={() => copiarLinkPortal(cliente)}
                        title="Copiar link para o cliente montar pedido pelo celular"
                        aria-label={`Copiar link do portal de ${cliente.nome}`}
                      >
                        <Link2 size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="cadastro-btn-icone"
                      onClick={() => setEmEdicao(cliente)}
                      aria-label={`Editar ${cliente.nome}`}
                    >
                      <Pencil size={16} />
                    </button>
                    {cliente.ativo ? (
                      <button
                        type="button"
                        className="cadastro-btn-icone"
                        onClick={() => excluir(cliente)}
                        aria-label={`Excluir ${cliente.nome}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button type="button" className="cadastro-btn secundario" onClick={() => alterarAtivo(cliente, true)}>
                        Reativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {emEdicao && (
          <FormCliente
            cliente={emEdicao.id_cliente ? emEdicao : null}
            onSalvo={aoSalvar}
            onFechar={() => setEmEdicao(null)}
          />
        )}
      </main>
    </div>
  );
}

export default ClientesCamisetas;
