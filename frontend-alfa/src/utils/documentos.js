/** Remove tudo que não for dígito. */
export const somenteDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

/** 52998224725 → 529.982.247-25 · 11222333000181 → 11.222.333/0001-81 (outros valores ficam como estão). */
export function formatarDocumento(valor) {
  const d = somenteDigitos(valor);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return valor ?? '';
}

/** 85999990000 → (85) 9 9999-0000 · 8533334444 → (85) 3333-4444. */
export function formatarTelefone(valor) {
  const d = somenteDigitos(valor);
  if (d.length === 11) return d.replace(/(\d{2})(\d)(\d{4})(\d{4})/, '($1) $2 $3-$4');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return valor ?? '';
}
