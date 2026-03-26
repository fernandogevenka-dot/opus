// ─── Catálogo de produtos ─────────────────────────────────────────────────────
//
// 4 categorias principais, cada uma com seus produtos.
// O campo main_product nos clientes armazena o nome do produto.
// Ao exibir/filtrar, usa-se a categoria para agrupar.

export interface ProductItem {
  id: string;
  name: string;
  categoryId: string;
}

export interface ProductCategory {
  id: string;
  label: string;
  description: string;
  color: string;
  icon: string; // emoji usado em contextos sem ícone Lucide
  products: ProductItem[];
}

export const PRODUCT_CATALOG: ProductCategory[] = [
  {
    id: "saber",
    label: "Saber",
    description: "Diagnósticos, consultorias e estruturação estratégica",
    color: "#8b5cf6",
    icon: "🎓",
    products: [
      { id: "estruturacao-estrategica", name: "Estruturação Estratégica", categoryId: "saber" },
      { id: "dr-x",                    name: "DR-X",                    categoryId: "saber" },
      { id: "dr-o",                    name: "DR-O",                    categoryId: "saber" },
    ],
  },
  {
    id: "ter",
    label: "Ter",
    description: "Entregáveis e ativos que o cliente passa a possuir",
    color: "#06b6d4",
    icon: "📦",
    products: [
      { id: "implementacao-crm-marketing", name: "Implementação de CRM de Marketing", categoryId: "ter" },
      { id: "site",                        name: "Site",                               categoryId: "ter" },
    ],
  },
  {
    id: "executar",
    label: "Executar",
    description: "Serviços recorrentes de execução operacional",
    color: "#22c55e",
    icon: "⚙️",
    products: [
      { id: "profissional-midia-compartilhado", name: "Profissional de Mídia — Compartilhado", categoryId: "executar" },
      { id: "profissional-midia-semi",          name: "Profissional de Mídia — Semi Dedicado", categoryId: "executar" },
      { id: "profissional-midia-dedicado",      name: "Profissional de Mídia — Dedicado",      categoryId: "executar" },
    ],
  },
  {
    id: "potencializar",
    label: "Potencializar",
    description: "Aceleradores e expansão de resultados",
    color: "#f59e0b",
    icon: "🚀",
    products: [],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna todos os produtos numa lista plana. */
export const ALL_PRODUCTS: ProductItem[] = PRODUCT_CATALOG.flatMap((c) => c.products);

/** Encontra a categoria de um produto pelo nome. */
export function getCategoryForProduct(productName: string): ProductCategory | undefined {
  return PRODUCT_CATALOG.find((cat) =>
    cat.products.some((p) => p.name === productName),
  );
}

/** Retorna config da categoria pelo id. */
export function getCategoryById(id: string): ProductCategory | undefined {
  return PRODUCT_CATALOG.find((c) => c.id === id);
}
