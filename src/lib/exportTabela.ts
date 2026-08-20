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
}) {
  const { nomeArquivo, nomeAba, colunas, linhas, propriedadeNome, safraNome } = opts
  const aoa: any[][] = []

  aoa.push(['Agro GFI'])
  aoa.push([`Relatório: ${nomeAba}`])
  if (propriedadeNome) aoa.push([`Propriedade: ${propriedadeNome}`])
  if (safraNome) aoa.push([`Safra: ${safraNome}`])
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
  operacional: { grupo: string; subtotal: number; itens: { nome: string; vezes?: number; valor: number }[] }[]
  financeiro: { grupo: string; subtotal: number; itens: { nome: string; valor: number; tipo?: string }[] }[]
  totalOperacional: number
  totalDespesas: number
  totalReceitas: number
}) {
  const { nomeArquivo, propriedadeNome, safraNome, operacional, financeiro, totalOperacional, totalDespesas, totalReceitas } = opts
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = 14

  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Remove sufixo entre parênteses do fim da unidade (ex: "Sacas (60kg)" -> "Sacas")
  const unidadeCurta = (unidade?: string) => (unidade || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

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

  const desenharSecao = (
    titulo: string, totalGeral: number,
    grupos: { grupo: string; subtotal: number; itens: any[] }[],
    linhaFormatador: (item: any) => [string, string]
  ) => {
    novaPaginaSeNecessario(14)
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text(titulo, margin, y)
    doc.text(`Total: R$ ${fmt2(totalGeral)}`, pageWidth - margin, y, { align: 'right' })
    y += 6

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
        const [esquerda, direita] = linhaFormatador(item)
        doc.setTextColor(COR_TEXTO)
        doc.text(esquerda, margin + 4, y)
        if (item.tipo === 'receita') {
          doc.setTextColor(...COR_RECEITA)
        } else if (item.tipo === 'despesa') {
          doc.setTextColor(...COR_DESPESA)
        } else {
          doc.setTextColor(COR_TEXTO)
        }
        doc.text(direita, pageWidth - margin, y, { align: 'right' })
        doc.setTextColor(0)
        y += 5.5
      })
      y += 3
    })
    y += 4
  }

  if (operacional.length > 0) {
    desenharSecao('Operacional', totalOperacional, operacional, (item) => [
      `${item.nome}${item.vezes != null ? ` ${item.vezes}x` : ''}`,
      `= R$ ${fmt2(item.valor)}`,
    ])
  }

  if (financeiro.length > 0) {
    novaPaginaSeNecessario(10)
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Financeiro', margin, y)
    doc.text(
      `Despesas: R$ ${fmt2(totalDespesas)}   |   Recebimentos: R$ ${fmt2(totalReceitas)}`,
      pageWidth - margin, y, { align: 'right' }
    )
    y += 6

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
