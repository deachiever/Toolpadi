import React, { useState } from 'react';
import { ShoppingBag, Search, ShieldCheck, Menu, X, ArrowRight, ExternalLink } from 'lucide-react';
import { useCart } from '../context/CartContext.js';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, param?: string) => void;
  onSearchChange?: (q: string) => void;
  searchQuery?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onSearchChange,
  searchQuery = ''
}) => {
  const { cart, itemCount, currency, setCurrency, setIsCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRateNotice, setShowRateNotice] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#fbfaf6]/95 backdrop-blur-md border-b border-[#e6e2d6]">
      {/* Top Notice Bar: Brand status & currency transparency */}
      <div className="bg-[#0e382b] text-[#f4f1ea] text-xs py-1.5 px-4 font-normal">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#84cc16]"></span>
            <span>ToolPadi (Proposed Brand)</span>
            <span aria-hidden="true" className="text-[#1a634b]">·</span>
            <span className="text-[#cbd3cc] hidden sm:inline">Africa-first digital tools marketplace</span>
            <span aria-hidden="true" className="text-[#1a634b] hidden sm:inline">·</span>
            <span className="text-[#cbd3cc]">100% transparent pricing</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#cbd3cc]">
            <button
              onClick={() => setShowRateNotice(!showRateNotice)}
              className="hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
            >
              Exchange Policy: ₦1,450 / $1
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => onNavigate('admin')}
              className="text-[#a3e635] hover:text-white font-medium transition-colors cursor-pointer"
            >
              Admin Desk
            </button>
          </div>
        </div>
      </div>

      {showRateNotice && (
        <div className="bg-[#f2efe6] border-b border-[#e0dacb] px-4 py-2 text-xs text-[#3a4740]">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p>
              <strong>Transparent Currency Standard:</strong> NGN prices are direct retail prices rounded to the nearest ₦50/₦100. USD conversions reflect verified wholesale normalization. No hidden conversion fees at checkout.
            </p>
            <button
              onClick={() => setShowRateNotice(false)}
              className="text-[#65736b] hover:text-black font-semibold ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="w-10 h-10 rounded-lg bg-[#0e382b] flex items-center justify-center text-[#fbfaf6] shadow-sm">
              <span className="font-heading font-black text-xl tracking-tight text-[#a3e635]">TP</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-xl tracking-tight text-[#08231b]">
                  ToolPadi
                </span>
              </div>
              <p className="text-[11px] text-[#637068] tracking-tight leading-none hidden sm:block">
                Your digital tools, within reach.
              </p>
            </div>
          </div>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a968f]" />
              <input
                type="text"
                placeholder="Search tools (Canva, Copilot, JetBrains...)"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange?.(e.target.value);
                  if (currentView !== 'catalogue' && e.target.value.trim().length > 0) {
                    onNavigate('catalogue');
                  }
                }}
                className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[#d8d3c5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e382b] focus:border-transparent transition-all placeholder-[#9aa59f] text-[#141f1a]"
              />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#2f3d35]">
            <button
              onClick={() => onNavigate('catalogue')}
              className={`hover:text-[#0e382b] transition-colors cursor-pointer ${
                currentView === 'catalogue' ? 'text-[#0e382b] font-bold' : ''
              }`}
            >
              Catalogue
            </button>
            <button
              onClick={() => onNavigate('account')}
              className={`hover:text-[#0e382b] transition-colors cursor-pointer ${
                currentView === 'account' ? 'text-[#0e382b] font-bold' : ''
              }`}
            >
              Order Lookup
            </button>
            <button
              onClick={() => onNavigate('support')}
              className={`hover:text-[#0e382b] transition-colors cursor-pointer ${
                currentView === 'support' ? 'text-[#0e382b] font-bold' : ''
              }`}
            >
              Support & FAQ
            </button>
            <button
              onClick={() => onNavigate('admin')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-[#0e382b] text-[#a3e635]'
                  : 'bg-[#ede9de] text-[#0e382b] hover:bg-[#0e382b] hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Desk</span>
            </button>
          </nav>

          {/* Controls: Currency selector + Cart Button */}
          <div className="flex items-center gap-3">
            {/* Segmented Currency Selector */}
            <div className="flex items-center bg-[#f0ece2] p-1 rounded-md border border-[#dfdbce]">
              <button
                onClick={() => setCurrency('NGN')}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                  currency === 'NGN'
                    ? 'bg-white text-[#0e382b] shadow-xs'
                    : 'text-[#64726a] hover:text-[#0e382b]'
                }`}
                title="Nigerian Naira"
              >
                ₦ NGN
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-white text-[#0e382b] shadow-xs'
                    : 'text-[#64726a] hover:text-[#0e382b]'
                }`}
                title="US Dollars"
              >
                $ USD
              </button>
            </div>

            {/* Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 bg-[#0e382b] hover:bg-[#134e3a] text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer"
              aria-label="View shopping cart"
            >
              <ShoppingBag className="w-4 h-4 text-[#a3e635]" />
              <span className="hidden sm:inline">Cart</span>
              {itemCount > 0 && (
                <span className="bg-[#84cc16] text-[#08231b] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[#2f3d35] hover:text-[#0e382b] focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        <div className="md:hidden pb-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a968f]" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange?.(e.target.value);
                if (currentView !== 'catalogue' && e.target.value.trim().length > 0) {
                  onNavigate('catalogue');
                }
              }}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-[#d8d3c5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e382b] text-[#141f1a]"
            />
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-[#e6e2d6] px-4 pt-3 pb-5 space-y-3">
          <button
            onClick={() => {
              onNavigate('catalogue');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 font-medium text-[#141f1a] hover:text-[#0e382b]"
          >
            Browse Catalogue
          </button>
          <button
            onClick={() => {
              onNavigate('account');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 font-medium text-[#141f1a] hover:text-[#0e382b]"
          >
            Track Order & Licenses
          </button>
          <button
            onClick={() => {
              onNavigate('support');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 font-medium text-[#141f1a] hover:text-[#0e382b]"
          >
            Customer Support & FAQs
          </button>
          <button
            onClick={() => {
              onNavigate('admin');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 font-medium text-[#0e382b] font-semibold"
          >
            Admin Management Desk →
          </button>
        </div>
      )}
    </header>
  );
};
