import { create } from 'zustand';

export interface CartItem {
    id: string;
    name: string;
    image: string | null;
    price: number;
    quantity: number;
    cookId: string;
    cookName: string;
}

interface AppState {
    isCookMode: boolean;
    userName: string;
    cartItems: CartItem[];
    setCookMode: (mode: boolean) => void;
    toggleCookMode: () => void;
    setUserName: (name: string) => void;
    addToCart: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
    removeFromCart: (mealId: string) => void;
    updateQuantity: (mealId: string, quantity: number) => void;
    clearCart: () => void;
    getCartTotal: () => number;
    getCartCount: () => number;
}

export const useAppStore = create<AppState>((set, get) => ({
    isCookMode: false,
    userName: '',
    cartItems: [],
    setCookMode: (mode) => set({ isCookMode: mode }),
    toggleCookMode: () => set((state) => ({ isCookMode: !state.isCookMode })),
    setUserName: (name) => set({ userName: name }),
    addToCart: (item, quantity) => set((state) => {
        const existing = state.cartItems.find(ci => ci.id === item.id);
        if (existing) {
            return {
                cartItems: state.cartItems.map(ci =>
                    ci.id === item.id ? { ...ci, quantity: ci.quantity + quantity } : ci
                ),
            };
        }
        return { cartItems: [...state.cartItems, { ...item, quantity }] };
    }),
    removeFromCart: (mealId) => set((state) => ({
        cartItems: state.cartItems.filter(ci => ci.id !== mealId),
    })),
    updateQuantity: (mealId, quantity) => set((state) => ({
        cartItems: quantity <= 0
            ? state.cartItems.filter(ci => ci.id !== mealId)
            : state.cartItems.map(ci => ci.id === mealId ? { ...ci, quantity } : ci),
    })),
    clearCart: () => set({ cartItems: [] }),
    getCartTotal: () => get().cartItems.reduce((sum, ci) => sum + ci.price * ci.quantity, 0),
    getCartCount: () => get().cartItems.reduce((sum, ci) => sum + ci.quantity, 0),
}));
