import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ProductGrid from "@/components/ship-store/pos/product-grid";
import ShoppingCart from "@/components/ship-store/pos/shopping-cart";
import { apiRequest } from "@/lib/queryClient";
import { AssetSelector } from "@/components/AssetSelector";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
}

export default function POS() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: selectedAssetId 
      ? ['/api/ship-store/products', selectedCategory || 'all', selectedAssetId]
      : ['/api/ship-store/products', selectedCategory || 'all'],
    queryFn: async () => {
      let url = selectedCategory 
        ? `/api/ship-store/products?categoryId=${selectedCategory}`
        : '/api/ship-store/products';
      if (selectedAssetId) {
        url += (url.includes('?') ? '&' : '?') + `assetId=${selectedAssetId}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/ship-store/categories"],
  });

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: 1,
        sku: product.sku,
      }];
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id));
    } else {
      setCart(prev => prev.map(item =>
        item.id === id ? { ...item, quantity } : item
      ));
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const scanBarcode = async () => {
    if (!barcodeInput.trim()) return;
    
    try {
      const response = await apiRequest("GET", `/api/ship-store/products/barcode/${barcodeInput}`);
      const product = await response.json();
      addToCart(product);
      setBarcodeInput("");
      toast({
        title: "Product Added",
        description: `${product.name} added to cart`,
      });
    } catch (error) {
      toast({
        title: "Product Not Found",
        description: "No product found with this barcode",
        variant: "destructive",
      });
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.0825; // 8.25% tax rate
  const total = subtotal + tax;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="pos-title">Point of Sale</h2>
          <p className="text-muted-foreground">Process customer transactions and manage cart</p>
        </div>
        <AssetSelector 
          value={selectedAssetId} 
          onChange={setSelectedAssetId}
          className="w-full max-w-[280px]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Catalog */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Product Catalog</CardTitle>
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Search or scan barcode..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && scanBarcode()}
                    className="w-64"
                    data-testid="barcode-input"
                  />
                  <Button onClick={scanBarcode} data-testid="scan-button">
                    <i className="fas fa-barcode"></i>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Category Tabs */}
              <div className="flex space-x-1 mb-4">
                <Button
                  variant={selectedCategory === "" ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setSelectedCategory("")}
                  data-testid="category-all"
                >
                  All
                </Button>
                {categories?.map((category: any) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    data-testid={`category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>

              <ProductGrid
                products={products || []}
                loading={productsLoading}
                onAddToCart={addToCart}
              />
            </CardContent>
          </Card>
        </div>

        {/* Shopping Cart */}
        <div>
          <ShoppingCart
            items={cart}
            subtotal={subtotal}
            tax={tax}
            total={total}
            onUpdateQuantity={updateQuantity}
            onClear={clearCart}
          />
        </div>
      </div>
    </div>
  );
}
