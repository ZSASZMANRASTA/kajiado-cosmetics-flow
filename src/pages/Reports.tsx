import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Calendar, TrendingUp, ShoppingCart, CreditCard } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

const Reports = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case 'month':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    }
  };

  const { data: salesData } = useQuery({
    queryKey: ['sales-report', dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();
      
      const { data: sales, error } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (*)
        `)
        .gte('sale_date', start.toISOString())
        .lte('sale_date', end.toISOString())
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return sales || [];
    },
  });

  const totalRevenue = salesData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
  const totalTransactions = salesData?.length || 0;
  const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  const paymentMethodStats = salesData?.reduce((acc, sale) => {
    acc[sale.payment_method] = (acc[sale.payment_method] || 0) + Number(sale.total_amount);
    return acc;
  }, {} as Record<string, number>) || {};

  const downloadCSV = () => {
    if (!salesData || salesData.length === 0) return;

    const headers = ['Date', 'Receipt', 'Total Amount', 'Payment Method', 'Items'];
    const rows = salesData.map(sale => [
      format(new Date(sale.sale_date), 'yyyy-MM-dd HH:mm'),
      sale.receipt_number,
      sale.total_amount,
      sale.payment_method,
      sale.sale_items?.length || 0,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
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
          
          <Button onClick={downloadCSV} disabled={!salesData || salesData.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4">
        <div className="flex gap-2">
          <Button
            variant={dateRange === 'today' ? 'default' : 'outline'}
            onClick={() => setDateRange('today')}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Today
          </Button>
          <Button
            variant={dateRange === 'week' ? 'default' : 'outline'}
            onClick={() => setDateRange('week')}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Last 7 Days
          </Button>
          <Button
            variant={dateRange === 'month' ? 'default' : 'outline'}
            onClick={() => setDateRange('month')}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Last 30 Days
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {totalTransactions} transaction(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Transaction</CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {averageTransaction.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Per sale</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
              <CreditCard className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(paymentMethodStats).map(([method, amount]) => (
                  <div key={method} className="flex justify-between text-sm">
                    <span className="capitalize">{method}:</span>
                    <span className="font-medium">KES {amount.toFixed(2)}</span>
                  </div>
                ))}
                {Object.keys(paymentMethodStats).length === 0 && (
                  <p className="text-xs text-muted-foreground">No payments</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Date & Time</th>
                    <th className="p-2 text-left">Receipt</th>
                    <th className="p-2 text-left">Payment</th>
                    <th className="p-2 text-left">Items</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData?.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        {format(new Date(sale.sale_date), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="p-2 font-mono text-sm">
                        {sale.receipt_number}
                      </td>
                      <td className="p-2">
                        <span className="capitalize">{sale.payment_method}</span>
                      </td>
                      <td className="p-2">
                        {sale.sale_items?.length || 0} item(s)
                      </td>
                      <td className="p-2 text-right font-bold text-primary">
                        KES {Number(sale.total_amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {(!salesData || salesData.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No sales in this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reports;
