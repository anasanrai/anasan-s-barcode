import { Building2, Crown } from "lucide-react";
import { useState } from "react";
import ManagerPortal from "./ManagerPortal";
import OwnerPanel from "./OwnerPanel";
import { useLang } from "@/lib/i18n";

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const { t } = useLang();
  const [role, setRole] = useState<"manager" | "owner" | null>(null);

  if (role === "manager") {
    return <ManagerPortal onBack={onBack} />;
  }
  if (role === "owner") {
    return <OwnerPanel onBack={onBack} />;
  }

  return (
    <main className="admin-page admin-page--login">
      <div className="admin-login-card">
        <h1 className="admin-login-card__title">{t.adminPortalTitle}</h1>
        <p className="admin-login-card__sub">{t.adminPortalSub}</p>

        <div className="admin-role-select">
          <button type="button" className="admin-role-btn" onClick={() => setRole("manager")}>
            <Building2 size={22} />
            <span>{t.managerRole}</span>
          </button>
          <button type="button" className="admin-role-btn" onClick={() => setRole("owner")}>
            <Crown size={22} />
            <span>{t.ownerRole}</span>
          </button>
        </div>

        <button type="button" onClick={onBack} className="admin-back-btn">
          {t.backToApp}
        </button>
      </div>
    </main>
  );
}
