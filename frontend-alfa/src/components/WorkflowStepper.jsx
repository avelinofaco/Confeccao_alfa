import React from 'react';
import { CheckCircle2, Circle, ArrowRight, ExternalLink } from 'lucide-react';

/**
 * Componente visual que exibe a esteira produtiva do contexto (Pipeline / Stepper)
 */
export default function WorkflowStepper({ etapas = [], etapaAtualId = null, onSelectEtapa = null }) {
  if (!etapas || etapas.length === 0) {
    return (
      <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
        Nenhuma etapa cadastrada para este fluxo de produção.
      </div>
    );
  }

  // Encontra o índice da etapa atual
  const indexAtual = etapaAtualId 
    ? etapas.findIndex(e => e.id_etapa === etapaAtualId)
    : 0;

  return (
    <div className="workflow-stepper-container" style={{ width: '100%', margin: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: '12px', gap: '8px' }}>
        {etapas.map((etapa, idx) => {
          const isConcluida = indexAtual > idx;
          const isAtual = indexAtual === idx;
          const isFutura = indexAtual < idx;

          return (
            <React.Fragment key={etapa.id_etapa || idx}>
              <div 
                onClick={() => onSelectEtapa && onSelectEtapa(etapa)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: isAtual ? '2px solid #00c875' : '1px solid #e5e7eb',
                  backgroundColor: isAtual ? '#f0fdf4' : isConcluida ? '#f9fafb' : '#ffffff',
                  cursor: onSelectEtapa ? 'pointer' : 'default',
                  flexShrink: 0,
                  transition: 'all 0.2s ease'
                }}
              >
                {isConcluida ? (
                  <CheckCircle2 size={16} color="#00c875" />
                ) : isAtual ? (
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#00c875' }} />
                ) : (
                  <Circle size={14} color="#9ca3af" />
                )}

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: isAtual ? '700' : '500', 
                    color: isAtual ? '#15803d' : isConcluida ? '#374151' : '#6b7280' 
                  }}>
                    {idx + 1}. {etapa.nome_etapa}
                  </span>
                  
                  {etapa.tipo_operacao === 'EXTERNA' && (
                    <span style={{ 
                      fontSize: '10px', 
                      color: '#b45309', 
                      backgroundColor: '#fef3c7', 
                      padding: '1px 6px', 
                      borderRadius: '6px', 
                      width: 'fit-content',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <ExternalLink size={10} /> Terceirizada (Facção)
                    </span>
                  )}
                </div>
              </div>

              {idx < etapas.length - 1 && (
                <ArrowRight size={14} color="#d1d5db" style={{ flexShrink: 0 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
