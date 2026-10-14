import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ShoppingBag,
  Zap,
  Info,
  Calendar,
  Lock,
  Layers,
  Tag
} from 'lucide-react';
import { useCart, getProductEffectivePrice } from '../context/CartContext.js';
import type { Product } from '../types.js';

interface ProductDetailViewProps {
  product: Product;
  onBack: () => void;
  onNavigateCheckout: () => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  onBack,
  onNavigateCheckout
}) => {
  const { addToCart, formatPrice, currency, setCurrency, exchangeRate } = useCart();
  const [quantity, setQuantity] = useState<number>(1);
  const [addedAnimation, setAddedAnimation] = useState<boolean>(false);

  const durationMap: Record<string, string> = {
    '1_month': '1 Month (30 Days)',
    '3_months': '3 Months (90 Days)',
    '6_months': '6 Months (180 Days)',
    '1_year': '1 Year (365 Days)',
    'lifetime': 'Lifetime Access'
  };

  const accessMap: Record<string, string> = {
    workspace_seat: 'Team Workspace Seat (Invited to authorized team)',
    account_invite: 'Direct Account Invitation (Activated on your personal account)',
    license_key: 'Official License Activation Key (Alpha-numeric code string)',
    redemption_code: 'Official Voucher Redemption Code'
  };

  const handleAddToCart = () => {
    const success = addToCart(product, quantity);
    if (success) {
      setAddedAnimation(true);
      setTimeout(() => setAddedAnimation(false), 2000);
    }
  };

  const maxAllowedQty = product.max_order_quantity && product.max_order_quantity > 0
    ? (product.is_unlimited === 1 ? product.max_order_quantity : Math.min(product.stock_count, product.max_order_quantity))
    : (product.is_unlimited === 1 ? 999 : product.stock_count);

  const effectivePrice = getProductEffectivePrice(product, quantity, exchangeRate);

  const handleInstantBuy = () => {
    const success = addToCart(product, quantity);
    if (success) {
      onNavigateCheckout();
    }
  };

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back Button & Breadcrumbs */}
      <div className="flex items-center gap-3 text-xs text-[#5f6d65]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[#0e382b] hover:underline font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalogue</span>
        </button>
        <span aria-hidden="true">/</span>
        <span>{product.category}</span>
        <span aria-hidden="true">/</span>
        <span className="text-[#141f1a] font-medium truncate max-w-xs">{product.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Details, Activation Steps, Terms */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xs">
            {/* Zero-Pill Static Metadata */}
            <div className="flex items-center flex-wrap gap-2 text-xs text-[#55645c]">
              <span className="font-semibold text-[#134e3a]">{product.category}</span>
              <span aria-hidden="true">·</span>
              <span>{durationMap[product.duration] || product.duration}</span>
              <span aria-hidden="true">·</span>
              <span>{accessMap[product.access_type] || product.access_type}</span>
            </div>

            <h1 className="font-heading font-black text-2xl sm:text-4xl text-[#08231b] leading-tight">
              {product.title}
            </h1>

            <p className="text-sm sm:text-base text-[#46544d] leading-relaxed">
              {product.description}
            </p>

            {/* Access & Duration Specs Table */}
            <div className="border border-[#e6e2d6] rounded-xl overflow-hidden text-xs">
              <div className="bg-[#fbfaf6] px-4 py-2.5 font-bold text-[#0e382b] border-b border-[#e6e2d6]">
                Technical Access Specifications
              </div>
              <div className="divide-y divide-[#f0ece2]">
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-[#65736b]">Access Method:</span>
                  <span className="font-semibold text-[#141f1a]">{accessMap[product.access_type] || product.access_type}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-[#65736b]">Subscription Duration:</span>
                  <span className="font-semibold text-[#141f1a]">{durationMap[product.duration] || product.duration}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-[#65736b]">Delivery Turnaround:</span>
                  <span className="font-semibold text-[#141f1a]">Instant on verified payment (under 15 mins)</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-[#65736b]">Wholesale Source ID:</span>
                  <span className="font-mono text-[#141f1a]">{product.source_product_id}</span>
                </div>
              </div>
            </div>

            {/* Activation Instructions */}
            <div className="bg-[#faf8f2] border border-[#e8e2d4] rounded-xl p-5 space-y-2">
              <h3 className="font-heading font-bold text-sm text-[#0e382b] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#65a30d]" />
                <span>How Activation & Delivery Works</span>
              </h3>
              <p className="text-xs text-[#505e56] leading-relaxed">
                {product.delivery_instructions}
              </p>
              <div className="pt-2 text-[11px] text-[#6b7971]">
                Codes and invitation links are delivered immediately onto your verified customer dashboard upon payment and stored permanently in your order history.
              </div>
            </div>

            {/* Terms of Service & Compliance */}
            <div className="space-y-3 pt-2">
              <h3 className="font-heading font-bold text-sm text-[#08231b] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#0e382b]" />
                <span>Reseller Compliance & Specific Terms</span>
              </h3>
              <div className="p-4 bg-[#fbfaf6] border border-[#e6e2d6] rounded-lg text-xs text-[#526058] leading-relaxed">
                {product.terms_of_service}
              </div>
            </div>

            {/* 48-Hour Warranty Commitment */}
            <div className="flex items-start gap-3 p-4 bg-[#f0f7f3] border border-[#cbe4d4] rounded-xl text-xs text-[#1e4a36]">
              <ShieldCheck className="w-5 h-5 text-[#1a634b] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#0e382b]">ToolPadi 48-Hour Replacement Guarantee</p>
                <p className="mt-0.5 leading-relaxed">
                  If your activation code fails or team seat invitation is not recognized within 48 hours of purchase, our support team will immediately re-issue working access or process a 100% money-back refund with zero hassle.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing, Reference Evidence, Buy Card */}
        <div className="space-y-6">
          <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-6 sticky top-24 shadow-sm">
            {/* Currency selector inside card */}
            <div className="flex items-center justify-between text-xs pb-3 border-b border-[#f0ece2]">
              <span className="text-[#65736b]">Selected Currency:</span>
              <div className="flex items-center bg-[#f0ece2] p-0.5 rounded border border-[#dfdbce]">
                <button
                  onClick={() => setCurrency('NGN')}
                  className={`px-2 py-0.5 text-xs font-semibold rounded cursor-pointer ${
                    currency === 'NGN' ? 'bg-white text-[#0e382b] shadow-2xs' : 'text-[#64726a]'
                  }`}
                >
                  ₦ NGN
                </button>
                <button
                  onClick={() => setCurrency('USD')}
                  className={`px-2 py-0.5 text-xs font-semibold rounded cursor-pointer ${
                    currency === 'USD' ? 'bg-white text-[#0e382b] shadow-2xs' : 'text-[#64726a]'
                  }`}
                >
                  $ USD
                </button>
              </div>
            </div>

            {/* Price Headline with Bulk Discount Support */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#5f6d65] font-medium">Effective Unit Price:</span>
                {effectivePrice.isBulkApplied && (
                  <span className="text-[10px] font-bold text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded">
                    {effectivePrice.tierLabel}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-heading font-extrabold text-3xl sm:text-4xl text-[#08231b]">
                  {formatPrice(effectivePrice.unitPriceNgn, effectivePrice.unitPriceUsd)}
                </span>
                {effectivePrice.isBulkApplied ? (
                  <span className="text-sm text-[#8a9690] line-through">
                    {formatPrice(product.retail_price_ngn, product.retail_price_usd)}
                  </span>
                ) : showSavings && referencePrice ? (
                  <span className="text-sm text-[#8a9690] line-through">
                    {formatPrice(
                      product.pricing?.reference_price_ngn || 0,
                      product.pricing?.reference_price_usd || 0
                    )}
                  </span>
                ) : null}
              </div>
              <div className="text-[11px] text-[#697770] mt-1">
                {effectivePrice.isBulkApplied ? (
                  <span className="text-[#16a34a] font-semibold">
                    Volume tier applied ({effectivePrice.discountPercent}% discount).
                  </span>
                ) : (
                  <span>Tax and processing included. Verified transparent wholesale rate.</span>
                )}
              </div>
            </div>

            {/* Bulk Volume Pricing Tiers Card (when enabled) */}
            {product.bulk_pricing?.enabled && product.bulk_pricing.tiers && product.bulk_pricing.tiers.length > 0 && (
              <div className="border border-[#bbf7d0] bg-[#f0fdf4] rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#14532d] text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#16a34a]" />
                    <span>Volume Purchase Tiers</span>
                  </span>
                  <span className="text-[10px] bg-[#dcfce7] text-[#15803d] font-bold px-2 py-0.5 rounded border border-[#bbf7d0]">
                    {product.bulk_pricing.mode === 'discount_percent' ? 'Discount % Mode' : 'Fixed Unit Price'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {/* Base tier */}
                  <div
                    onClick={() => setQuantity(1)}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                      quantity < (product.bulk_pricing.tiers[0]?.min_quantity || 2)
                        ? 'bg-white border-[#16a34a] ring-1 ring-[#16a34a] font-semibold'
                        : 'bg-white/70 border-[#c7ebd4] hover:bg-white text-[#4b5563]'
                    }`}
                  >
                    <span>1 – {(product.bulk_pricing.tiers[0]?.min_quantity || 2) - 1} units (Base)</span>
                    <strong className="text-[#08231b]">
                      {formatPrice(product.retail_price_ngn, product.retail_price_usd)}/ea
                    </strong>
                  </div>

                  {/* Configured Tiers */}
                  {product.bulk_pricing.tiers.map((t, idx) => {
                    const isCurrent = quantity >= t.min_quantity && (!t.max_quantity || t.max_quantity === 0 || quantity <= t.max_quantity);
                    const tNgn = product.bulk_pricing?.mode === 'discount_percent'
                      ? Math.round(product.retail_price_ngn * (1 - (t.discount_percentage || 0) / 100))
                      : (t.fixed_unit_price_ngn || product.retail_price_ngn);
                    const tUsd = product.bulk_pricing?.mode === 'discount_percent'
                      ? Math.round((product.retail_price_usd * (1 - (t.discount_percentage || 0) / 100)) * 100) / 100
                      : (t.fixed_unit_price_usd || Math.round((tNgn / exchangeRate) * 100) / 100);

                    return (
                      <div
                        key={idx}
                        onClick={() => setQuantity(t.min_quantity)}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-white border-[#16a34a] ring-1 ring-[#16a34a] font-semibold text-[#14532d]'
                            : 'bg-white/70 border-[#c7ebd4] hover:bg-white text-[#4b5563]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{t.min_quantity}{t.max_quantity && t.max_quantity > 0 ? `–${t.max_quantity}` : '+'} units:</span>
                          {product.bulk_pricing?.mode === 'discount_percent' ? (
                            <span className="text-[10px] bg-[#dcfce7] text-[#15803d] font-bold px-1.5 py-0.2 rounded">
                              {t.discount_percentage}% OFF
                            </span>
                          ) : (
                            <span className="text-[10px] bg-[#e0f2fe] text-[#0369a1] font-bold px-1.5 py-0.2 rounded">
                              Fixed
                            </span>
                          )}
                        </div>
                        <strong className="text-[#08231b]">
                          {formatPrice(tNgn, tUsd)}/ea
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Verifiable Reference Benchmark Evidence Box (Crucial Requirement!) */}
            <div className="border border-[#e0dacb] bg-[#faf8f2] rounded-xl p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0e382b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#65a30d]" />
                  <span>Reference Benchmark Evidence</span>
                </span>
                {showSavings ? (
                  <span className="text-[11px] font-bold text-[#1a634b]">
                    Save ~{product.effective_savings_percent}%
                  </span>
                ) : null}
              </div>

              {product.pricing?.reference_price_ngn && !product.is_reference_stale ? (
                <div className="space-y-1.5 text-[11px] text-[#4f5c54]">
                  <div>
                    <span className="text-[#75827b]">Official Benchmark: </span>
                    <strong className="text-[#141f1a]">
                      {formatPrice(product.pricing.reference_price_ngn, product.pricing.reference_price_usd || 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#75827b]">Comparable Plan: </span>
                    <span>{product.pricing.reference_plan_name || 'Direct official tier'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[#75827b]">Source: </span>
                    {product.pricing.reference_source_url ? (
                      <a
                        href={product.pricing.reference_source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0e382b] underline flex items-center gap-0.5 hover:text-[#1b634b]"
                      >
                        <span>Official Pricing Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span>Direct official pricing</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[#75827b]">Audited: </span>
                    <span>
                      {product.pricing.reference_verified_at
                        ? new Date(product.pricing.reference_verified_at).toLocaleDateString()
                        : 'Recent'}
                    </span>
                  </div>
                </div>
              ) : product.is_reference_stale && product.pricing?.reference_price_ngn ? (
                <div className="text-[11px] text-[#92400e] space-y-1">
                  <p className="font-semibold">Savings Benchmark Withheld (Stale Notice)</p>
                  <p>
                    Official reference pricing was verified more than 30 days ago. Under ToolPadi compliance rules, claims are suppressed until re-audited.
                  </p>
                </div>
              ) : (
                <div className="text-[11px] text-[#55635b]">
                  <p>Direct wholesale price with no fabricated benchmark discount.</p>
                </div>
              )}
            </div>

            {/* Reseller Authorization & Stock Status */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#65736b]">Reseller Status:</span>
                {product.reseller_approved === 1 ? (
                  <span className="text-[#1a634b] font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Authorized Wholesale</span>
                  </span>
                ) : (
                  <span className="text-[#b45309] font-bold">
                    PENDING VERIFICATION
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#65736b]">Availability:</span>
                <span className={`font-semibold ${product.stock_count > 0 ? 'text-[#1a634b]' : 'text-[#b91c1c]'}`}>
                  {product.stock_count > 0 ? `${product.stock_count} units available` : 'Out of stock'}
                </span>
              </div>

              {product.max_order_quantity && product.max_order_quantity > 0 ? (
                <div className="flex items-center justify-between text-xs text-[#b45309]">
                  <span className="font-medium">Order Limit:</span>
                  <span className="font-bold">Max {product.max_order_quantity} units / order</span>
                </div>
              ) : null}
            </div>

            {/* Block reason if not purchasable */}
            {!product.can_purchase && (
              <div className="p-3 bg-[#fef3c7] border border-[#fde68a] rounded-lg text-xs text-[#92400e] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#d97706] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Checkout Unavailable</p>
                  <p className="mt-0.5">{product.block_reason || 'Product cannot be purchased at this time.'}</p>
                </div>
              </div>
            )}

            {/* Quantity Selector with Limits and Dynamic Total */}
            {product.can_purchase && (
              <div className="space-y-2.5 pt-2 border-t border-[#f0ece2]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#3a4740] font-medium">Quantity:</span>
                  <div className="flex items-center border border-[#d8d3c5] rounded-md bg-[#faf8f2]">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-1 text-sm text-[#2f3b34] hover:bg-[#eae5d8] transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-3 text-xs font-bold text-[#141f1a] min-w-[28px] text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(maxAllowedQty, quantity + 1))}
                      disabled={quantity >= maxAllowedQty}
                      className="px-3 py-1 text-sm text-[#2f3b34] hover:bg-[#eae5d8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Live Order Total Box */}
                <div className="p-3 bg-[#fbfaf6] border border-[#e6e2d6] rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[#5f6d65]">
                    <span>Line Total ({quantity} {quantity === 1 ? 'unit' : 'units'}):</span>
                    <strong className="text-base text-[#08231b] font-heading">
                      {formatPrice(effectivePrice.totalNgn, effectivePrice.totalUsd)}
                    </strong>
                  </div>
                  {effectivePrice.isBulkApplied && effectivePrice.totalSavingsNgn > 0 && (
                    <div className="flex items-center justify-between text-[#166534] font-semibold text-[11px] pt-1 border-t border-[#ded8c9]">
                      <span>Volume Savings:</span>
                      <span>- {formatPrice(effectivePrice.totalSavingsNgn, effectivePrice.totalSavingsUsd)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {product.can_purchase ? (
                <>
                  <button
                    onClick={handleAddToCart}
                    className="w-full py-3 px-4 bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#0e382b] font-bold text-sm rounded-lg transition-colors border border-[#dcd7cb] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{addedAnimation ? 'Added to Cart!' : 'Add to Cart'}</span>
                  </button>

                  <button
                    onClick={handleInstantBuy}
                    className="w-full py-3 px-4 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-sm rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-[#a3e635]" />
                    <span>Instant Checkout ({formatPrice(effectivePrice.totalNgn, effectivePrice.totalUsd)})</span>
                  </button>
                </>
              ) : (
                <button
                  disabled
                  className="w-full py-3 px-4 bg-[#e5e1d5] text-[#7d8981] font-semibold text-sm rounded-lg cursor-not-allowed text-center"
                >
                  Checkout Disabled (Compliance Gate)
                </button>
              )}
            </div>

            <div className="text-[11px] text-[#717e77] text-center pt-1">
              Supports Nigerian Bank Transfer & Cards in Sandbox Mode
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
