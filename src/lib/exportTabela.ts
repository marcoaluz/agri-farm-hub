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
