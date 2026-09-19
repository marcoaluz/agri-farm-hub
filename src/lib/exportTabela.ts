import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

export type Coluna = { header: string; key: string; width?: number }

const hoje = () => format(new Date(), 'yyyy-MM-dd')

// Converte a logo (arquivo público) em base64 uma vez, e reaproveita.
let logoBase64Cache: string | null = null
async function getLogoBase64(): Promise<string | null> {
  if (logoBase64Cache) return logoBase64Cache
  try {
    const res = await fetch('/logo-icon.png')
    const blob = await res.blob()
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    logoBase64Cache = base64
    return base64
  } catch {
    return null
  }
}

export function exportarExcel(opts: {
  nomeArquivo: string
  nomeAba: string
  colunas: Coluna[]
  linhas: any[]
  propriedadeNome?: string
  safraNome?: string
  resumoFiltros?: string
}) {
  const { nomeArquivo, nomeAba, colunas, linhas, propriedadeNome, safraNome, resumoFiltros } = opts
  const aoa: any[][] = []

  aoa.push(['Agro GFI'])
  aoa.push([`Relatório: ${nomeAba}`])
  if (propriedadeNome) aoa.push([`Propriedade: ${propriedadeNome}`])
  if (safraNome) aoa.push([`Safra: ${safraNome}`])
  if (resumoFiltros) aoa.push([`Mostrando: ${resumoFiltros}`])
  aoa.push([`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`])
  aoa.push([])
  aoa.push(colunas.map((c) => c.header))

  linhas.forEach((row) => {
    aoa.push(colunas.map((c) => row[c.key] ?? ''))
  })

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = colunas.map((c) => ({ wch: c.width ?? 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, nomeAba.substring(0, 28))
  XLSX.writeFile(wb, `${nomeArquivo}-${hoje()}.xlsx`)
}

export async function exportarPDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  nomeAba: string
  colunas: Coluna[]
  linhas: any[]
  safraNome?: string
}) {
  const { nomeArquivo, propriedadeNome, nomeAba, colunas, linhas, safraNome } = opts
  const doc = new jsPDF({ orientation: 'landscape' })
  const dataAtual = format(new Date(), 'dd/MM/yyyy HH:mm')

  const logo = await getLogoBase64()
  let textX = 14
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 14, 8, 12, 12)
      textX = 30
    } catch {
      // se a imagem falhar por qualquer motivo, segue só com texto
    }
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Agro GFI', textX, 14)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Relatório: ${nomeAba}`, textX, 20)

  doc.setFontSize(10)
  doc.text(`Propriedade: ${propriedadeNome}`, 14, 30)
  if (safraNome) doc.text(`Safra: ${safraNome}`, 14, 36)
  doc.text(`Gerado em: ${dataAtual}`, 14, safraNome ? 42 : 36)

  autoTable(doc, {
    startY: safraNome ? 48 : 42,
    head: [colunas.map((c) => c.header)],
    body: linhas.map((row) => colunas.map((c) => String(row[c.key] ?? ''))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      if (logo) {
        try {
          const pageWidth = doc.internal.pageSize.getWidth()
          const pageHeight = doc.internal.pageSize.getHeight()
          const tamanho = 90
          doc.saveGraphicsState()
          // @ts-ignore - GState existe em runtime no jsPDF, só falta no tipo
          doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
          doc.addImage(
            logo, 'PNG',
            (pageWidth - tamanho) / 2,
            (pageHeight - tamanho) / 2,
            tamanho, tamanho
          )
          doc.restoreGraphicsState()
        } catch {
          // se a marca d'água falhar, não impede o resto do PDF
        }
      }
    },
  })

  doc.save(`${nomeArquivo}-${hoje()}.pdf`)
}

export async function exportarCustosDetalhadosPDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  safraNome?: string
  resumoFiltros?: string
  porTalhao: { talhao_nome: string; subtotal: number; operacional: { grupo: string; subtotal: number; itens: { nome: string; vezes?: number; valor: number }[] }[] }[]
  financeiro: { grupo: string; subtotal: number; itens: { nome: string; valor: number; tipo?: string }[] }[]
  totalOperacional: number
  totalDespesas: number
  totalReceitas: number
}) {
  const { nomeArquivo, propriedadeNome, safraNome, resumoFiltros, porTalhao, financeiro, totalOperacional, totalDespesas, totalReceitas } = opts
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = 14

  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Remove sufixo entre parênteses do fim da unidade (ex: "Sacas (60kg)" -> "Sacas")
  const unidadeCurta = (unidade?: string) => (unidade || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

  // Formata só a coluna de Quantidade de um item Operacional, de acordo com o tipo.
  // item.vezes continua vindo do RPC normalmente, só não é mais desenhado no PDF.
  const formatarQtdeOperacional = (item: any): string => {
    const qtd = item.quantidade != null ? fmt2(Number(item.quantidade)) : null
    const un = unidadeCurta(item.unidade)
    switch (item.tipo_ref) {
      case 'produto':
        return qtd != null ? `${qtd} (${un})` : '-'
      case 'maquina':
      case 'servico_simples':
        return qtd != null ? `${qtd}(${un})` : '-'
      case 'abastecimento':
        return qtd != null ? `(${qtd} ${un})` : '-'
      case 'manutencao':
        return qtd != null ? qtd : '-'
      default:
        return qtd != null ? `${qtd}${un ? ` (${un})` : ''}` : '-'
    }
  }

  const COR_TEXTO = 55 as const
  const COR_RECEITA: [number, number, number] = [21, 101, 52]
  const COR_DESPESA: [number, number, number] = [180, 30, 30]

  const logo = await getLogoBase64()
  const desenharMarcaDagua = () => {
    if (!logo) return
    try {
      const tamanho = 90
      doc.saveGraphicsState()
      // @ts-ignore
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
      doc.addImage(logo, 'PNG', (pageWidth - tamanho) / 2, (pageHeight - tamanho) / 2, tamanho, tamanho)
      doc.restoreGraphicsState()
    } catch {}
  }

  const novaPaginaSeNecessario = (alturaNecessaria: number) => {
    if (y + alturaNecessaria > pageHeight - 20) {
      doc.addPage()
      desenharMarcaDagua()
      y = 14
    }
  }

  desenharMarcaDagua()
  let textX = margin
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 8, 12, 12); textX = margin + 16 } catch {}
  }
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('Agro GFI', textX, 14)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text('Relatório: Custos Detalhados', textX, 20)
  doc.setFontSize(10)
  doc.text(`Propriedade: ${propriedadeNome}`, margin, 30)
  if (safraNome) doc.text(`Safra: ${safraNome}`, margin, 36)
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, safraNome ? 42 : 36)
  y = safraNome ? 50 : 44
  if (resumoFiltros) {
    doc.setFontSize(8)
    doc.setTextColor(110)
    doc.text(`Mostrando: ${resumoFiltros}`, margin, y - 4)
    doc.setTextColor(0)
    y += 4
  }

  const COL_QTDE_X = pageWidth - margin - 38

  const desenharSecao = (
    titulo: string, totalGeral: number,
    grupos: { grupo: string; subtotal: number; itens: any[] }[],
    linhaFormatador: (item: any) => [string, string, string]
  ) => {
    novaPaginaSeNecessario(16)
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text(titulo, margin, y)
    doc.text(`Total: R$ ${fmt2(totalGeral)}`, pageWidth - margin, y, { align: 'right' })
    y += 6

    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.setTextColor(140)
    doc.text('Qtde.', COL_QTDE_X, y, { align: 'right' })
    doc.text('Valor', pageWidth - margin, y, { align: 'right' })
    doc.setTextColor(0)
    y += 4

    grupos.forEach((grupo) => {
      novaPaginaSeNecessario(10 + grupo.itens.length * 6)

      doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text(grupo.grupo, margin, y)
      doc.text(`R$ ${fmt2(grupo.subtotal)}`, pageWidth - margin, y, { align: 'right' })
      y += 1
      doc.setDrawColor(200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      grupo.itens.forEach((item: any) => {
        const [nome, qtde, valor] = linhaFormatador(item)
        doc.setTextColor(COR_TEXTO)
        doc.text(nome, margin + 4, y)
        doc.setTextColor(140)
        doc.text(qtde, COL_QTDE_X, y, { align: 'right' })
        doc.setTextColor(COR_TEXTO)
        doc.text(valor, pageWidth - margin, y, { align: 'right' })
        doc.setTextColor(0)
        y += 5.5
      })
      y += 3
    })
    y += 4
  }

  const secoesComItens = (porTalhao || []).filter((sec) => (sec.operacional || []).length > 0)
  if (secoesComItens.length > 0) {
    secoesComItens.forEach((sec) => {
      desenharSecao(
        `Operacional — ${sec.talhao_nome}`,
        Number(sec.subtotal || 0),
        sec.operacional,
        (item) => [
          item.nome,
          formatarQtdeOperacional(item),
          `R$ ${fmt2(item.valor)}`,
        ]
      )
    })
    if (secoesComItens.length > 1) {
      novaPaginaSeNecessario(10)
      doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Total Operacional', margin, y)
      doc.text(`R$ ${fmt2(totalOperacional)}`, pageWidth - margin, y, { align: 'right' })
      y += 8
    }
  }

  if (financeiro.length > 0) {
    const saldoFinanceiro = totalReceitas - totalDespesas
    novaPaginaSeNecessario(10)
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Financeiro', margin, y)
    doc.text(
      `Despesas: R$ ${fmt2(totalDespesas)}   |   Recebimentos: R$ ${fmt2(totalReceitas)}`,
      pageWidth - margin, y, { align: 'right' }
    )
    y += 5
    doc.setFontSize(10)
    doc.setTextColor(...(saldoFinanceiro >= 0 ? COR_RECEITA : COR_DESPESA))
    doc.text(`Saldo: R$ ${fmt2(saldoFinanceiro)}`, pageWidth - margin, y, { align: 'right' })
    doc.setTextColor(0)
    y += 7

    financeiro.forEach((grupo) => {
      novaPaginaSeNecessario(10 + grupo.itens.length * 6)
      doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text(grupo.grupo, margin, y)
      doc.text(`R$ ${fmt2(grupo.subtotal)}`, pageWidth - margin, y, { align: 'right' })
      y += 1
      doc.setDrawColor(200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      grupo.itens.forEach((item: any) => {
        const detalhe = item.quantidade != null
          ? ` (${item.quantidade} ${unidadeCurta(item.unidade)} · méd. R$ ${fmt2(item.preco_medio)}/${item.unidade || ''})`
          : ''
        doc.setTextColor(COR_TEXTO)
        doc.text(`${item.nome}${detalhe}`, margin + 4, y)
        if (item.tipo === 'receita') {
          doc.setTextColor(...COR_RECEITA)
        } else {
          doc.setTextColor(...COR_DESPESA)
        }
        doc.text(`${item.tipo === 'receita' ? '+' : '-'} R$ ${fmt2(item.valor)}`, pageWidth - margin, y, { align: 'right' })
        doc.setTextColor(0)
        y += 5.5
      })
      y += 3
    })
  }

  doc.save(`${nomeArquivo}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

const TIPO_ESTOQUE_LABEL_PDF: Record<string, string> = {
  agricola: 'Agrícola',
  pecuario: 'Pecuária',
  geral: 'Geral',
}

export async function exportarEstoquePDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  tipos: {
    tipo_estoque: string
    total_itens: number
    itens_zerados: number
    categorias: {
      categoria: string
      total_itens: number
      itens_zerados: number
      itens: { nome: string; saldo_atual: number; unidade: string; abaixo_minimo: boolean }[]
    }[]
  }[]
}) {
  const { nomeArquivo, propriedadeNome, tipos } = opts
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = 14

  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const unidadeCurta = (u?: string) => (u || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

  const COR_TEXTO = 55 as const
  const COR_ALERTA: [number, number, number] = [180, 30, 30]

  const logo = await getLogoBase64()
  const desenharMarcaDagua = () => {
    if (!logo) return
    try {
      const tamanho = 90
      doc.saveGraphicsState()
      // @ts-ignore
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
      doc.addImage(logo, 'PNG', (pageWidth - tamanho) / 2, (pageHeight - tamanho) / 2, tamanho, tamanho)
      doc.restoreGraphicsState()
    } catch {}
  }

  const novaPaginaSeNecessario = (alturaNecessaria: number) => {
    if (y + alturaNecessaria > pageHeight - 20) {
      doc.addPage()
      desenharMarcaDagua()
      y = 14
    }
  }

  desenharMarcaDagua()
  let textX = margin
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 8, 12, 12); textX = margin + 16 } catch {}
  }
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('Agro GFI', textX, 14)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text('Relatório: Estoque', textX, 20)
  doc.setFontSize(10)
  doc.text(`Propriedade: ${propriedadeNome}`, margin, 30)
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, 36)
  y = 44

  tipos.forEach((tipo) => {
    novaPaginaSeNecessario(16)
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text(TIPO_ESTOQUE_LABEL_PDF[tipo.tipo_estoque] || tipo.tipo_estoque, margin, y)
    doc.text(`${tipo.total_itens} produtos`, pageWidth - margin, y, { align: 'right' })
    y += 6

    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.setTextColor(140)
    doc.text('Qtde. em estoque', pageWidth - margin, y, { align: 'right' })
    doc.setTextColor(0)
    y += 4

    ;(tipo.categorias || []).forEach((cat) => {
      novaPaginaSeNecessario(10 + cat.itens.length * 6)

      doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text(cat.categoria, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8); doc.setTextColor(140)
      doc.text(`${cat.total_itens} ${cat.total_itens === 1 ? 'item' : 'itens'}`, pageWidth - margin, y, { align: 'right' })
      doc.setTextColor(0)
      y += 1
      doc.setDrawColor(200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      cat.itens.forEach((item) => {
        if (item.abaixo_minimo) {
          doc.setTextColor(...COR_ALERTA)
        } else {
          doc.setTextColor(COR_TEXTO)
        }
        doc.text(item.abaixo_minimo ? `${item.nome} (abaixo do mínimo)` : item.nome, margin + 4, y)
        doc.text(`${fmt2(item.saldo_atual)} ${unidadeCurta(item.unidade)}`, pageWidth - margin, y, { align: 'right' })
        doc.setTextColor(0)
        y += 5.5
      })
      y += 3
    })
    y += 4
  })

  doc.save(`${nomeArquivo}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

const TIPO_ESTOQUE_LABEL_INSUMOS: Record<string, string> = {
  agricola: 'Agrícola',
  pecuario: 'Pecuária',
  geral: 'Geral',
}

export async function exportarInsumosPDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  safraNome?: string
  grupos: {
    tipo_estoque: string
    subtotal: number
    itens: { produto_nome: string; quantidade_total: number; unidade_medida: string; custo_total: number; custo_unitario_medio: number }[]
  }[]
}) {
  const { nomeArquivo, propriedadeNome, safraNome, grupos } = opts
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = 14

  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const unidadeCurta = (u?: string) => (u || '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  const COR_TEXTO = 55 as const

  const logo = await getLogoBase64()
  const desenharMarcaDagua = () => {
    if (!logo) return
    try {
      const tamanho = 90
      doc.saveGraphicsState()
      // @ts-ignore
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
      doc.addImage(logo, 'PNG', (pageWidth - tamanho) / 2, (pageHeight - tamanho) / 2, tamanho, tamanho)
      doc.restoreGraphicsState()
    } catch {}
  }

  const novaPaginaSeNecessario = (alturaNecessaria: number) => {
    if (y + alturaNecessaria > pageHeight - 20) {
      doc.addPage()
      desenharMarcaDagua()
      y = 14
    }
  }

  desenharMarcaDagua()
  let textX = margin
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 8, 12, 12); textX = margin + 16 } catch {}
  }
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('Agro GFI', textX, 14)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text('Relatório: Insumos', textX, 20)
  doc.setFontSize(10)
  doc.text(`Propriedade: ${propriedadeNome}`, margin, 30)
  if (safraNome) doc.text(`Safra: ${safraNome}`, margin, 36)
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, safraNome ? 42 : 36)
  y = safraNome ? 50 : 44

  grupos.forEach((grupo) => {
    novaPaginaSeNecessario(16)
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text(TIPO_ESTOQUE_LABEL_INSUMOS[grupo.tipo_estoque] || grupo.tipo_estoque, margin, y)
    doc.text(`R$ ${fmt2(grupo.subtotal)}`, pageWidth - margin, y, { align: 'right' })
    y += 6

    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.setTextColor(140)
    doc.text('Qtde.', pageWidth - margin - 38, y, { align: 'right' })
    doc.text('Valor', pageWidth - margin, y, { align: 'right' })
    doc.setTextColor(0)
    y += 4
    doc.setDrawColor(200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    grupo.itens.forEach((item) => {
      novaPaginaSeNecessario(6)
      doc.setTextColor(COR_TEXTO)
      doc.text(item.produto_nome, margin + 4, y)
      doc.setTextColor(140)
      doc.text(`${fmt2(item.quantidade_total)} (${unidadeCurta(item.unidade_medida)})`, pageWidth - margin - 38, y, { align: 'right' })
      doc.setTextColor(COR_TEXTO)
      doc.text(`R$ ${fmt2(item.custo_total)}`, pageWidth - margin, y, { align: 'right' })
      doc.setTextColor(0)
      y += 5.5
    })
    y += 5
  })

  doc.save(`${nomeArquivo}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

export async function exportarObservacoesPDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  safraNome?: string
  termoBuscado: string
  totalGeral: number
  grupos: {
    descricao: string
    subtotal: number
    itens: { rotulo: string; vezes: number; valor: number }[]
  }[]
}) {
  const { nomeArquivo, propriedadeNome, safraNome, termoBuscado, totalGeral, grupos } = opts
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = 14

  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const COR_TEXTO = 55 as const

  const logo = await getLogoBase64()
  const desenharMarcaDagua = () => {
    if (!logo) return
    try {
      const tamanho = 90
      doc.saveGraphicsState()
      // @ts-ignore
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
      doc.addImage(logo, 'PNG', (pageWidth - tamanho) / 2, (pageHeight - tamanho) / 2, tamanho, tamanho)
      doc.restoreGraphicsState()
    } catch {}
  }

  const novaPaginaSeNecessario = (alturaNecessaria: number) => {
    if (y + alturaNecessaria > pageHeight - 20) {
      doc.addPage()
      desenharMarcaDagua()
      y = 14
    }
  }

  desenharMarcaDagua()
  let textX = margin
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 8, 12, 12); textX = margin + 16 } catch {}
  }
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('Agro GFI', textX, 14)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text(`Relatório: Observações — "${termoBuscado}"`, textX, 20)
  doc.setFontSize(10)
  doc.text(`Propriedade: ${propriedadeNome}`, margin, 30)
  if (safraNome) doc.text(`Safra: ${safraNome}`, margin, 36)
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, safraNome ? 42 : 36)
  y = safraNome ? 50 : 44

  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text('Total', margin, y)
  doc.text(`R$ ${fmt2(totalGeral)}`, pageWidth - margin, y, { align: 'right' })
  y += 6

  const COL_QTDE_X = pageWidth - margin - 30

  doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  doc.setTextColor(140)
  doc.text('Qtde.', COL_QTDE_X, y, { align: 'right' })
  doc.text('Valor', pageWidth - margin, y, { align: 'right' })
  doc.setTextColor(0)
  y += 4

  grupos.forEach((grupo) => {
    novaPaginaSeNecessario(10 + grupo.itens.length * 6)

    doc.setFontSize(10); doc.setFont('helvetica', 'bold')
    doc.text(grupo.descricao, margin, y)
    doc.text(`R$ ${fmt2(grupo.subtotal)}`, pageWidth - margin, y, { align: 'right' })
    y += 1
    doc.setDrawColor(200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    grupo.itens.forEach((item) => {
      doc.setTextColor(COR_TEXTO)
      doc.text(item.rotulo, margin + 4, y)
      doc.setTextColor(140)
      doc.text(`${item.vezes}x`, COL_QTDE_X, y, { align: 'right' })
      doc.setTextColor(COR_TEXTO)
      doc.text(`R$ ${fmt2(item.valor)}`, pageWidth - margin, y, { align: 'right' })
      doc.setTextColor(0)
      y += 5.5
    })
    y += 3
  })

  doc.save(`${nomeArquivo}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

export async function exportarMaquinasPDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  safraNome?: string
  resumoFiltros?: string
  totalGeral: number
  grupos: {
    nome: string
    subtotal: number
    horimetro: string
    itens: { nome: string; qtdLabel: string; valor: number | null }[]
  }[]
}) {
  const { nomeArquivo, propriedadeNome, safraNome, resumoFiltros, totalGeral, grupos } = opts
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = 14

  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const COR_TEXTO = 55 as const

  const logo = await getLogoBase64()
  const desenharMarcaDagua = () => {
    if (!logo) return
    try {
      const tamanho = 90
      doc.saveGraphicsState()
      // @ts-ignore
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
      doc.addImage(logo, 'PNG', (pageWidth - tamanho) / 2, (pageHeight - tamanho) / 2, tamanho, tamanho)
      doc.restoreGraphicsState()
    } catch {}
  }

  const novaPaginaSeNecessario = (alturaNecessaria: number) => {
    if (y + alturaNecessaria > pageHeight - 20) {
      doc.addPage()
      desenharMarcaDagua()
      y = 14
    }
  }

  desenharMarcaDagua()
  let textX = margin
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 8, 12, 12); textX = margin + 16 } catch {}
  }
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('Agro GFI', textX, 14)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text('Relatório: Máquinas', textX, 20)
  doc.setFontSize(10)
  doc.text(`Propriedade: ${propriedadeNome}`, margin, 30)
  if (safraNome) doc.text(`Safra: ${safraNome}`, margin, 36)
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, safraNome ? 42 : 36)
  y = safraNome ? 50 : 44
  if (resumoFiltros) {
    doc.setFontSize(8)
    doc.setTextColor(110)
    doc.text(`Mostrando: ${resumoFiltros}`, margin, y - 4)
    doc.setTextColor(0)
    y += 4
  }

  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text('Total', margin, y)
  doc.text(`R$ ${fmt2(totalGeral)}`, pageWidth - margin, y, { align: 'right' })
  y += 6

  const COL_QTDE_X = pageWidth - margin - 34

  doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  doc.setTextColor(140)
  doc.text('Qtd', COL_QTDE_X, y, { align: 'right' })
  doc.text('Valor', pageWidth - margin, y, { align: 'right' })
  doc.setTextColor(0)
  y += 4

  grupos.forEach((grupo) => {
    novaPaginaSeNecessario(10 + grupo.itens.length * 6)

    doc.setFontSize(10); doc.setFont('helvetica', 'bold')
    doc.text(`${grupo.nome} — ${grupo.horimetro}`, margin, y)
    doc.text(`R$ ${fmt2(grupo.subtotal)}`, pageWidth - margin, y, { align: 'right' })
    y += 1
    doc.setDrawColor(200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    grupo.itens.forEach((item) => {
      doc.setTextColor(COR_TEXTO)
      doc.text(item.nome, margin + 4, y)
      doc.setTextColor(140)
      doc.text(item.qtdLabel, COL_QTDE_X, y, { align: 'right' })
      doc.setTextColor(COR_TEXTO)
      doc.text(item.valor != null ? `R$ ${fmt2(item.valor)}` : '-', pageWidth - margin, y, { align: 'right' })
      doc.setTextColor(0)
      y += 5.5
    })
    y += 3
  })

  doc.save(`${nomeArquivo}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

/** Desenha um gráfico de linha simples (sem lib externa) com N séries, dentro de um retângulo x/y/width/height. */
function desenharGraficoLinha(doc: jsPDF, opts: {
  x: number; y: number; width: number; height: number
  labels: string[]
  series: { label: string; color: [number, number, number]; valores: number[]; mostrarValores?: boolean }[]
}) {
  const { x, y, width, height, labels, series } = opts
  const todosValores = series.flatMap((s) => s.valores)
  const maxV = Math.max(...todosValores, 0)
  const minV = Math.min(...todosValores, 0)
  const range = maxV - minV || 1
  const n = labels.length

  const fmtCompacto = (v: number) => {
    const abs = Math.abs(v)
    const sinal = v < 0 ? '-' : ''
    if (abs >= 1000) return `${sinal}${(abs / 1000).toFixed(0)}k`
    return `${sinal}${abs.toFixed(0)}`
  }

  // Reserva espaço à esquerda para os números do eixo Y
  const labelWidth = 14
  const plotX = x + labelWidth
  const plotWidth = width - labelWidth
  const stepX = n > 1 ? plotWidth / (n - 1) : 0
  const escalaY = (v: number) => y + height - ((v - minV) / range) * height

  // Legenda
  let lx = plotX
  const ly = y - 5
  series.forEach((s) => {
    doc.setFillColor(...s.color)
    doc.rect(lx, ly - 2.5, 3, 3, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(s.label, lx + 4.5, ly)
    lx += doc.getTextWidth(s.label) + 16
  })
  doc.setTextColor(0)

  // Eixo Y: linhas de grade com o valor em R$
  const NUM_LINHAS_Y = 4
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  for (let i = 0; i <= NUM_LINHAS_Y; i++) {
    const v = minV + (range * i) / NUM_LINHAS_Y
    const py = escalaY(v)
    doc.setDrawColor(230)
    doc.line(plotX, py, plotX + plotWidth, py)
    doc.setTextColor(130)
    doc.text(fmtCompacto(v), plotX - 2, py + 1.5, { align: 'right' })
  }
  doc.setTextColor(0)

  // Eixo X e linha do zero (se a faixa cruzar zero)
  doc.setDrawColor(180)
  doc.line(plotX, y + height, plotX + plotWidth, y + height)
  if (minV < 0 && maxV > 0) {
    const zeroY = escalaY(0)
    doc.setDrawColor(160)
    doc.line(plotX, zeroY, plotX + plotWidth, zeroY)
  }

   // Séries
  series.forEach((s, si) => {
    doc.setDrawColor(...s.color)
    doc.setFillColor(...s.color)
    doc.setLineWidth(0.4)
    s.valores.forEach((v, i) => {
      const px = plotX + i * stepX
      const py = escalaY(v)
      if (i > 0) {
        const prevPx = plotX + (i - 1) * stepX
        const prevPy = escalaY(s.valores[i - 1])
        doc.line(prevPx, prevPy, px, py)
      }
      doc.circle(px, py, 0.6, 'F')
      if (s.mostrarValores && v !== 0) {
        const desvio = 2 + si * 2.4
        const labelY = v >= 0
          ? Math.max(py - desvio, y + 2)
          : Math.min(py + desvio + 2, y + height - 1)
        doc.setFontSize(5.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...s.color)
        doc.text(fmtCompacto(v), px, labelY, { align: 'center' })
        doc.setTextColor(0)
      }
    })
  })
  doc.setDrawColor(0)

  // Rótulos do eixo X
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  labels.forEach((lbl, i) => {
    const px = plotX + i * stepX
    doc.text(lbl, px, y + height + 4, { align: 'center' })
  })
  doc.setTextColor(0)
}

function desenharGraficoBarras(doc: jsPDF, opts: {
  x: number; y: number; width: number; height: number
  labels: string[]
  credito: number[]
  debito: number[]
  saldo: number[]
}) {
  const { x, y, width, height, labels, credito, debito, saldo } = opts
  const n = labels.length
  const todosValores = [...credito, ...debito, ...saldo]
  const maxV = Math.max(...todosValores, 0)
  const minV = Math.min(...todosValores, 0)
  const range = maxV - minV || 1

  const fmtCompacto = (v: number) => {
    const abs = Math.abs(v)
    const sinal = v < 0 ? '-' : ''
    if (abs >= 1000) return `${sinal}${(abs / 1000).toFixed(0)}k`
    return `${sinal}${abs.toFixed(0)}`
  }

  const COR_RECEITA: [number, number, number] = [21, 101, 52]
  const COR_DESPESA: [number, number, number] = [180, 30, 30]
  const COR_SALDO: [number, number, number] = [21, 101, 187]

  const labelWidth = 14
  const plotX = x + labelWidth
  const plotWidth = width - labelWidth
  const slotWidth = n > 0 ? plotWidth / n : 0
  const escalaY = (v: number) => y + height - ((v - minV) / range) * height
  const zeroY = escalaY(0)

  // Desenha o texto com um fundo branco atrás, pra ficar legível em cima
  // de barra, linha ou qualquer outra coisa.
  const rotuloComFundo = (texto: string, px: number, py: number, cor: [number, number, number], tamanho = 5.5) => {
    doc.setFontSize(tamanho)
    doc.setFont('helvetica', 'bold')
    const w = doc.getTextWidth(texto)
    doc.setFillColor(255, 255, 255)
    doc.rect(px - w / 2 - 0.8, py - tamanho * 0.32 - 0.8, w + 1.6, tamanho * 0.32 + 1.6, 'F')
    doc.setTextColor(...cor)
    doc.text(texto, px, py, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)
  }

  // Legenda
  let lx = plotX
  const ly = y - 5
  ;[
    { label: 'Crédito', color: COR_RECEITA },
    { label: 'Débito', color: COR_DESPESA },
    { label: 'Saldo', color: COR_SALDO },
  ].forEach((l) => {
    doc.setFillColor(...l.color)
    doc.rect(lx, ly - 2.5, 3, 3, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(l.label, lx + 4.5, ly)
    lx += doc.getTextWidth(l.label) + 16
  })
  doc.setTextColor(0)

  // Eixo Y
  const NUM_LINHAS_Y = 4
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  for (let i = 0; i <= NUM_LINHAS_Y; i++) {
    const v = minV + (range * i) / NUM_LINHAS_Y
    const py = escalaY(v)
    doc.setDrawColor(230)
    doc.line(plotX, py, plotX + plotWidth, py)
    doc.setTextColor(130)
    doc.text(fmtCompacto(v), plotX - 2, py + 1.5, { align: 'right' })
  }
  doc.setTextColor(0)

  doc.setDrawColor(160)
  doc.line(plotX, zeroY, plotX + plotWidth, zeroY)

  // 1) Linha de Saldo primeiro — fica "por baixo" das barras
  doc.setDrawColor(...COR_SALDO)
  doc.setLineWidth(0.5)
  for (let i = 0; i < n; i++) {
    if (i === 0) continue
    const px = plotX + i * slotWidth + slotWidth / 2
    const py = escalaY(saldo[i] || 0)
    const prevPx = plotX + (i - 1) * slotWidth + slotWidth / 2
    const prevPy = escalaY(saldo[i - 1] || 0)
    doc.line(prevPx, prevPy, px, py)
  }
  doc.setDrawColor(0)

  // 2) Barras de Crédito e Débito, com número (fundo branco) em cima de cada uma
  const barW = slotWidth * 0.32
  const gap = slotWidth * 0.06
  const clampY = (v: number) => Math.min(Math.max(v, y + 3), y + height - 1)
  for (let i = 0; i < n; i++) {
    const slotCenter = plotX + i * slotWidth + slotWidth / 2
    const cx = slotCenter - gap / 2 - barW
    const dx = slotCenter + gap / 2

    const cv = credito[i] || 0
    const cy = escalaY(cv)
    doc.setFillColor(...COR_RECEITA)
    doc.rect(cx, Math.min(cy, zeroY), barW, Math.abs(zeroY - cy), 'F')
    if (cv !== 0) rotuloComFundo(fmtCompacto(cv), cx + barW / 2, clampY(Math.min(cy, zeroY) - 1.5), COR_RECEITA)

    const dv = debito[i] || 0
    const dy = escalaY(dv)
    doc.setFillColor(...COR_DESPESA)
    doc.rect(dx, Math.min(dy, zeroY), barW, Math.abs(zeroY - dy), 'F')
    if (dv !== 0) rotuloComFundo(fmtCompacto(dv), dx + barW / 2, clampY(Math.min(dy, zeroY) - 1.5), COR_DESPESA)
  }

  // 3) Pontos e números do Saldo por cima de tudo — sempre visível, com fundo branco
  doc.setFillColor(...COR_SALDO)
  for (let i = 0; i < n; i++) {
    const px = plotX + i * slotWidth + slotWidth / 2
    const py = escalaY(saldo[i] || 0)
    doc.setFillColor(...COR_SALDO)
    doc.circle(px, py, 0.7, 'F')
    if (saldo[i] !== 0) {
      const labelY = saldo[i] >= 0 ? clampY(py - 3) : clampY(py + 5.5)
      rotuloComFundo(fmtCompacto(saldo[i]), px, labelY, COR_SALDO)
    }
  }

  // Eixo X
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  labels.forEach((lbl, i) => {
    const px = plotX + i * slotWidth + slotWidth / 2
    doc.text(lbl, px, y + height + 4, { align: 'center' })
  })
  doc.setTextColor(0)
}

const NOMES_MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export async function exportarBalanceteGeralPDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  proprietarioNome?: string
  ano: number
  meses: { mes: number; credito: number; debito: number; saldo: number }[]
}) {
  const { nomeArquivo, propriedadeNome, proprietarioNome, ano, meses } = opts
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14

  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const COR_RECEITA: [number, number, number] = [21, 101, 52]
  const COR_DESPESA: [number, number, number] = [180, 30, 30]
  const COR_SALDO: [number, number, number] = [21, 101, 187]

  const logo = await getLogoBase64()
  const desenharMarcaDagua = () => {
    if (!logo) return
    try {
      const tamanho = 90
      doc.saveGraphicsState()
      // @ts-ignore
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
      doc.addImage(logo, 'PNG', (pageWidth - tamanho) / 2, (pageHeight - tamanho) / 2, tamanho, tamanho)
      doc.restoreGraphicsState()
    } catch {}
  }

  desenharMarcaDagua()
  let textX = margin
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 8, 12, 12); textX = margin + 16 } catch {}
  }
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('Agro GFI', textX, 14)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text('Relatório: Balancete Geral', textX, 20)
  doc.setFontSize(10)
  doc.text(`Propriedade: ${propriedadeNome}`, margin, 30)
  let yCabecalho = 36
  if (proprietarioNome) {
    doc.text(`Proprietário: ${proprietarioNome}`, margin, yCabecalho)
    yCabecalho += 6
  }
  doc.text(`Ano: ${ano}`, margin, yCabecalho)
  yCabecalho += 6
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, yCabecalho)

  const totalCredito = meses.reduce((s, m) => s + m.credito, 0)
  const totalDebito = meses.reduce((s, m) => s + m.debito, 0)
  const totalSaldo = totalCredito - totalDebito

  autoTable(doc, {
    startY: yCabecalho + 10,
    head: [['Mês', 'Crédito', 'Débito', 'Saldo']],
    body: meses.map((m) => [
      NOMES_MESES_ABREV[m.mes - 1],
      `R$ ${fmt2(m.credito)}`,
      `R$ ${fmt2(m.debito)}`,
      `R$ ${fmt2(m.saldo)}`,
    ]),
    foot: [['TOTAL', `R$ ${fmt2(totalCredito)}`, `R$ ${fmt2(totalDebito)}`, `R$ ${fmt2(totalSaldo)}`]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [235, 235, 235], textColor: [30, 30, 30], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { halign: 'right', cellWidth: (pageWidth - margin * 2 - 40) / 3 },
      2: { halign: 'right', cellWidth: (pageWidth - margin * 2 - 40) / 3 },
      3: { halign: 'right', cellWidth: (pageWidth - margin * 2 - 40) / 3 },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: margin, right: margin },
    didDrawPage: () => desenharMarcaDagua(),
  })

  let y = (doc as any).lastAutoTable.finalY + 8

  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(totalSaldo >= 0 ? COR_RECEITA : COR_DESPESA))
  doc.text(`RESULTADO DO PERÍODO: R$ ${fmt2(totalSaldo)}`, pageWidth - margin, y, { align: 'right' })
  doc.setTextColor(0)
  y += 10

  if (y + 78 > pageHeight - 16) { doc.addPage(); desenharMarcaDagua(); y = 24 }
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(60)
  doc.text('Crédito, Débito e Saldo por Mês', margin, y)
  doc.setTextColor(0)
  y += 9

  desenharGraficoBarras(doc, {
    x: margin, y, width: pageWidth - margin * 2, height: 58,
    labels: meses.map((m) => NOMES_MESES_ABREV[m.mes - 1]),
    credito: meses.map((m) => m.credito),
    debito: meses.map((m) => m.debito),
    saldo: meses.map((m) => m.saldo),
  })

  doc.save(`${nomeArquivo}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

export async function exportarMovimentoCaixaPDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  proprietarioNome?: string
  mesLabel: string
  linhas: { data: string; historico: string; entrada: number; saida: number }[]
  saldoAnterior: number
}) {
  const { nomeArquivo, propriedadeNome, proprietarioNome, mesLabel, linhas, saldoAnterior } = opts
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14

  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const logo = await getLogoBase64()
  const desenharMarcaDagua = () => {
    if (!logo) return
    try {
      const tamanho = 90
      doc.saveGraphicsState()
      // @ts-ignore
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
      doc.addImage(logo, 'PNG', (pageWidth - tamanho) / 2, (pageHeight - tamanho) / 2, tamanho, tamanho)
      doc.restoreGraphicsState()
    } catch {}
  }

  desenharMarcaDagua()
  let textX = margin
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 8, 12, 12); textX = margin + 16 } catch {}
  }
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('Agro GFI', textX, 14)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text('Relatório: Movimento do Caixa', textX, 20)
  doc.setFontSize(10)
  doc.text(`Propriedade: ${propriedadeNome}`, margin, 30)
  let yCabecalho = 36
  if (proprietarioNome) {
    doc.text(`Proprietário: ${proprietarioNome}`, margin, yCabecalho)
    yCabecalho += 6
  }
  doc.text(`Período: ${mesLabel}`, margin, yCabecalho)
  yCabecalho += 6
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, yCabecalho)

  const somaEntrada = linhas.reduce((s, l) => s + l.entrada, 0)
  const somaSaida = linhas.reduce((s, l) => s + l.saida, 0)
  const saldoMes = somaEntrada - somaSaida
  const saldoAtual = saldoAnterior + saldoMes

  autoTable(doc, {
    startY: yCabecalho + 6,
    head: [['Data', 'Histórico', 'Entrada', 'Saída']],
    body: linhas.length > 0
      ? linhas.map((l) => [
          l.data,
          l.historico,
          l.entrada > 0 ? `R$ ${fmt2(l.entrada)}` : '',
          l.saida > 0 ? `R$ ${fmt2(l.saida)}` : '',
        ])
      : [['—', 'Nenhuma transação paga neste mês', '', '']],
    foot: [['', 'SOMA DO MÊS', `R$ ${fmt2(somaEntrada)}`, `R$ ${fmt2(somaSaida)}`]],
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2.5, valign: 'middle' },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [235, 235, 235], textColor: [30, 30, 30], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 24 }, 2: { halign: 'left', cellWidth: 36 }, 3: { halign: 'left', cellWidth: 36 } },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: margin, right: margin },
    didDrawPage: () => desenharMarcaDagua(),
  })

  let y = (doc as any).lastAutoTable.finalY + 10
  if (y + 40 > pageHeight - 16) { doc.addPage(); desenharMarcaDagua(); y = 24 }

  const linhaResumo = (label: string, valor: number, destaque = false) => {
    const negativo = valor < 0
    doc.setFontSize(destaque ? 11 : 9.5)
    doc.setFont('helvetica', destaque ? 'bold' : 'normal')
    if (destaque) {
      if (negativo) doc.setTextColor(180, 30, 30)
      else doc.setTextColor(39, 103, 61)
    } else {
      doc.setTextColor(80, 80, 80)
    }
    doc.text(label, pageWidth - margin - 70, y)
    doc.text(`R$ ${fmt2(valor)}`, pageWidth - margin, y, { align: 'right' })
    doc.setTextColor(0)
    y += destaque ? 7 : 6
  }

  linhaResumo('Soma do Mês', saldoMes)
  linhaResumo('Saldo Anterior', saldoAnterior)
  linhaResumo('Saldo Atual', saldoAtual, true)

  y += 16
  if (y + 20 > pageHeight - 16) { doc.addPage(); desenharMarcaDagua(); y = 24 }
  doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60)
  doc.text('Recebido em ____ / ____ / ______', margin, y)
  y += 12
  doc.setDrawColor(120)
  doc.line(margin, y, margin + 80, y)
  doc.text('Ass.:', margin, y + 4)
  doc.setTextColor(0)

  doc.save(`${nomeArquivo}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

const NOMES_MESES_COMPLETO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export async function exportarMovimentoCaixaAnualPDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  proprietarioNome?: string
  ano: number
  saldoInicial: number
  meses: { mes: number; linhas: { data: string; historico: string; entrada: number; saida: number }[] }[]
}) {
  const { nomeArquivo, propriedadeNome, proprietarioNome, ano, saldoInicial, meses } = opts
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14

  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const COR_RECEITA: [number, number, number] = [21, 101, 52]
  const COR_DESPESA: [number, number, number] = [180, 30, 30]

  const logo = await getLogoBase64()
  const desenharMarcaDagua = () => {
    if (!logo) return
    try {
      const tamanho = 90
      doc.saveGraphicsState()
      // @ts-ignore
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
      doc.addImage(logo, 'PNG', (pageWidth - tamanho) / 2, (pageHeight - tamanho) / 2, tamanho, tamanho)
      doc.restoreGraphicsState()
    } catch {}
  }

  desenharMarcaDagua()
  let textX = margin
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 8, 12, 12); textX = margin + 16 } catch {}
  }
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('Agro GFI', textX, 14)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text('Relatório: Movimento de Caixa Geral', textX, 20)
  doc.setFontSize(10)
  doc.text(`Propriedade: ${propriedadeNome}`, margin, 30)
  let yCabecalho = 36
  if (proprietarioNome) {
    doc.text(`Proprietário: ${proprietarioNome}`, margin, yCabecalho)
    yCabecalho += 6
  }
  doc.text(`Ano: ${ano}`, margin, yCabecalho)
  yCabecalho += 6
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, yCabecalho)
  yCabecalho += 6
  doc.setTextColor(80)
  doc.text(`Saldo em 31/12/${ano - 1}: R$ ${fmt2(saldoInicial)}`, margin, yCabecalho)
  doc.setTextColor(0)

  let y = yCabecalho + 10

  const novaPaginaSeNecessario = (alturaNecessaria: number) => {
    if (y + alturaNecessaria > pageHeight - 16) {
      doc.addPage()
      desenharMarcaDagua()
      y = 20
    }
  }

  let saldoCorrente = saldoInicial
  let totalEntradaAno = 0
  let totalSaidaAno = 0

  meses.forEach(({ mes, linhas }) => {
    const somaEntrada = linhas.reduce((s, l) => s + l.entrada, 0)
    const somaSaida = linhas.reduce((s, l) => s + l.saida, 0)
    const saldoMes = somaEntrada - somaSaida
    saldoCorrente += saldoMes
    totalEntradaAno += somaEntrada
    totalSaidaAno += somaSaida

    novaPaginaSeNecessario(22)

    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4.5, pageWidth - margin * 2, 7, 'F')
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(40)
    doc.text(`${NOMES_MESES_COMPLETO[mes - 1]} de ${ano}`, margin + 2, y)
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
    doc.setTextColor(...(saldoMes >= 0 ? COR_RECEITA : COR_DESPESA))
    doc.text(`Saldo do mês: R$ ${fmt2(saldoMes)}`, pageWidth - margin - 2, y, { align: 'right' })
    doc.setTextColor(0)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Histórico', 'Entrada', 'Saída']],
      body: linhas.length > 0
        ? linhas.map((l) => [
            l.data, l.historico,
            l.entrada > 0 ? `R$ ${fmt2(l.entrada)}` : '',
            l.saida > 0 ? `R$ ${fmt2(l.saida)}` : '',
          ])
        : [['—', 'Nenhuma movimentação neste mês', '', '']],
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
      headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: { 0: { cellWidth: 24 }, 2: { halign: 'left', cellWidth: 34 }, 3: { halign: 'left', cellWidth: 34 } },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: margin, right: margin },
      didDrawPage: () => desenharMarcaDagua(),
    })

    y = (doc as any).lastAutoTable.finalY + 8
  })

  novaPaginaSeNecessario(30)
  doc.setDrawColor(180)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(40)
  doc.text('TOTAL DO ANO', margin, y)
  doc.setFontSize(9)
  doc.setTextColor(...COR_RECEITA)
  doc.text(`Entradas: R$ ${fmt2(totalEntradaAno)}`, margin + 45, y)
  doc.setTextColor(...COR_DESPESA)
  doc.text(`Saídas: R$ ${fmt2(totalSaidaAno)}`, margin + 115, y)
  doc.setTextColor(0)
  y += 9

  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(saldoCorrente >= 0 ? COR_RECEITA : COR_DESPESA))
  doc.text(`SALDO EM 31/12/${ano}: R$ ${fmt2(saldoCorrente)}`, pageWidth - margin, y, { align: 'right' })
  doc.setTextColor(0)

  doc.save(`${nomeArquivo}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
