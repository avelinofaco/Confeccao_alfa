# app/core/config.py
"""Constantes de configuração da aplicação."""
from zoneinfo import ZoneInfo

# Fuso do negócio: define "hoje" e os limites de cada mês no financeiro.
FUSO_HORARIO = ZoneInfo("America/Fortaleza")
