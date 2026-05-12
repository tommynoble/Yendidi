-- Add payment tracking columns to orders table for Paystack integration
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'success', 'failed', 'cancelled'));

-- Fix delivery_method constraint to include 'Dine-in' alongside existing values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_method_check
  CHECK (delivery_method IN ('Pickup', 'Delivery', 'Dine-in'));
