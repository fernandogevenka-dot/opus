import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { WikiPage, Client } from "@/types";

export function useWiki() {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<WikiPage[]>([]);
  const [aiAnswer, setAIAnswer] = useState<string>("");
  const [aiSearching, setAISearching] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    loadPages();
    loadClients();
  }, []);

  async function loadPages() {
    setLoading(true);
    const { data } = await supabase
      .from("wiki_pages")
      .select("*, author:users(id, name, avatar_url)")
      .is("parent_id", null)
      .order("updated_at", { ascending: false });
    if (data) setPages(data as WikiPage[]);
    setLoading(false);
  }

  async function loadClients() {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("name");
    if (data) setClients(data as Client[]);
  }

  async function loadPage(id: string) {
    const { data } = await supabase
      .from("wiki_pages")
      .select("*, author:users(id, name, avatar_url), children:wiki_pages(*)")
      .eq("id", id)
      .single();
    if (data) setActivePage(data as WikiPage);
    return data as WikiPage | null;
  }

  async function savePage(
    id: string | null,
    title: string,
    content: unknown,
    parentId: string | null = null,
    icon: string = "📄"
  ) {
    if (!user) return null;

    if (id) {
      const { data } = await supabase
        .from("wiki_pages")
        .update({ title, content, icon, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      await loadPages();
      return data;
    } else {
      const { data } = await supabase
        .from("wiki_pages")
        .insert({ title, content, parent_id: parentId, author_id: user.id, icon })
        .select()
        .single();

      // Grant XP for wiki contribution
      await supabase.from("xp_events").insert({
        user_id: user.id,
        type: "wiki_contribution",
        xp: 15,
        reference_id: data?.id,
        description: `Documentou: ${title}`,
      });
      await supabase.rpc("increment_user_xp", { p_user_id: user.id, p_xp: 15 });

      await loadPages();
      return data;
    }
  }

  async function deletePage(id: string) {
    await supabase.from("wiki_pages").delete().eq("id", id);
    setActivePage(null);
    await loadPages();
  }

  async function aiSearch(query: string) {
    setAISearching(true);
    setAIAnswer("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wiki-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ query }),
        }
      );

      const data = await response.json();
      setAIAnswer(data.answer ?? "Não encontrei informações sobre isso na base de conhecimento.");
      setSearchResults(data.sources ?? []);
    } catch {
      setAIAnswer("Erro ao pesquisar. Tente novamente.");
    } finally {
      setAISearching(false);
    }
  }

  async function saveClient(client: Partial<Client>) {
    if (!user) return null;
    if (client.id) {
      const { data } = await supabase
        .from("clients")
        .update({ ...client, updated_at: new Date().toISOString() })
        .eq("id", client.id)
        .select()
        .single();
      await loadClients();
      return data;
    } else {
      const { data } = await supabase
        .from("clients")
        .insert({ ...client, team_id: user.id })
        .select()
        .single();
      await loadClients();
      return data;
    }
  }

  return {
    pages,
    clients,
    activePage,
    loading,
    searchResults,
    aiAnswer,
    aiSearching,
    loadPage,
    savePage,
    deletePage,
    aiSearch,
    saveClient,
    setActivePage,
  };
}
