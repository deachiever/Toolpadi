import React from 'react';
import { ShieldCheck, AlertCircle, ArrowUpRight, Check, Clock, Layers } from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import type { Product } from '../types.js';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const { addToCart, formatPrice, currency } = useCart();

  const accessLabel = {
    workspace_seat: 'Team Workspace Seat',
    account_invite: 'Account Invitation',
    license_key: 'Official License Key',
    redemption_code: 'Voucher Redemption Code'
  }[product.access_type] || product.access_type;

  const durationLabel = {
    '1_month': '1 Month',
    '3_months': '3 Months',
    '6_months': '6 Months',
    '1_year': '1 Year',
    'lifetime': 'Lifetime Access'
  }[product.duration] || product.duration;

  const currentPrice = currency === 'USD' ? product.retail_price_usd : product.retail_price_ngn;
  const referencePrice = currency === 'USD'
    ? product.pricing?.reference_price_usd
    : product.pricing?.reference_price_ngn;

  const showSavings = Boolean(
    !product.is_reference_stale &&
    product.effective_savings_percent &&
    product.effective_savings_percent > 0 &&
    referencePrice &&
    referencePrice > currentPrice
  );

  return (
    <div className="bg-white border border-[#e6e2d6] rounded-xl p-5 flex flex-col justify-between hover:border-[#134e3a] transition-all duration-200 hover:shadow-sm group">
      <div>
        {/* Zero-Pill Static Metadata: Clean unboxed text with typographical bullet separators */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs text-[#5f6d65] mb-2.5">
          <span className="font-medium text-[#134e3a]">{product.category}</span>
          <span aria-hidden="true" className="text-[#a4b0a8]">·</span>
          <span>{durationLabel}</span>
          <span aria-hidden="true" className="text-[#a4b0a8]">·</span>
          <span>{accessLabel}</span>
        </div>

        {/* Product Title */}
        <h3
          onClick={() => onSelect(product)}
          className="font-heading font-bold text-lg text-[#08231b] group-hover:text-[#134e3a] transition-colors cursor-pointer leading-snug line-clamp-1 mb-1.5"
        >
          {product.title}
        </h3>

        {/* Concise Description */}
        <p className="text-xs text-[#54625a] line-clamp-2 leading-relaxed mb-4">
          {product.short_description}
        </p>

        {/* Compliance / Reseller Verification indicator */}
        <div className="text-[11px] mb-4">
          {product.reseller_approved === 1 ? (
            <div className="flex items-center gap-1.5 text-[#1a634b]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#65a30d]" />
              <span>Verified Wholesale Allocation</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#b45309]">
              <AlertCircle className="w-3.5 h-3.5 text-[#d97706]" />
              <span>Reseller Verification Pending (Not for sale)</span>
            </div>
          )}
        </div>

        {/* Bulk volume purchase badge */}
        {product.bulk_pricing?.enabled && product.bulk_pricing.tiers && product.bulk_pricing.tiers.length > 0 && (
          <div className="mb-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
            <Layers className="w-3 h-3 text-[#16a34a]" />
            <span>Volume Pricing Available ({product.bulk_pricing.tiers.length} {product.bulk_pricing.tiers.length === 1 ? 'tier' : 'tiers'})</span>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-[#f0ece2]">
        {/* Pricing area */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-xl text-[#08231b]">
              {formatPrice(product.retail_price_ngn, product.retail_price_usd)}
            </span>

            {/* Reference price comparison with verifiable source tag */}
            {showSavings && referencePrice && (
              <span className="text-xs text-[#828f87] line-through">
                {formatPrice(
                  product.pricing?.reference_price_ngn || 0,
                  product.pricing?.reference_price_usd || 0
                )}
              </span>
            )}
          </div>

          {/* Genuine Verified Savings citation (Anti-slop: only shown if officially verified within 30 days) */}
          {showSavings && (
            <div className="text-[11px] text-[#2d5f48] font-medium mt-0.5">
              Save ~{product.effective_savings_percent}% vs official direct billing
            </div>
          )}

          {product.is_reference_stale && product.pricing?.reference_price_ngn && (
            <div className="text-[10px] text-[#85928a] mt-0.5">
              Official benchmark unverified within 30 days (savings claim withheld)
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSelect(product)}
            className="w-full py-2 px-3 text-xs font-semibold text-[#0e382b] bg-[#f5f2e9] hover:bg-[#eae5d8] rounded-lg transition-colors text-center cursor-pointer"
          >
            Details & Terms
          </button>

          {product.can_purchase ? (
            <button
              onClick={() => addToCart(product)}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#0e382b] hover:bg-[#134e3a] rounded-lg transition-colors text-center cursor-pointer shadow-2xs"
            >
              Add to Cart
            </button>
          ) : (
            <button
              disabled
              className="w-full py-2 px-2 text-xs font-medium text-[#7d8982] bg-[#ece8dc] rounded-lg cursor-not-allowed text-center"
              title={product.block_reason || 'Product currently unavailable for checkout'}
            >
              Unavailable
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
