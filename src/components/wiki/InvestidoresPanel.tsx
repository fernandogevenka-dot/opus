import { useState } from "react";
import { Search, X, Users, MapPin, Building2, Calendar, Phone, Mail, Linkedin, Hash, Clock } from "lucide-react";

// Proxy via Supabase Edge Function — resolve CORS e autenticação do Notion
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
function proxyNotionImage(notionPath: string): string {
  const rawUrl = `https://www.notion.so/image/${notionPath}`;
  return `${SUPABASE_URL}/functions/v1/notion-image-proxy?url=${encodeURIComponent(rawUrl)}`;
}

interface Membro {
  nome: string;
  cargo: string;
  local: "🏭 SBS" | "🏠 Home" | "🧬 Híbrido";
  departamento: string;
  squad?: string;
  step?: string;
  tags?: string[];
  photo?: string;
  // Campos extras (Notion)
  lt?: number;           // LT em meses
  joined?: string;       // "DD/MM/AAAA"
  termination?: string;
  aging?: string;        // ex: "🔴 +48m"
  linkedin?: string;
  phone?: string;
  email?: string;
  id?: number;
}

const N = (path: string) => proxyNotionImage(path);

const MEMBROS: Membro[] = [
  { id: 2,  nome: "Fernando Gevenka",    cargo: "Diretor PE&G",          local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",     step: "🧐 S - Saber",        lt: 60, joined: "01/03/2021", aging: "🔴 +48m", linkedin: "linkedin.com/in/...33595/", phone: "+55 47 99690-4373", email: "fernando.gevenka@v4company.com", photo: N("attachment%3A044e57a4-3c69-4226-bc28-328408cbb761%3Aimage.png?table=block&id=3058ba96-5ef3-80e4-af42-e040fdb2eac4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gabriel Fragoso",     cargo: "Coordenador ADM",       local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",                                  photo: N("attachment%3A1e8af1f3-deb3-48c0-9cf9-b79eb045bdc2%3Aimage.png?table=block&id=3088ba96-5ef3-806d-b997-f6f248831575&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Henrique",            cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3Ab3701ca8-64af-436b-ba53-48ad3ea94d96%3A458289353_863409365386280_2505678977002282105_n.jpg_stpdst-jpg_s320x320_tt6efgeyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0_nc") },
  { nome: "Luis Felipe",         cargo: "Coordenador Receita",   local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad Receita",                               photo: N("attachment%3A60da587d-028b-48f3-a43c-b58d14512947%3Aimage.png?table=block&id=3088ba96-5ef3-801c-b505-cfea39a0be28&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Matheus Azael",       cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3Ae84915a4-d587-40b3-ba78-f1e0fe5f9530%3Aimage.png?table=block&id=3088ba96-5ef3-804b-a436-de3f132f9322&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Jean Martins",        cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🎖️ SEALS",     step: "🧐 S - Saber",        photo: N("attachment%3A12afa236-e0ed-48f9-b66c-8bb55f7f3d8b%3Aimage.png?table=block&id=3088ba96-5ef3-80ca-913b-c2636cffe821&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Matheus Xavier",      cargo: "CSM",                   local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad Receita",                               photo: N("attachment%3Ad9dd2672-fb10-4359-8f06-91a0a22dc029%3Aimage.png?table=block&id=3088ba96-5ef3-80d8-b8e8-fa0d4a426986&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "João Gabriel",        cargo: "Closer",                local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad Receita",                               photo: N("attachment%3Aaf711c68-7133-47ef-8d99-981e332a1f89%3Aimage.png?table=block&id=3088ba96-5ef3-8006-aef2-d7863a7fe2f8&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Kelvin Seidel",       cargo: "Gestor de Tráfego",     local: "🏠 Home", departamento: "03 - PE&G",   squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3A126fce4f-94ab-4390-9b04-c29990cb717e%3Aimage.png?table=block&id=3088ba96-5ef3-80d2-9b53-e5c32297962e&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Calebe",              cargo: "Account Manager",       local: "🏭 SBS", departamento: "03 - PE&G",    squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3A4b64dcdb-eb24-4cd4-b2e8-61b98af257a2%3Aimage.png?table=block&id=3088ba96-5ef3-800e-9517-ebbfcd1b684b&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Paulo Scudieri",      cargo: "People & Performance",  local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",                                  photo: N("attachment%3A9355b579-85d2-44c4-8c51-64101185bfd6%3APaulo_Scudieri.png?table=block&id=3088ba96-5ef3-8065-8668-c0618f6c2223&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Eduardo Vieira",      cargo: "Gestor de Tráfego",     local: "🏭 SBS", departamento: "03 - PE&G",    squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3Ace4dd99e-e1ca-4423-ba43-28e9d9d6fc7c%3Aimage.png?table=block&id=3088ba96-5ef3-8010-9573-d42b5132ee44&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Bruno Antunes",       cargo: "Closer",                local: "🏭 SBS", departamento: "02 - Receita", squad: "Squad Receita",                               photo: N("attachment%3A73585353-d364-4a66-a148-7c5d27269079%3Aimage.png?table=block&id=3088ba96-5ef3-8081-9c39-e29cda6e0175&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Vinícius Paiva",      cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A15386b3f-346a-4954-93ca-646f2d01102d%3Aimage.png?table=block&id=3088ba96-5ef3-80df-8bb4-fcbf78d84ccc&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Nayane",              cargo: "Designer",              local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3A1a99aef0-7a89-4860-894a-05bec6627ae1%3Aimage.png?table=block&id=3088ba96-5ef3-80d1-9654-ea31819e9a35&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Filipe Redó",         cargo: "Coordenador PE&G",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🤖 JARVIS",     step: "🤖T - Ter",           photo: N("attachment%3A784dc879-0421-4750-b3b8-c81db2ed271b%3Aimage.png?table=block&id=3088ba96-5ef3-80ec-a65b-c80ef9470f11&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Daniel Canquerino",   cargo: "SDR",                   local: "🏠 Home", departamento: "02 - Receita", squad: "Squad Receita",                              photo: N("attachment%3A762f03e8-a5ef-499a-9ed0-dba27cbe37d6%3Aimage.png?table=block&id=3088ba96-5ef3-8081-8dc7-ed745edeb175&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gabriel Araújo",      cargo: "Designer",              local: "🏭 SBS", departamento: "03 - PE&G",    squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3A023efafc-93e7-4ef3-9421-882474540f0c%3Aimage.png?table=block&id=3088ba96-5ef3-80c3-91ab-e74e8528f576&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Caike Gasparin",      cargo: "Account Manager",       local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3A7789104b-18f9-4c5a-935f-28296b25a4b7%3Aimage.png?table=block&id=3088ba96-5ef3-80cb-9024-faef1a8c6e22&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Samira Barbosa",      cargo: "Designer",              local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎖️ SEALS",     step: "🧐 S - Saber",        photo: N("attachment%3A085fcc7a-2136-4469-8924-0b8c22622b33%3Aimage.png?table=block&id=3088ba96-5ef3-8084-a07a-ec37fef6d822&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Wilgner",             cargo: "Gestor de Tráfego",     local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3A8a1814f2-9a7c-461b-8306-5d17e534bacb%3Aimage.png?table=block&id=3088ba96-5ef3-8035-ad0e-f46b2a97f7f4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gabriele Bucci",      cargo: "SDR",                   local: "🏭 SBS", departamento: "03 - PE&G",    squad: "Squad P",       step: "📈 P - Potencializar", photo: N("attachment%3A5cfe6f53-91be-4925-a679-71c30c622901%3Aimage.png?table=block&id=3088ba96-5ef3-8069-8cba-c3b6e5a6d69c&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Julio Santos",        cargo: "Consultor Especialista",local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🎖️ SEALS",     step: "🧐 S - Saber",        photo: N("attachment%3A3496cf08-2fd6-41b6-840b-c6356c25e91d%3Aimage.png?table=block&id=3088ba96-5ef3-8032-8831-f34ca6261537&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Matheus Redó",        cargo: "Analista Financeiro",   local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",                                  photo: N("attachment%3Ad61fa0b7-b01b-4c5c-906f-2db2e2f341ab%3Aimage.png?table=block&id=3088ba96-5ef3-80fd-9e2c-e9a7a7598011&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Marcelo Ferreira",    cargo: "SDR",                   local: "🏠 Home", departamento: "02 - Receita", squad: "Squad Receita",                              photo: N("attachment%3A03f4ecd4-fb76-4284-acd0-333bc715d903%3Aimage.png?table=block&id=3088ba96-5ef3-80b2-bfd0-fc9035af868d&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Augusto Fontoura",    cargo: "Account Manager",       local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A10241fee-29d2-494f-a538-8111df779c90%3Aimage.png?table=block&id=3088ba96-5ef3-8085-9dcf-db74ca41f2a4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Dayan do Amaral",     cargo: "Account Manager",       local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A7d285a41-5c1c-4ce0-88b6-652b7d25e2fe%3Aimage.png?table=block&id=3088ba96-5ef3-80e1-ab51-e114f62b809c&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Willian Briski",      cargo: "Gestor de Tráfego",     local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A7e2a1d31-ca10-4e69-bd17-cea5156d1a3f%3Aimage.png?table=block&id=3088ba96-5ef3-80bf-b5f9-f279fbf0a7c4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Júlia Monaco",        cargo: "Account Manager",       local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A00c6b60c-8290-4385-b476-4c633ee48ce3%3Aimage.png?table=block&id=3088ba96-5ef3-801f-b42c-fdc7f122024a&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Guilherme Moreira",   cargo: "Designer",              local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A53b45e54-c255-4df6-9f88-d7e8ad20aae5%3AGUILHERME_DE_ALMEIDA_MOREIRA_-_FOTO_ORIGINAL.png?table=block&id=2318ba96-5ef3-8099-85f6-f43ac7171702&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Airton",              cargo: "Account Manager",       local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3A323fd469-a380-47f5-846d-32db652178ec%3Aimage.png?table=block&id=1f38ba96-5ef3-80ea-8fd1-deb808ec4119&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Fernando Rodrigo",    cargo: "Gerente PE&G",          local: "🏭 SBS", departamento: "03 - PE&G",    step: "🧐 S - Saber",                                photo: N("attachment%3Ae35e265a-d941-467b-9178-3d396e4fdc41%3AIMG_7280.jpeg?table=block&id=1f38ba96-5ef3-8171-bc78-edf804210d65&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gabriel Sangoi",      cargo: "Designer",              local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3A9efe02d6-92e8-40b1-a85e-ba246ca2d287%3Aimage.png?table=block&id=1f38ba96-5ef3-8057-b415-c30d63f476d4&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Hilton",              cargo: "Copywriter",            local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3A3f7acd0d-374b-4dd4-ac89-72af1bd1d4e6%3Aimage.png?table=block&id=1f38ba96-5ef3-8097-a2dc-c2de25795b50&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Isabel Klein",        cargo: "Social Media",          local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3Aa2d9c144-7997-4b01-9e3b-2c3ca684992e%3AIMG_1611.jpeg?table=block&id=1f38ba96-5ef3-8139-8bb1-c57ead19358a&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Kelvin Daniel",       cargo: "Gestor de Tráfego",     local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A18e8afd2-15ec-4537-9205-082b27834ac5%3AKELVIN_DANIEL__-_FOTO_ORIGINAL_(1).jpg?table=block&id=1f38ba96-5ef3-8071-b576-d82eeb53a32f&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Leonardo Scaramella", cargo: "Gestor de Tráfego",     local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3A00369de7-0162-4872-a58e-9dd9a47e15d4%3Aimage.png?table=block&id=1f38ba96-5ef3-80bb-abbe-c3a51de628e0&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Victor (VVV)",        cargo: "Analista Martech",      local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎓 UniBF",      step: "🛠️ E - Executar",    photo: N("attachment%3Aa29e06dc-0528-4147-bcd3-3d292e19f3b1%3Aimage.png?table=block&id=3088ba96-5ef3-809c-9391-e4b84170476f&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Leliane",             cargo: "Especialista Comercial",local: "🏠 Home", departamento: "03 - PE&G",    squad: "🎖️ SEALS",     step: "🧐 S - Saber",        photo: N("attachment%3Abeec40fc-992e-4bba-ad5f-aeb7c9bef0df%3Aimage.png?table=block&id=3088ba96-5ef3-8033-8f82-c0e3dccdb8fa&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Guilherme Soledade",  cargo: "Designer",              local: "🏠 Home", departamento: "03 - PE&G",    squad: "⚔️ Spartans",   step: "🛠️ E - Executar",    photo: N("attachment%3A3d64b20c-7411-4782-bb49-60693abec9b1%3Aimage.png?table=block&id=3088ba96-5ef3-801a-9e37-c5984d4a17ca&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Emanuel Machado",     cargo: "Account Manager",       local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🈹 Yakuza",     step: "🛠️ E - Executar",    photo: N("attachment%3Aec8e264e-7c67-4cf4-8b84-56b959b95e0d%3Aimage.png?table=block&id=3088ba96-5ef3-80e5-bee9-f4ac65732296&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Rafaella Bargellini", cargo: "People & Performance",  local: "🏭 SBS", departamento: "01 - ADM",     squad: "Squad ADM",                                  photo: N("attachment%3Ae9d2f144-917e-463f-90c2-54ee2541bee8%3Aimage.png?table=block&id=30d8ba96-5ef3-805b-9b12-c4ad7ba27cee&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Aline Ávila",         cargo: "Designer",              local: "🧬 Híbrido", departamento: "03 - PE&G", squad: "🈹 Yakuza",    step: "🛠️ E - Executar",    photo: N("attachment%3Ae13e3f6e-4287-4c42-bfba-23439e6e1c4f%3Aimage.png?table=block&id=3148ba96-5ef3-80dc-abc5-caa12285cde5&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
  { nome: "Gustavo Avila",       cargo: "Analista Martech",      local: "🏭 SBS", departamento: "03 - PE&G",    squad: "🤖 JARVIS",     step: "🤖T - Ter",           photo: N("attachment%3A6e97e2c5-d90f-4e31-b2d8-9cc4e13c37e1%3Aimage.png?table=block&id=3148ba96-5ef3-80e5-8c4e-e23b0d67adb2&spaceId=710f4471-234a-4dd6-bae9-a96d21fecc33&width=360") },
];

const DEPT_COLOR: Record<string, string> = {
  "01 - ADM":     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "02 - Receita": "bg-green-500/20 text-green-300 border-green-500/30",
  "03 - PE&G":    "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function avatarColor(name: string) {
  const colors = [
    "from-red-500/60 to-pink-600/60",
    "from-orange-500/60 to-amber-600/60",
    "from-blue-500/60 to-indigo-600/60",
    "from-green-500/60 to-teal-600/60",
    "from-purple-500/60 to-violet-600/60",
    "from-cyan-500/60 to-sky-600/60",
    "from-rose-500/60 to-red-600/60",
    "from-fuchsia-500/60 to-purple-600/60",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

/** Avatar com fallback: foto → gradiente+iniciais */
function MemberAvatar({ m, className, textClass }: { m: Membro; className: string; textClass: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (m.photo && !imgFailed) {
    return (
      <img
        src={m.photo}
        alt={m.nome}
        className={`${className} object-cover object-top`}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div className={`${className} bg-gradient-to-br ${avatarColor(m.nome)} flex items-center justify-center font-bold ${textClass}`}>
      {initials(m.nome)}
    </div>
  );
}

/** Capa do card — foto tall ou avatar centralizado */
function CardCover({ m }: { m: Membro }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (m.photo && !imgFailed) {
    return (
      <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-secondary/40">
        <img
          src={m.photo}
          alt={m.nome}
          className="w-full h-full object-cover object-top"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }
  return (
    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor(m.nome)} flex items-center justify-center text-2xl font-bold mb-3 mx-auto`}>
      {initials(m.nome)}
    </div>
  );
}

/** Linha de propriedade estilo Notion */
function PropRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/20 last:border-0">
      <div className="flex items-center gap-2 w-36 flex-shrink-0 text-muted-foreground/70 text-xs pt-0.5">
        <span className="flex-shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex-1 text-sm text-foreground min-h-[1.25rem]">{children}</div>
    </div>
  );
}

/** Badge pill */
function Pill({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${className ?? "bg-secondary/60 text-foreground border-border/30"}`}>
      {label}
    </span>
  );
}

const ALL_SQUADS = Array.from(new Set(MEMBROS.map((m) => m.squad).filter(Boolean))) as string[];
const ALL_DEPTS  = Array.from(new Set(MEMBROS.map((m) => m.departamento)));

type ViewMode = "gallery" | "table";

export function InvestidoresPanel() {
  const [search, setSearch]           = useState("");
  const [filterSquad, setFilterSquad] = useState("all");
  const [filterDept, setFilterDept]   = useState("all");
  const [filterLocal, setFilterLocal] = useState("all");
  const [view, setView]               = useState<ViewMode>("gallery");
  const [selected, setSelected]       = useState<Membro | null>(null);

  const filtered = MEMBROS.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.nome.toLowerCase().includes(q) || m.cargo.toLowerCase().includes(q) || (m.squad ?? "").toLowerCase().includes(q);
    const matchSquad  = filterSquad === "all" || m.squad === filterSquad;
    const matchDept   = filterDept  === "all" || m.departamento === filterDept;
    const matchLocal  = filterLocal === "all" || m.local.includes(filterLocal);
    return matchSearch && matchSquad && matchDept && matchLocal;
  });

  function openDetail(m: Membro) {
    setSelected(m);
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 flex-1 min-w-40">
          <Search size={13} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, cargo, squad..."
            className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/60"
          />
          {search && <button onClick={() => setSearch("")}><X size={12} className="text-muted-foreground" /></button>}
        </div>

        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="glass rounded-xl px-3 py-2 text-xs focus:outline-none border-0 cursor-pointer">
          <option value="all">Todos os depto</option>
          {ALL_DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select value={filterSquad} onChange={(e) => setFilterSquad(e.target.value)} className="glass rounded-xl px-3 py-2 text-xs focus:outline-none border-0 cursor-pointer">
          <option value="all">Todos os squads</option>
          {ALL_SQUADS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={filterLocal} onChange={(e) => setFilterLocal(e.target.value)} className="glass rounded-xl px-3 py-2 text-xs focus:outline-none border-0 cursor-pointer">
          <option value="all">Todos os locais</option>
          <option value="SBS">🏭 SBS</option>
          <option value="Home">🏠 Home</option>
          <option value="Híbrido">🧬 Híbrido</option>
        </select>

        {/* View toggle */}
        <div className="flex items-center gap-1 glass rounded-xl p-1">
          <button onClick={() => setView("gallery")} className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${view === "gallery" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            ⊞ Galeria
          </button>
          <button onClick={() => setView("table")} className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${view === "table" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            ≡ Tabela
          </button>
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
        <Users size={12} />
        <span>{filtered.length} membro{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "gallery" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((m) => (
              <button
                key={m.nome}
                onClick={() => openDetail(m)}
                className={`glass rounded-2xl p-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5 border ${
                  selected?.nome === m.nome ? "border-primary/40 bg-primary/10" : "border-border/30"
                }`}
              >
                <CardCover m={m} />
                <p className="font-semibold text-sm text-center truncate">{m.nome}</p>
                <p className="text-xs text-muted-foreground text-center truncate mb-2">{m.cargo}</p>
                <div className="flex flex-wrap gap-1 justify-center">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${DEPT_COLOR[m.departamento] ?? "bg-secondary text-muted-foreground border-border/30"}`}>
                    {m.departamento}
                  </span>
                  {m.squad && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground">
                      {m.squad}
                    </span>
                  )}
                  {m.step && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary/80">
                      {m.step}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-4 text-center py-12 text-muted-foreground">
                <Users size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum membro encontrado</p>
              </div>
            )}
          </div>
        ) : (
          /* Table view */
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-card border-b border-border/40">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground/80 w-48">Nome</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground/80 w-40">Cargo</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground/80 w-28">Local</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground/80 w-28">Departamento</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground/80 w-32">Squad</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground/80 w-36">STEP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr
                  key={m.nome}
                  onClick={() => openDetail(m)}
                  className={`border-b border-border/20 cursor-pointer transition-colors hover:bg-secondary/40 ${
                    selected?.nome === m.nome ? "bg-primary/10" : i % 2 === 0 ? "" : "bg-card/40"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <MemberAvatar m={m} className="w-6 h-6 rounded-full flex-shrink-0" textClass="text-[10px]" />
                      <span className="font-medium">{m.nome}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{m.cargo}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{m.local}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${DEPT_COLOR[m.departamento] ?? "bg-secondary text-muted-foreground border-border/30"}`}>
                      {m.departamento}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{m.squad ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{m.step ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground">
                    <Users size={24} className="mx-auto mb-2 opacity-20" />
                    <p>Nenhum membro encontrado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal de detalhe estilo Notion ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* card */}
          <div
            className="relative z-10 w-full max-w-lg glass-strong rounded-2xl shadow-2xl border border-border/40 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com foto de capa + close */}
            <div className="relative">
              {/* cover banner */}
              <div className={`w-full h-24 bg-gradient-to-r ${avatarColor(selected.nome)} opacity-60`} />

              {/* avatar sobre a cover */}
              <div className="absolute left-6 -bottom-8">
                <MemberAvatar
                  m={selected}
                  className="w-16 h-16 rounded-2xl border-4 border-card shadow-lg"
                  textClass="text-xl"
                />
              </div>

              {/* close btn */}
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Nome + cargo */}
            <div className="pt-10 px-6 pb-3">
              <h2 className="text-xl font-bold">{selected.nome}</h2>
              <p className="text-sm text-muted-foreground">{selected.cargo}</p>
            </div>

            {/* Propriedades estilo Notion */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {selected.id !== undefined && (
                <PropRow icon={<Hash size={13} />} label="ID">
                  <span className="text-muted-foreground">{selected.id}</span>
                </PropRow>
              )}

              <PropRow icon={<MapPin size={13} />} label="Location">
                <Pill label={selected.local} />
              </PropRow>

              <PropRow icon={<Building2 size={13} />} label="Department">
                <div className="flex flex-wrap gap-1">
                  {selected.departamento.split(",").map((d) => (
                    <Pill key={d} label={d.trim()} className={DEPT_COLOR[d.trim()] ?? "bg-secondary/60 text-foreground border-border/30"} />
                  ))}
                </div>
              </PropRow>

              {selected.squad && (
                <PropRow icon={<Users size={13} />} label="Squad">
                  <Pill label={selected.squad} />
                </PropRow>
              )}

              {selected.step && (
                <PropRow icon={<span className="text-xs">🎯</span>} label="STEP">
                  <Pill label={selected.step} className="bg-primary/15 text-primary/90 border-primary/20" />
                </PropRow>
              )}

              {selected.lt !== undefined && (
                <PropRow icon={<Clock size={13} />} label="LT">
                  <span>{selected.lt}</span>
                </PropRow>
              )}

              {selected.joined && (
                <PropRow icon={<Calendar size={13} />} label="Joined">
                  <span>{selected.joined}</span>
                </PropRow>
              )}

              {selected.termination && (
                <PropRow icon={<Calendar size={13} />} label="Termination">
                  <span>{selected.termination}</span>
                </PropRow>
              )}

              {selected.aging && (
                <PropRow icon={<span className="text-xs">⏱️</span>} label="Aging">
                  <span>{selected.aging}</span>
                </PropRow>
              )}

              {selected.linkedin && (
                <PropRow icon={<Linkedin size={13} />} label="LinkedIn">
                  <a
                    href={selected.linkedin.startsWith("http") ? selected.linkedin : `https://${selected.linkedin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline truncate block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {selected.linkedin}
                  </a>
                </PropRow>
              )}

              {selected.phone && (
                <PropRow icon={<Phone size={13} />} label="Phone">
                  <a href={`tel:${selected.phone}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    {selected.phone}
                  </a>
                </PropRow>
              )}

              {selected.email && (
                <PropRow icon={<Mail size={13} />} label="e-mail">
                  <a href={`mailto:${selected.email}`} className="text-primary hover:underline truncate block" onClick={(e) => e.stopPropagation()}>
                    {selected.email}
                  </a>
                </PropRow>
              )}

              {selected.tags && selected.tags.length > 0 && (
                <PropRow icon={<span className="text-xs">🏷️</span>} label="Tags">
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map((t) => <Pill key={t} label={t} />)}
                  </div>
                </PropRow>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
