import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Target, Users, BarChart3, Zap, ArrowUpRight, ArrowDownRight,
  Minus, ChevronRight, Activity,
} from "lucide-react";
import { useGTMCockpit, type ClientHealthScore, type MonthWaterfall } from "@/hooks/useGTMCockpit";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtMRR(value: number): string {
  if (value >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)    return `R$${(value / 1_000).toFixed(1)}k`;
  return `R$${value.toLocaleString("pt-BR")}`;
}

function fmtPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// ── Componentes de UI ──────────────────────────────────────────────────────────
function MetricCard({
  title,
  value,
  benchmark,
  benchmarkLabel,
  status,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  benchmark?: string;
  benchmarkLabel?: string;
  status: "ok" | "warn" | "bad" | "neutral";
  subtitle?: string;
  icon: React.ElementType;
}) {
  const statusColors = {
    ok:      "border-emerald-500/30 bg-emerald-500/5",
    warn:    "border-amber-500/30 bg-amber-500/5",
    bad:     "border-red-500/30 bg-red-500/5",
    neutral: "border-border bg-card",
  };
  const valueColors = {
    ok:      "text-emerald-400",
    warn:    "text-amber-400",
    bad:     "text-red-400",
    neutral: "text-foreground",
  };
  const iconColors = {
    ok:      "text-emerald-500",
    warn:    "text-amber-500",
    bad:     "text-red-500",
    neutral: "text-violet-500",
  };

  return (
    <div className={`rounded-xl border p-4 ${statusColors[status]}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium">{title}</span>
        <Icon size={15} className={iconColors[status]} />
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueColors[status]}`}>{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      {benchmark && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1 text-xs text-muted-foreground">
          <Target size={10} />
          <span>{benchmarkLabel ?? "Benchmark"}: {benchmark}</span>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ClientHealthScore["status"] }) {
  const map = {
    saudavel: { label: "Saudável",  bg: "bg-emerald-500/15 text-emerald-400" },
    atencao:  { label: "Atenção",   bg: "bg-amber-500/15 text-amber-400"   },
    risco:    { label: "Risco",     bg: "bg-red-500/15 text-red-400"       },
    critico:  { label: "Crítico",   bg: "bg-zinc-700 text-zinc-300"        },
  };
  const s = map[status];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg}`}>
      {s.label}
    </span>
  );
}

function ScoreDot({ status }: { status: ClientHealthScore["status"] }) {
  const colors = {
    saudavel: "bg-emerald-500",
    atencao:  "bg-amber-500",
    risco:    "bg-red-500",
    critico:  "bg-zinc-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status]}`} />;
}

