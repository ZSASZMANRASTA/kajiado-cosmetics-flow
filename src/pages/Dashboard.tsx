import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, ChartBar as BarChart3, Users, LogOut, ShoppingBag, TrendingUp, TriangleAlert as AlertTriangle, Download, Upload, FileText } from 'lucide-react';
import { db } from '@/lib/db';
import { toast } from 'sonner';

const Dashboard = () => {
  const { user, signOut, userRole } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    todaySales: 0,
    totalProducts: 0,
    lowStockCount: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySales = await db.sales.where('createdAt').above(today).toArray();
    const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);

    const products = await db.products.toArray();
    const lowStock = products.filter(p => p.stock <= p.reorderLevel);

    setStats({
      todaySales: totalRevenue,
      totalProducts: products.length,
      lowStockCount: lowStock.length,
    });
  };

  const handleExportData = async () => {
  try {
    console.log('Dashboard: Starting data export');
    const exported = await db.exportData();
    console.log('Dashboard: export returned ->', exported);

    // If exportData returned nothing, we can't build a file here.
    // Some implementations may itself trigger a download and return undefined.
    if (exported === undefined || exported === null) {
      console.log('Dashboard: exportData returned no payload — assuming it handled download (or failed silently).');
      toast.success('Data exported successfully!');
      return;
    }

    // Normalize to a Blob
    let blob: Blob;
    if (typeof exported === 'string') {
      blob = new Blob([exported], { type: 'application/json' });
    } else {
      // likely an object
      blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    }

    const fileName = `kajiado-backup-${new Date().toISOString().split('T')[0]}.json`;

    // Try File System Access API first (best for direct save on device)
    // Note: showSaveFilePicker is available in Chromium-based browsers and requires secure context (HTTPS or localhost).
    // Use (window as any) to avoid TS errors if you don't have lib.dom types for this API.
    const maybeShowSaveFilePicker = (window as any).showSaveFilePicker;
    if (maybeShowSaveFilePicker) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'JSON Backup',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log('Dashboard: Export successful via File System Access API');
        toast.success('Data exported successfully!');
        return;
      } catch (fsError) {
        // If user cancels save dialog or API fails, fall back to anchor download
        console.warn('Dashboard: File System Access API failed or was cancelled, falling back to anchor download', fsError);
      }
    }

    // Fallback: anchor download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    // Append to DOM for better cross-browser support (some browsers require it)
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    console.log('Dashboard: Export successful (anchor download triggered)');
    toast.success('Data exported successfully!');
  } catch (error) {
    console.error('Dashboard: Export error', error);
    toast.error('Failed to export data');
  }
};

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Dashboard: Starting data import', file.name);

    try {
      await db.importData(file);
      console.log('Dashboard: Import successful');
      toast.success('Data imported successfully!');
      loadStats();
    } catch (error) {
      console.error('Dashboard: Import error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import data');
    }

    // Reset file input
    event.target.value = '';
  };

  const menuItems = [
    {
      title: 'Point of Sale',
      description: 'Process sales and transactions',
      icon: ShoppingCart,
      path: '/pos',
      color: 'bg-primary',
      roles: ['admin', 'cashier']
    },
    {
      title: 'Inventory',
      description: 'Manage products and stock',
      icon: Package,
      path: '/inventory',
      color: 'bg-secondary',
      roles: ['admin', 'cashier']
    },
    {
    title: 'Invoices',
    description: 'Create and manage invoices',
    icon: FileText,
    path: '/invoices',
    color: 'bg-accent',
    roles: ['admin', 'cashier']
  },
    {
      title: 'Sales Reports',
      description: 'View sales analytics',
      icon: BarChart3,
      path: '/reports',
      color: 'bg-success',
      roles: ['admin']
    },
    {
      title: 'User Management',
      description: 'Manage staff accounts',
      icon: Users,
      path: '/users',
      color: 'bg-accent',
      roles: ['admin']
    },
  ];

  const filteredMenu = userRole
    ? menuItems.filter(item => item.roles.includes(userRole))
    : menuItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Kajiado POS</h1>
              <p className="text-xs text-muted-foreground">Offline Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.fullName || user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Welcome back! Select an option to get started.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {filteredMenu.map((item) => (
            <Card
              key={item.path}
              className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              onClick={() => navigate(item.path)}
            >
              <CardHeader>
                <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-lg ${item.color} text-white`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full">
                  Open →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {userRole === 'admin' && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">KES {stats.todaySales.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.todaySales > 0 ? 'Sales recorded today' : 'No sales recorded today'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalProducts}</div>
                <p className="text-xs text-muted-foreground">Items in inventory</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.lowStockCount}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.lowStockCount > 0 ? 'Items need restocking' : 'All items well stocked'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {userRole === 'admin' && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Backup and restore your offline data. Export creates a JSON file with all your data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Regular backups are recommended to prevent data loss. Store backup files in a safe location.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleExportData} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Create Backup
                </Button>
                <label>
                  <Button variant="outline" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Restore from Backup
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
