# app/core/erros.py
"""Erro de regra de negócio levantado pelos serviços e convertido em resposta HTTP."""
from typing import Optional


class ErroNegocio(Exception):
    def __init__(self, status_code: int, mensagem: str, dados: Optional[dict] = None):
        super().__init__(mensagem)
        self.status_code = status_code
        self.mensagem = mensagem
        self.dados = dados

    def detalhe(self):
        """Texto simples; com dados extras (ex.: lista de faltas), {mensagem, ...dados}."""
        if not self.dados:
            return self.mensagem
        return {"mensagem": self.mensagem, **self.dados}
