/** Rendimento em peças por kg ("5.50 peças/kg"), ou "—" sem dados. */
export function formatarRendimento(pecas, pesoKg) {
  const peso = Number(pesoKg);
  if (!pecas || !(peso > 0)) return '—';
  return `${(pecas / peso).toFixed(2)} peças/kg`;
}

/** Primeiro problema que impede abrir a OP (linha incompleta ou cor repetida), ou ''. */
export function problemasDoEnfesto(linhas) {
  const incompleta = linhas.findIndex((l) => !l.id_cor || !l.id_insumo_tecido || !(parseFloat(l.peso_kg) > 0));
  if (incompleta >= 0) return `Complete a linha ${incompleta + 1}: cor, rolo de malha e peso maior que zero.`;
  const cores = linhas.map((l) => String(l.id_cor));
  const repetida = cores.findIndex((cor, indice) => cores.indexOf(cor) !== indice);
  if (repetida >= 0) return `A cor da linha ${repetida + 1} já está em outra linha; junte o peso numa linha só.`;
  return '';
}

/** Rolos cujo saldo não cobre o peso somado das linhas que os usam (uma frase por rolo). */
export function faltasDeMalha(linhas, tecidos) {
  const pesoPorRolo = linhas.reduce((mapa, linha) => {
    if (!linha.id_insumo_tecido) return mapa;
    const chave = String(linha.id_insumo_tecido);
    return { ...mapa, [chave]: (mapa[chave] || 0) + (parseFloat(linha.peso_kg) || 0) };
  }, {});
  return Object.entries(pesoPorRolo)
    .map(([idRolo, peso]) => ({ rolo: tecidos.find((t) => String(t.id_insumo) === idRolo), peso }))
    .filter(({ rolo, peso }) => rolo && peso > parseFloat(rolo.saldo_atual || 0))
    .map(({ rolo, peso }) => `O rolo ${rolo.codigo} tem ${parseFloat(rolo.saldo_atual || 0).toFixed(3)} kg e o enfesto pede ${peso.toFixed(3)} kg.`);
}

/** "Preto: P20 M10 · Branco: G5" a partir dos itens de uma remessa. */
export function resumoPorCor(itens, campo = 'qtd_enviada') {
  const porCor = itens.reduce((mapa, item) => ({
    ...mapa, [item.nome_cor]: [...(mapa[item.nome_cor] || []), `${item.rotulo}${item[campo] ?? 0}`],
  }), {});
  return Object.entries(porCor).map(([cor, partes]) => `${cor}: ${partes.join(' ')}`).join(' · ');
}
