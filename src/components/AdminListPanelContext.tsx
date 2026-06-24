import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type AdminListPanelContextValue = {
  filterControl: ReactNode;
  setFilterControl: (control: ReactNode) => void;
};

const AdminListPanelContext = createContext<AdminListPanelContextValue | null>(
  null,
);

export function AdminListPanelProvider({ children }: { children: ReactNode }) {
  const [filterControl, setFilterControl] = useState<ReactNode>(null);

  return (
    <AdminListPanelContext.Provider value={{ filterControl, setFilterControl }}>
      {children}
    </AdminListPanelContext.Provider>
  );
}

export function AdminListPanelFilterButton() {
  const ctx = useContext(AdminListPanelContext);
  if (!ctx?.filterControl) return null;
  return <>{ctx.filterControl}</>;
}

export function useRegisterAdminListFilter(control: ReactNode) {
  const ctx = useContext(AdminListPanelContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.setFilterControl(control);
    return () => ctx.setFilterControl(null);
  }, [ctx, control]);
}

export function AdminListPanelActions({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-2">{children}</div>;
}
