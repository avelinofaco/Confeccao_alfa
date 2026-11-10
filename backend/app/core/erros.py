# app/core/erros.py
"""Erro de regra de negócio levantado pelos serviços e convertido em resposta HTTP."""


class ErroNegocio(Exception):
    def __init__(self, status_code: int, mensagem: str):
        super().__init__(mensagem)
        self.status_code = status_code
        self.mensagem = mensagem
