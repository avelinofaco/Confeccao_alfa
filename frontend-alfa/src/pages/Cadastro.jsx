import React, { useState } from 'react';
import { Scissors } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../components/feedback/useToast';

function Cadastro() {
  // Ajustando os estados para refletir o backend
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleCadastro = async (e) => {
    e.preventDefault();
    
    const loginFormatado = login.trim();
    const nomeFormatado = nomeUsuario.trim();

    if (!loginFormatado || !nomeFormatado || !senha) {
      toast.aviso('Preencha todos os campos obrigatórios.');
      return;
    }

    if (senha.length < 6) {
      toast.aviso('A senha precisa de pelo menos 6 caracteres.');
      return;
    }

    try {
      setCarregando(true);
      // Montando o payload exatamente como o FastAPI espera com perfil padrão "Gestor"
      const payload = {
        login: loginFormatado,
        nome_usuario: nomeFormatado,
        perfil: 'Gestor',
        ativo: true,
        senha: senha
      };

      await api.post('/usuarios/', payload);

      toast.sucesso(`Usuário ${nomeFormatado} cadastrado com sucesso! Faça login para continuar.`);
      navigate('/'); // Redireciona para o login

    } catch (error) {
      console.error("Erro no cadastro:", error);
      
      const detalhe = error.response?.data?.detail;
      let mensagemErro = 'Erro ao realizar cadastro. Verifique os dados digitados.';
      
      if (typeof detalhe === 'string') {
        mensagemErro = detalhe;
      } else if (Array.isArray(detalhe)) {
        // Erro 422 de validação do Pydantic
        mensagemErro = detalhe.map(err => {
          const campo = err.loc ? err.loc[err.loc.length - 1] : 'Campo';
          return `${campo}: ${err.msg}`;
        }).join('\n');
      }

      toast.erro(mensagemErro);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="logo-box">
          <Scissors className="logo-icon" strokeWidth={1.5} />
        </div>
        <h1>Cadastrar novo usuário</h1>
      </div>

      <div className="login-card">
        <form onSubmit={handleCadastro} className="login-form">
          
          <div className="input-group">
            <label>Nome Completo</label>
            <input
              type="text"
              value={nomeUsuario}
              onChange={(e) => setNomeUsuario(e.target.value)}
              placeholder="Digite seu nome"
              required
            />
          </div>

          <div className="input-group">
            <label>Login (E-mail ou CPF)</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Como deseja acessar?"
              required
            />
          </div>

          <div className="input-group">
            <label>Senha (mínimo 6 caracteres)</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Crie uma senha (mínimo 6 caracteres)"
              minLength={6}
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={carregando}>
            {carregando ? 'Cadastrando...' : 'Finalizar Cadastro'}
          </button>
        </form>

        <div className="register-link-container">
          <span>Já possui uma conta? </span>
          <Link to="/" className="register-link">Fazer Login</Link>
        </div>
      </div>
    </div>
  );
}

export default Cadastro;