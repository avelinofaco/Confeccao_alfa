import React, { useState } from 'react';
import { Scissors } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

function Login() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      // O FastAPI padrão (OAuth2) exige que o login seja enviado como Form Data
      // e que os campos se chamem "username" e "password"
      const formData = new URLSearchParams();
      formData.append('username', login); 
      formData.append('password', senha);

      // ATENÇÃO: Ajuste a rota '/login' para o endpoint exato que está no seu FastAPI
      const response = await api.post('/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      // Se deu certo, o FastAPI devolve um token. Vamos salvar no navegador!
      const token = response.data.access_token;
      localStorage.setItem('token_confeccao', token);

      // Redireciona para a tela de decisão de segmento (Camisetas ou Moda Íntima)
      navigate('/selecao-segmento'); 

    } catch (error) {
      console.error("Erro no login:", error);
      if (error.message === 'Network Error' || !error.response) {
        alert('Não foi possível conectar ao servidor (Erro de Conexão).\n\n• Se estiver usando a nuvem (Render), o servidor gratuito pode estar acordando (aguarde cerca de 1 minuto e tente novamente).\n• Para acesso imediato, utilize o ambiente local em: http://localhost:5173');
      } else {
        alert(error.response?.data?.detail || 'Credenciais inválidas ou erro no servidor. Verifique os dados digitados.');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="logo-box">
          <Scissors className="logo-icon" strokeWidth={1.5} />
        </div>
        <h1>Bem-vindo à Confecção Alfa</h1>
      </div>

      <div className="login-card">
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label>Login</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Digite seu e-mail ou CPF"
              required
            />
          </div>

          <div className="input-group">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              required
            />
            <div className="forgot-password">
              <a href="#">Esqueceu a senha?</a>
            </div>
          </div>

          <button type="submit" className="login-button">
            Entrar
          </button>
        </form>

        <div className="register-link-container">
          <span>Não tem uma conta? </span>
          <Link to="/cadastro" className="register-link">Cadastre-se</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;