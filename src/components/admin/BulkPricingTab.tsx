import React, { useState, useEffect } from 'react';
import {
  Layers,
  Tag,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Calculator,
  RefreshCw,
  Search,
  Plus,
  ArrowRight,
  TrendingDown,
  Info,
  Sparkles
} from 'lucide-react';
import type { Product } from '../../types.js';

interface BulkPricingTabProps {
  adminKey: string;
  products: Product[];
  exchangeRate: number;
  onOpenProductControls: (product: Product) => void;
  onRefresh: () => void;
}

export const BulkPricingTab: React.FC<BulkPricingTabProps> = ({
  adminKey,
  products,
  exchangeRate,
  onOpenProductControls,
  onRefresh
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'enabled' | 'discount_percent' | 'fixed_unit_price'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSeedingShowcase, setIsSeedingShowcase] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Sandbox Simulator State
  const bulkEnabledProducts = products.filter(p => p.bulk_pricing_enabled === 1 || Boolean(p.bulk_pricing?.enabled));
  const defaultSimProd = bulkEnabledProducts[0] || products[0];
  const [selectedSimProductId, setSelectedSimProductId] = useState<string>(defaultSimProd?.id || '');
  const [simQuantity, setSimQuantity] = useState<number>(10);

  // Update selected sim product if list changes
  useEffect(() => {
    if (!selectedSimProductId && products.length > 0) {
      const firstBulk = products.find(p => p.bulk_pricing_enabled === 1);
      setSelectedSimProductId(firstBulk ? firstBulk.id : products[0].id);
    }
  }, [products, selectedSimProductId]);

  const selectedProduct = products.find(p => p.id === selectedSimProductId) || defaultSimProd;

  // Handle Seeding Showcase Data
  const handleSeedShowcase = async () => {
    setIsSeedingShowcase(true);
    setMessage(null);
    try {
      const resp = await fetch('/api/admin/testing/seed-bulk-showcase', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await resp.json();
      if (resp.ok) {
        setMessage('Showcase bulk pricing tiers successfully seeded across catalogue products.');
        onRefresh();
      } else {
        setMessage(`Error: ${data.error || 'Failed to seed showcase data'}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsSeedingShowcase(false);
      setTimeout(() => setMessage(null), 6000);
    }
  };

  // Filter products for table
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.source_product_id.toLowerCase().includes(searchQuery.toLowerCase());

    const isBulkEnabled = p.bulk_pricing_enabled === 1 || Boolean(p.bulk_pricing?.enabled);
    const mode = p.bulk_pricing_mode || p.bulk_pricing?.mode || 'discount_percent';

    if (!matchesSearch) return false;
    if (filterMode === 'all') return true;
    if (filterMode === 'enabled') return isBulkEnabled;
    if (filterMode === 'discount_percent') return isBulkEnabled && mode === 'discount_percent';
    if (filterMode === 'fixed_unit_price') return isBulkEnabled && mode === 'fixed_unit_price';
    return true;
  });

  // Calculate sandbox simulation
  const calculateSandbox = () => {
    if (!selectedProduct) return null;

    const qty = Math.max(1, Math.floor(simQuantity));
    const baseNgn = selectedProduct.retail_price_ngn;
    const baseUsd = selectedProduct.retail_price_usd;
    const costNgn = selectedProduct.supplier_cost_ngn;
    const maxQty = selectedProduct.max_order_quantity || 0;
    const isExceededMax = maxQty > 0 && qty > maxQty;

    const tiers = selectedProduct.bulk_pricing?.tiers || [];
    const isBulkEnabled = selectedProduct.bulk_pricing_enabled === 1 || Boolean(selectedProduct.bulk_pricing?.enabled);
    const mode = selectedProduct.bulk_pricing_mode || selectedProduct.bulk_pricing?.mode || 'discount_percent';

    let matchedTier: any = null;
    let effectiveUnitNgn = baseNgn;
    let effectiveUnitUsd = baseUsd;
    let discountPercent = 0;

    if (isBulkEnabled && tiers.length > 0) {
      const sortedTiers = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
      for (const t of sortedTiers) {
        const min = t.min_quantity;
        const max = (t.max_quantity && t.max_quantity > 0) ? t.max_quantity : Infinity;
        if (qty >= min && qty <= max) {
          matchedTier = t;
          break;
        }
      }

      if (matchedTier) {
        if (mode === 'discount_percent') {
          discountPercent = matchedTier.discount_percentage || 0;
          const discounted = baseNgn * (1 - discountPercent / 100);
          effectiveUnitNgn = discounted <= 1000 ? Math.round(discounted / 50) * 50 : Math.round(discounted / 100) * 100;
          effectiveUnitUsd = Math.round((baseUsd * (1 - discountPercent / 100)) * 100) / 100;
        } else {
          effectiveUnitNgn = Number(matchedTier.fixed_unit_price_ngn || baseNgn);
          effectiveUnitUsd = Number(matchedTier.fixed_unit_price_usd || Math.round((effectiveUnitNgn / exchangeRate) * 100) / 100);
          if (baseNgn > 0 && effectiveUnitNgn < baseNgn) {
            discountPercent = Math.round(((baseNgn - effectiveUnitNgn) / baseNgn) * 100);
          }
        }
      }
    }

    const totalNgn = effectiveUnitNgn * qty;
    const totalUsd = Math.round(effectiveUnitUsd * qty * 100) / 100;
    const baseTotalNgn = baseNgn * qty;
    const totalSavingsNgn = Math.max(0, baseTotalNgn - totalNgn);
    const totalSavingsUsd = Math.round(Math.max(0, (baseUsd * qty) - totalUsd) * 100) / 100;
    const unitProfitNgn = effectiveUnitNgn - costNgn;
    const isUnprofitable = effectiveUnitNgn < costNgn;
    const marginPct = effectiveUnitNgn > 0 ? Math.round((unitProfitNgn / effectiveUnitNgn) * 100) : 0;

    return {
      qty,
      baseNgn,
      baseUsd,
      costNgn,
      effectiveUnitNgn,
      effectiveUnitUsd,
      discountPercent,
      totalNgn,
      totalUsd,
      baseTotalNgn,
      totalSavingsNgn,
      totalSavingsUsd,
      unitProfitNgn,
      marginPct,
      isUnprofitable,
      matchedTier,
      isBulkEnabled,
      mode,
      maxQty,
      isExceededMax
    };
  };

  const simResult = calculateSandbox();

  // Metrics summary
  const totalBulkEnabled = products.filter(p => p.bulk_pricing_enabled === 1 || Boolean(p.bulk_pricing?.enabled)).length;
  const totalTiersCount = products.reduce((acc, p) => acc + (p.bulk_pricing?.tiers?.length || 0), 0);
  const discountModeCount = products.filter(p => (p.bulk_pricing_enabled === 1 || Boolean(p.bulk_pricing?.enabled)) && (p.bulk_pricing_mode === 'discount_percent' || p.bulk_pricing?.mode === 'discount_percent')).length;
  const fixedModeCount = products.filter(p => (p.bulk_pricing_enabled === 1 || Boolean(p.bulk_pricing?.enabled)) && (p.bulk_pricing_mode === 'fixed_unit_price' || p.bulk_pricing?.mode === 'fixed_unit_price')).length;

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#f0ece2]">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#0e382b]" />
              <h3 className="font-heading font-bold text-lg text-[#08231b]">
                Bulk Purchase & Volume Pricing Administration
              </h3>
            </div>
            <p className="text-xs text-[#59665f] mt-0.5">
              Configure product-level volume discounts, manage quantity tiers, preview unit price calculations, and enforce negative-margin safety guardrails.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSeedShowcase}
              disabled={isSeedingShowcase}
              className="py-2 px-3.5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#86efac]" />
              <span>{isSeedingShowcase ? 'Seeding Demo Tiers...' : 'Seed Showcase Bulk Tiers'}</span>
            </button>
            <button
              onClick={onRefresh}
              className="py-2 px-3 bg-[#f5f2e9] hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {message && (
          <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] text-xs rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16a34a]" />
            <span>{message}</span>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#faf8f2] border border-[#e6e2d6] p-4 rounded-xl space-y-1">
            <span className="text-[11px] text-[#637269] font-medium block">Bulk-Enabled Products</span>
            <div className="font-heading font-extrabold text-2xl text-[#08231b]">
              {totalBulkEnabled} <span className="text-xs font-normal text-[#637269]">/ {products.length}</span>
            </div>
            <span className="text-[10px] text-[#16a34a] font-semibold">Product-specific scoping</span>
          </div>

          <div className="bg-[#faf8f2] border border-[#e6e2d6] p-4 rounded-xl space-y-1">
            <span className="text-[11px] text-[#637269] font-medium block">Active Volume Tiers</span>
            <div className="font-heading font-extrabold text-2xl text-[#08231b]">{totalTiersCount}</div>
            <span className="text-[10px] text-[#59665f]">Sequential bracket checks</span>
          </div>

          <div className="bg-[#faf8f2] border border-[#e6e2d6] p-4 rounded-xl space-y-1">
            <span className="text-[11px] text-[#637269] font-medium block">Pricing Strategies</span>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="px-2 py-0.5 bg-[#dcfce7] text-[#15803d] font-bold text-xs rounded">
                {discountModeCount} Auto %
              </span>
              <span className="px-2 py-0.5 bg-[#e0f2fe] text-[#0369a1] font-bold text-xs rounded">
                {fixedModeCount} Fixed
              </span>
            </div>
            <span className="text-[10px] text-[#59665f]">Flexible per-product mode</span>
          </div>

          <div className="bg-[#faf8f2] border border-[#e6e2d6] p-4 rounded-xl space-y-1">
            <span className="text-[11px] text-[#637269] font-medium block">Profit Margin Protection</span>
            <div className="flex items-center gap-1.5 pt-0.5 text-[#166534] font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
              <span>Active & Enforced</span>
            </div>
            <span className="text-[10px] text-[#59665f]">Rejects tiers selling below cost</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE BULK PRICING SANDBOX & TIER SIMULATOR */}
      {/* ========================================================================= */}
      <div className="bg-[#fcfbf7] border border-[#d6d0c2] rounded-2xl p-6 space-y-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#e6e2d6]">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#0e382b]" />
            <h4 className="font-heading font-bold text-base text-[#08231b]">
              Interactive Bulk Pricing Sandbox & Boundary Tester
            </h4>
          </div>
          <span className="text-[11px] font-semibold text-[#0e382b] bg-[#e8e4d8] px-2.5 py-1 rounded-full">
            Live Database Calculations
          </span>
        </div>

        <p className="text-xs text-[#59665f]">
          Select any catalogue product and simulate quantities below, at, and above tier boundaries. Verifies authoritative backend calculation logic, customer volume savings, and negative-margin guardrails.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Input Selection */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#2f3d35] mb-1.5">
                Select Product to Inspect:
              </label>
              <select
                value={selectedSimProductId}
                onChange={(e) => setSelectedSimProductId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#d6d0c2] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#0e382b]"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.bulk_pricing_enabled === 1 || Boolean(p.bulk_pricing?.enabled) ? 'Bulk Active' : 'Bulk Disabled'}) — ₦{p.retail_price_ngn.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#2f3d35]">
                  Test Order Quantity:
                </label>
                <span className="text-xs font-mono font-bold text-[#0e382b] bg-white px-2 py-0.5 rounded border">
                  {simQuantity} {simQuantity === 1 ? 'unit' : 'units'}
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="999"
                value={simQuantity}
                onChange={(e) => setSimQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-white border border-[#d6d0c2] rounded-xl text-xs font-bold"
              />
            </div>

            {/* Quick Boundary Preset Buttons */}
            <div>
              <span className="text-[11px] text-[#637269] font-medium block mb-1.5">
                Quick Boundary Test Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '1 (Base)', q: 1 },
                  { label: '4 (Below Tier 1)', q: 4 },
                  { label: '5 (Tier 1 Boundary)', q: 5 },
                  { label: '10 (Mid-Tier 1)', q: 10 },
                  { label: '19 (Tier 1 Ceiling)', q: 19 },
                  { label: '20 (Tier 2 Boundary)', q: 20 },
                  { label: '49 (Tier 2 Ceiling)', q: 49 },
                  { label: '50 (Tier 3 Boundary)', q: 50 },
                  { label: '100 (Volume)', q: 100 }
                ].map(b => (
                  <button
                    key={b.q}
                    type="button"
                    onClick={() => setSimQuantity(b.q)}
                    className={`px-2 py-1 text-[11px] rounded-lg border font-semibold transition-all cursor-pointer ${
                      simQuantity === b.q
                        ? 'bg-[#0e382b] text-white border-[#0e382b]'
                        : 'bg-white hover:bg-[#ede8db] border-[#d6d0c2] text-[#2f3d35]'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Metadata Info */}
            {selectedProduct && (
              <div className="p-3 bg-white border border-[#e6e2d6] rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#637269]">Wholesale Cost:</span>
                  <strong className="text-[#08231b]">₦{selectedProduct.supplier_cost_ngn.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637269]">Base Retail Price:</span>
                  <strong className="text-[#08231b]">₦{selectedProduct.retail_price_ngn.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637269]">Max Order Limit:</span>
                  <span className="font-semibold text-[#b45309]">
                    {selectedProduct.max_order_quantity && selectedProduct.max_order_quantity > 0
                      ? `${selectedProduct.max_order_quantity} units/order`
                      : 'Unlimited'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637269]">Active Tier Schedule:</span>
                  <span className="font-semibold text-[#0e382b]">
                    {selectedProduct.bulk_pricing?.tiers?.length || 0} configured tiers
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Calculation Output Card */}
          <div className="lg:col-span-7">
            {simResult && (
              <div className="bg-white border border-[#d6d0c2] rounded-xl p-5 space-y-4 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#f0ece2]">
                    <div>
                      <span className="text-[11px] text-[#637269] font-medium">Authoritative Calculated Result</span>
                      <h5 className="font-heading font-bold text-base text-[#08231b]">
                        {selectedProduct?.title} (Qty: {simResult.qty})
                      </h5>
                    </div>
                    {simResult.matchedTier ? (
                      <span className="px-2.5 py-1 bg-[#dcfce7] text-[#15803d] font-bold text-xs rounded-full border border-[#bbf7d0] flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>Tier Applied: {simResult.matchedTier.min_quantity}–{simResult.matchedTier.max_quantity || '+'}</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-[#f4f1ea] text-[#637269] font-bold text-xs rounded-full border border-[#ded8c9]">
                        Standard Retail Price (Sub-tier)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
                    <div className="p-3 bg-[#faf8f2] rounded-lg border border-[#e6e2d6]">
                      <span className="text-[10px] text-[#637269] block">Effective Unit Price</span>
                      <strong className="text-base text-[#0e382b] font-bold">
                        ₦{simResult.effectiveUnitNgn.toLocaleString()}
                      </strong>
                      <div className="text-[10px] text-[#717e77]">${simResult.effectiveUnitUsd.toFixed(2)} USD</div>
                    </div>

                    <div className="p-3 bg-[#faf8f2] rounded-lg border border-[#e6e2d6]">
                      <span className="text-[10px] text-[#637269] block">Total Order Price</span>
                      <strong className="text-base text-[#0e382b] font-bold">
                        ₦{simResult.totalNgn.toLocaleString()}
                      </strong>
                      <div className="text-[10px] text-[#717e77]">${simResult.totalUsd.toFixed(2)} USD</div>
                    </div>

                    <div className="p-3 bg-[#faf8f2] rounded-lg border border-[#e6e2d6]">
                      <span className="text-[10px] text-[#637269] block">Customer Volume Savings</span>
                      <strong className="text-base text-[#16a34a] font-bold">
                        ₦{simResult.totalSavingsNgn.toLocaleString()}
                      </strong>
                      <div className="text-[10px] text-[#16a34a] font-semibold">
                        {simResult.discountPercent > 0 ? `${simResult.discountPercent}% Discount` : 'No discount'}
                      </div>
                    </div>

                    <div className="p-3 bg-[#faf8f2] rounded-lg border border-[#e6e2d6]">
                      <span className="text-[10px] text-[#637269] block">Unit Profit Margin</span>
                      <strong className={`text-base font-bold ${simResult.isUnprofitable ? 'text-[#b91c1c]' : 'text-[#16a34a]'}`}>
                        ₦{simResult.unitProfitNgn.toLocaleString()}
                      </strong>
                      <div className="text-[10px] text-[#717e77]">{simResult.marginPct}% Gross Margin</div>
                    </div>

                    <div className="p-3 bg-[#faf8f2] rounded-lg border border-[#e6e2d6]">
                      <span className="text-[10px] text-[#637269] block">Total Margin (Order)</span>
                      <strong className={`text-base font-bold ${simResult.isUnprofitable ? 'text-[#b91c1c]' : 'text-[#16a34a]'}`}>
                        ₦{(simResult.unitProfitNgn * simResult.qty).toLocaleString()}
                      </strong>
                      <div className="text-[10px] text-[#717e77]">Total net contribution</div>
                    </div>

                    <div className="p-3 bg-[#faf8f2] rounded-lg border border-[#e6e2d6]">
                      <span className="text-[10px] text-[#637269] block">Safety & Profit Status</span>
                      {simResult.isUnprofitable ? (
                        <span className="text-xs font-bold text-[#b91c1c] flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Negative Margin!</span>
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#166534] flex items-center gap-1 mt-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Profitable</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {simResult.isExceededMax && (
                    <div className="mt-3 p-2.5 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-xs text-[#991b1b] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-[#ef4444]" />
                      <span>
                        Quantity {simResult.qty} exceeds configured maximum order limit ({simResult.maxQty} units/order). Checkout will block this quantity.
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#f0ece2] flex items-center justify-between">
                  <span className="text-xs text-[#59665f]">
                    Pricing Mode: <strong className="capitalize">{simResult.mode.replace('_', ' ')}</strong>
                  </span>
                  <button
                    onClick={() => selectedProduct && onOpenProductControls(selectedProduct)}
                    className="py-1.5 px-3 bg-[#0e382b] hover:bg-[#134e3a] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Edit Product Tiers & Limits</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BULK PRICING DIRECTORY & CONFIGURATION TABLE */}
      {/* ========================================================================= */}
      <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-heading font-bold text-base text-[#08231b]">
              Catalogue Bulk Pricing Directory
            </h4>
            <p className="text-xs text-[#59665f] mt-0.5">
              Review bulk status, active tier brackets, and max order quantities for all products.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Mode */}
            <div className="flex items-center gap-1 bg-[#ede9de] p-1 rounded-lg text-xs">
              {(['all', 'enabled', 'discount_percent', 'fixed_unit_price'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer capitalize ${
                    filterMode === mode ? 'bg-white text-[#0e382b] shadow-2xs' : 'text-[#637269]'
                  }`}
                >
                  {mode === 'all' ? 'All Products' : mode === 'enabled' ? 'Bulk Active' : mode === 'discount_percent' ? 'Discount %' : 'Fixed Price'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-[#d6d0c2] rounded-lg text-xs w-48"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#7d8c83]" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e6e2d6] text-[#637269] font-medium bg-[#fcfbf7]">
                <th className="py-3 px-3">Product / SKU</th>
                <th className="py-3 px-3">Cost</th>
                <th className="py-3 px-3">Retail Price</th>
                <th className="py-3 px-3">Bulk Mode</th>
                <th className="py-3 px-3">Configured Quantity Tiers</th>
                <th className="py-3 px-3">Max Order Qty</th>
                <th className="py-3 px-3">Bulk Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ece2]">
              {filteredProducts.map(p => {
                const isBulk = p.bulk_pricing_enabled === 1 || Boolean(p.bulk_pricing?.enabled);
                const tiers = p.bulk_pricing?.tiers || [];
                const mode = p.bulk_pricing_mode || p.bulk_pricing?.mode || 'discount_percent';

                return (
                  <tr key={p.id} className="hover:bg-[#faf9f5]">
                    <td className="py-3.5 px-3">
                      <strong className="text-sm text-[#08231b] block">{p.title}</strong>
                      <div className="text-[11px] text-[#637269]">
                        <span className="font-semibold text-[#0e382b]">{p.category}</span>
                        <span aria-hidden="true" className="mx-1">·</span>
                        <span className="font-mono text-[10px]">SKU: {p.source_product_id}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-medium text-[#141f1a]">₦{p.supplier_cost_ngn.toLocaleString()}</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <strong className="text-[#0e382b]">₦{p.retail_price_ngn.toLocaleString()}</strong>
                    </td>

                    <td className="py-3.5 px-3">
                      {isBulk ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          mode === 'discount_percent' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#e0f2fe] text-[#0369a1]'
                        }`}>
                          {mode === 'discount_percent' ? 'Discount %' : 'Fixed Price'}
                        </span>
                      ) : (
                        <span className="text-[#9ca3af]">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      {isBulk && tiers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {tiers.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-[#f4f1ea] border border-[#dcd7cb] rounded text-[10px] font-mono text-[#2f3d35]"
                            >
                              {t.min_quantity}{t.max_quantity ? `–${t.max_quantity}` : '+'}:{' '}
                              <strong className="text-[#0e382b]">
                                {mode === 'discount_percent' ? `${t.discount_percentage}% off` : `₦${t.fixed_unit_price_ngn?.toLocaleString()}`}
                              </strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#9ca3af]">No tiers configured</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      {p.max_order_quantity && p.max_order_quantity > 0 ? (
                        <span className="text-[#b45309] font-semibold">{p.max_order_quantity} units</span>
                      ) : (
                        <span className="text-[#637269]">Unlimited</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      {isBulk ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                          Enabled ({tiers.length} {tiers.length === 1 ? 'tier' : 'tiers'})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#f4f1ea] text-[#738178] border border-[#ded8c9]">
                          Disabled
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => onOpenProductControls(p)}
                        className="py-1 px-2.5 bg-[#0e382b] hover:bg-[#134e3a] text-white rounded text-xs font-semibold cursor-pointer shadow-2xs"
                      >
                        Configure Tiers
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
