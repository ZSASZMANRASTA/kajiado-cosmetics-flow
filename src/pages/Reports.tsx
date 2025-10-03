import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download } from 'lucide-react';
import { db } from '@/lib/db';
import Papa from 'papaparse';

const Reports = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    salesCount: 0,
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const sales = await db.sales.reverse().limit(50).toArray();
    const saleItems = await db.saleItems.toArray();
    const products = await db.products.toArray();

    let totalRevenue = 0;
    let totalProfit = 0;

    for (const sale of sales) {
      totalRevenue += sale.totalAmount;

      const items = saleItems.filter(item => item.saleId === sale.id);
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const profit = (item.price - product.buyingPrice) * item.quantity;
          totalProfit += profit;
        }
      }
    }

    setStats({
      totalSales: sales.length,
      totalRevenue,
      totalProfit,
      salesCount: sales.length,
    });

    setRecentSales(sales);
  };

  const exportToCSV = async () => {
    const sales = await db.sales.toArray();
    const saleItems = await db.saleItems.toArray();

    const exportData = [];
    for (const sale of sales) {
      const items = saleItems.filter(item => item.saleId === sale.id);
      for (const item of items) {
        exportData.push({
          'Receipt Number': sale.receiptNumber,
          'Date': new Date(sale.createdAt).toLocaleString(),
          'Product': item.productName,
          'Quantity': item.quantity,
          'Price': item.price,
          'Subtotal': item.subtotal,
          'Payment Method': sale.paymentMethod,
          'Cashier': sale.cashierName,
          'Total': sale.totalAmount,
        });
      }
    }

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          <Button onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4">
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
              <CardTitle className="text-sm">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">KES {stats.totalRevenue.toFixed(2)}</p>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Avg Sale Value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                KES {stats.salesCount > 0 ? (stats.totalRevenue / stats.salesCount).toFixed(2) : '0.00'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Receipt</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Cashier</th>
                    <th className="p-2 text-left">Payment</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">{sale.receiptNumber}</td>
                      <td className="p-2">{new Date(sale.createdAt).toLocaleString()}</td>
                      <td className="p-2">{sale.cashierName}</td>
                      <td className="p-2 capitalize">{sale.paymentMethod}</td>
                      <td className="p-2 text-right font-bold">KES {sale.totalAmount.toFixed(2)}</td>
                    </tr>
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
