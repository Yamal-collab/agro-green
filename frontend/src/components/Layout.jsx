import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, Wheat, Egg, Bird, Droplets, ArrowLeftRight, Truck, LogOut, Leaf
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/customers", label: "Customers", icon: Users, testid: "nav-customers" },
  { to: "/suppliers", label: "Suppliers", icon: Truck, testid: "nav-suppliers" },
  { to: "/feed", label: "Feed Trading", icon: Wheat, testid: "nav-feed" },
  { to: "/hatchery", label: "Egg Hatchery", icon: Egg, testid: "nav-hatchery" },
  { to: "/farm", label: "Own Farm", icon: Bird, testid: "nav-farm" },
  { to: "/water", label: "Water", icon: Droplets, testid: "nav-water" },
  { to: "/transfers", label: "Internal Transfers", icon: ArrowLeftRight, testid: "nav-transfers" },
  { to: "/finance", label: "Finance", icon: LayoutDashboard, testid: "nav-finance" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-border bg-white">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              AgriBiz
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Operations</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-primary"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
              {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {user?.role?.replace("_", " ")}
              </div>
            </div>
          </div>
          <button
            data-testid="btn-logout"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-primary transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </aside>

      <main className="ml-64 min-h-screen p-8">
        <Outlet />
      </main>
    </div>
  );
}