// ── Gráfico de barras waterfall simples ───────────────────────────────────────
function WaterfallChart({ data }: { data: MonthWaterfall[] }) {
  const maxMRR = Math.max(...data.map((d) => d.mrr), 1);

  return (
    <div className="flex items-end gap-1.5 h-28 w-full">
      {data.map((d) => {
        const height = Math.max((d.mrr / maxMRR) * 100, 4);
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative flex flex-col justify-end" style={{ height: "96px" }}>
              {/* barra total */}
              <div
                className="w-full rounded-t-sm bg-violet-500/20 relative overflow-hidden"
                style={{ height: `${height}%` }}
              >
                {/* novo (verde) */}
                {d.novo > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-emerald-500/70"
                    style={{ height: `${(d.novo / d.mrr) * 100}%` }}
                  />
                )}
                {/* expandido (azul) */}
                {d.expandido > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-cyan-500/70"
                    style={{
                      height: `${(d.expandido / d.mrr) * 100}%`,
                      bottom: `${(d.novo / d.mrr) * 100}%`,
                    }}
                  />
                )}
              </div>
              {/* churned (vermelho, abaixo) */}
              {d.churned > 0 && (
                <div
                  className="w-full bg-red-500/40 rounded-b-sm -mt-0.5"
                  style={{ height: `${Math.max((d.churned / maxMRR) * 100, 2)}%` }}
                />
              )}
            </div>
            <span className="text-[9px] text-muted-foreground capitalize">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export function GTMCockpitPage() {
  const { data, loading } = useGTMCockpit();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-sm animate-pulse">Carregando cockpit GTM…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <BarChart3 size={40} className="text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Nenhum dado encontrado. Cadastre clientes e projetos para ver o cockpit.
        </p>
      </div>
    );
  }

  const {
    mrrAtual, crescimentoMedio, horizonteInfo, modalDominante,
    grr, nrr, churnRate, waterfall,
    healthScores, healthDist, totalAtivos,
    productMix, tierCounts,
    gargalo,
  } = data;

  // Status das métricas GTM-5
  const grrStatus  = grr  >= 85 ? "ok" : grr  >= 70 ? "warn" : "bad";
  const nrrStatus  = nrr  >= 100 ? "ok" : nrr  >= 85 ? "warn" : "bad";
  const crescStatus = crescimentoMedio >= horizonteInfo.benchmarkCrescimento ? "ok"
    : crescimentoMedio >= horizonteInfo.benchmarkCrescimento * 0.6 ? "warn" : "bad";
  const churnStatus = churnRate <= 3 ? "ok" : churnRate <= 7 ? "warn" : "bad";

  const gargaloColor = {
    ok:        "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    retencao:  "border-red-500/30 bg-red-500/5 text-red-400",
    expansao:  "border-amber-500/30 bg-amber-500/5 text-amber-400",
    aquisicao: "border-violet-500/30 bg-violet-500/5 text-violet-400",
  }[gargalo.tipo];

  // Tier mais relevante (por MRR)
  const tierEntries = Object.entries(tierCounts).sort((a, b) => b[1].mrr - a[1].mrr);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Activity size={18} className="text-violet-500" />
              GTM Cockpit
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visão integrada da unidade · atualizado com os dados cadastrados
            </p>
          </div>
        </motion.div>

        {/* ── BLOCO 1: Posição da Unidade ──────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Posição da Unidade
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Horizonte */}
            <div className="col-span-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Horizonte Atual</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                  {horizonteInfo.fase}
                </span>
              </div>
              <div className="text-2xl font-bold text-violet-400">{horizonteInfo.horizonte}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{horizonteInfo.range}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {horizonteInfo.modaisLiberados.map((m) => (
                  <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                    {m}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Benchmark crescimento: ≥ {horizonteInfo.benchmarkCrescimento}%/mês · Prazo máx: {horizonteInfo.prazoMax}
              </p>
            </div>

            {/* MRR */}
            <MetricCard
              title="MRR Atual"
              value={fmtMRR(mrrAtual)}
              subtitle={`${totalAtivos} clientes ativos`}
              status="neutral"
              icon={TrendingUp}
            />

            {/* Crescimento */}
            <MetricCard
              title="Crescimento Médio"
              value={fmtPct(crescimentoMedio)}
              subtitle="últimos 3 meses"
              benchmark={`≥ ${horizonteInfo.benchmarkCrescimento}%`}
              status={crescStatus}
              icon={crescimentoMedio >= 0 ? TrendingUp : TrendingDown}
            />
          </div>

          {/* Modal dominante */}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Modal dominante:</span>
            <span className="font-semibold text-foreground">{modalDominante}</span>
            <span>·</span>
            <span>Mix de tiers:</span>
            {tierEntries.filter(([, v]) => v.count > 0).map(([tier, v]) => (
              <span key={tier} className="font-medium text-foreground">
                {tier} ({v.count})
              </span>
            ))}
          </div>
        </motion.section>

        {/* ── BLOCO 2: Saúde da Base ────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Saúde da Base · Retenção
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <MetricCard
              title="GRR (Retenção Bruta)"
              value={fmtPct(grr)}
              benchmark="> 85%"
              status={grrStatus}
              subtitle="preservação sem expansão"
              icon={CheckCircle2}
            />
            <MetricCard
              title="NRR (Retenção Líquida)"
              value={fmtPct(nrr)}
              benchmark="> 100%"
              status={nrrStatus}
              subtitle="inclui upsell/expansão"
              icon={ArrowUpRight}
            />
            <MetricCard
              title="Churn Rate"
              value={fmtPct(churnRate)}
              benchmark="< 3%"
              status={churnStatus}
              subtitle="clientes perdidos no mês"
              icon={ArrowDownRight}
            />
            <MetricCard
              title="LTV:CAC"
              value="—"
              benchmark="> 3:1"
              status="neutral"
              subtitle="cadastre CAC nos clientes"
              icon={Target}
            />
          </div>

          {/* Waterfall */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium">Evolução MRR — últimos 6 meses</span>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500/70 inline-block"/> Novo</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500/70 inline-block"/> Expansão</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500/20 inline-block"/> Retido</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/40 inline-block"/> Churn</span>
              </div>
            </div>
            <WaterfallChart data={waterfall} />
            {/* Tabela resumo */}
            <div className="mt-3 grid grid-cols-6 gap-1 text-[10px]">
              {waterfall.map((w) => (
                <div key={w.month} className="text-center space-y-0.5">
                  <div className="font-medium text-foreground">{fmtMRR(w.mrr)}</div>
                  {w.novo > 0 && <div className="text-emerald-400">+{fmtMRR(w.novo)}</div>}
                  {w.churned > 0 && <div className="text-red-400">-{fmtMRR(w.churned)}</div>}
                  {w.expandido > 0 && <div className="text-cyan-400">↑{fmtMRR(w.expandido)}</div>}
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── BLOCO 3: Health Score ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Health Score · {totalAtivos} clientes ativos
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="text-emerald-400 font-medium">🟢 {healthDist.saudavel}</span>
              <span className="text-amber-400 font-medium">🟡 {healthDist.atencao}</span>
              <span className="text-red-400 font-medium">🔴 {healthDist.risco}</span>
              <span className="text-zinc-400 font-medium">⚫ {healthDist.critico}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {healthScores.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum cliente ativo encontrado.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Cabeçalho */}
                <div className="grid grid-cols-12 px-4 py-2 text-[10px] text-muted-foreground font-medium">
                  <span className="col-span-4">Cliente</span>
                  <span className="col-span-2">MRR</span>
                  <span className="col-span-2">Tier / Modal</span>
                  <span className="col-span-2">Score</span>
                  <span className="col-span-2">Status</span>
                </div>
                {healthScores.map((hs) => (
                  <div
                    key={hs.clientId}
                    className="grid grid-cols-12 items-center px-4 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="col-span-4 flex items-center gap-2">
                      <ScoreDot status={hs.status} />
                      <span className="text-sm font-medium truncate">{hs.clientName}</span>
                    </div>
                    <div className="col-span-2 text-sm tabular-nums">{fmtMRR(hs.mrr)}</div>
                    <div className="col-span-2">
                      <div className="text-xs font-medium">{hs.tier}</div>
                      <div className="text-[10px] text-muted-foreground">{hs.modal}</div>
                    </div>
                    <div className="col-span-2">
                      {/* Barra de score */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              hs.status === "saudavel" ? "bg-emerald-500" :
                              hs.status === "atencao"  ? "bg-amber-500"  :
                              hs.status === "risco"    ? "bg-red-500"    : "bg-zinc-500"
                            }`}
                            style={{ width: `${hs.score}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-7 text-right">{hs.score}</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <StatusBadge status={hs.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>

        {/* ── BLOCO 4: Mix de Produtos + Gargalo TOC ───────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Mix de Produtos & Gargalo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Mix STEP */}
            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-xs font-medium mb-3 block">Receita por categoria STEP</span>
              {productMix.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Associe produtos aos projetos para ver o breakdown.
                </p>
              ) : (
                <div className="space-y-2">
                  {productMix.map((p) => {
                    const pct = mrrAtual > 0 ? (p.mrr / mrrAtual) * 100 : 0;
                    return (
                      <div key={p.category}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium" style={{ color: p.color }}>{p.label}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {fmtMRR(p.mrr)} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: p.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gargalo TOC */}
            <div className={`rounded-xl border p-4 ${gargaloColor}`}>
              <div className="flex items-start gap-2 mb-2">
                {gargalo.tipo === "ok" ? (
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <span className="text-sm font-semibold block">{gargalo.titulo}</span>
                  <span className="text-[10px] opacity-70">
                    {gargalo.metrica}: {gargalo.valor} · benchmark {gargalo.benchmark}
                  </span>
                </div>
              </div>
              <p className="text-xs opacity-80 mb-3">{gargalo.descricao}</p>
              <div className="flex items-start gap-1.5 text-xs">
                <ChevronRight size={13} className="mt-0.5 flex-shrink-0" />
                <span className="font-medium">{gargalo.acao}</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Rodapé */}
        <div className="text-[10px] text-muted-foreground/50 text-center pb-4">
          Metodologia V4 Company · EMPS 2.0 · GTM Engineering SCIENT 2026
        </div>

      </div>
    </div>
  );
}
