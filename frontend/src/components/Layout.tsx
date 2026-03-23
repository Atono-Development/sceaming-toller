import { Outlet, Link } from "react-router-dom";
import { MobileMenu } from "@/components/MobileMenu";

export default function Layout() {

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <MobileMenu />
              <Link
                to="/"
                className="text-xl font-bold text-orange-600 hover:text-orange-500 transition-colors"
              >
                Toller Ball
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              {/* Desktop links removed, now in MobileMenu */}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

