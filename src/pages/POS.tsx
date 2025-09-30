import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

const POS = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [processing, setProcessing] = useState(false);

  const { data: products = [], refetch } = useQuery({
    queryKey: ['products', searchTerm],
    queryFn: async () => {
      let query = supabase.from('products').select('*');
      
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const addToCart = (product: any) => {
    if (product.quantity_in_stock <= 0) {
      toast.error('Product out of stock!');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity_in_stock) {
          toast.error('Not enough stock!');
          return prev;
        }
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: Number(product.selling_price),
        quantity: 1,
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.productId === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const processPayment = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty!');
      return;
    }

    setProcessing(true);
    try {
      const saleData = {
        total_amount: total,
        tax_amount: 0,
        discount_amount: 0,
        payment_method: paymentMethod,
        cashier_id: user?.id,
        receipt_number: `RCP-${Date.now()}`,
      };

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert(saleData)
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.productId,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ quantity_in_stock: product.quantity_in_stock - item.quantity })
            .eq('id', item.productId);
          
          if (updateError) throw updateError;
        }
      }

      toast.success('Sale completed successfully!');
      setCart([]);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process sale');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm p-4">
        <div className="container mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Point of Sale</h1>
        </div>
      </header>

      <main className="container mx-auto grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="max-h-[600px] space-y-2 overflow-auto">
                {products.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer transition-colors hover:bg-muted"
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.brand} - {product.unit_size}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stock: {product.quantity_in_stock}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          KES {Number(product.selling_price).toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {products.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    No products found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {cart.length} item(s)
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[400px] space-y-2 overflow-auto">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        KES {item.price.toFixed(2)} each
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.productId, parseInt(e.target.value) || 1)
                      }
                      className="w-20"
                    />
                    <p className="w-24 text-right font-bold">
                      KES {(item.price * item.quantity).toFixed(2)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(item.productId)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {cart.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    Cart is empty
                  </p>
                )}
              </div>

              {cart.length > 0 && (
                <>
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">KES {total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Method</label>
                    <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={processPayment}
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Complete Sale'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default POS;
