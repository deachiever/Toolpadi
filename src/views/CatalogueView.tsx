import React, { useState, useMemo } from 'react';
import { Search, Filter, SlidersHorizontal, RotateCcw, AlertTriangle } from 'lucide-react';
import { ProductCard } from '../components/ProductCard.js';
import type { Product } from '../types.js';

interface CatalogueViewProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const CatalogueView: React.FC<CatalogueViewProps> = ({
  products,
  onSelectProduct,
  searchQuery,
  onSearchChange
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedAccessType, setSelectedAccessType] = useState<string>('All');
  const [selectedDuration, setSelectedDuration] = useState<string>('All');
  const [onlyAuthorized, setOnlyAuthorized] = useState<boolean>(false);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured');

  const categories = ['All', 'Design & Creative', 'Developer Tools', 'Learning & Education', 'Productivity & Office', 'AI & Utility'];
  const accessTypes = [
    { value: 'All', label: 'All Access Types' },
    { value: 'workspace_seat', label: 'Team Workspace Seat' },
    { value: 'account_invite', label: 'Account Invitation' },
    { value: 'license_key', label: 'License Key String' },
    { value: 'redemption_code', label: 'Voucher Redemption Code' }
  ];
  const durations = [
    { value: 'All', label: 'All Durations' },
    { value: '1_month', label: '1 Month' },
    { value: '3_months', label: '3 Months' },
    { value: '6_months', label: '6 Months' },
    { value: '1_year', label: '1 Year' },
    { value: 'lifetime', label: 'Lifetime' }
  ];

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.short_description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Category
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Access Type
    if (selectedAccessType !== 'All') {
      result = result.filter(p => p.access_type === selectedAccessType);
    }

    // Duration
    if (selectedDuration !== 'All') {
      result = result.filter(p => p.duration === selectedDuration);
    }

    // Only Reseller Authorized
    if (onlyAuthorized) {
      result = result.filter(p => p.reseller_approved === 1);
    }

    // Only in stock
    if (onlyInStock) {
      result = result.filter(p => p.stock_count > 0);
    }

    // Sorting
    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.retail_price_ngn - b.retail_price_ngn);
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.retail_price_ngn - a.retail_price_ngn);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [products, searchQuery, selectedCategory, selectedAccessType, selectedDuration, onlyAuthorized, onlyInStock, sortBy]);

  const hasActiveFilters = selectedCategory !== 'All' || selectedAccessType !== 'All' || selectedDuration !== 'All' || onlyAuthorized || onlyInStock || searchQuery.length > 0;

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSelectedAccessType('All');
    setSelectedDuration('All');
    setOnlyAuthorized(false);
    setOnlyInStock(false);
    onSearchChange('');
    setSortBy('featured');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title & Header */}
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-[#08231b]">
          Digital Tools Catalogue
        </h1>
        <p className="text-sm text-[#5a6760] mt-1">
          Explore verified digital subscriptions, team workspace seats, and commercial developer licenses.
        </p>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white border border-[#e6e2d6] rounded-xl p-5 space-y-4 shadow-2xs">
        {/* Top line: Search and sorting */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a968f]" />
            <input
              type="text"
              placeholder="Search by product name, keywords, or tooling category..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#faf9f5] border border-[#d8d3c5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e382b] text-[#141f1a]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5f6d65] shrink-0 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-2 px-3 text-xs font-semibold bg-[#faf9f5] border border-[#d8d3c5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e382b] text-[#141f1a] cursor-pointer"
            >
              <option value="featured">Curated (Default)</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name">Product Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Categories segment tabs (Interactive buttons, zero-pill) */}
        <div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[#5f6d65] font-medium mr-2 shrink-0">Category:</span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#0e382b] text-white'
                    : 'bg-[#f4f1ea] text-[#3d4942] hover:bg-[#eae6dc]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Secondary Filters */}
        <div className="pt-3 border-t border-[#f0ece2] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Access Type */}
            <select
              value={selectedAccessType}
              onChange={(e) => setSelectedAccessType(e.target.value)}
              className="py-1.5 px-2.5 bg-[#fbfaf6] border border-[#d8d3c5] rounded-md text-[#3a4740] cursor-pointer"
            >
              {accessTypes.map(at => (
                <option key={at.value} value={at.value}>{at.label}</option>
              ))}
            </select>

            {/* Duration */}
            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
              className="py-1.5 px-2.5 bg-[#fbfaf6] border border-[#d8d3c5] rounded-md text-[#3a4740] cursor-pointer"
            >
              {durations.map(dur => (
                <option key={dur.value} value={dur.value}>{dur.label}</option>
              ))}
            </select>

            {/* Checkboxes */}
            <label className="flex items-center gap-1.5 text-[#3a4740] cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAuthorized}
                onChange={(e) => setOnlyAuthorized(e.target.checked)}
                className="rounded text-[#0e382b] focus:ring-[#0e382b]"
              />
              <span>Authorized Resale Only</span>
            </label>

            <label className="flex items-center gap-1.5 text-[#3a4740] cursor-pointer">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded text-[#0e382b] focus:ring-[#0e382b]"
              />
              <span>In Stock Only</span>
            </label>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-[#b91c1c] hover:underline cursor-pointer font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Count Summary */}
      <div className="flex items-center justify-between text-xs text-[#5e6d65]">
        <span>Showing {filteredProducts.length} of {products.length} products</span>
        <span>Transparent pricing enforced server-side</span>
      </div>

      {/* Grid or Honest Empty State */}
      {products.length === 0 ? (
        <div className="py-20 text-center bg-white border border-[#e6e2d6] rounded-2xl p-8 sm:p-14 max-w-xl mx-auto space-y-4 shadow-2xs">
          <div className="w-12 h-12 bg-[#faf8f2] text-[#0e382b] rounded-xl flex items-center justify-center mx-auto border border-[#e6e2d6]">
            <AlertTriangle className="w-6 h-6 text-[#0e382b]" />
          </div>
          <h3 className="font-heading font-bold text-xl text-[#08231b]">
            Products will appear here when the supplier catalogue is connected.
          </h3>
          <p className="text-xs text-[#5f6c65] max-w-md mx-auto leading-relaxed">
            ToolPadi displays actual synchronized products only. No fictional mock listings are generated. Once the InsightXPro reseller API is polled and products are approved, they will appear here.
          </p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center bg-white border border-[#e6e2d6] rounded-xl p-8 space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto text-[#d97706]" />
          <h3 className="font-heading font-bold text-lg text-[#08231b]">No matching tools found</h3>
          <p className="text-xs text-[#5f6c65] max-w-md mx-auto">
            Try adjusting your search query, selecting "All" categories, or removing access type filters.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-2 py-2 px-4 bg-[#0e382b] text-white rounded-lg text-xs font-semibold hover:bg-[#134e3a] transition-colors cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
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
    </div>
  );
};
