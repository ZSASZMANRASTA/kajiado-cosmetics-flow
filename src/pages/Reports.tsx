import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { SalesCSVImport } from '@/components/reports/SalesCSVImport';

// VAT settings
const VAT_RATE = 0.16; // 16%
const VAT_INCLUSIVE = true; // prices are VAT-inclusive

const Reports = () => {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    salesCount: 0,
    totalVAT: 0,
    netRevenue: 0,
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [itemStats, setItemStats] = useState<any[]>([]);
  const [expandedSales, setExpandedSales] = useState<Set<number>>(new Set());
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  useEffect(() => {
    loadReports();
  }, [dateFilter, paymentFilter]);

  const calculateVATForAmount = (amount: number) => {
    if (VAT_INCLUSIVE) {
      return amount * VAT_RATE / (1 + VAT_RATE);
    } else {
      return amount * VAT_RATE;
    }
  };

  const loadReports = async () => {
    let salesQuery = db.sales.reverse();

    // Get all sales first
    let sales = await salesQuery.toArray();

    // Filter by cashier if not admin
    if (userRole === 'cashier' && user?.id) {
      sales = sales.filter(s => s.cashierId === user.id);
    }

    // Filter by date
    const now = new Date();
    if (dateFilter === 'today') {
      const start = startOfDay(now);
      const end = endOfDay(now);
      sales = sales.filter(s => new Date(s.createdAt) >= start && new Date(s.createdAt) <= end);
    } else if (dateFilter === 'this-month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      sales = sales.filter(s => new Date(s.createdAt) >= start && new Date(s.createdAt) <= end);
    } else if (dateFilter === 'this-year') {
      const start = startOfYear(now);
      const end = endOfYear(now);
      sales = sales.filter(s => new Date(s.createdAt) >= start && new Date(s.createdAt) <= end);
    }

    // Filter by payment method
    if (paymentFilter !== 'all') {
      sales = sales.filter(s => s.paymentMethod === paymentFilter);
    }

    // Limit to 50 most recent
    sales = sales.slice(0, 50);

    const saleItems = await db.saleItems.toArray();
    const products = await db.products.toArray();

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalVAT = 0;

    for (const sale of sales) {
      totalRevenue += sale.totalAmount;

      const items = saleItems.filter(item => item.saleId === sale.id);
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const profit = (item.price - product.buyingPrice) * item.quantity;
          totalProfit += profit;
        }
        // Compute VAT per item (authoritative) and accumulate
        const itemVAT = calculateVATForAmount(item.subtotal);
        totalVAT += itemVAT;
      }
    }

    const netRevenue = totalRevenue - totalVAT;

    setStats({
      totalSales: sales.length,
      totalRevenue,
      totalProfit,
      salesCount: sales.length,
      totalVAT,
      netRevenue,
    });

    // Calculate item statistics
    const itemStatsMap = new Map<number, {
      productId: number;
      productName: string;
      quantitySold: number;
      revenue: number; // gross (includes VAT)
      profit: number;
      salesCount: number;
      vat: number;
      netRevenue: number;
    }>();

    for (const sale of sales) {
      const items = saleItems.filter(item => item.saleId === sale.id);
      for (const item of items) {
        const existing = itemStatsMap.get(item.productId);
        const product = products.find(p => p.id === item.productId);
        const profit = product ? (item.price - product.buyingPrice) * item.quantity : 0;
        const itemVAT = calculateVATForAmount(item.subtotal);
        const itemNet = item.subtotal - itemVAT;

        if (existing) {
          existing.quantitySold += item.quantity;
          existing.revenue += item.subtotal;
          existing.profit += profit;
          existing.salesCount += 1;
          existing.vat += itemVAT;
          existing.netRevenue += itemNet;
        } else {
          itemStatsMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            quantitySold: item.quantity,
            revenue: item.subtotal,
            profit,
            salesCount: 1,
            vat: itemVAT,
            netRevenue: itemNet,
          });
        }
      }
    }

    const sortedItemStats = Array.from(itemStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue);

    setItemStats(sortedItemStats);

    // Attach items to each sale (include VAT/net per item and per sale)
    const salesWithItems = await Promise.all(
      sales.map(async (sale) => {
        const items = saleItems
          .filter(item => item.saleId === sale.id)
          .map(item => {
            const vat = calculateVATForAmount(item.subtotal);
            const net = item.subtotal - vat;
            return { ...item, vat, net };
          });
        const saleVAT = items.reduce((acc, it) => acc + it.vat, 0);
        const saleNet = sale.totalAmount - saleVAT;
        return { ...sale, items, saleVAT, saleNet };
      })
    );

    setRecentSales(salesWithItems);
  };

  const toggleSaleExpansion = (saleId: number) => {
    setExpandedSales(prev => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });
  };

  const exportToCSV = async () => {
    if (itemStats.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Create item statistics CSV (adding VAT and Net Revenue columns)
    const itemExportData = itemStats.map((item, idx) => ({
      'Rank': idx + 1,
      'Product': item.productName,
      'Quantity Sold': item.quantitySold,
      'Times Sold': item.salesCount,
      'Revenue (Gross KES)': item.revenue.toFixed(2),
      'VAT (KES)': item.vat.toFixed(2),
      'Net Revenue (KES)': item.netRevenue.toFixed(2),
      'Profit (KES)': item.profit.toFixed(2),
      'Avg Price (KES)': (item.quantitySold ? (item.revenue / item.quantitySold) : 0).toFixed(2),
    }));

    const csv = Papa.unparse(itemExportData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Product sales CSV exported (now includes VAT and Net Revenue columns)');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Sales Reports</h1>
          </div>
          <div className="flex gap-2">
            {userRole === 'admin' && <SalesCSVImport />}
            <Button onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4">
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.salesCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Revenue (Gross)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">KES {stats.totalRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">VAT Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">KES {stats.totalVAT.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Net Revenue (Excl. VAT)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">KES {stats.netRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">KES {stats.totalProfit.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sales by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-right">Qty Sold</th>
                    <th className="p-2 text-right">Times Sold</th>
                    <th className="p-2 text-right">Revenue (Gross)</th>
                    <th className="p-2 text-right">VAT</th>
                    <th className="p-2 text-right">Net Revenue</th>
                    <th className="p-2 text-right">Profit</th>
                    <th className="p-2 text-right">Avg Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {itemStats.map((item, idx) => (
                    <tr key={item.productId} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                          <span className="font-medium">{item.productName}</span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-semibold">{item.quantitySold}</td>
                      <td className="p-2 text-right">{item.salesCount}</td>
                      <td className="p-2 text-right font-bold">KES {item.revenue.toFixed(2)}</td>
                      <td className="p-2 text-right">KES {item.vat.toFixed(2)}</td>
                      <td className="p-2 text-right">KES {item.netRevenue.toFixed(2)}</td>
                      <td className="p-2 text-right font-bold text-green-600">
                        KES {item.profit.toFixed(2)}
                      </td>
                      <td className="p-2 text-right text-sm text-muted-foreground">
                        KES {(item.quantitySold ? (item.revenue / item.quantitySold) : 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {itemStats.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">No product sales data</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left w-8"></th>
                    <th className="p-2 text-left">Receipt</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Cashier</th>
                    <th className="p-2 text-left">Payment</th>
                    <th className="p-2 text-right">VAT</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <>
                      <tr 
                        key={sale.id} 
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleSaleExpansion(sale.id)}
                      >
                        <td className="p-2">
                          {expandedSales.has(sale.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="p-2">{sale.receiptNumber}</td>
                        <td className="p-2">{new Date(sale.createdAt).toLocaleString()}</td>
                        <td className="p-2">{sale.cashierName}</td>
                        <td className="p-2 capitalize">{sale.paymentMethod}</td>
                        <td className="p-2 text-right">KES {(sale.saleVAT ?? calculateVATForAmount(sale.totalAmount)).toFixed(2)}</td>
                        <td className="p-2 text-right font-bold">KES {sale.totalAmount.toFixed(2)}</td>
                      </tr>
                      {expandedSales.has(sale.id) && sale.items && sale.items.length > 0 && (
                        <tr key={`${sale.id}-items`}>
                          <td colSpan={7} className="p-0">
                            <div className="bg-muted/30 p-4">
                              <p className="text-sm font-semibold mb-2">Items Sold:</p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border/50">
                                    <th className="p-2 text-left">Product</th>
                                    <th className="p-2 text-right">Qty</th>
                                    <th className="p-2 text-right">Price</th>
                                    <th className="p-2 text-right">Subtotal (Gross)</th>
                                    <th className="p-2 text-right">VAT</th>
                                    <th className="p-2 text-right">Net</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sale.items.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-b border-border/30">
                                      <td className="p-2">{item.productName}</td>
                                      <td className="p-2 text-right">{item.quantity}</td>
                                      <td className="p-2 text-right">KES {item.price.toFixed(2)}</td>
                                      <td className="p-2 text-right">KES {item.subtotal.toFixed(2)}</td>
                                      <td className="p-2 text-right">KES {item.vat.toFixed(2)}</td>
                                      <td className="p-2 text-right">KES {item.net.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {recentSales.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">No sales found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reports;