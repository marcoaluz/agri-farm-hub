import { supabase } from "@/lib/supabase";

export const MAX_ANEXO_BYTES = 5 * 1024 * 1024;

export type EntidadeAnexo = "lote" | "rebanho_movimentacao";

/** Faz upload da nota fiscal no bucket `anexos` e registra na tabela `anexos`. */
export async function uploadAnexoNF(params: {
  propriedadeId: string;
  entidadeTipo: EntidadeAnexo;
  entidadeId: string;
  arquivo: File;
  pasta?: string;
}): Promise<{ error?: string }> {
  const { propriedadeId, entidadeTipo, entidadeId, arquivo } = params;
  const pasta = params.pasta || entidadeTipo;
  const path = `${propriedadeId}/${pasta}/${entidadeId}/${Date.now()}_${arquivo.name}`;

  const { error: erroUpload } = await supabase.storage.from("anexos").upload(path, arquivo);
  if (erroUpload) return { error: erroUpload.message };

  const { error: erroInsert } = await supabase.from("anexos" as any).insert({
    propriedade_id: propriedadeId,
    entidade_tipo: entidadeTipo,
    entidade_id: entidadeId,
    nome_arquivo: arquivo.name,
    storage_path: path,
    mime_type: arquivo.type,
    tamanho_bytes: arquivo.size,
    descricao: "Nota fiscal",
  });
  if (erroInsert) return { error: erroInsert.message };
  return {};
}

export async function listarAnexos(entidadeTipo: EntidadeAnexo, entidadeId: string) {
  const { data } = await supabase
    .from("anexos" as any)
    .select("id, storage_path, nome_arquivo")
    .eq("entidade_tipo", entidadeTipo)
    .eq("entidade_id", entidadeId)
    .order("created_at", { ascending: false });
  return (data || []) as any[];
}

export async function removerAnexo(anexo: { id: string; storage_path: string }) {
  await supabase.storage.from("anexos").remove([anexo.storage_path]);
  await supabase
    .from("anexos" as any)
    .delete()
    .eq("id", anexo.id);
}

export async function abrirAnexoEmNovaAba(storagePath: string) {
  const { data } = await supabase.storage.from("anexos").createSignedUrl(storagePath, 300);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
}

/** Converte o campo `origem` de uma transação (ex: "lote:uuid") em entidade de anexo. */
export function parseOrigemTransacao(origem?: string | null): { tipo: EntidadeAnexo; id: string } | null {
  if (!origem || !origem.includes(":")) return null;
  const [prefixo, id] = origem.split(":");
  if (!id) return null;
  if (prefixo === "lote") return { tipo: "lote", id };
  if (prefixo === "pecuaria_movimentacao" || prefixo === "rebanho_movimentacao")
    return { tipo: "rebanho_movimentacao", id };
  return null;
}
