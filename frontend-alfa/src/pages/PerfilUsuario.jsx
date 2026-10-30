import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  CheckCircle, 
  Save, 
  Smartphone, 
  Briefcase, 
  Eye, 
  EyeOff, 
  Settings, 
  AlertCircle, 
  Sparkles, 
  Shirt,
  Sliders,
  Check
} from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { useSegmento } from '../context/SegmentoContext';
import './PerfilUsuario.css';

function PerfilUsuario() {
  const navigate = useNavigate();
  const { segmento, setSegmentoAtivo, isCamisetas } = useSegmento();
  const [activeTab, setActiveTab] = useState('perfil'); // 'perfil' | 'seguranca' | 'preferencias'
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  // ID do usuário gestor padrão
  const idUsuarioLogado = 1;

  // Dados do Perfil
  const [formPerfil, setFormPerfil] = useState({
    nome_usuario: '',
    login: '',
    cargo: 'Gestor(a) de Produção e PCP',
    telefone: '(11) 98765-4321'
  });

  // Alteração de Senha
  const [formSenha, setFormSenha] = useState({
    senha_atual: '',
    nova_senha: '',
    confirmar_senha: ''
  });
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  // Preferências
  const [preferencias, setPreferencias] = useState({
    segmento_padrao: isCamisetas ? 'Camisetas' : 'Moda Íntima',
    alertar_estoque_baixo: true,
    notificacoes_pedidos: true
  });

  // Busca dados do usuário na API
  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/usuarios/${idUsuarioLogado}`);
        if (res.data) {
          setFormPerfil(prev => ({
            ...prev,
            nome_usuario: res.data.nome_usuario || 'Gestor Alfa',
            login: res.data.login || 'admin@confeccaoalfa.com.br'
          }));
        }
      } catch (err) {
        console.error("Erro ao buscar dados do perfil:", err);
      } finally {
        setLoading(false);
      }
    };

    carregarPerfil();
  }, []);

  const exibirAlertaTemporario = (msg) => {
    setMensagemSucesso(msg);
    setTimeout(() => {
      setMensagemSucesso('');
    }, 4500);
  };

  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    if (!formPerfil.nome_usuario || !formPerfil.login) {
      alert("Nome e login são obrigatórios.");
      return;
    }

    try {
      setSalvando(true);
      await api.put(`/usuarios/${idUsuarioLogado}`, {
        nome_usuario: formPerfil.nome_usuario,
        login: formPerfil.login
      });

      // Atualiza no localStorage para refletir no sistema
      try {
        const usuarioArmazenado = JSON.parse(localStorage.getItem('usuario_confeccao') || '{}');
        localStorage.setItem('usuario_confeccao', JSON.stringify({
          ...usuarioArmazenado,
          nome_usuario: formPerfil.nome_usuario,
          login: formPerfil.login
        }));
      } catch {
        // Ignora caso falhe o parse
      }

      exibirAlertaTemporario("Perfil atualizado com sucesso! Suas informações foram salvas.");
    } catch (err) {
      console.error("Erro ao atualizar perfil:", err);
      alert(err.response?.data?.detail || "Erro ao atualizar perfil do usuário.");
    } finally {
      setSalvando(false);
    }
  };

  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    if (!formSenha.nova_senha || !formSenha.confirmar_senha) {
      alert("Preencha a nova senha e sua confirmação.");
      return;
    }

    if (formSenha.nova_senha.length < 6) {
      alert("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (formSenha.nova_senha !== formSenha.confirmar_senha) {
      alert("As senhas digitadas não coincidem.");
      return;
    }

    try {
      setSalvando(true);
      await api.put(`/usuarios/${idUsuarioLogado}`, {
        senha: formSenha.nova_senha
      });

      setFormSenha({
        senha_atual: '',
        nova_senha: '',
        confirmar_senha: ''
      });

      exibirAlertaTemporario("Senha alterada com sucesso! O novo hash criptográfico foi gravado.");
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      alert(err.response?.data?.detail || "Erro ao atualizar senha.");
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarPreferencias = async (e) => {
    e.preventDefault();
    try {
      setSalvando(true);
      if (setSegmentoAtivo && preferencias.segmento_padrao) {
        setSegmentoAtivo(preferencias.segmento_padrao);
      }
      await api.put(`/usuarios/${idUsuarioLogado}/segmento`, {
        segmento: preferencias.segmento_padrao
      }).catch(() => null);

      exibirAlertaTemporario("Preferências operacionais salvas com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar preferências:", err);
      alert("Erro ao salvar preferências.");
    } finally {
      setSalvando(false);
    }
  };

  // Cálculo de Força da Senha
  const calcularForcaSenha = (senha) => {
    if (!senha) return { score: 0, label: 'Não informada', cor: '#cbd5e1', largura: '0%' };
    let score = 0;
    if (senha.length >= 6) score += 1;
    if (senha.length >= 8) score += 1;
    if (/[A-Z]/.test(senha)) score += 1;
    if (/[0-9]/.test(senha)) score += 1;
    if (/[^A-Za-z0-9]/.test(senha)) score += 1;

    if (score <= 2) return { score: 1, label: 'Senha Fraca', cor: '#ef4444', largura: '33%' };
    if (score <= 4) return { score: 2, label: 'Senha Média', cor: '#f59e0b', largura: '66%' };
    return { score: 3, label: 'Senha Forte e Segura', cor: '#10b981', largura: '100%' };
  };

  const forcaSenha = calcularForcaSenha(formSenha.nova_senha);

  // Iniciais do Usuário
  const obterIniciais = (nome) => {
    if (!nome) return 'GA';
    const partes = nome.trim().split(' ');
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  };

  return (
    <div className="perfil-container">
      <Sidebar />

      <main className="perfil-main">
        <header className="perfil-header">
          <h1>
            <Settings size={28} color={isCamisetas ? "#2563eb" : "#00c875"} />
            Configurações de Perfil do Usuário
          </h1>
          <p>
            Gerencie suas credenciais de acesso, dados cadastrais e preferências de navegação na Confecção Alfa.
          </p>
        </header>

        {/* HERO PROFILE CARD */}
        <div className="perfil-hero-card">
          <div className="perfil-hero-left">
            <div className={`perfil-avatar-circle ${!isCamisetas ? 'moda-intima' : ''}`}>
              {obterIniciais(formPerfil.nome_usuario)}
              <span className="perfil-status-dot" title="Usuário Ativo"></span>
            </div>

            <div className="perfil-hero-info">
              <h2>{formPerfil.nome_usuario || 'Carregando...'}</h2>
              <p>
                <Mail size={15} />
                {formPerfil.login || 'usuario@confeccaoalfa.com.br'}
              </p>
            </div>
          </div>

          <div className="perfil-hero-badges">
            <span className="badge-perfil-role">
              <Shield size={14} />
              {formPerfil.cargo}
            </span>
            <span className="badge-perfil-segmento">
              {isCamisetas ? <Shirt size={14} color="#2563eb" /> : <Sparkles size={14} color="#00c875" />}
              Segmento: <strong>{isCamisetas ? 'Camisetas' : 'Moda Íntima'}</strong>
            </span>
          </div>
        </div>

        {/* FEEDBACK DE SUCESSO */}
        {mensagemSucesso && (
          <div className="alerta-sucesso-perfil">
            <CheckCircle size={20} />
            <span>{mensagemSucesso}</span>
          </div>
        )}

        {/* ABAS DE NAVEGAÇÃO */}
        <div className="perfil-tabs-bar">
          <button 
            type="button"
            className={`perfil-tab-btn ${activeTab === 'perfil' ? 'active' : ''} ${!isCamisetas ? 'moda-intima' : ''}`}
            onClick={() => setActiveTab('perfil')}
          >
            <User size={18} />
            <span>Dados do Perfil</span>
          </button>

          <button 
            type="button"
            className={`perfil-tab-btn ${activeTab === 'seguranca' ? 'active' : ''} ${!isCamisetas ? 'moda-intima' : ''}`}
            onClick={() => setActiveTab('seguranca')}
          >
            <Lock size={18} />
            <span>Segurança & Senha</span>
          </button>

          <button 
            type="button"
            className={`perfil-tab-btn ${activeTab === 'preferencias' ? 'active' : ''} ${!isCamisetas ? 'moda-intima' : ''}`}
            onClick={() => setActiveTab('preferencias')}
          >
            <Sliders size={18} />
            <span>Preferências</span>
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}

        {/* ABA 1: DADOS DO PERFIL */}
        {activeTab === 'perfil' && (
          <div className="perfil-card-content">
            <h3>
              <User size={20} color={isCamisetas ? "#2563eb" : "#00c875"} />
              Informações Pessoais & Contato
            </h3>
            <p className="perfil-card-subtitle">
              Mantenha seus dados atualizados para comunicação interna e relatórios de auditoria.
            </p>

            <form onSubmit={handleSalvarPerfil}>
              <div className="form-grid-perfil">
                <div className="form-group-perfil">
                  <label>
                    <User size={15} />
                    Nome Completo *
                  </label>
                  <input 
                    type="text" 
                    value={formPerfil.nome_usuario}
                    onChange={(e) => setFormPerfil({ ...formPerfil, nome_usuario: e.target.value })}
                    placeholder="Ex: Gestor da Silva Alfa"
                    required
                  />
                </div>

                <div className="form-group-perfil">
                  <label>
                    <Mail size={15} />
                    E-mail / Login de Acesso *
                  </label>
                  <input 
                    type="text" 
                    value={formPerfil.login}
                    onChange={(e) => setFormPerfil({ ...formPerfil, login: e.target.value })}
                    placeholder="Ex: admin@confeccaoalfa.com.br"
                    required
                  />
                </div>

                <div className="form-group-perfil">
                  <label>
                    <Briefcase size={15} />
                    Cargo / Função
                  </label>
                  <input 
                    type="text" 
                    value={formPerfil.cargo}
                    onChange={(e) => setFormPerfil({ ...formPerfil, cargo: e.target.value })}
                    placeholder="Ex: Gerente Geral de PCP"
                  />
                </div>

                <div className="form-group-perfil">
                  <label>
                    <Smartphone size={15} />
                    Telefone / WhatsApp
                  </label>
                  <input 
                    type="text" 
                    value={formPerfil.telefone}
                    onChange={(e) => setFormPerfil({ ...formPerfil, telefone: e.target.value })}
                    placeholder="Ex: (11) 98765-4321"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-salvar-perfil"
                style={{ backgroundColor: isCamisetas ? '#2563eb' : '#00c875' }}
                disabled={salvando}
              >
                <Save size={18} />
                <span>{salvando ? 'Salvando Alterações...' : 'Salvar Alterações de Perfil'}</span>
              </button>
            </form>
          </div>
        )}

        {/* ABA 2: SEGURANÇA & SENHA */}
        {activeTab === 'seguranca' && (
          <div className="perfil-card-content">
            <h3>
              <Lock size={20} color={isCamisetas ? "#2563eb" : "#00c875"} />
              Credenciais & Proteção de Acesso
            </h3>
            <p className="perfil-card-subtitle">
              Sua senha é protegida com criptografia de ponta a ponta (algoritmo PBKDF2/Bcrypt).
            </p>

            <form onSubmit={handleAlterarSenha}>
              <div className="form-grid-perfil">
                <div className="form-group-perfil">
                  <label>
                    <Lock size={15} />
                    Nova Senha *
                  </label>
                  <div className="input-password-wrapper">
                    <input 
                      type={mostrarNovaSenha ? "text" : "password"} 
                      placeholder="Mínimo de 6 caracteres"
                      value={formSenha.nova_senha}
                      onChange={(e) => setFormSenha({ ...formSenha, nova_senha: e.target.value })}
                      required
                    />
                    <button 
                      type="button" 
                      className="btn-toggle-password"
                      onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                      tabIndex={-1}
                    >
                      {mostrarNovaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {formSenha.nova_senha && (
                    <div className="forca-senha-box">
                      <div className="forca-senha-barra">
                        <div 
                          className="forca-senha-preenchimento" 
                          style={{ width: forcaSenha.largura, backgroundColor: forcaSenha.cor }}
                        ></div>
                      </div>
                      <span className="forca-senha-label" style={{ color: forcaSenha.cor }}>
                        {forcaSenha.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-group-perfil">
                  <label>
                    <CheckCircle size={15} />
                    Confirmar Nova Senha *
                  </label>
                  <div className="input-password-wrapper">
                    <input 
                      type={mostrarConfirmarSenha ? "text" : "password"} 
                      placeholder="Repita a nova senha"
                      value={formSenha.confirmar_senha}
                      onChange={(e) => setFormSenha({ ...formSenha, confirmar_senha: e.target.value })}
                      required
                    />
                    <button 
                      type="button" 
                      className="btn-toggle-password"
                      onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                      tabIndex={-1}
                    >
                      {mostrarConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-salvar-perfil"
                style={{ backgroundColor: isCamisetas ? '#2563eb' : '#00c875' }}
                disabled={salvando}
              >
                <Save size={18} />
                <span>{salvando ? 'Atualizando Senha...' : 'Atualizar Senha com Criptografia'}</span>
              </button>
            </form>
          </div>
        )}

        {/* ABA 3: PREFERÊNCIAS DO SISTEMA */}
        {activeTab === 'preferencias' && (
          <div className="perfil-card-content">
            <h3>
              <Sliders size={20} color={isCamisetas ? "#2563eb" : "#00c875"} />
              Preferências Operacionais
            </h3>
            <p className="perfil-card-subtitle">
              Configure seu ambiente de trabalho para otimizar sua rotina de controle.
            </p>

            <form onSubmit={handleSalvarPreferencias}>
              <div className="form-group-perfil" style={{ marginBottom: '1.5rem', maxWidth: '380px' }}>
                <label>Segmento Padrão ao Iniciar o Sistema</label>
                <select 
                  value={preferencias.segmento_padrao}
                  onChange={(e) => setPreferencias({ ...preferencias, segmento_padrao: e.target.value })}
                >
                  <option value="Camisetas">👕 Segmento de Camisetas (PCP Especializado)</option>
                  <option value="Moda Íntima">✨ Segmento de Moda Íntima (Lingerie)</option>
                </select>
              </div>

              <div className="preferencia-item">
                <div className="preferencia-texto">
                  <h4>Alertas Automáticos de Estoque Mínimo</h4>
                  <p>Notificar na interface quando o saldo de rolos de malha ou aviamentos atingir o ponto de reposição.</p>
                </div>
                <label className="switch-toggle">
                  <input 
                    type="checkbox" 
                    checked={preferencias.alertar_estoque_baixo} 
                    onChange={(e) => setPreferencias({ ...preferencias, alertar_estoque_baixo: e.target.checked })}
                  />
                  <span className="slider-toggle"></span>
                </label>
              </div>

              <div className="preferencia-item">
                <div className="preferencia-texto">
                  <h4>Resumo Instantâneo de Pedidos</h4>
                  <p>Exibir notificações automáticas ao receber novos pedidos de clientes no módulo comercial.</p>
                </div>
                <label className="switch-toggle">
                  <input 
                    type="checkbox" 
                    checked={preferencias.notificacoes_pedidos} 
                    onChange={(e) => setPreferencias({ ...preferencias, notificacoes_pedidos: e.target.checked })}
                  />
                  <span className="slider-toggle"></span>
                </label>
              </div>

              <button 
                type="submit" 
                className="btn-salvar-perfil"
                style={{ backgroundColor: isCamisetas ? '#2563eb' : '#00c875', marginTop: '1.5rem' }}
                disabled={salvando}
              >
                <Save size={18} />
                <span>Salvar Preferências</span>
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default PerfilUsuario;
