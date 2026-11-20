import { Plus, Trash2, X } from 'lucide-react';
import { useToast } from '../feedback/useToast';
import { chaveCelula } from '../../utils/grade';
import {
  LINHA_QTD,
  POSICOES_ESTAMPA,
  colunasDoModelo,
  itemVazio,
  precoUnitarioDoItem,
  subtotalDoItem,
  temArteNoItem,
  totalCalculadoDosItens,
  totalDoItem,
} from '../../utils/pedidoItens';
import '../cadastros/cadastros.css';
import './pedidos.css';

const LIMITE_BYTES = 2 * 1024 * 1024; // 2 MB
const formatarMoeda = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

/** Silhueta de camiseta com ícone de quadro no peito, idêntica ao modelo visual. */
function IconeCamisetaArte() {
  return (
    <svg
      className="item-pedido-camiseta-svg"
      viewBox="0 0 120 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M38 14C44 20 51 23 60 23C69 23 76 20 82 14L108 28L96 50L82 43V96H38V43L24 50L12 28L38 14Z"
        stroke="#c5bdb0"
        strokeWidth="2.2"
        strokeLinejoin="round"
        fill="#f9f7f2"
      />
      <path
        d="M44 15C49 24 71 24 76 15"
        stroke="#c5bdb0"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="46" y="40" width="28" height="22" rx="3" stroke="#2c2523" strokeWidth="2" fill="#ffffff" />
      <circle cx="53" cy="47" r="2.2" fill="#2c2523" />
      <path d="M48 59L56 51L62 56L67 52L72 59" stroke="#2c2523" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Grade de itens do pedido em 4 colunas (grid-cols-4):
 * - Card do Item: topo com upload/pré-visualização da imagem, controles compactos de modelo/cor,
 *   seguido pela barra de tamanhos (P, M, G, GG) e campos de quantidade logo abaixo.
 * - Botão + Adicionar item posicionado imediatamente à direita do último card ativo.
 */
export function ItensPedidoEditor({ itens, onChange, modelos, cores, estampas = [], idPrefixo }) {
  const toast = useToast();

  const alterar = (chave, mudancas) =>
    onChange(itens.map((item) => (item.chave === chave ? { ...item, ...mudancas } : item)));

  const adicionar = () => {
    const proxima = Math.max(0, ...itens.map((item) => item.chave)) + 1;
    const ultimo = itens.at(-1);
    const idModeloPadrao = ultimo?.id_modelo || (modelos[0] ? String(modelos[0].id_modelo) : '');
    const idCorPadrao = ultimo?.id_cor || (cores[0] ? String(cores[0].id_cor) : '');
    onChange([...itens, itemVazio(proxima, idModeloPadrao, idCorPadrao)]);
  };

  const processarArquivoImagem = (arquivo, callback) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const dataUrl = leitor.result;
      if (typeof dataUrl !== 'string') return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let largura = img.width;
        let altura = img.height;
        let precisaCanvas = false;

        if (largura > maxDim || altura > maxDim) {
          if (largura > altura) {
            altura = Math.round((altura * maxDim) / largura);
            largura = maxDim;
          } else {
            largura = Math.round((largura * maxDim) / altura);
            altura = maxDim;
          }
          precisaCanvas = true;
        }

        const tiposValidos = ['image/png', 'image/jpeg', 'image/webp'];
        if (precisaCanvas || !tiposValidos.includes(arquivo.type)) {
          const canvas = document.createElement('canvas');
          canvas.width = largura;
          canvas.height = altura;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, largura, altura);
          const formato = arquivo.type === 'image/png' ? 'image/png' : 'image/jpeg';
          callback(canvas.toDataURL(formato, 0.88));
        } else {
          callback(dataUrl);
        }
      };
      img.onerror = () => callback(dataUrl);
      img.src = dataUrl;
    };
    leitor.readAsDataURL(arquivo);
  };

  const aoEscolherImagemNoCard = (chave, e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    if (arquivo.type && !arquivo.type.startsWith('image/')) {
      toast.aviso('Escolha um arquivo de imagem válido.');
      e.target.value = '';
      return;
    }

    processarArquivoImagem(arquivo, (resultado) => {
      alterar(chave, {
        id_estampa: '',
        imagem_estampa_url: '',
        imagem_data_url: resultado,
        nome_estampa_nova: arquivo.name.replace(/\.[^.]+$/, ''),
      });
      toast.sucesso('Imagem da blusa carregada com sucesso.');
    });
  };

  const totalGeral = itens.reduce((total, item) => total + totalDoItem(item), 0);
  const valorCalculado = totalCalculadoDosItens(itens, modelos);

  return (
    <fieldset className="itens-pedido">
      <legend>
        Itens do pedido <span className="total-grade-badge">Total: {totalGeral} peças</span>
        {valorCalculado > 0 && (
          <span className="total-grade-badge">Tabela: {formatarMoeda(valorCalculado)}</span>
        )}
      </legend>

      <div className="itens-pedido-grade">
        {itens.map((item, indice) => {
          const modelo = modelos.find((m) => String(m.id_modelo) === String(item.id_modelo));
          const cor = cores.find((c) => String(c.id_cor) === String(item.id_cor));
          const estampaCatalogo = estampas.find((est) => String(est.id_estampa) === String(item.id_estampa));
          const previaUrl = item.imagem_data_url || item.imagem_estampa_url || estampaCatalogo?.imagem_data_url || '';
          const colunas = colunasDoModelo(modelo);
          const id = `${idPrefixo || 'item'}-${item.chave}`;
          const precoUnit = precoUnitarioDoItem(item, modelos);
          const subtotal = subtotalDoItem(item, modelos);

          return (
            <div key={item.chave} className="item-pedido-card">
              {itens.length > 1 && (
                <button
                  type="button"
                  className="item-pedido-remover-btn"
                  aria-label={`Remover item ${indice + 1}`}
                  title={`Remover item ${indice + 1}`}
                  onClick={() => onChange(itens.filter((i) => i.chave !== item.chave))}
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Área superior dedicada ao upload / pré-visualização da imagem */}
              <div className="item-pedido-arte-wrapper">
                <label
                  htmlFor={`${id}-arquivo`}
                  className={`item-pedido-arte-box ${previaUrl ? 'tem-imagem' : ''}`}
                  title={previaUrl ? 'Clique para trocar a imagem da blusa' : 'Clique para adicionar a imagem da blusa'}
                >
                  {previaUrl ? (
                    <>
                      <img
                        src={previaUrl}
                        alt={estampaCatalogo?.nome || item.nome_estampa_nova || `Estampa do item ${indice + 1}`}
                        className="item-pedido-arte-img"
                      />
                      <span className="item-pedido-arte-hover-overlay">
                        <span>Trocar imagem</span>
                      </span>
                    </>
                  ) : (
                    <span className="item-pedido-arte-vazia">
                      <IconeCamisetaArte />
                      <span>Adicionar imagem</span>
                    </span>
                  )}
                </label>
                <input
                  id={`${id}-arquivo`}
                  type="file"
                  accept="image/*"
                  className="painel-estampa-input-oculto"
                  onClick={(e) => { e.target.value = ''; }}
                  onChange={(e) => aoEscolherImagemNoCard(item.chave, e)}
                />
                {previaUrl && (
                  <button
                    type="button"
                    className="item-pedido-limpar-arte"
                    title="Remover imagem deste item (deixar camiseta lisa)"
                    aria-label={`Remover imagem do item ${indice + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      alterar(item.chave, { id_estampa: '', imagem_data_url: '', imagem_estampa_url: '', nome_estampa_nova: '' });
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Seletores enxutos de Modelo, Cor e Estampa/Posição */}
              <div className="item-pedido-seletores-compactos">
                <select
                  id={`${id}-modelo`}
                  aria-label={`Modelo do item ${indice + 1}`}
                  value={item.id_modelo}
                  onChange={(e) => alterar(item.chave, { id_modelo: e.target.value, valores: {} })}
                >
                  <option value="">Modelo…</option>
                  {modelos.map((m) => (
                    <option key={m.id_modelo} value={m.id_modelo}>
                      {m.nome_modelo}
                    </option>
                  ))}
                </select>

                <div className="item-pedido-cor-select-box">
                  {cor?.hex && (
                    <span
                      className="item-pedido-cor-bolinha"
                      style={{ background: cor.hex }}
                      aria-hidden="true"
                    />
                  )}
                  <select
                    id={`${id}-cor`}
                    aria-label={`Cor do item ${indice + 1}`}
                    value={item.id_cor}
                    onChange={(e) => alterar(item.chave, { id_cor: e.target.value })}
                  >
                    <option value="">Cor…</option>
                    {cores.map((c) => (
                      <option key={c.id_cor} value={c.id_cor}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {estampas.length > 0 && (
                  <select
                    id={`${id}-estampa`}
                    aria-label={`Estampa do catálogo para o item ${indice + 1}`}
                    value={item.id_estampa || ''}
                    onChange={(e) => {
                      const estEscolhida = estampas.find((est) => String(est.id_estampa) === String(e.target.value));
                      alterar(item.chave, {
                        id_estampa: e.target.value,
                        imagem_estampa_url: estEscolhida?.imagem_data_url || '',
                        imagem_data_url: '',
                        nome_estampa_nova: '',
                      });
                    }}
                  >
                    <option value="">
                      {item.imagem_data_url ? `Upload: ${item.nome_estampa_nova || 'Nova arte'}` : (item.imagem_estampa_url ? 'Imagem personalizada' : 'Lisa / Catálogo…')}
                    </option>
                    {estampas.map((est) => (
                      <option key={est.id_estampa} value={est.id_estampa}>
                        [{est.codigo}] {est.nome}
                      </option>
                    ))}
                  </select>
                )}

                {temArteNoItem(item) && (
                  <select
                    id={`${id}-posicao`}
                    aria-label={`Posição da estampa do item ${indice + 1}`}
                    value={item.posicao_estampa || 'Frente'}
                    onChange={(e) => alterar(item.chave, { posicao_estampa: e.target.value })}
                  >
                    {POSICOES_ESTAMPA.map((pos) => (
                      <option key={pos} value={pos}>
                        Posição: {pos}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* FINAL DO CARD: APENAS A GRADE DE TAMANHOS E QUANTIDADES (OU AVISO SE NÃO HOUVER GRADE) */}
              <div className="item-pedido-rodape-card">
                {!modelo ? (
                  <p className="painel-cadastro-vazio" style={{ margin: '0.4rem 0 0', fontSize: '0.78rem' }}>
                    Selecione o modelo acima.
                  </p>
                ) : colunas.length === 0 ? (
                  <p className="painel-cadastro-vazio" style={{ margin: '0.4rem 0 0', fontSize: '0.78rem' }}>
                    Esse modelo ainda não possui grade cadastrada.
                  </p>
                ) : (
                  <div className="item-pedido-tamanhos-bloco" role="group" aria-label={`Quantidades do item ${indice + 1}`}>
                    <div
                      className="item-pedido-tamanhos-barra"
                      style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}
                    >
                      {colunas.map((col) => (
                        <span key={col.id} className="item-pedido-tam-rotulo">{col.rotulo}</span>
                      ))}
                    </div>
                    <div
                      className="item-pedido-tamanhos-campos"
                      style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}
                    >
                      {colunas.map((col) => {
                        const celula = chaveCelula(LINHA_QTD, col.id);
                        const valorAtual = item.valores[celula];
                        const valorExibido = valorAtual !== undefined && valorAtual !== '' ? valorAtual : 0;

                        return (
                          <input
                            key={col.id}
                            id={`${id}-${celula}`}
                            type="number"
                            min="0"
                            inputMode="numeric"
                            aria-label={`Item ${indice + 1}, quantidade para tamanho ${col.rotulo}`}
                            className="item-pedido-qtd-input grade-qtd-campo"
                            value={valorExibido}
                            onFocus={(e) => {
                              if (e.target.value === '0') {
                                e.target.select();
                              }
                            }}
                            onChange={(e) => {
                              const digito = e.target.value;
                              const val = digito === '' ? 0 : Math.max(0, parseInt(digito, 10) || 0);
                              alterar(item.chave, { valores: { ...item.valores, [celula]: val } });
                            }}
                          />
                        );
                      })}
                    </div>
                    {precoUnit > 0 && (
                      <div className="item-pedido-preco-rodape">
                        <span>{formatarMoeda(precoUnit)}/un</span>
                        <strong>{formatarMoeda(subtotal)}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

              {/* Botão + ao lado do último card ativo */}
              <button
                type="button"
                className="item-pedido-card-adicionar"
                onClick={adicionar}
              >
                <Plus size={28} strokeWidth={2} aria-hidden="true" />
                <span>Adicionar item</span>
              </button>
            </div>
    </fieldset>
  );
}
