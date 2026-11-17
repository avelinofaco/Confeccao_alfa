import React from 'react';

/**
 * Componente genérico para renderização de formulários baseados em Schema JSON
 * Suporta: text, number, select, textarea, checkbox
 */
export default function DynamicFormRenderer({ schema = [], values = {}, onChange, disabled = false }) {
  if (!schema || schema.length === 0) {
    return null;
  }

  return (
    <div className="dynamic-form-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', margin: '12px 0' }}>
      {schema.map((campo) => {
        const valorAtual = values[campo.nome] ?? campo.default ?? '';

        return (
          <div key={campo.nome} className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {campo.label}
              {campo.required && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>*</span>}
            </label>

            {campo.tipo === 'select' ? (
              <select
                disabled={disabled}
                value={valorAtual}
                onChange={(e) => onChange(campo.nome, e.target.value)}
                required={campo.required}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              >
                <option value="">Selecione uma opção...</option>
                {campo.opcoes?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : campo.tipo === 'textarea' ? (
              <textarea
                disabled={disabled}
                value={valorAtual}
                placeholder={campo.placeholder || ''}
                onChange={(e) => onChange(campo.nome, e.target.value)}
                required={campo.required}
                rows={3}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            ) : (
              <input
                disabled={disabled}
                type={campo.tipo || 'text'}
                value={valorAtual}
                placeholder={campo.placeholder || ''}
                onChange={(e) => onChange(campo.nome, e.target.value)}
                required={campo.required}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            )}

            {campo.descricao && (
              <small style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                {campo.descricao}
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}
