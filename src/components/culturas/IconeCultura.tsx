import { Sprout } from "lucide-react";

import { ICONES_CULTURA } from "@/components/talhoes/NovaCulturaDialog";

import { cn } from "@/lib/utils";



interface IconeCulturaProps {

  nome?: string;

  className?: string;

}



export function IconeCultura({ nome, className }: IconeCulturaProps) {

  const found = ICONES_CULTURA.find((i) => i.valor === nome);

  const Icon = found?.Icon || Sprout;

  return <Icon className={cn("h-4 w-4", className)} />;

}

