import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type {
  UserProfile,
  UserProfileEnriched,
  ProfileSkill,
  CareerEntry,
  EducationEntry,
  CertificationEntry,
  Departamento,
  LocalTrabalho,
} from "@/types";

// ─── Dados estáticos do Notion (mesmo array do InvestidoresPanel) ──────────────
// Somente campos que fazem sentido como "fonte verdadeira" do Notion.
// O frontend faz o merge pelo email.

interface NotionMember {
  nome: string;
  email?: string;
  cargo: string;
  departamento: string;
  squad?: string;
  step?: string;
  local: string;
  joined?: string;   // "DD/MM/AAAA"
  lt?: number;
  aging?: string;
  linkedin?: string;
  phone?: string;
  photo?: string;
  id?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const N = (path: string) =>
  `${SUPABASE_URL}/functions/v1/notion-image-proxy?url=${encodeURIComponent(`https://www.notion.so/image/${path}`)}`;

// Lista completa dos membros do Notion (fonte de dados read-only)
export const NOTION_MEMBERS: NotionMember[] = [
  { id: 2,  nome: "Fernando Gevenka",    email: "fernando.gevenka@v4company.com", cargo: "Diretor PE&G",          local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",     step: "🧐 S - Saber",        lt: 60, joined: "01/03/2021", aging: "🔴 +48m", linkedin: "https://linkedin.com/in/...33595/", phone: "+55 47 99690-4373", photo: N("attachment%3A044e57a4-3c69-4226-bc28-328408cbb761%3Aimage.png?table=block&id=3058ba96-5ef3-80e4-af42-e040fdb2eac4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gabriel Fragoso",     email: "gabriel.fragoso@v4company.com",     cargo: "Coordenador ADM",       local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",     photo: N("attachment%3A1e8af1f3-deb3-48c0-9cf9-b79eb045bdc2%3Aimage.png?table=block&id=3088ba96-5ef3-806d-b997-f6f248831575&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Henrique",            cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3Ab3701ca8-64af-436b-ba53-48ad3ea94d96%3A458289353_863409365386280_2505678977002282105_n.jpg_stpdst-jpg_s320x320_tt6efgeyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0_nc") },
  { nome: "Luis Felipe",         cargo: "Coordenador Receita",   local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad Receita", photo: N("attachment%3A60da587d-028b-48f3-a43c-b58d14512947%3Aimage.png?table=block&id=3088ba96-5ef3-801c-b505-cfea39a0be28&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Matheus Azael",       cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3Ae84915a4-d587-40b3-ba78-f1e0fe5f9530%3Aimage.png?table=block&id=3088ba96-5ef3-804b-a436-de3f132f9322&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Jean Martins",        cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🎖️ SEALS",     step: "🧐 S - Saber",        photo: N("attachment%3A12afa236-e0ed-48f9-b66c-8bb55f7f3d8b%3Aimage.png?table=block&id=3088ba96-5ef3-80ca-913b-c2636cffe821&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Matheus Xavier",      cargo: "CSM",                   local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad Receita", photo: N("attachment%3Ad9dd2672-fb10-4359-8f06-91a0a22dc029%3Aimage.png?table=block&id=3088ba96-5ef3-80d8-b8e8-fa0d4a426986&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "João Gabriel",        cargo: "Closer",                local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad Receita", photo: N("attachment%3Aaf711c68-7133-47ef-8d99-981e332a1f89%3Aimage.png?table=block&id=3088ba96-5ef3-8006-aef2-d7863a7fe2f8&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Kelvin Seidel",       cargo: "Gestor de Tráfego",     local: "🏠 Home", departamento: "03 - PE&G",   squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3A126fce4f-94ab-4390-9b04-c29990cb717e%3Aimage.png?table=block&id=3088ba96-5ef3-80d2-9b53-e5c32297962e&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Calebe",              cargo: "Account Manager",       local: "🏭 SBS", departamento: "03 - PE&G",    squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3A4b64dcdb-eb24-4cd4-b2e8-61b98af257a2%3Aimage.png?table=block&id=3088ba96-5ef3-800e-9517-ebbfcd1b684b&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Paulo Scudieri",      cargo: "People & Performance",  local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",     photo: N("attachment%3A9355b579-85d2-44c4-8c51-64101185bfd6%3APaulo_Scudieri.png?table=block&id=3088ba96-5ef3-8065-8668-c0618f6c2223&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Eduardo Vieira",      cargo: "Gestor de Tráfego",     local: "🏭 SBS", departamento: "03 - PE&G",    squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3Ace4dd99e-e1ca-4423-ba43-28e9d9d6fc7c%3Aimage.png?table=block&id=3088ba96-5ef3-8010-9573-d42b5132ee44&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Bruno Antunes",       cargo: "Closer",                local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad Receita", photo: N("attachment%3A73585353-d364-4a66-a148-7c5d27269079%3Aimage.png?table=block&id=3088ba96-5ef3-8081-9c39-e29cda6e0175&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Vinícius Paiva",      cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A15386b3f-346a-4954-93ca-646f2d01102d%3Aimage.png?table=block&id=3088ba96-5ef3-80df-8bb4-fcbf78d84ccc&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Nayane",              cargo: "Designer",              local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3A1a99aef0-7a89-4860-894a-05bec6627ae1%3Aimage.png?table=block&id=3088ba96-5ef3-80d1-9654-ea31819e9a35&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Filipe Redó",         cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🤖 JARVIS",     step: "🤖T - Ter",           photo: N("attachment%3A784dc879-0421-4750-b3b8-c81db2ed271b%3Aimage.png?table=block&id=3088ba96-5ef3-80ec-a65b-c80ef9470f11&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Daniel Canquerino",   cargo: "SDR",                   local: "🏠 Home", departamento: "02 - Receita", squad: "Squad Receita", photo: N("attachment%3A762f03e8-a5ef-499a-9ed0-dba27cbe37d6%3Aimage.png?table=block&id=3088ba96-5ef3-8081-8dc7-ed745edeb175&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gabriel Araújo",      cargo: "Designer",              local: "🏭 SBS", departamento: "03 - PE&G",    squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3A023efafc-93e7-4ef3-9421-882474540f0c%3Aimage.png?table=block&id=3088ba96-5ef3-80c3-91ab-e74e8528f576&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Caike Gasparin",      cargo: "Account Manager",       local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3A7789104b-18f9-4c5a-935f-28296b25a4b7%3Aimage.png?table=block&id=3088ba96-5ef3-80cb-9024-faef1a8c6e22&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Samira Barbosa",      cargo: "Designer",              local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎖️ SEALS",     step: "🧐 S - Saber",        photo: N("attachment%3A085fcc7a-2136-4469-8924-0b8c22622b33%3Aimage.png?table=block&id=3088ba96-5ef3-8084-a07a-ec37fef6d822&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Wilgner",             cargo: "Gestor de Tráfego",     local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3A8a1814f2-9a7c-461b-8306-5d17e534bacb%3Aimage.png?table=block&id=3088ba96-5ef3-8035-ad0e-f46b2a97f7f4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gabriele Bucci",      cargo: "SDR",                   local: "🏭 SBS", departamento: "03 - PE&G",    squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3A5cfe6f53-91be-4925-a679-71c30c622901%3Aimage.png?table=block&id=3088ba96-5ef3-8069-8cba-c3b6e5a6d69c&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Julio Santos",        cargo: "Consultor Especialista",local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🎖️ SEALS",     step: "🧐 S - Saber",        photo: N("attachment%3A3496cf08-2fd6-41b6-840b-c6356c25e91d%3Aimage.png?table=block&id=3088ba96-5ef3-8032-8831-f34ca6261537&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Matheus Redó",        cargo: "Analista Financeiro",   local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",     photo: N("attachment%3Ad61fa0b7-b01b-4c5c-906f-2db2e2f341ab%3Aimage.png?table=block&id=3088ba96-5ef3-80fd-9e2c-e9a7a7598011&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Marcelo Ferreira",    cargo: "SDR",                   local: "🏠 Home", departamento: "02 - Receita", squad: "Squad Receita", photo: N("attachment%3A03f4ecd4-fb76-4284-acd0-333bc715d903%3Aimage.png?table=block&id=3088ba96-5ef3-80b2-bfd0-fc9035af868d&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Augusto Fontoura",    cargo: "Account Manager",       local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A10241fee-29d2-494f-a538-8111df779c90%3Aimage.png?table=block&id=3088ba96-5ef3-8085-9dcf-db74ca41f2a4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Dayan do Amaral",     cargo: "Account Manager",       local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A7d285a41-5c1c-4ce0-88b6-652b7d25e2fe%3Aimage.png?table=block&id=3088ba96-5ef3-80e1-ab51-e114f62b809c&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Willian Briski",      cargo: "Gestor de Tráfego",     local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A7e2a1d31-ca10-4e69-bd17-cea5156d1a3f%3Aimage.png?table=block&id=3088ba96-5ef3-80bf-b5f9-f279fbf0a7c4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Júlia Monaco",        cargo: "Account Manager",       local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A00c6b60c-8290-4385-b476-4c633ee48ce3%3Aimage.png?table=block&id=3088ba96-5ef3-801f-b42c-fdc7f122024a&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Guilherme Moreira",   cargo: "Designer",              local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A53b45e54-c255-4df6-9f88-d7e8ad20aae5%3AGUILHERME_DE_ALMEIDA_MOREIRA_-_FOTO_ORIGINAL.png?table=block&id=2318ba96-5ef3-8099-85f6-f43ac7171702&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Airton",              cargo: "Account Manager",       local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3A323fd469-a380-47f5-846d-32db652178ec%3Aimage.png?table=block&id=1f38ba96-5ef3-80ea-8fd1-deb808ec4119&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Fernando Rodrigo",    cargo: "Gerente PE&G",          local: "🏭 SBS", departamento: "03 - PE&G",    step: "🧐 S - Saber",  photo: N("attachment%3Ae35e265a-d941-467b-9178-3d396e4fdc41%3AIMG_7280.jpeg?table=block&id=1f38ba96-5ef3-8171-bc78-edf804210d65&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gabriel Sangoi",      cargo: "Designer",              local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3A9efe02d6-92e8-40b1-a85e-ba246ca2d287%3Aimage.png?table=block&id=1f38ba96-5ef3-8057-b415-c30d63f476d4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Hilton",              cargo: "Copywriter",            local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3A3f7acd0d-374b-4dd4-ac89-72af1bd1d4e6%3Aimage.png?table=block&id=1f38ba96-5ef3-8097-a2dc-c2de25795b50&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Isabel Klein",        cargo: "Social Media",          local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3Aa2d9c144-7997-4b01-9e3b-2c3ca684992e%3AIMG_1611.jpeg?table=block&id=1f38ba96-5ef3-8139-8bb1-c57ead19358a&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Kelvin Daniel",       cargo: "Gestor de Tráfego",     local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A18e8afd2-15ec-4537-9205-082b27834ac5%3AKELVIN_DANIEL__-_FOTO_ORIGINAL_(1).jpg?table=block&id=1f38ba96-5ef3-8071-b576-d82eeb53a32f&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Leonardo Scaramella", cargo: "Gestor de Tráfego",     local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3A00369de7-0162-4872-a58e-9dd9a47e15d4%3Aimage.png?table=block&id=1f38ba96-5ef3-80bb-abbe-c3a51de628e0&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Victor (VVV)",        cargo: "Analista Martech",      local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3Aa29e06dc-0528-4147-bcd3-3d292e19f3b1%3Aimage.png?table=block&id=3088ba96-5ef3-809c-9391-e4b84170476f&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Leliane",             cargo: "Especialista Comercial",local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎖️ SEALS",     step: "🧐 S - Saber",        photo: N("attachment%3Abeec40fc-992e-4bba-ad5f-aeb7c9bef0df%3Aimage.png?table=block&id=3088ba96-5ef3-8033-8f82-c0e3dccdb8fa&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Guilherme Soledade",  cargo: "Designer",              local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A3d64b20c-7411-4782-bb49-60693abec9b1%3Aimage.png?table=block&id=3088ba96-5ef3-801a-9e37-c5984d4a17ca&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Emanuel Machado",     cargo: "Account Manager",       local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3Aec8e264e-7c67-4cf4-8b84-56b959b95e0d%3Aimage.png?table=block&id=3088ba96-5ef3-80e5-bee9-f4ac65732296&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Rafaella Bargellini", cargo: "People & Performance",  local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",     photo: N("attachment%3Ae9d2f144-917e-463f-90c2-54ee2541bee8%3Aimage.png?table=block&id=30d8ba96-5ef3-805b-9b12-c4ad7ba27cee&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Aline Ávila",         cargo: "Designer",              local: "🧬 Híbrido", departamento: "03 - PE&G", squad: "🈹 Yakuza",    step: "🛠️ E - Executar",    photo: N("attachment%3Ae13e3f6e-4287-4c42-bfba-23439e6e1c4f%3Aimage.png?table=block&id=3148ba96-5ef3-80dc-abc5-caa12285cde5&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gustavo Avila",       cargo: "Analista Martech",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🤖 JARVIS",     step: "🤖T - Ter",           photo: N("attachment%3A6e97e2c5-d90f-4e31-b2d8-9cc4e13c37e1%3Aimage.png?table=block&id=3148ba96-5ef3-80e5-8c4e-e23b0d67adb2&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
];

/** Encontra o membro Notion pelo email do usuário logado */
export function findNotionMember(email: string): NotionMember | null {
  const normalized = email.toLowerCase().trim();
  return NOTION_MEMBERS.find(
    (m) => m.email?.toLowerCase().trim() === normalized
  ) ?? null;
}

// ─── Hook principal ────────────────────────────────────────────────────────────

export type ProfileDraft = Omit<UserProfile, "user_id" | "created_at" | "updated_at" | "tenure_months" | "aging_auto">;

const DEFAULT_PROFILE: Omit<ProfileDraft, "user_id"> = {
  notion_email: null,
  cover_url: null,
  headline: null,
  bio: null,
  phone: null,
  linkedin_url: null,
  secondary_email: null,
  show_phone: true,
  show_email: true,
  departamento: null,
  squad: null,
  step: null,
  local_trabalho: null,
  cargo: null,
  joined_at: null,
  lt_months: null,
  aging_label: null,
  skills: [],
  career: [],
  education: [],
  certifications: [],
};

export function useProfile(targetUserId?: string) {
  const { user } = useAuthStore();
  const userId = targetUserId ?? user?.id;

  const [profile, setProfile]     = useState<UserProfileEnriched | null>(null);
  const [notionData, setNotionData] = useState<NotionMember | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Fetch profile from Supabase ──────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("user_profiles_enriched")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (data) {
      // Parse JSONB arrays
      const enriched: UserProfileEnriched = {
        ...data,
        skills:         Array.isArray(data.skills)         ? data.skills         : [],
        career:         Array.isArray(data.career)         ? data.career         : [],
        education:      Array.isArray(data.education)      ? data.education      : [],
        certifications: Array.isArray(data.certifications) ? data.certifications : [],
      };
      setProfile(enriched);

      // Vincula com Notion pelo email
      const emailToSearch = enriched.notion_email ?? enriched.email;
      if (emailToSearch) {
        setNotionData(findNotionMember(emailToSearch));
      }
    } else {
      // Perfil não existe ainda — cria automaticamente e usa defaults
      await ensureProfile(userId);
    }

    setLoading(false);
  }, [userId]);

  // ── Garante que o perfil existe no banco ─────────────────────────────────────
  async function ensureProfile(uid: string) {
    await supabase.rpc("ensure_user_profile", { p_user_id: uid });
    // Refetch após criação
    const { data } = await supabase
      .from("user_profiles_enriched")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (data) {
      setProfile({
        ...data,
        skills: [], career: [], education: [], certifications: [],
      } as UserProfileEnriched);
      if (user?.email) setNotionData(findNotionMember(user.email));
    }
  }

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Save profile ─────────────────────────────────────────────────────────────
  const saveProfile = useCallback(async (updates: Partial<ProfileDraft>): Promise<boolean> => {
    if (!userId) return false;
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from("user_profiles")
      .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" });

    if (err) {
      setError(err.message);
      setSaving(false);
      return false;
    }

    await fetchProfile();
    setSaving(false);
    return true;
  }, [userId, fetchProfile]);

  // ── Add / remove skill ───────────────────────────────────────────────────────
  const addSkill = useCallback(async (skill: ProfileSkill) => {
    const current: ProfileSkill[] = profile?.skills ?? [];
    const updated = [...current, skill];
    return saveProfile({ skills: updated });
  }, [profile, saveProfile]);

  const removeSkill = useCallback(async (skillName: string) => {
    const updated = (profile?.skills ?? []).filter((s) => s.name !== skillName);
    return saveProfile({ skills: updated });
  }, [profile, saveProfile]);

  // ── Career ───────────────────────────────────────────────────────────────────
  const addCareerEntry = useCallback(async (entry: CareerEntry) => {
    const updated = [...(profile?.career ?? []), entry];
    return saveProfile({ career: updated });
  }, [profile, saveProfile]);

  const removeCareerEntry = useCallback(async (index: number) => {
    const updated = (profile?.career ?? []).filter((_, i) => i !== index);
    return saveProfile({ career: updated });
  }, [profile, saveProfile]);

  // ── Education ────────────────────────────────────────────────────────────────
  const addEducation = useCallback(async (entry: EducationEntry) => {
    const updated = [...(profile?.education ?? []), entry];
    return saveProfile({ education: updated });
  }, [profile, saveProfile]);

  const removeEducation = useCallback(async (index: number) => {
    const updated = (profile?.education ?? []).filter((_, i) => i !== index);
    return saveProfile({ education: updated });
  }, [profile, saveProfile]);

  // ── Certifications ───────────────────────────────────────────────────────────
  const addCertification = useCallback(async (entry: CertificationEntry) => {
    const updated = [...(profile?.certifications ?? []), entry];
    return saveProfile({ certifications: updated });
  }, [profile, saveProfile]);

  const removeCertification = useCallback(async (index: number) => {
    const updated = (profile?.certifications ?? []).filter((_, i) => i !== index);
    return saveProfile({ certifications: updated });
  }, [profile, saveProfile]);

  // ── Merged view: dados do Supabase + overlay Notion (read-only) ──────────────
  // Regra: campo Supabase tem prioridade; Notion preenche vazios
  const merged = profile ? {
    ...profile,
    // Se o campo no Supabase está vazio, usa dado do Notion como fallback visual
    cargo:         profile.cargo         ?? notionData?.cargo         ?? null,
    departamento:  profile.departamento  ?? notionData?.departamento  as Departamento | null ?? null,
    squad:         profile.squad         ?? notionData?.squad         ?? null,
    step:          profile.step          ?? notionData?.step          ?? null,
    local_trabalho: profile.local_trabalho ?? notionData?.local        as LocalTrabalho | null ?? null,
    phone:         profile.phone         ?? notionData?.phone         ?? null,
    linkedin_url:  profile.linkedin_url  ?? notionData?.linkedin      ?? null,
    joined_at:     profile.joined_at     ?? (notionData?.joined ? parseNotionDate(notionData.joined) : null),
    // Foto do Notion como fallback para o cover quando não tem cover_url configurado
    _notion_photo: notionData?.photo ?? null,
  } : null;

  return {
    profile: merged,
    rawProfile: profile,
    notionData,
    loading,
    saving,
    error,
    saveProfile,
    addSkill,
    removeSkill,
    addCareerEntry,
    removeCareerEntry,
    addEducation,
    removeEducation,
    addCertification,
    removeCertification,
    refetch: fetchProfile,
    DEFAULT_PROFILE,
  };
}

/** Converte "DD/MM/AAAA" → "AAAA-MM-DD" */
function parseNotionDate(d: string): string | null {
  const parts = d.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}`;
}

export type { NotionMember, ProfileSkill, CareerEntry, EducationEntry, CertificationEntry };
