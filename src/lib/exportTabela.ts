import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

export type Coluna = { header: string; key: string; width?: number }

const hoje = () => format(new Date(), 'yyyy-MM-dd')

export function exportarExcel(opts: {
  nomeArquivo: string
  nomeAba: string
  colunas: Coluna[]
  linhas: any[]
}) {
  const { nomeArquivo, nomeAba, colunas, linhas } = opts
  const aoa: any[][] = [colunas.map((c) => c.header)]
  linhas.forEach((row) => {
    aoa.push(colunas.map((c) => row[c.key] ?? ''))
  })
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = colunas.map((c) => ({ wch: c.width ?? 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, nomeAba.substring(0, 28))
  XLSX.writeFile(wb, `${nomeArquivo}-${hoje()}.xlsx`)
}

export function exportarPDF(opts: {
  nomeArquivo: string
  propriedadeNome: string
  nomeAba: string
  colunas: Coluna[]
  linhas: any[]
}) {
  const { nomeArquivo, propriedadeNome, nomeAba, colunas, linhas } = opts
  const doc = new jsPDF({ orientation: 'landscape' })
  const dataAtual = format(new Date(), 'dd/MM/yyyy HH:mm')

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Relatório ${nomeAba}`, 14, 15)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Propriedade: ${propriedadeNome}`, 14, 22)
  doc.text(`Data: ${dataAtual}`, 14, 28)

  autoTable(doc, {
    startY: 34,
    head: [colunas.map((c) => c.header)],
    body: linhas.map((row) => colunas.map((c) => String(row[c.key] ?? ''))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  })

  doc.save(`${nomeArquivo}-${hoje()}.pdf`)
}
