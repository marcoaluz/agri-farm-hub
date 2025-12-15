import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { DollarSign, Package, Wrench, Users } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface ItemComCusto {
  item_id: string
  nome: string
  tipo: 'produto_estoque' | 'servico' | 'maquina_hora'
  quantidade: number
  custo_total: number
  unidade_medida: string
}

interface ResumoFinanceiroProps {
  itens: ItemComCusto[]
  areaHa?: number
}

export function ResumoFinanceiro({ itens, areaHa }: ResumoFinanceiroProps) {
  const produtos = itens.filter(i => i.tipo === 'produto_estoque')
  const servicos = itens.filter(i => i.tipo === 'servico')
  const maquinas = itens.filter(i => i.tipo === 'maquina_hora')

  const subtotalProdutos = produtos.reduce((sum, i) => sum + i.custo_total, 0)
  const subtotalServicos = servicos.reduce((sum, i) => sum + i.custo_total, 0)
  const subtotalMaquinas = maquinas.reduce((sum, i) => sum + i.custo_total, 0)

  const total = subtotalProdutos + subtotalServicos + subtotalMaquinas
  const custoPorHa = areaHa && areaHa > 0 ? total / areaHa : null

  if (itens.length === 0) return null

  return (
    <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-900">
          <DollarSign className="h-5 w-5" />
          Resumo Financeiro do Lançamento
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Produtos de Estoque */}
        {produtos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-blue-600" />
              <h4 className="font-semibold text-sm text-muted-foreground">
                Produtos de Estoque
              </h4>
            </div>
            <div className="space-y-1 ml-6">
              {produtos.map(item => (
                <div key={item.item_id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.nome} ({item.quantidade} {item.unidade_medida})
                  </span>
                  <span className="font-semibold text-foreground">
                    R$ {item.custo_total.toFixed(2)}
                  </span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-blue-700">Subtotal Produtos:</span>
                <span className="text-blue-900">R$ {subtotalProdutos.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Serviços */}
        {servicos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-600" />
              <h4 className="font-semibold text-sm text-muted-foreground">
                Serviços
              </h4>
            </div>
            <div className="space-y-1 ml-6">
              {servicos.map(item => (
                <div key={item.item_id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.nome} ({item.quantidade} {item.unidade_medida})
                  </span>
                  <span className="font-semibold text-foreground">
                    R$ {item.custo_total.toFixed(2)}
                  </span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-purple-700">Subtotal Serviços:</span>
                <span className="text-purple-900">R$ {subtotalServicos.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Máquinas */}
        {maquinas.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-orange-600" />
              <h4 className="font-semibold text-sm text-muted-foreground">
                Horas de Máquina
              </h4>
            </div>
            <div className="space-y-1 ml-6">
              {maquinas.map(item => (
                <div key={item.item_id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.nome} ({item.quantidade} {item.unidade_medida})
                  </span>
                  <span className="font-semibold text-foreground">
                    R$ {item.custo_total.toFixed(2)}
                  </span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-orange-700">Subtotal Máquinas:</span>
                <span className="text-orange-900">R$ {subtotalMaquinas.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Total Geral */}
        <Separator className="my-4" />

        <div className="bg-green-600 text-white p-4 rounded-lg -mx-6 -mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-bold">💰 CUSTO TOTAL:</span>
            <span className="text-2xl font-bold">
              R$ {total.toFixed(2)}
            </span>
          </div>

          {custoPorHa !== null && (
            <div className="flex justify-between items-center text-sm text-green-100">
              <span>Custo por hectare:</span>
              <span className="font-semibold">
                R$ {custoPorHa.toFixed(2)}/ha
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
