import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── EXCEL ──────────────────────────────────────────────────────
export function exportarExcel(dados: {
  titulo: string
  nomeArquivo: string
  abas: {
    nome: string
    colunas: string[]
    linhas: (string | number)[][]
    totais?: (string | number)[]
  }[]
}) {
  const wb = XLSX.utils.book_new()
  dados.abas.forEach(aba => {
    const wsData = [aba.colunas, ...aba.linhas, ...(aba.totais ? [[], aba.totais] : [])]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = aba.colunas.map(() => ({ wch: 20 }))
    XLSX.utils.book_append_sheet(wb, ws, aba.nome.substring(0, 31))
  })
  XLSX.writeFile(wb, `${dados.nomeArquivo}.xlsx`)
}

// ── PDF COMPLETO ───────────────────────────────────────────────
export function exportarPDFCompleto(dados: {
  titulo: string
  subtitulo: string
  nomeArquivo: string
  propriedade: string
  safra: string
  periodo: string
  kpis: { label: string; valor: string }[]
  tabelas: {
    titulo: string
    colunas: string[]
    linhas: (string | number)[][]
    rodape?: (string | number)[]
  }[]
  chartImageBase64?: string
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const verde: [number, number, number] = [39, 103, 61]

  // Header
  doc.setFillColor(...verde)
  doc.rect(0, 0, 297, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('SGA — Sistema de Gestão Agropecuária', 14, 13)
  doc.setFontSize(10)
  doc.text(dados.titulo, 297 - 14, 13, { align: 'right' })

  // Metadata
  doc.setTextColor(60, 60, 60)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Propriedade: ${dados.propriedade} | Safra: ${dados.safra} | Período: ${dados.periodo}`, 14, 27)
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 297 - 14, 27, { align: 'right' })

  // KPIs
  let y = 35
  const kpiW = (297 - 28) / dados.kpis.length
  dados.kpis.forEach((kpi, i) => {
    const x = 14 + i * kpiW
    doc.setFillColor(245, 247, 245)
    doc.roundedRect(x, y, kpiW - 3, 14, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(kpi.label, x + (kpiW - 3) / 2, y + 5, { align: 'center' })
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...verde)
    doc.text(kpi.valor, x + (kpiW - 3) / 2, y + 11, { align: 'center' })
  })
  y += 20

  // Chart image
  if (dados.chartImageBase64) {
    doc.addImage(dados.chartImageBase64, 'PNG', 14, y, 269, 55)
    y += 60
  }

  // Tables
  dados.tabelas.forEach(tabela => {
    if (y > 170) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    doc.text(tabela.titulo, 14, y + 6)
    y += 9
    autoTable(doc, {
      startY: y,
      head: [tabela.colunas],
      body: tabela.linhas as any,
      foot: tabela.rodape ? [tabela.rodape as any] : undefined,
      theme: 'striped',
      headStyles: { fillColor: verde, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [250, 252, 250] },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  })

  // Page numbers
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(`Página ${i} de ${pages}`, 297 / 2, 205, { align: 'center' })
  }
  doc.save(`${dados.nomeArquivo}.pdf`)
}

// ── PDF SINTÉTICO ──────────────────────────────────────────────
export function exportarPDFSintetico(dados: {
  titulo: string
  nomeArquivo: string
  propriedade: string
  safra: string
  periodo: string
  kpis: { label: string; valor: string }[]
  resumos: {
    titulo: string
    itens: { label: string; valor: string; destaque?: boolean }[]
  }[]
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const verde: [number, number, number] = [39, 103, 61]

  doc.setFillColor(...verde)
  doc.rect(0, 0, 210, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('SGA — Sistema de Gestão Agropecuária', 14, 12)
  doc.setFontSize(9)
  doc.text(dados.titulo, 14, 19)

  doc.setTextColor(80, 80, 80)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`${dados.propriedade} • ${dados.safra} • ${dados.periodo}`, 14, 30)
  doc.text(`Gerado: ${new Date().toLocaleString('pt-BR')}`, 14, 36)

  let y = 43
  const cols = 2
  const kpiW = 88
  dados.kpis.forEach((kpi, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = 14 + col * (kpiW + 6)
    const ky = y + row * 18
    doc.setFillColor(245, 248, 245)
    doc.roundedRect(x, ky, kpiW, 15, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(kpi.label, x + 4, ky + 5)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...verde)
    doc.text(kpi.valor, x + 4, ky + 12)
  })
  y += Math.ceil(dados.kpis.length / cols) * 18 + 8

  dados.resumos.forEach(resumo => {
    if (y > 260) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(39, 103, 61)
    doc.text(resumo.titulo, 14, y)
    doc.setDrawColor(...verde)
    doc.line(14, y + 1, 196, y + 1)
    y += 7
    resumo.itens.forEach(item => {
      doc.setFont('helvetica', item.destaque ? 'bold' : 'normal')
      doc.setFontSize(9)
      doc.setTextColor(item.destaque ? 39 : 80, item.destaque ? 103 : 80, item.destaque ? 61 : 80)
      doc.text(item.label, 18, y)
      doc.text(item.valor, 196, y, { align: 'right' })
      y += 6
    })
    y += 4
  })

  doc.save(`${dados.nomeArquivo}.pdf`)
}
