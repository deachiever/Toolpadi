import React from 'react';
import { X, Trash2, ArrowRight, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext.js';

interface CartDrawerProps {
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onCheckout }) => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    currency,
    setCurrency,
    totalNgn,
    totalUsd,
    totalSavingsNgn,
    totalSavingsUsd,
    formatPrice,
    getItemPrice
  } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#fbfaf6] border-l border-[#e6e2d6] shadow-xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-[#e6e2d6] bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#0e382b]" />
              <h2 className="font-heading font-bold text-lg text-[#08231b]">Your Tool Cart</h2>
              <span className="text-xs text-[#59665f]">({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1 text-[#65736b] hover:text-[#08231b] rounded-md transition-colors"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body items */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.length === 0 ? (
              <div className="py-16 text-center text-[#67756e]">
                <ShoppingBag className="w-12 h-12 mx-auto text-[#b8c2bc] mb-3" />
                <p className="font-medium text-[#1c2822]">Your cart is empty</p>
                <p className="text-xs text-[#717e76] mt-1 max-w-xs mx-auto">
                  Add verified subscriptions or developer licenses to begin your checkout.
                </p>
              </div>
            ) : (
              cart.map(item => {
                const durationLabel = {
                  '1_month': '1 Mo',
                  '3_months': '3 Mo',
                  '6_months': '6 Mo',
                  '1_year': '1 Yr',
                  'lifetime': 'Lifetime'
                }[item.product.duration] || item.product.duration;
                const priceInfo = getItemPrice(item);

                return (
                  <div
                    key={item.product.id}
                    className="bg-white border border-[#e6e2d6] rounded-lg p-4 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] text-[#55645c]">
                          <span>{item.product.category}</span>
                          <span aria-hidden="true" className="mx-1">·</span>
                          <span>{durationLabel}</span>
                        </div>
                        <h4 className="font-heading font-bold text-sm text-[#08231b] mt-0.5">
                          {item.product.title}
                        </h4>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-[#9aa59f] hover:text-[#b91c1c] p-1 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f4f0e6]">
                      {/* Quantity controls */}
                      <div className="flex items-center border border-[#d8d3c5] rounded-md bg-[#fdfdfb]">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="px-2.5 py-0.5 text-sm text-[#3b4740] hover:bg-[#eae5d8] transition-colors"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-semibold text-[#141f1a]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="px-2.5 py-0.5 text-sm text-[#3b4740] hover:bg-[#eae5d8] transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* Line price and bulk discount badge */}
                      <div className="text-right">
                        {priceInfo.isBulkApplied && (
                          <div className="text-[10px] font-bold text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] px-1.5 py-0.5 rounded inline-block mb-1">
                            {priceInfo.tierLabel}
                          </div>
                        )}
                        <div className="font-heading font-bold text-sm text-[#08231b]">
                          {formatPrice(priceInfo.totalNgn, priceInfo.totalUsd)}
                        </div>
                        {priceInfo.isBulkApplied && priceInfo.totalSavingsNgn > 0 && (
                          <div className="text-[10px] text-[#65a30d] font-semibold">
                            Saved {formatPrice(priceInfo.totalSavingsNgn, priceInfo.totalSavingsUsd)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer & Checkout Action */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-[#e6e2d6] bg-white space-y-3">
              <div className="flex items-center justify-between text-xs text-[#5f6d65]">
                <span>Currency Display:</span>
                <div className="flex items-center bg-[#f0ece2] p-0.5 rounded border border-[#dfdbce]">
                  <button
                    onClick={() => setCurrency('NGN')}
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      currency === 'NGN' ? 'bg-white text-[#0e382b] font-bold shadow-2xs' : 'text-[#64726a]'
                    }`}
                  >
                    ₦ NGN
                  </button>
                  <button
                    onClick={() => setCurrency('USD')}
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      currency === 'USD' ? 'bg-white text-[#0e382b] font-bold shadow-2xs' : 'text-[#64726a]'
                    }`}
                  >
                    $ USD
                  </button>
                </div>
              </div>

              {totalSavingsNgn > 0 && (
                <div className="p-2.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg flex items-center justify-between text-xs">
                  <span className="text-[#166534] font-semibold">Total Bulk Volume Savings:</span>
                  <span className="font-bold text-[#166534]">
                    - {formatPrice(totalSavingsNgn, totalSavingsUsd)}
                  </span>
                </div>
              )}

              <div className="flex items-baseline justify-between pt-1">
                <span className="font-medium text-sm text-[#2c3832]">Total Amount:</span>
                <span className="font-heading font-extrabold text-2xl text-[#08231b]">
                  {formatPrice(totalNgn, totalUsd)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-[#42524a]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#65a30d]" />
                <span>Instant delivery via secure customer dashboard.</span>
              </div>

              <button
                onClick={() => {
                  setIsCartOpen(false);
                  onCheckout();
                }}
                className="w-full py-3 px-4 bg-[#0e382b] hover:bg-[#134e3a] text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4 text-[#a3e635]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
