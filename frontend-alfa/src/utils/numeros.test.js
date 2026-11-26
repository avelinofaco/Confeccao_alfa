/**
 * Testes do formatador de números. Rode com `npm test`.
 *
 * Usa o runner embutido do Node (`node:test`), sem dependência nova no projeto.
 *
 * O caso que originou este módulo está no primeiro teste: o peso de malha saía como
 * "20.000 kg" na listagem de Corte e Rendimento, que em pt-BR se lê como vinte mil quilos.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatarMoeda,
  formatarNumero,
  formatarPecas,
  formatarPecasPorKg,
  formatarPercentual,
  formatarPeso,
  formatarPesoCurto,
  formatarQuantidade,
  paraCampoNumerico,
  siglaUnidade,
} from './numeros.js';

describe('formatarPeso', () => {
  it('usa vírgula decimal: 20 kg nunca sai como "20.000 kg"', () => {
    assert.equal(formatarPeso(20), '20,000 kg');
    assert.doesNotMatch(formatarPeso(20), /20\.000/);
  });

  it('aceita a string que a API devolve para um Numeric(10,3)', () => {
    assert.equal(formatarPeso('20.000'), '20,000 kg');
    assert.equal(formatarPeso('58.027'), '58,027 kg');
  });

  it('separa o milhar com ponto e os decimais com vírgula', () => {
    assert.equal(formatarPeso(1250.5), '1.250,500 kg');
  });

  it('trata ausência de valor como zero em vez de quebrar', () => {
    assert.equal(formatarPeso(0), '0,000 kg');
    assert.equal(formatarPeso(null), '0,000 kg');
    assert.equal(formatarPeso(undefined), '0,000 kg');
  });
});

describe('formatarPesoCurto', () => {
  it('corta as casas que não interessam num KPI', () => {
    assert.equal(formatarPesoCurto(20), '20,0 kg');
    assert.equal(formatarPesoCurto(58.027), '58,03 kg');
    assert.equal(formatarPesoCurto(1250.5), '1.250,5 kg');
  });
});

describe('siglaUnidade', () => {
  it('encurta as três unidades que o backend documenta', () => {
    assert.equal(siglaUnidade('kg'), 'kg');
    assert.equal(siglaUnidade('unidades'), 'un');
    assert.equal(siglaUnidade('metros'), 'm');
  });

  it('metros não viram unidade', () => {
    assert.notEqual(siglaUnidade('metros'), 'un');
  });

  it('não depende de caixa nem de espaço em volta', () => {
    assert.equal(siglaUnidade(' KG '), 'kg');
    assert.equal(siglaUnidade('Unidade'), 'un');
  });

  it('devolve unidade desconhecida como veio, sem perder informação', () => {
    assert.equal(siglaUnidade('rolos'), 'rolos');
  });

  it('vazio não inventa unidade', () => {
    assert.equal(siglaUnidade(null), '');
    assert.equal(siglaUnidade(''), '');
  });
});

describe('formatarQuantidade', () => {
  it('mostra a unidade cadastrada do insumo, sempre na mesma sigla', () => {
    assert.equal(formatarQuantidade(472.5, 'unidades'), '472,5 un');
    assert.equal(formatarQuantidade(58.027, 'kg'), '58,027 kg');
    assert.equal(formatarQuantidade(12, 'metros'), '12 m');
  });

  it('omite a unidade quando ela não vem', () => {
    assert.equal(formatarQuantidade(5, null), '5');
    assert.equal(formatarQuantidade(5, ''), '5');
  });

  it('não força casas decimais em valor inteiro', () => {
    assert.equal(formatarQuantidade(150, 'kg'), '150 kg');
  });
});

describe('formatarPecas', () => {
  it('peças são inteiras e levam separador de milhar', () => {
    assert.equal(formatarPecas(1250), '1.250 un.');
    assert.equal(formatarPecas(300), '300 un.');
    assert.equal(formatarPecas(0), '0 un.');
  });

  it('arredonda fração em vez de exibir casas decimais', () => {
    assert.equal(formatarPecas(99.6), '100 un.');
  });
});

describe('formatarPecasPorKg', () => {
  it('rendimento do enfesto com duas casas e vírgula', () => {
    assert.equal(formatarPecasPorKg(5.1724), '5,17 peças/kg');
    assert.equal(formatarPecasPorKg(5), '5,00 peças/kg');
  });
});

describe('formatarPercentual', () => {
  it('usa vírgula e já traz o sinal', () => {
    assert.equal(formatarPercentual(12.34), '12,3%');
    assert.equal(formatarPercentual(0), '0,0%');
  });

  it('aceita outra quantidade de casas', () => {
    assert.equal(formatarPercentual(3, 2), '3,00%');
  });
});

describe('formatarMoeda', () => {
  // O Intl separa o símbolo com espaço não separável (U+00A0), e o caractere exato já
  // mudou entre versões do ICU. O que importa é o número, não qual espaço o ICU usou.
  const comEspacoSimples = (texto) => texto.replace(/\s/g, ' ');

  it('formata em reais', () => {
    assert.equal(comEspacoSimples(formatarMoeda(1250.5)), 'R$ 1.250,50');
    assert.equal(comEspacoSimples(formatarMoeda(null)), 'R$ 0,00');
  });
});

describe('paraCampoNumerico', () => {
  it('usa ponto decimal, porque alimenta input e corpo de requisição', () => {
    assert.equal(paraCampoNumerico(1250.5), '1250.50');
    assert.equal(paraCampoNumerico(20, 3), '20.000');
    assert.equal(paraCampoNumerico(null), '0.00');
  });

  it('não insere separador de milhar, que invalidaria o campo', () => {
    assert.doesNotMatch(paraCampoNumerico(1250.5), /,/);
  });
});

describe('formatarNumero', () => {
  it('não deixa o mínimo de casas passar do máximo', () => {
    assert.equal(formatarNumero(1.5, { min: 3, max: 1 }), '1,500');
  });

  it('texto não numérico vira zero em vez de "NaN" na tela', () => {
    assert.equal(formatarNumero('abc'), '0');
    assert.equal(formatarNumero(''), '0');
  });
});
