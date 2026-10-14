import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, Zap, Sparkles, Check, Info, Server, RefreshCw } from 'lucide-react';
import { ProductCard } from '../components/ProductCard.js';
import { useCart } from '../context/CartContext.js';
import type { Product } from '../types.js';

interface HomeViewProps {
  products: Product[];
  onSelectProduct: (p: Product) => void;
  onNavigate: (view: string, param?: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  onSelectProduct,
  onNavigate
}) => {
  const { config } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Derive unique categories from actual synchronized products
  const availableCategories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category === selectedCategory);

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-14 sm:pb-16 bg-[#0e382b] text-[#fbfaf6] rounded-2xl mx-4 sm:mx-6 lg:mx-8 px-6 sm:px-12 border border-[#134e3a]">
        <div className="max-w-4xl relative z-10">
          <div className="flex items-center gap-2 text-xs font-medium text-[#a3e635] mb-4">
            <span>Proposed Brand</span>
            <span aria-hidden="true" className="text-[#1a634b]">·</span>
            <span>Africa-First Marketplace</span>
            <span aria-hidden="true" className="text-[#1a634b]">·</span>
            <span>Local Currency Simplicity</span>
          </div>

          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.1] mb-6">
            Your digital tools,<br />
            <span className="text-[#a3e635]">within reach.</span>
          </h1>

          <p className="text-base sm:text-xl text-[#d4ded7] font-normal leading-relaxed max-w-2xl mb-8">
            Powerful tools. Prices that work for you. Built for African creators, developers, freelancers, and growing agencies tired of foreign currency card limits and inflated middlemen prices.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => onNavigate('catalogue')}
              className="py-3 px-6 bg-[#84cc16] hover:bg-[#a3e635] text-[#08231b] font-bold text-sm rounded-lg transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <span>Explore Real Catalogue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('admin')}
              className="py-3 px-6 bg-[#134e3a] hover:bg-[#1b634b] text-[#fbfaf6] font-semibold text-sm rounded-lg transition-colors border border-[#1a634b] cursor-pointer flex items-center gap-2"
            >
              <Server className="w-4 h-4 text-[#a3e635]" />
              <span>Supplier Sync Desk</span>
            </button>
          </div>
        </div>

        <div className="absolute -right-20 -top-20 w-96 h-96 bg-[#84cc16]/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Real Supplier Integration Transparency Notice */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#f2efe6] border border-[#ded8c9] rounded-xl p-4 sm:p-5 flex items-start gap-4 text-xs text-[#3a4740] leading-relaxed">
          <Info className="w-5 h-5 text-[#0e382b] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-[#0e382b] text-sm">
              Authentic Supplier Integration Standard
            </p>
            <p>
              ToolPadi integrates directly with the official InsightXPro Reseller API (<code>https://api.insightxpro.store/api/v1/products</code>).
              We do not fabricate fake stock, mock products, or artificial countdowns. All customer listings represent live inventory ingested from wholesale providers and approved by human compliance officers.
            </p>
          </div>
        </div>
      </section>

      {/* Real Products Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b]">
              Synchronized Marketplace Tools
            </h2>
            <p className="text-sm text-[#5a6760] mt-1">
              Real wholesale allocations approved for resale with verified delivery and transparent pricing.
            </p>
          </div>

          {products.length > 0 && availableCategories.length > 2 && (
            <div className="flex items-center gap-1 p-1 bg-[#ede9de] rounded-lg border border-[#ded8c9] overflow-x-auto">
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-white text-[#0e382b] shadow-xs'
                      : 'text-[#5a6760] hover:text-[#0e382b]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Honest Empty State when no real supplier products are synced or approved yet */}
        {products.length === 0 ? (
          <div className="bg-white border border-[#e6e2d6] rounded-2xl p-10 sm:p-14 text-center max-w-2xl mx-auto space-y-5 shadow-2xs">
            <div className="w-14 h-14 bg-[#faf8f2] text-[#0e382b] rounded-2xl flex items-center justify-center mx-auto border border-[#e6e2d6]">
              <Server className="w-7 h-7 text-[#0e382b]" />
            </div>

            <div className="space-y-2">
              <h3 className="font-heading font-bold text-xl text-[#08231b]">
                Products will appear here when the supplier catalogue is connected.
              </h3>
              <p className="text-xs sm:text-sm text-[#5a6860] max-w-lg mx-auto leading-relaxed">
                ToolPadi does not display fictional mock products. The marketplace queries live inventory from InsightXPro via authenticated server API synchronization (<code>GET /api/v1/products</code>).
              </p>
            </div>

            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl text-xs text-left text-[#4c5952] space-y-2">
              <div className="font-bold text-[#0e382b] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#65a30d]" />
                <span>Supplier Integration Status:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px]">
                <li>
                  <strong>InsightXPro API:</strong>{' '}
                  {config?.supplier_configured ? (
                    <span className="text-[#1a634b] font-semibold">INSIGHT_API_KEY Configured in Server</span>
                  ) : (
                    <span className="text-[#b45309] font-semibold">Awaiting INSIGHT_API_KEY in Server Environment</span>
                  )}
                </li>
                <li>
                  <strong>Approval Gate:</strong> Ingested supplier products must be approved by administrators before public display.
                </li>
                <li>
                  <strong>Last Sync:</strong> {config?.catalogue_last_synced ? new Date(config.catalogue_last_synced).toLocaleString() : 'Never'}
                </li>
              </ul>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => onNavigate('admin')}
                className="py-2.5 px-5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Open Operations Desk to Sync Real Products</span>
              </button>
            </div>
          </div>
        ) : (
          /* Actual live products grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
              />
            ))}
          </div>
        )}
      </section>

      {/* How It Works Section */}
      <section className="bg-[#f4f1ea] border-y border-[#e6e2d6] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b]">
              Transparent Wholesale Architecture
            </h2>
            <p className="text-sm text-[#5a6760] mt-2">
              Every listing connects to authorized wholesale providers with real inventory and verified terms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl border border-[#e6e2d6] space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#0e382b] text-[#a3e635] flex items-center justify-center font-bold text-sm">
                01
              </div>
              <h3 className="font-heading font-bold text-base text-[#08231b]">
                Real Supplier Synchronization
              </h3>
              <p className="text-xs text-[#526058] leading-relaxed">
                Stock counts and base costs are polled directly from InsightXPro API (<code>GET /api/v1/products</code>). When a product sells out at the supplier, it automatically leaves the customer storefront.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-[#e6e2d6] space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#0e382b] text-[#a3e635] flex items-center justify-center font-bold text-sm">
                02
              </div>
              <h3 className="font-heading font-bold text-base text-[#08231b]">
                Administrator Reseller Review
              </h3>
              <p className="text-xs text-[#526058] leading-relaxed">
                Ingested products remain unlisted until an administrator audits the commercial resale eligibility, sets transparent retail pricing, and verifies the access terms.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-[#e6e2d6] space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#0e382b] text-[#a3e635] flex items-center justify-center font-bold text-sm">
                03
              </div>
              <h3 className="font-heading font-bold text-base text-[#08231b]">
                Direct Digital Fulfilment
              </h3>
              <p className="text-xs text-[#526058] leading-relaxed">
                Customers pay in local currency (NGN or USD) and receive authenticated access tokens, license keys, or team invitations directly into their order portal with a 48-hour warranty.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
