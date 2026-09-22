# app/routers/equipe.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List

from app.database import get_db
from app.models import equipe as models_equipe
from app.schemas import equipe as schemas

router = APIRouter(prefix="/equipe", tags=["Equipe e RH"])

@router.post("/colaboradores", response_model=schemas.ColaboradorResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_colaborador(colaborador: schemas.ColaboradorCreate, db: Session = Depends(get_db)):
    """Cadastra um novo membro na equipe."""
    novo_colaborador = models_equipe.Colaborador(**colaborador.model_dump())
    db.add(novo_colaborador)
    db.commit()
    db.refresh(novo_colaborador)
    return novo_colaborador

@router.get("/colaboradores", response_model=List[schemas.ColaboradorResponse])
def listar_colaboradores(db: Session = Depends(get_db)):
    """Lista todos os colaboradores cadastrados."""
    return db.query(models_equipe.Colaborador).all()

@router.post("/presencas/lote", response_model=List[schemas.PresencaResponse])
def salvar_presencas_diarias(presencas: List[schemas.PresencaCreate], db: Session = Depends(get_db)):
    """
    Salva a chamada do dia para vários colaboradores.
    Se a presença já existir para o dia, ele atualiza (corrige). Se não existir, ele cria.
    """
    registros_salvos = []
    
    for p in presencas:
        # Verifica se o colaborador existe
        colaborador = db.query(models_equipe.Colaborador).filter(models_equipe.Colaborador.id_colaborador == p.id_colaborador).first()
        if not colaborador:
            raise HTTPException(status_code=404, detail=f"Colaborador ID {p.id_colaborador} não encontrado.")

        # Busca se já tem registro de presença para essa pessoa neste dia
        registro_existente = db.query(models_equipe.PresencaEquipe).filter(
            models_equipe.PresencaEquipe.id_colaborador == p.id_colaborador,
            models_equipe.PresencaEquipe.data_referencia == p.data_referencia
        ).first()

        if registro_existente:
            # Se já existe, apenas atualiza (caso a gestora tenha corrigido a chamada)
            registro_existente.presente = p.presente
            registros_salvos.append(registro_existente)
        else:
            # Se não existe, cria um novo
            nova_presenca = models_equipe.PresencaEquipe(**p.model_dump())
            db.add(nova_presenca)
            registros_salvos.append(nova_presenca)

    db.commit()
    
    # Faz o refresh de todos os itens para retornar os dados atualizados com os IDs
    for registro in registros_salvos:
        db.refresh(registro)
        
    return registros_salvos

@router.get("/presencas/resumo", response_model=List[schemas.ResumoMensalResponse])
def resumo_mensal_presencas(mes: str, db: Session = Depends(get_db)):
    """
    Retorna o total de presenças e faltas de cada colaborador ativo para um mês específico.
    Formato esperado do parâmetro 'mes': 'YYYY-MM' (ex: '2026-08')
    """
    # 1. Valida e separa o ano e o mês
    try:
        ano, mes_num = map(int, mes.split('-'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de mês inválido. Use YYYY-MM.")

    # 2. Busca todos os colaboradores ativos
    colaboradores = db.query(models_equipe.Colaborador).filter(models_equipe.Colaborador.ativo == True).all()
    
    resumo = []
    
    # 3. Calcula o total de presenças e faltas de cada um no mês filtrado
    for colab in colaboradores:
        registros = db.query(models_equipe.PresencaEquipe).filter(
            models_equipe.PresencaEquipe.id_colaborador == colab.id_colaborador,
            extract('year', models_equipe.PresencaEquipe.data_referencia) == ano,
            extract('month', models_equipe.PresencaEquipe.data_referencia) == mes_num
        ).all()

        presencas = sum(1 for r in registros if r.presente)
        faltas = sum(1 for r in registros if not r.presente)

        resumo.append({
            "nome": colab.nome_completo,
            "presencas": presencas,
            "faltas": faltas
        })

    return resumo