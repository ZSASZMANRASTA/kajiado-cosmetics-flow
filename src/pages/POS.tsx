import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, ShoppingCart, Trash2, Download } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { db, Product } from '@/lib/db';
import { ReceiptDialog } from '@/components/pos/ReceiptDialog';

interface CartItem {
  productId: number;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    receiptNumber: string;
    items: CartItem[];
    total: number;
    paymentMethod: string;
  } | null>(null);

  useEffect(() => {
    loadProducts();
  }, [searchTerm]);

  const loadProducts = async () => {
    try {
      let query = db.products.orderBy('name');

      if (searchTerm) {
        const results = await db.products
          .filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
          )
          .limit(20)
          .toArray();
        setProducts(results);
      } else {
        const results = await query.limit(20).toArray();
        setProducts(results);
      }
    } catch (error) {
      toast.error('Failed to load products');
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error('Product out of stock!');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
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
        productId: product.id!,
        name: product.name,
        price: product.sellingPrice,
        quantity: 1,
      }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
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

  const showReceipt = (receiptNumber: string, items: CartItem[], total: number, paymentMethod: string) => {
    setReceiptData({ receiptNumber, items, total, paymentMethod });
    setShowReceiptDialog(true);
    toast.success('Sale completed successfully!');
  };

  const exportSalesData = async () => {
    try {
      const sales = await db.sales
        .filter(sale => sale.cashierId === user?.id)
        .reverse()
        .sortBy('createdAt');

      const salesWithItems = await Promise.all(
        sales.map(async (sale) => {
          const items = await db.saleItems
            .where('saleId')
            .equals(sale.id!)
            .toArray();

          return {
            'Receipt Number': sale.receiptNumber,
            'Date': new Date(sale.createdAt).toLocaleString(),
            'Items': items.map(i => `${i.productName} (${i.quantity})`).join(', '),
            'Total Amount': sale.totalAmount.toFixed(2),
            'Payment Method': sale.paymentMethod,
            'Cashier': sale.cashierName,
          };
        })
      );

      const csv = Papa.unparse(salesWithItems);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `sales_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Sales data exported successfully!');
    } catch (error) {
      toast.error('Failed to export sales data');
    }
  };

  const processPayment = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty!');
      return;
    }

    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    setProcessing(true);
    try {
      const receiptNumber = `RCP-${Date.now()}`;

      const saleId = await db.sales.add({
        receiptNumber,
        totalAmount: total,
        amountPaid: total,
        change: 0,
        paymentMethod,
        cashierId: user.id,
        cashierName: user.fullName,
        createdAt: new Date(),
      });

      for (const item of cart) {
        await db.saleItems.add({
          saleId,
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
        });

        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(item.productId, {
            stock: product.stock - item.quantity,
            updatedAt: new Date(),
          });
        }
      }

      // Show receipt dialog
      showReceipt(receiptNumber, cart, total, paymentMethod);
      setCart([]);
      loadProducts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process sale');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm p-3 md:p-4">
        <div className="container mx-auto flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold flex-1">Point of Sale</h1>
          <Button variant="outline" size="sm" onClick={exportSalesData} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export Sales</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto grid gap-3 md:gap-4 p-3 md:p-4 md:grid-cols-2">
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
                          {product.brand} - {product.category}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stock: {product.stock}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          KES {product.sellingPrice.toFixed(2)}
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
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') return; // Allow deletion but don't update
                        updateQuantity(item.productId, parseInt(val) || 1);
                      }}
                      onBlur={(e) => {
                        // Ensure minimum of 1 when user leaves the field
                        if (e.target.value === '' || parseInt(e.target.value) < 1) {
                          updateQuantity(item.productId, 1);
                        }
                      }}
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

      {receiptData && (
        <ReceiptDialog
          open={showReceiptDialog}
          onOpenChange={setShowReceiptDialog}
          receiptNumber={receiptData.receiptNumber}
          items={receiptData.items}
          total={receiptData.total}
          paymentMethod={receiptData.paymentMethod}
        />
      )}
    </div>
  );
};

export default POS;
