// ─── useProducts ──────────────────────────────────────────────────────────────
//
// Gerencia o catálogo de produtos da empresa.
// Cada produto define se a receita é recorrente (MRR) ou única (one-time).
//
// SQL para criar a tabela no Supabase:
//
//   create table products (
//     id          uuid primary key default gen_random_uuid(),
//     name        text not null,
//     category    text not null default 'outros',
//     billing_type text not null default 'recurring'  -- 'recurring' | 'one_time'
//                 check (billing_type in ('recurring', 'one_time')),
//     default_price numeric(12,2) default 0,
//     description text,
//     active      boolean not null default true,
//     created_at  timestamptz not null default now(),
//     updated_at  timestamptz not null default now()
//   );
//
//   -- RLS (ajuste conforme sua policy padrão)
//   alter table products enable row level security;
//   create policy "allow all authenticated" on products
//     for all using (auth.role() = 'authenticated');

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BillingType = "recurring" | "one_time";
export type MaterialType = "comercial" | "operacional" | "treinamento";

export interface ProductMaterial {
  id: string;
  product_id: string;
  name: string;
  url: string | null;
  type: MaterialType;
  formato: string | null;
  active: boolean;
  created_at: string;
}

export interface ProductTask {
  dri: string;
  fase: string;
  etapa: string;
  tarefa: string;
  comoExecutar: string;
  estimativaHoras: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;       // e.g. "saber", "ter", "executar", "potencializar", "outros"
  billing_type: BillingType;
  default_price: number;
  description?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  // V4 section fields
  descricao_card?: string | null;
  escopo?: string | null;
  formato_entrega?: string | null;
  o_que_entrego?: string | null;
  como_vendo?: string | null;
  para_quem_serve?: string | null;
  como_entrega_valor?: string | null;
  time_envolvido?: string | null;
  duracao?: string | null;
  dono?: string | null;
  descricao_completa?: string | null;
  como_entrego_dados?: ProductTask[] | null;
  spiced_data?: Record<string, unknown> | null;
  use_case_map_1_name?: string | null;
  use_case_map_1_data?: Record<string, unknown> | null;
  use_case_map_2_name?: string | null;
  use_case_map_2_data?: Record<string, unknown> | null;
  materials?: ProductMaterial[];
}

export interface ProductFormData {
  // Basic
  name: string;
  category: string;
  billing_type: BillingType;
  default_price: number;
  duracao?: string;
  dono?: string;
  active: boolean;
  // 1. Visão Geral
  descricao_card?: string;
  description?: string;
  // 2. Aspectos Técnicos
  escopo?: string;
  formato_entrega?: string;
  time_envolvido?: string;
  // 3. Informações para Vender
  para_quem_serve?: string;
  como_entrega_valor?: string;
  como_vendo?: string;
  // 4. Informações para Operar
  o_que_entrego?: string;
  // 5. Estrutura do Produto — stored as raw JSON text for the form, parsed on save
  como_entrego_dados_raw?: string;
}

const EMPTY_FORM: ProductFormData = {
  name: "",
  category: "outros",
  billing_type: "recurring",
  default_price: 0,
  duracao: "",
  dono: "",
  active: true,
  descricao_card: "",
  description: "",
  escopo: "",
  formato_entrega: "",
  time_envolvido: "",
  para_quem_serve: "",
  como_entrega_valor: "",
  como_vendo: "",
  o_que_entrego: "",
  como_entrego_dados_raw: "",
};

// ─── Category config (mirrors productCatalog.ts) ──────────────────────────────

export const PRODUCT_CATEGORIES: { id: string; label: string; color: string; icon: string }[] = [
  { id: "saber",        label: "Saber",           color: "#8b5cf6", icon: "🎓" },
  { id: "ter",          label: "Ter",             color: "#06b6d4", icon: "📦" },
  { id: "executar",     label: "Executar",        color: "#22c55e", icon: "⚙️" },
  { id: "potencializar",label: "Potencializar",   color: "#f59e0b", icon: "🚀" },
  { id: "destrava",     label: "Destrava Receita",color: "#ef4444", icon: "🔓" },
  { id: "outros",       label: "Outros",          color: "#94a3b8", icon: "📋" },
];

export function getCategoryConfig(categoryId: string) {
  return PRODUCT_CATEGORIES.find((c) => c.id === categoryId) ?? PRODUCT_CATEGORIES[4];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: prods, error: e1 }, { data: mats, error: e2 }] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("category", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("product_materials")
          .select("*")
          .eq("active", true)
          .order("type", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;

      // Attach materials to each product
      const matsMap = new Map<string, ProductMaterial[]>();
      (mats as ProductMaterial[] ?? []).forEach((m) => {
        const arr = matsMap.get(m.product_id) ?? [];
        arr.push(m);
        matsMap.set(m.product_id, arr);
      });

      const products = (prods as Product[] ?? []).map((p) => ({
        ...p,
        materials: matsMap.get(p.id) ?? [],
      }));

      setProducts(products);
    } catch (e) {
      setError((e as Error).message ?? "Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const saveProduct = useCallback(
    async (formData: ProductFormData, id?: string): Promise<void> => {
      // Parse como_entrego_dados_raw if provided
      let como_entrego_dados = null;
      if (formData.como_entrego_dados_raw?.trim()) {
        try {
          como_entrego_dados = JSON.parse(formData.como_entrego_dados_raw);
        } catch {
          // If not valid JSON, store as a single-task array
          como_entrego_dados = null;
        }
      }

      const payload = {
        name:               formData.name.trim(),
        category:           formData.category,
        billing_type:       formData.billing_type,
        default_price:      formData.default_price,
        active:             formData.active,
        updated_at:         new Date().toISOString(),
        // Basic extras
        duracao:            formData.duracao?.trim() || null,
        dono:               formData.dono?.trim() || null,
        // Section fields
        description:        formData.description?.trim() || null,
        descricao_card:     formData.descricao_card?.trim() || null,
        escopo:             formData.escopo?.trim() || null,
        formato_entrega:    formData.formato_entrega?.trim() || null,
        time_envolvido:     formData.time_envolvido?.trim() || null,
        para_quem_serve:    formData.para_quem_serve?.trim() || null,
        como_entrega_valor: formData.como_entrega_valor?.trim() || null,
        como_vendo:         formData.como_vendo?.trim() || null,
        o_que_entrego:      formData.o_que_entrego?.trim() || null,
        como_entrego_dados: como_entrego_dados,
      };

      if (id) {
        const { error: err } = await supabase
          .from("products")
          .update(payload)
          .eq("id", id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("products")
          .insert([payload]);
        if (err) throw err;
      }
      await loadProducts();
    },
    [loadProducts]
  );

  const deleteProduct = useCallback(
    async (id: string): Promise<void> => {
      const { error: err } = await supabase
        .from("products")
        .delete()
        .eq("id", id);
      if (err) throw err;
      await loadProducts();
    },
    [loadProducts]
  );

  const toggleActive = useCallback(
    async (id: string, active: boolean): Promise<void> => {
      const { error: err } = await supabase
        .from("products")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (err) throw err;
      await loadProducts();
    },
    [loadProducts]
  );

  const activeProducts = products.filter((p) => p.active);
  const recurringProducts = activeProducts.filter((p) => p.billing_type === "recurring");
  const onetimeProducts = activeProducts.filter((p) => p.billing_type === "one_time");

  return {
    products,
    activeProducts,
    recurringProducts,
    onetimeProducts,
    loading,
    error,
    loadProducts,
    saveProduct,
    deleteProduct,
    toggleActive,
    EMPTY_FORM,
  };
}
