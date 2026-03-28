import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/dashboard',  icon: '🏠', label: 'Dashboard' },
  { to: '/employees',  icon: '👥', label: 'Employees' },
  { to: '/attendance', icon: '📅', label: 'Attendance' },
  { to: '/salary',     icon: '💰', label: 'Salary' },
  { to: '/advances',   icon: '💵', label: 'Advances' },
  { to: '/loans',      icon: '🏦', label: 'Loans' },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 bg-gradient-to-b from-orange-800 to-red-900 text-white flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-orange-700">
          <div className="text-lg font-bold leading-tight">🕉️ Kasi Kitchen</div>
          <div className="text-xs text-orange-200 mt-0.5">KVKF Varanasi — Payroll</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-600 text-white'
                    : 'text-orange-100 hover:bg-orange-700/60'
                }`
              }
            >
              <span className="text-base">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-orange-700 text-xs text-orange-300">
          Kasi Visvanathar Koviloor<br />Foundation
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-amber-50">
        <Outlet />
      </main>
    </div>
  );
}
