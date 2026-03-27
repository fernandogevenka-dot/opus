import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/store/appStore";
import { AppLayout } from "@/components/shared/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { PendingApprovalPage } from "@/pages/PendingApprovalPage";
import { SetupProfilePage } from "@/pages/SetupProfilePage";
import { OfficePage } from "@/pages/OfficePage";
import { FeedPage } from "@/pages/FeedPage";
import { AIPage } from "@/pages/AIPage";
import { WikiPage } from "@/pages/WikiPage";
import { CustomerSuccessPage } from "@/pages/CustomerSuccessPage";
import { MeetingsPage } from "@/pages/MeetingsPage";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { OfficeSettingsPage } from "@/pages/OfficeSettingsPage";
import { DeskCustomizePage } from "@/pages/DeskCustomizePage";
import { UserProfilePage } from "@/pages/UserProfilePage";
import { WhatsAppCSPage } from "@/pages/WhatsAppCSPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProductCatalogPage } from "@/pages/ProductCatalogPage";
import { SquadsPage } from "@/pages/SquadsPage";
import { CollaboratorsPage } from "@/pages/CollaboratorsPage";
import { CheckinsPage } from "@/pages/CheckinsPage";
import { UserApprovalPage } from "@/pages/UserApprovalPage";
import { FeatureRequestsPage } from "@/pages/FeatureRequestsPage";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto animate-pulse">
          <img src="/v4-logo.jpg" alt="OPUS" className="w-full h-full object-cover" />
        </div>
        <p className="text-muted-foreground text-sm">Carregando OPUS...</p>
        <p className="text-muted-foreground/50 text-xs">Verifique o console (F12) se demorar muito</p>
      </div>
    </div>
  );
}

function PageRouter() {
  const { currentPage, profileUserId } = useAppStore();

  switch (currentPage) {
    case "office":    return <OfficePage />;
    case "feed":      return <FeedPage />;
    case "ai":        return <AIPage />;
    case "wiki":      return <WikiPage />;
    case "cs":        return <CustomerSuccessPage />;
    case "meetings":  return <MeetingsPage />;
    case "workspace":        return <WorkspacePage />;
    case "office-settings":  return <OfficeSettingsPage />;
    case "desk-customize":   return <DeskCustomizePage />;
    case "profile":          return <UserProfilePage viewUserId={profileUserId ?? undefined} />;
    case "wa-cs":            return <WhatsAppCSPage />;
    case "projects":         return <ProjectsPage />;
    case "products":         return <ProductCatalogPage />;
    case "squads":           return <SquadsPage />;
    case "collaborators":    return <CollaboratorsPage />;
    case "checkins":         return <CheckinsPage />;
    case "user-approval":    return <UserApprovalPage />;
    case "feature-requests": return <FeatureRequestsPage />;
    default:                 return <OfficePage />;
  }
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  // Usuário aguardando aprovação
  if (user.approval_status === "pending" || user.approval_status === "rejected") {
    return <PendingApprovalPage />;
  }

  // Aprovado mas ainda não configurou função (primeiro acesso)
  if (user.approval_status === "approved" && !user.funcao) {
    return <SetupProfilePage />;
  }

  return (
    <AppLayout>
      <PageRouter />
    </AppLayout>
  );
}
