import { Card, CardContent } from "@/components/ui/card";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: string;
  stock: number;
  lowStockThreshold: number;
}

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  onAddToCart: (product: Product) => void;
}

export default function ProductGrid({ products, loading, onAddToCart }: ProductGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-muted rounded-lg mb-3"></div>
            <div className="h-4 bg-muted rounded mb-2"></div>
            <div className="h-3 bg-muted rounded mb-2"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <i className="fas fa-box-open text-4xl mb-4"></i>
          <p>No products found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
      {products.map((product) => (
        <Card
          key={product.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onAddToCart(product)}
          data-testid={`product-${product.sku}`}
        >
          <CardContent className="p-3 flex flex-col h-full">
            <div className="aspect-square bg-muted/20 rounded-lg mb-3 flex items-center justify-center">
              <i className="fas fa-image text-muted-foreground text-2xl"></i>
            </div>
            <h4 className="font-medium text-sm mb-1 flex-grow" title={product.name}>
              {product.name.length > 20 ? `${product.name.slice(0, 20)}...` : product.name}
            </h4>
            <p className="text-xs text-muted-foreground mb-2">SKU: {product.sku}</p>
            <div className="flex items-center justify-between mt-auto">
              <span className="font-bold text-primary text-base">${Number(product.price).toFixed(2)}</span>
              <span 
                className={`text-xs font-medium ${
                  product.stock <= product.lowStockThreshold 
                    ? "text-destructive" 
                    : "text-muted-foreground"
                }`}
              >
                Stock: {product.stock}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
