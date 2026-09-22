import React, { useState } from 'react';
import { Scissors } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

function Cadastro() {
  // Ajustando os estados para refletir o backend
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [login, setLogin] = useState('');
  const [perfil, setPerfil] = useState('Gestor');
  const [senha, setSenha] = useState('');
  
  const navigate = useNavigate();

  const handleCadastro = async (e) => {
    e.preventDefault();
    
    try {
      // Montando o "pacote" exatamente como o FastAPI espera
      const payload = {
        login: login,
        nome_usuario: nomeUsuario,
        perfil: perfil,
        ativo: true, // Enviando 'true' por padrão, conforme o seu modelo
        senha: senha
      };

      const response = await api.post('/usuarios/', payload);

      alert('Cadastro realizado com sucesso!');
      navigate('/'); // Redireciona para o Login

    } catch (error) {
      console.error("Erro no cadastro:", error);
      alert('Erro ao realizar cadastro. Verifique o console.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="logo-box">
          <Scissors className="logo-icon" strokeWidth={1.5} />
        </div>
        <h1>Criar nova conta</h1>
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

          {/* Novo campo para escolher o Perfil */}
          <div className="input-group">
            <label>Perfil</label>
            <select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value)}
              required
            >
              <option value="Gestor">Gestor</option>
              <option value="Operador">Operador</option>
            </select>
          </div>

          <div className="input-group">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Crie uma senha"
              required
            />
          </div>

          <button type="submit" className="login-button">
            Finalizar Cadastro
          </button>
        </form>

        <div className="register-link-container">
          <span>Já possui uma conta? </span>
          <Link to="/" className="register-link">Voltar para o Login</Link>
        </div>
      </div>
    </div>
  );
}

export default Cadastro;