import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

type Route =
  | { path: "/" }
  | { path: "/login" }
  | { path: "/patient/hospitals" }
  | { path: "/patient/hospital"; id: string }
  | { path: "/patient/tokens" }
  | { path: "/patient/track"; sessionId: string; tokenNumber: number }
  | { path: "/doctor" }
  | { path: "/admin" }
  | { path: "/admin/hospitals" }
  | { path: "/admin/doctors" }
  | { path: "/admin/patients" }
  | { path: "/admin/sessions" }
  | { path: "/admin/bookings" };

interface RouterCtx {
  route: Route;
  navigate: (r: Route) => void;
  goBack: () => void;
}

const RouterContext = createContext<RouterCtx | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<Route[]>([{ path: "/" }]);
  const route = history[history.length - 1];

  const navigate = useCallback((r: Route) => {
    setHistory((prev) => [...prev, r]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  return (
    <RouterContext.Provider value={{ route, navigate, goBack }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterCtx {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}

export type { Route };
